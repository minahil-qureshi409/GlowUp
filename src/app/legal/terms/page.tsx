import type { Metadata } from 'next';
import Link from 'next/link';

import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The agreement between you and GlowUp, in plain language.',
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p>
        Last updated {LEGAL_LAST_UPDATED}. By creating an account you agree to these terms. If you
        do not, please do not use GlowUp.
      </p>

      <h2>GlowUp is not medical advice</h2>
      <p>
        This is the important one. GlowUp is a <strong>tracking tool</strong>. It records what you
        tell it and shows you the trend. It does not diagnose anything, does not treat anything, and
        the suggestions it makes are scheduling nudges — not clinical guidance.
      </p>
      <ul>
        <li>
          Nothing in the app is a substitute for a doctor, dietitian, dermatologist or trainer.
        </li>
        <li>
          Do not start, stop or change any treatment, medication, diet or exercise programme because
          of something GlowUp displayed.
        </li>
        <li>
          Nutrition figures are approximations from reference values for typical ingredients. They
          are labelled approximate because they are.
        </li>
        <li>
          If something about your health concerns you, speak to a qualified professional. If it is
          urgent, contact your local emergency service.
        </li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You need a working email address, and you must be at least 16.</li>
        <li>Keep your password to yourself. You are responsible for activity under your account.</li>
        <li>One account per person. Do not create an account for someone else.</li>
        <li>
          Tell us at {LEGAL_CONTACT_EMAIL} if you believe someone else has access to your account.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you log stays yours. You grant GlowUp only the permission needed to store it, display
        it back to you and generate your charts and summaries. It is not used for anything else, and
        this permission ends when you delete the content or your account.
      </p>
      <p>
        Do not upload anything you do not have the right to upload, and do not upload photos of
        other people without their agreement.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access another account&rsquo;s data.</li>
        <li>Do not probe, scan or overload the service, or work around its rate limits.</li>
        <li>Do not resell or redistribute the service.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        GlowUp is provided as-is and as-available. There is no uptime guarantee, features may change
        or be removed, and the service may be discontinued. If it is, you will be given reasonable
        notice and a chance to export your data.
      </p>

      <h2>Liability</h2>
      <p>
        To the fullest extent the law allows, GlowUp is not liable for indirect or consequential
        loss, for lost data, or for any decision made on the basis of what the app displayed.
        Nothing here limits liability that cannot lawfully be limited — including for death or
        personal injury caused by negligence, or for fraud.
      </p>

      <h2>Ending it</h2>
      <p>
        You can delete your account at any time from Settings, which removes your data as described
        in the <Link href="/legal/privacy">privacy policy</Link>. We may suspend an account that
        breaks these terms, and will say why where we can.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes will be announced in the app before they take effect. Continuing to use
        GlowUp after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>{LEGAL_CONTACT_EMAIL}</p>
    </>
  );
}
