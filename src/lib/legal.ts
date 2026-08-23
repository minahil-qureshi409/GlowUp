/**
 * Facts the legal pages state about *this* deployment.
 *
 * Kept in one place because both documents repeat them and because they are the
 * two things that must be checked before a public launch — a privacy policy
 * with an unreachable contact address is worse than none, and Google's and
 * Microsoft's OAuth verification both read these pages.
 *
 * `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` overrides the placeholder. Set it.
 */

export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || 'privacy@example.invalid';

/** Bump when either document changes in substance. */
export const LEGAL_LAST_UPDATED = '24 August 2026';

/** True once a real address is configured — the launch checklist reads this. */
export const LEGAL_CONTACT_CONFIGURED = !LEGAL_CONTACT_EMAIL.endsWith('example.invalid');
