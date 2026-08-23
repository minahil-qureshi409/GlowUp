'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fail, fromZodError, ok, type ActionResult } from '@/server/actions/result';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/schemas';
import { siteUrl } from '@/lib/env';
import { safeRedirect } from '@/lib/safe-redirect';
import {
  AUTH_LIMITS,
  checkAll,
  clientIp,
  resetRateLimit,
  tooManyAttemptsMessage,
} from '@/lib/rate-limit';

/**
 * One message for every sign-in failure.
 *
 * "No account with that email" and "wrong password" are different facts, and
 * telling them apart turns the login form into an account-existence oracle:
 * feed it an address list and it reports which ones are registered. For a
 * health app that list is itself sensitive.
 */
const SIGN_IN_FAILURE = "That email and password don't match.";

async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

export async function signIn(
  input: unknown,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await requestIp();
  const email = parsed.data.email.toLowerCase();

  // Both dimensions are consumed on every attempt: the IP key stops one machine
  // working through an address list, the email key stops a distributed run at
  // one account.
  const limit = checkAll([`signin:ip:${ip}`, `signin:email:${email}`], AUTH_LIMITS.signIn);
  if (!limit.ok) return fail(tooManyAttemptsMessage(limit.retryAfterSeconds));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return fail(SIGN_IN_FAILURE);

  // A successful sign-in clears the budget, so someone who mistyped twice and
  // then got it right is not still throttled on their next visit.
  resetRateLimit(`signin:ip:${ip}`);
  resetRateLimit(`signin:email:${email}`);

  // `next` is attacker-controlled — it arrives in the query string. Only a
  // same-origin relative path survives; everything else falls back to /today.
  return ok({ redirectTo: safeRedirect(next) });
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await requestIp();
  const email = parsed.data.email.toLowerCase();

  const limit = checkAll([`signup:ip:${ip}`, `signup:email:${email}`], AUTH_LIMITS.signUp);
  if (!limit.ok) return fail(tooManyAttemptsMessage(limit.retryAfterSeconds));

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      // Read by the `handle_new_user` trigger to pre-fill the profile.
      data: parsed.data.display_name ? { display_name: parsed.data.display_name } : undefined,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return fail('There is already an account with that email. Try signing in instead.');
    }
    return fail(error.message);
  }

  // With email confirmation on, Supabase returns a user but no session.
  const needsConfirmation = !data.session;
  return ok({ needsConfirmation });
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Starts a password reset.
 *
 * Always reports the same thing, whether or not the address has an account —
 * for the same reason the sign-in error is vague. The rate limit is per email
 * as well as per IP, because an unlimited reset endpoint is a way to have a
 * stranger's inbox filled on request.
 */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await requestIp();
  const email = parsed.data.email.toLowerCase();

  const limit = checkAll([`reset:ip:${ip}`, `reset:email:${email}`], AUTH_LIMITS.passwordReset);
  if (!limit.ok) return fail(tooManyAttemptsMessage(limit.retryAfterSeconds));

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });

  return ok();
}

/**
 * Finishes a password reset.
 *
 * By the time this runs the recovery link has already been exchanged for a
 * session by `/auth/callback`, so `updateUser` is authenticated as the person
 * who opened the email. No session means the link was never opened, was used
 * twice, or has expired.
 */
export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail('That reset link has expired or has already been used. Request a new one.');
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);

  return ok();
}
