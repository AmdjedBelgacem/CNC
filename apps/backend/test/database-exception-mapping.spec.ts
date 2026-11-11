import { describe, expect, it } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { findPgError, mapDatabaseError } from '../src/common/http/database-exception.filter';

/** A DrizzleQueryError keeps the driver error on `.cause`. */
const drizzleError = (pg: Record<string, unknown>) =>
  Object.assign(new Error('Failed query: insert into ...'), { cause: { severity: 'ERROR', ...pg } });

describe('database errors map to the status a client can act on', () => {
  it('a missing required field is a 400 that names the field in camelCase', () => {
    const mapped = mapDatabaseError(drizzleError({ code: '23502', column_name: 'repair_shop_name' }));
    expect(mapped).toEqual({ status: HttpStatus.BAD_REQUEST, message: 'repairShopName should not be empty' });
  });

  it('a reference to a record that does not exist is a 400', () => {
    const mapped = mapDatabaseError(drizzleError({ code: '23503', detail: 'Key (course_id)=(x) is not present in table "courses".' }));
    expect(mapped?.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('deleting a record that is still referenced is a 409, not a 500', () => {
    const mapped = mapDatabaseError(drizzleError({ code: '23503', detail: 'Key (id)=(x) is still referenced from table "comments".' }));
    expect(mapped?.status).toBe(HttpStatus.CONFLICT);
  });

  it('a duplicate is a 409, and a malformed value is a 400', () => {
    expect(mapDatabaseError(drizzleError({ code: '23505' }))?.status).toBe(HttpStatus.CONFLICT);
    expect(mapDatabaseError(drizzleError({ code: '22P02' }))?.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('an undefined body field, and an empty PATCH, are 400s rather than server errors', () => {
    const undefinedValue = Object.assign(new Error('Failed query'), { cause: Object.assign(new Error('UNDEFINED_VALUE: Undefined values are not allowed'), { code: 'UNDEFINED_VALUE' }) });
    expect(mapDatabaseError(undefinedValue)?.status).toBe(HttpStatus.BAD_REQUEST);
    expect(mapDatabaseError(new Error('No values to set'))?.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('leaves everything else a 500, so a real failure is never disguised', () => {
    expect(mapDatabaseError(drizzleError({ code: '42P01' }))).toBeNull(); // undefined table
    expect(mapDatabaseError(drizzleError({ code: '57014' }))).toBeNull(); // query cancelled
    expect(mapDatabaseError(new Error('boom'))).toBeNull();
    expect(mapDatabaseError(null)).toBeNull();
  });

  it('does not expose the SQL or the row in the message', () => {
    const mapped = mapDatabaseError(drizzleError({ code: '23502', column_name: 'name', detail: 'Failing row contains (secret@example.com)' }));
    expect(JSON.stringify(mapped)).not.toMatch(/secret|insert into|Failing row/);
  });

  it('finds the driver error whether it is wrapped or thrown directly', () => {
    expect(findPgError(drizzleError({ code: '23505' }))?.code).toBe('23505');
    expect(findPgError({ code: '23505', severity: 'ERROR' })?.code).toBe('23505');
    // An application error that merely has a `code` field is not a Postgres error.
    expect(findPgError({ code: 'ENOENT' })).toBeNull();
  });
});
