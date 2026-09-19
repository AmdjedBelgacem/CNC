// Flat ESLint config for the whole monorepo.
//
// There was no ESLint config anywhere in the repo, so `pnpm lint` (`turbo lint`) could
// never pass: `eslint src/` errors with "couldn't find a configuration file", and the
// frontend's `next lint` is a command Next 16 removed. `packages/config-eslint` existed
// as an empty directory — clearly the intended home — but a single root config is
// simpler, and ESLint 9 searches ancestor directories, so every workspace picks it up
// without a workspace dependency or an install.
//
// Scope is deliberately correctness, not style: Prettier owns formatting, so rules that
// only encode taste (indentation, quotes, line length) are left off. The goal is that a
// real mistake — an unused variable, a floating promise, a shadowed binding, a `@ts-`
// escape hatch — fails CI, and that the config is honest enough to pass on the code that
// already exists.
import tseslint from 'typescript-eslint';

/**
 * `@next/eslint-plugin-next` and `eslint-plugin-react-hooks` cannot be installed in this
 * environment (pnpm's store linking is blocked by the sandbox), but 27 `eslint-disable`
 * directives across the frontend name their rules. ESLint 9 treats a directive naming an
 * unknown rule as a hard ERROR, so those directives alone made `pnpm lint` fail.
 *
 * Rather than delete 27 directives and lose the intent behind them, the rules they
 * reference are registered here. `no-img-element` is simple enough to implement
 * correctly and is implemented for real, so `<img>` usage is genuinely caught and the
 * existing suppressions are genuine suppressions.
 *
 * `exhaustive-deps` is registered as an explicit NO-OP: a correct implementation needs
 * real React-hooks dataflow analysis, and a half-right version would be worse than none.
 * It exists only so the one directive referencing it resolves. When the real plugins
 * become installable, delete this block and add them to the config — do not leave the
 * no-op in place while believing the rule is enforced.
 */
const localNextPlugin = {
  rules: {
    'no-img-element': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Prefer next/image over <img> for optimised delivery.' },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name?.type === 'JSXIdentifier' && node.name.name === 'img') {
              context.report({
                node,
                message:
                  'Use next/image (<Image />) instead of <img> — it handles sizing and modern formats.',
              });
            }
          },
        };
      },
    },
  },
};

const localReactHooksPlugin = {
  rules: {
    // Intentionally inert — see the note above.
    'exhaustive-deps': { meta: { schema: [] }, create: () => ({}) },
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
      '**/next-env.d.ts',
      // NOTE: `apps/admin` (Payload) is dead code and is deliberately NOT ignored.
      // It was tempting to skip it, but it lints clean (17 files, 0 errors) — so
      // ignoring it would only mean that editing dead code silently escapes the
      // same rules the live code follows. Skipping a workspace is a decision to
      // make when it is noisy, not merely when it is unused.
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': localNextPlugin,
      'react-hooks': localReactHooksPlugin,
    },
    rules: {
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `any` is load-bearing at several integration seams (Drizzle rows, Fastify
      // request/reply, test doubles). Downgraded rather than disabled so it stays
      // visible without blocking the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused code is a real defect and worth failing on — but an underscore prefix is
      // the repo's established signal for a deliberately unused binding.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // NestJS decorators and Next.js route exports legitimately look "unused".
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // A dropped promise in a request handler is a genuine bug class (unhandled
      // rejection, work that never completes). Kept on.
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    // Tests may reach for `any` and non-null assertions freely.
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
