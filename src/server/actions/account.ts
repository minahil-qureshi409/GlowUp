'use server';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, ok, type ActionResult } from '@/server/actions/result';
import { deleteAccount } from '@/services/account';
import { createClient } from '@/lib/supabase/server';

/**
 * Deletes the account, permanently.
 *
 * Guarded by a typed confirmation rather than a checkbox: this removes every
 * weigh-in, workout, routine and progress photo, and there is no undo. The
 * password is not re-checked because Supabase gives a server action no way to
 * verify one without signing in again — the typed phrase plus an authenticated
 * session is the bar, and it is stated plainly in the dialog.
 */
const CONFIRMATION = 'DELETE';

export async function deleteMyAccount(confirmation: string): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();

  if (confirmation.trim().toUpperCase() !== CONFIRMATION) {
    return fail(`Type ${CONFIRMATION} to confirm.`);
  }

  try {
    await deleteAccount(supabase, userId);
  } catch (error) {
    return fromUnknownError(error, 'deleteMyAccount');
  }

  // The session cookie outlives the user row, so it has to be cleared
  // explicitly or the next request holds a JWT for an account that is gone.
  const client = await createClient();
  await client.auth.signOut();

  return ok();
}
