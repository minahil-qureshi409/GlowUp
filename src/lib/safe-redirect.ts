/**
 * Post-login redirect validation.
 *
 * `/login?next=…` is attacker-controlled: anybody can send a link with it set.
 * If the value is used unchecked the app becomes an open redirect, which is a
 * ready-made phishing vector — a real glowup.app link that bounces the user to
 * a lookalike sign-in page the moment they authenticate.
 *
 * The rule is narrow on purpose: a same-origin *relative path* and nothing
 * else. `//evil.example.com` is rejected even though it starts with `/`
 * (browsers read it as a protocol-relative absolute URL), as is anything
 * carrying a scheme, a backslash, or a control character.
 */

export const DEFAULT_REDIRECT = '/today';

/** A placeholder origin: only the *shape* of the resolved URL is being tested. */
const PROBE_ORIGIN = 'https://glowup.invalid';

const BACKSLASH = String.fromCharCode(0x5c);

export function isSafeRedirect(next: string | null | undefined): next is string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 512) return false;

  // Must be a path.
  if (!next.startsWith('/')) return false;
  // Protocol-relative: a browser reads `//evil.example.com` as an absolute URL
  // even though it starts with the slash a naive check looks for.
  if (next.startsWith('//')) return false;
  // Backslashes, control characters and raw whitespace. Browsers strip tabs
  // and newlines out of URLs before resolving them, so `/<tab>/evil.com`
  // becomes `//evil.com`; `\` folds to `/` in several parsers. A legitimate
  // in-app path never contains any of them un-encoded, so the whole range goes.
  // Checked by code point rather than by a regex full of literal control
  // bytes, which is unreadable and easy to break by accident.
  if (next.includes(BACKSLASH)) return false;
  for (let index = 0; index < next.length; index += 1) {
    const code = next.charCodeAt(index);
    if (code <= 0x20 || code === 0x7f) return false;
  }
  // A scheme in the first path segment, e.g. `/javascript:alert(1)`.
  if (/^\/[^/?#]*:/.test(next)) return false;

  try {
    const resolved = new URL(next, PROBE_ORIGIN);
    return resolved.origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

/** The validated path, or `/today`. Never returns an off-site destination. */
export function safeRedirect(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  return isSafeRedirect(next) ? next : fallback;
}
