'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { signIn, signUp } from '@/server/actions/auth';
import {
  PASSWORD_RULE,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '@/lib/validation/schemas';
import { safeRedirect } from '@/lib/safe-redirect';
import { detectTimezone } from '@/lib/date';

type Mode = 'sign-in' | 'sign-up';

export function AuthForm({ mode, next }: { mode: Mode; next?: string | null }) {
  const isSignUp = mode === 'sign-up';
  return isSignUp ? <SignUpForm /> : <SignInForm next={next ?? null} />;
}

/**
 * Sign in.
 *
 * The one thing this screen absolutely must do is tell you when it did not
 * work. A failed sign-in used to produce nothing at all — no message, no
 * spinner, no console entry — and a form that sits there silently reads as a
 * broken site, not as a wrong password.
 */
function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  function onSubmit(values: SignInInput) {
    setFormError(null);
    // A second submit while one is in flight would burn a rate-limit attempt
    // for nothing. The button is disabled too; this is the guard behind it.
    if (pending) return;

    startTransition(async () => {
      const result = await signIn(values, next);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      // The server already validated `next` and returned a safe destination.
      // Re-checking here costs nothing and means the client never navigates to
      // something it has not itself vetted.
      router.push(safeRedirect(result.data.redirectTo));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <AuthHeading body="Welcome back. Pick up where you left off." />

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

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          hint="Enter your password"
          error={form.formState.errors.password?.message}
          register={form.register('password')}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <FormError message={formError} />

        <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing you in…" />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function SignUpForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm_password: '',
      display_name: '',
      // Typed `true` by the schema, so the default has to be the literal false
      // that fails it — an unticked box must never submit.
      accepted_terms: false as unknown as true,
    },
  });

  // Timezone is captured silently at signup so the very first "today" is right.
  React.useEffect(() => {
    try {
      window.sessionStorage.setItem('glowup:tz', detectTimezone());
    } catch {
      // Private mode or storage disabled — onboarding asks for it instead.
    }
  }, []);

  function onSubmit(values: SignUpInput) {
    setFormError(null);
    if (pending) return;

    startTransition(async () => {
      const result = await signUp(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      if (result.data.needsConfirmation) {
        setConfirmationSent(true);
        return;
      }
      // The signup trigger has seeded the account; onboarding tunes it.
      router.push('/onboarding');
      router.refresh();
    });
  }

  if (confirmationSent) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <h1 className="font-display text-xl">Check your inbox ✨</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{' '}
          <span className="font-medium text-foreground">{form.getValues('email')}</span>. Open it and
          you will land straight in the app.
        </p>
        <p className="text-xs text-muted-foreground">
          Nothing there? Check spam, and give it a minute before trying again.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const termsError = form.formState.errors.accepted_terms?.message;

  return (
    <div className="space-y-6">
      <AuthHeading body="One place for weight, strength, food and skincare." />

      <form onSubmit={form.handleSubmit(onSubmit)} className="surface-card space-y-4 p-6" noValidate>
        <Field
          id="display_name"
          label="Name (optional)"
          autoComplete="given-name"
          error={form.formState.errors.display_name?.message}
          inputProps={{ placeholder: 'What should we call you?' }}
          register={form.register('display_name')}
        />

        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
          register={form.register('email')}
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          // The rule is stated before the attempt, not after it fails.
          hint={PASSWORD_RULE}
          error={form.formState.errors.password?.message}
          register={form.register('password')}
        />

        <Field
          id="confirm_password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirm_password?.message}
          register={form.register('confirm_password')}
        />

        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="accepted_terms"
              checked={form.watch('accepted_terms') === true}
              onCheckedChange={(checked) =>
                form.setValue('accepted_terms', (checked === true) as true, {
                  shouldValidate: form.formState.isSubmitted,
                })
              }
              aria-invalid={Boolean(termsError)}
              aria-describedby={termsError ? 'accepted_terms-error' : undefined}
              className="mt-0.5"
            />
            <Label htmlFor="accepted_terms" className="cursor-pointer text-xs font-normal leading-relaxed text-muted-foreground">
              I agree to the{' '}
              <Link href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
                privacy policy
              </Link>{' '}
              and{' '}
              <Link href="/legal/terms" className="text-primary underline-offset-4 hover:underline">
                terms
              </Link>
              . GlowUp stores health information you enter, including weight and photos.
            </Label>
          </div>
          {termsError ? (
            <p id="accepted_terms-error" role="alert" className="text-xs text-destructive">
              {termsError}
            </p>
          ) : null}
        </div>

        <FormError message={formError} />

        <SubmitButton pending={pending} label="Create account" pendingLabel="Creating your account…" />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ── shared pieces ───────────────────────────────────────────────────────────

export function AuthHeading({ body }: { body: string }) {
  return (
    <div className="space-y-2.5 text-center">
      <p className="font-display text-display-lg">
        GlowUp <span aria-hidden="true">✨</span>
      </p>
      <p className="text-[14.5px] text-muted-foreground">{body}</p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function SubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button type="submit" variant="brand" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function Field({
  id,
  label,
  type = 'text',
  autoComplete,
  hint,
  error,
  register,
  inputProps,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm>['register']>;
  inputProps?: React.ComponentProps<typeof Input>;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...inputProps}
        {...register}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
