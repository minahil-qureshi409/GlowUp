import type { Metadata } from 'next';
import Link from 'next/link';

import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What GlowUp stores, where it is stored, who can see it, and how to export or delete it.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>
        Last updated {LEGAL_LAST_UPDATED}. This policy describes what GlowUp stores about you and
        what it does with it. It is written to be read, not to be survived.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Everything you enter is yours, and visible only to your account.</li>
        <li>GlowUp does not sell your data, share it with advertisers, or use it to train models.</li>
        <li>Connecting a calendar gives GlowUp busy times only — never event details.</li>
        <li>You can export everything, and you can delete everything, from Settings.</li>
      </ul>

      <h2>What GlowUp stores</h2>
      <p>Only what you enter, plus the minimum needed to run an account:</p>
      <ul>
        <li>
          <strong>Account</strong> — your email address, an encrypted password hash held by our
          authentication provider, and the display name you choose.
        </li>
        <li>
          <strong>Health information you log</strong> — body weight and goal weight, height,
          habit completions, workouts and the sets you record, skincare routines and products, notes
          about your skin, weekly reviews, and any notes you write.
        </li>
        <li>
          <strong>Progress photos</strong> — stored in a private bucket. Files are never public;
          the app fetches them through short-lived links generated for your session only.
        </li>
        <li>
          <strong>Preferences</strong> — timezone, time format, theme, reminder settings, and your
          typical schedule.
        </li>
        <li>
          <strong>Calendar availability</strong>, only if you connect a calendar. See below.
        </li>
      </ul>
      <p>
        GlowUp has no analytics or advertising trackers, and sets no third-party cookies. The only
        cookies it sets are the ones that keep you signed in.
      </p>

      <h2>Calendar connections</h2>
      <p>
        Connecting Google or Microsoft is optional and everything else works without it. When you
        do connect one, GlowUp requests the narrowest availability permission each provider offers
        and stores <strong>start and end times of busy blocks only</strong>.
      </p>
      <ul>
        <li>Event titles, descriptions, guests, locations and organisers are never requested and never stored.</li>
        <li>GlowUp cannot create, edit or delete events. It has no write access at all.</li>
        <li>Only the next 14 days are held. Anything older is deleted on every sync.</li>
        <li>
          Access tokens are held server-side in a table no browser client can read, and refresh
          tokens are encrypted at rest.
        </li>
        <li>
          Disconnecting revokes access at the provider, deletes the stored tokens, and deletes every
          cached busy block. Nothing is left behind.
        </li>
      </ul>

      <h2>Who can see your data</h2>
      <p>
        You, and nobody else using the app. Every table enforces row-level security in the database,
        so a request for another account&rsquo;s rows is refused by the database itself rather than
        by application code that could have a bug in it.
      </p>
      <p>
        GlowUp uses <strong>Supabase</strong> (database, authentication and file storage) and a
        hosting provider to run the site. They process data on our instructions in order to provide
        the service. If you connect a calendar, GlowUp exchanges requests with Google or Microsoft
        for availability only.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Your logs are kept until you delete them or delete your account. Calendar busy blocks are
        kept for 14 days ahead and cleared as they pass. Deleting your account removes your database
        rows and your stored photos; backups roll off within 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Export</strong> — download everything you have logged as a JSON file, from
          Settings.
        </li>
        <li>
          <strong>Delete</strong> — delete your account and everything in it, including your photos,
          from Settings. This cannot be undone.
        </li>
        <li>
          <strong>Correct</strong> — every value in the app is editable, and past entries can be
          changed or removed.
        </li>
        <li>
          <strong>Withdraw calendar access</strong> — disconnect at any time, from Calendar.
        </li>
      </ul>
      <p>
        Depending on where you live you may also have rights to access, correct, port, restrict or
        object to processing of your data. The tools above cover most of these directly; for
        anything else, write to {LEGAL_CONTACT_EMAIL}.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest by our infrastructure providers. Progress photos
        live in a private bucket with per-user access rules. Calendar refresh tokens are encrypted
        with a key held outside the database, so a database dump alone does not yield a usable
        token. No system is perfect, and this one has not been independently audited.
      </p>

      <h2>Children</h2>
      <p>
        GlowUp is not intended for anyone under 16, and accounts should not be created for them.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that affects what is collected or who it is shared with, the
        change will be announced in the app before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests or complaints: {LEGAL_CONTACT_EMAIL}. See also the{' '}
        <Link href="/legal/terms">terms</Link>.
      </p>
    </>
  );
}
