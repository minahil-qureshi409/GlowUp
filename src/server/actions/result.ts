import type { z } from 'zod';

/**
 * The shape every Server Action returns.
 *
 * Actions never throw across the network boundary: a thrown error in production
 * reaches the client as an opaque digest, which gives the user nothing. Instead
 * every action resolves to a discriminated union the caller can render — a
 * message for the form, and field errors where the failure was per-field.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Flattens a Zod failure into the field-error map forms expect. */
export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? 'Please check the highlighted fields.';
  return fail(first, fieldErrors);
}

/**
 * Turns an unexpected failure into something safe to show.
 *
 * Postgres error codes are mapped to plain language where the cause is
 * actionable; anything else gets a generic message, and the detail is logged
 * server-side rather than leaked to the browser.
 */
export function fromUnknownError(error: unknown, context: string): ActionResult<never> {
  const code = (error as { code?: string } | null)?.code;

  if (code === '23505') return fail('That already exists.');
  if (code === '23503') return fail('That item no longer exists. Try refreshing.');
  if (code === '23514') return fail('That value is outside the allowed range.');
  if (code === '42501') return fail('You do not have access to that.');

  console.error(`[action:${context}]`, error);
  return fail('Something went wrong saving that. Please try again.');
}
