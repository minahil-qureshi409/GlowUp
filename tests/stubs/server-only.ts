/**
 * Stand-in for Next's `server-only` package under Vitest.
 *
 * `server-only` exists to make a build fail if a server module is imported into
 * a client bundle. There is no bundle here, so it resolves to nothing.
 */
export {};
