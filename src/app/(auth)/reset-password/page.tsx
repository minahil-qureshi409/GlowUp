import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getOptionalUser } from '@/server/auth';

export const metadata: Metadata = { title: 'Set a new password' };
// The recovery session is read per request; nothing here can be prerendered.
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  // `/auth/callback` has already exchanged the recovery code for a session, so
  // the presence of a user *is* the proof the link was valid. Checking here
  // rather than in the form means an expired link shows an explanation
  // instead of a password box that will fail on submit.
  const user = await getOptionalUser();

  return <ResetPasswordForm hasSession={user !== null} />;
}
