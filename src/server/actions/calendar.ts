'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/server/auth';
import { fail, fromUnknownError, ok, type ActionResult } from '@/server/actions/result';
import { isProviderId } from '@/lib/calendar/registry';
import { disconnectCalendar, syncBusyWindow, SYNC_WINDOW_DAYS } from '@/services/calendar';
import { getUserContext } from '@/services/profile';
import type { Enums } from '@/lib/db/database.types';

/**
 * Pulls the next two weeks of busy blocks.
 *
 * Two weeks is the horizon the planner and weekly view actually use — asking
 * for more would mean holding more of someone's schedule than the app needs.
 */
export async function syncCalendar(
  provider: Enums<'calendar_provider'> = 'google',
): Promise<ActionResult<{ synced: number }>> {
  const { supabase, userId } = await requireUser();

  if (!isProviderId(provider)) return fail('That calendar provider is not available yet.');

  try {
    const context = await getUserContext(supabase, userId);
    const now = new Date();

    const result = await syncBusyWindow(
      userId,
      provider,
      { from: now, to: new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      context.profile.timezone,
    );

    revalidatePath('/calendar');
    revalidatePath('/today');
    return ok(result);
  } catch (error) {
    return fromUnknownError(error, 'syncCalendar');
  }
}

/**
 * Removes a calendar connection.
 *
 * Deletes the tokens and every cached busy block. Revocation at the provider is
 * attempted first but never blocks: disconnect always disconnects.
 */
export async function disconnect(
  provider: Enums<'calendar_provider'> = 'google',
): Promise<ActionResult> {
  const { userId } = await requireUser();

  if (!isProviderId(provider)) return fail('That calendar provider is not available yet.');

  try {
    await disconnectCalendar(userId, provider);
    revalidatePath('/calendar');
    revalidatePath('/today');
    return ok();
  } catch (error) {
    return fromUnknownError(error, 'disconnectCalendar');
  }
}
