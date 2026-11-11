import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * The slice of a Postgres error the mapping needs. Drizzle wraps the driver error in a
 * `DrizzleQueryError` and keeps the original on `.cause`, so the code lives one level down.
 */
export interface PgErrorShape {
  code: string;
  column_name?: string;
  table_name?: string;
  constraint_name?: string;
  detail?: string;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

/** Finds the Postgres error inside whatever was thrown, or null when this is not one. */
export function findPgError(error: unknown): PgErrorShape | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; severity?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && SQLSTATE.test(candidate.code) && 'severity' in candidate) {
      return current as PgErrorShape;
    }
    current = candidate.cause;
  }
  return null;
}

function hasCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const camel = (snake: string) => snake.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

export interface MappedDatabaseError {
  status: HttpStatus;
  message: string;
}

/**
 * Turns a constraint or type violation into the status a client can act on.
 *
 * The API accepts plenty of bodies the validation pipe never sees (inline types), so a missing
 * field used to reach the database and come back as a 500 "Internal server error". That is the
 * caller's mistake, not the server's, and it also drowned real failures in error alerts.
 * Anything not listed here stays a 500.
 */
export function mapDatabaseError(error: unknown): MappedDatabaseError | null {
  // Raised by the driver, before any SQL runs: a body field the handler passed along was never sent.
  if (hasCode(error, 'UNDEFINED_VALUE')) {
    return { status: HttpStatus.BAD_REQUEST, message: 'A required value is missing' };
  }
  // Drizzle refuses an UPDATE with nothing to set, which is what an empty PATCH body produces.
  if (error instanceof Error && error.message === 'No values to set') {
    return { status: HttpStatus.BAD_REQUEST, message: 'There is nothing to update' };
  }
  const pg = findPgError(error);
  if (!pg) return null;
  switch (pg.code) {
    case '23502': // not_null_violation
      return {
        status: HttpStatus.BAD_REQUEST,
        message: pg.column_name ? `${camel(pg.column_name)} should not be empty` : 'A required field is missing',
      };
    case '23503': // foreign_key_violation
      return /is still referenced/i.test(pg.detail ?? '')
        ? { status: HttpStatus.CONFLICT, message: 'This record is still in use and cannot be deleted' }
        : { status: HttpStatus.BAD_REQUEST, message: 'A referenced record does not exist' };
    case '23505': // unique_violation
      return { status: HttpStatus.CONFLICT, message: 'A record with these details already exists' };
    case '23514': // check_violation
      return { status: HttpStatus.BAD_REQUEST, message: 'A value is outside the allowed range' };
    case '22P02': // invalid_text_representation (a malformed uuid, number, enum...)
    case '22001': // string_data_right_truncation
    case '22003': // numeric_value_out_of_range
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return { status: HttpStatus.BAD_REQUEST, message: 'A value has an invalid format' };
    default:
      return null;
  }
}

/** Applies {@link mapDatabaseError}; every other exception is handled exactly as before. */
@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly log = new Logger('DatabaseExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) return super.catch(exception, host);
    const mapped = mapDatabaseError(exception);
    if (!mapped) return super.catch(exception, host);
    const pg = findPgError(exception);
    this.log.warn(`${pg?.code} on ${pg?.table_name ?? '?'}${pg?.column_name ? `.${pg.column_name}` : ''} -> ${mapped.status}`);
    return super.catch(new HttpException({ statusCode: mapped.status, message: mapped.message, error: HttpStatus[mapped.status] }, mapped.status), host);
  }
}
