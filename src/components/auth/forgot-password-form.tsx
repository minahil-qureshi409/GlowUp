'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthHeading, Field, FormError, SubmitButton } from '@/components/auth/auth-form';
import { requestPasswordReset } from '@/server/actions/auth';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/schemas';

/**
 * "Forgot password".
 *
 * The confirmation is identical whether or not the address has an account. A
 * form that says "no account with that email" is a free membership check, and
 * the whole point of the vague sign-in error is undone if this screen answers
 * the same question.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    if (pending) return;

    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (!result.ok) {
        // Only ever a rate limit or a malformed address — never "no such user".
        setFormError(result.error);
        return;
      }
      setSent(values.email);
    });
  }

  if (sent) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden="true" />
        <h1 className="font-display text-xl font-semibold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{sent}</span> has a GlowUp account, a
          reset link is on its way. It expires in an hour.
        </p>
        <p className="text-xs text-muted-foreground">
          Nothing there? Check spam, and make sure you typed the address you signed up with.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading body="Enter your email and we will send you a link to set a new password." />

      <form onSubmit={form.handleSubmit(onSubmit)} className="surface-card space-y-4 p-6" noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
          register={form.register('email')}
        />

        <FormError message={formError} />

        <SubmitButton pending={pending} label="Send reset link" pendingLabel="Sending…" />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
