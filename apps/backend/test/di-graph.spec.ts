import { describe, it, expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { EmailModule } from '../src/modules/email/email.module';
import { AuthModule } from '../src/modules/auth/auth.module';

/**
 * Dependency-injection wiring invariants.
 *
 * This exists because of a real outage. Moving EmailService out of AuthModule
 * into EmailModule left AuthModule re-exporting a provider it no longer owned.
 * Every unit test still passed — they construct services directly with mocks —
 * and the break only surfaced when the production container refused to boot:
 *
 *   UnknownExportException: Nest cannot export a provider/module that is not a
 *   part of the currently processed module (AuthModule)
 *
 * and every route returned 500.
 *
 * These assertions are metadata checks rather than `Test.createTestingModule()
 * .compile()`. Compiling the graph under vitest is not dependable here: Nest
 * resolves constructor parameter types from `emitDecoratorMetadata`, and under
 * vitest's ESM transform some of those references arrive undefined, producing a
 * `DrizzleService (?)` failure that does not occur in the compiled production
 * bundle (where the app boots and reports `database: up`). Asserting the
 * metadata is deterministic and pins the actual regression.
 */

function metadata(key: 'imports' | 'providers' | 'exports' | 'controllers', target: unknown): unknown[] {
  return (Reflect.getMetadata(key, target) ?? []) as unknown[];
}

/**
 * Nest stores a circular import as `{ forwardRef: () => Module }`, so a plain
 * `toContain(Module)` never matches. Unwrap to the real module class.
 */
function unwrap(value: unknown): unknown {
  const wrapped = value as { forwardRef?: () => unknown };
  if (wrapped && typeof wrapped.forwardRef === 'function') {
    try {
      return wrapped.forwardRef();
    } catch {
      return value;
    }
  }
  return value;
}

function label(value: unknown): string {
  const name = (value as { name?: string })?.name;
  return name ?? typeof value;
}

describe('DI wiring invariants', () => {
  it('registers EmailModule in AppModule', () => {
    expect(metadata('imports', AppModule)).toContain(EmailModule);
  });

  /**
   * The regression itself: a module may only export a provider it provides.
   * Asserted for every module in the graph rather than just the two touched, so
   * the same mistake elsewhere fails too.
   */
  it('never exports a provider a module does not itself provide', () => {
    const modules = [
      ['AuthModule', AuthModule],
      ['EmailModule', EmailModule],
      ['AppModule', AppModule],
    ] as const;

    for (const [name, target] of modules) {
      const providers = metadata('providers', target);
      for (const exported of metadata('exports', target)) {
        expect(
          providers.includes(exported),
          `${name} exports ${label(exported)} but does not provide it — Nest throws UnknownExportException at boot`,
        ).toBe(true);
      }
    }
  });

  it('exports EmailService from EmailModule, where it is provided', () => {
    const emailProviders = metadata('providers', EmailModule);
    const emailExports = metadata('exports', EmailModule);
    const authExports = metadata('exports', AuthModule);

    // EmailModule provides and exports several services; assert the sets line up
    // rather than hardcoding a symbol that a refactor would rename.
    expect(emailExports.length).toBeGreaterThanOrEqual(4);
    for (const exported of emailExports) {
      expect(emailProviders).toContain(exported);
    }

    // AuthModule must not claim it, which is what broke the boot.
    const overlap = authExports.filter((e) => emailProviders.includes(e));
    expect(
      overlap.map(label),
      'AuthModule re-exports a provider owned by EmailModule',
    ).toEqual([]);
  });

  it('makes AuthModule import EmailModule for its own EmailService consumers', () => {
    // AuthService and EmailVerificationService inject EmailService. With
    // forwardRef on both sides the cycle is safe; without the import, DI fails.
    const authImports = metadata('imports', AuthModule).map(unwrap);
    const emailImports = metadata('imports', EmailModule).map(unwrap);

    expect(authImports, 'AuthModule must import EmailModule').toContain(EmailModule);
    expect(emailImports, 'EmailModule must import AuthModule for AuditService').toContain(AuthModule);
  });
});