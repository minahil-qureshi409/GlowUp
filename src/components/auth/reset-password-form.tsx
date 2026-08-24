'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AuthHeading, Field, FormError, SubmitButton } from '@/components/auth/auth-form';
import { resetPassword } from '@/server/actions/auth';
import {
  PASSWORD_RULE,
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@/lib/validation/schemas';

/**
 * Sets a new password.
 *
 * Reached from the emailed recovery link, which `/auth/callback` has already
 * exchanged for a session — so by the time this form submits the user is
 * signed in as themselves and `updateUser` needs no token of its own. On
 * success they stay signed in and go straight to the app; asking someone to log
 * in again with the password they just typed is busywork.
 */
export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm_password: '' },
  });

  function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    if (pending) return;

    startTransition(async () => {
      const result = await resetPassword(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success('Password updated.');
      router.push('/today');
      router.refresh();
    });
  }

  if (!hasSession) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <h1 className="font-display text-xl">That link has expired</h1>
        <p className="text-sm text-muted-foreground">
          Reset links are single use and last an hour. Ask for a fresh one and it will work.
        </p>
        <Button variant="brand" asChild className="w-full">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading body="Choose a new password. You will stay signed in on this device." />

      <form onSubmit={form.handleSubmit(onSubmit)} className="surface-card space-y-4 p-6" noValidate>
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_RULE}
          error={form.formState.errors.password?.message}
          register={form.register('password')}
        />

        <Field
          id="confirm_password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirm_password?.message}
          register={form.register('confirm_password')}
        />

        <FormError message={formError} />

        <SubmitButton pending={pending} label="Save new password" pendingLabel="Saving…" />
      </form>
    </div>
  );
}
