import { describe, expect, it } from 'vitest';

import { DEFAULT_REDIRECT, isSafeRedirect, safeRedirect } from '@/lib/safe-redirect';

/**
 * `?next=` is attacker-controlled. `/login?next=https://evil.example.com/x`
 * returned 200 and carried the value into the page; if the post-login redirect
 * had used it unchecked, a genuine GlowUp link would have deposited a
 * freshly-authenticated user on someone else's sign-in page.
 */

describe('isSafeRedirect', () => {
  it('accepts same-origin relative paths', () => {
    for (const value of [
      '/today',
      '/progress/photos',
      '/settings?tab=goals',
      '/calendar#week',
      '/workout/session/6f1c0f6e-6e34-4d3a-9a1a-4a2b0b3f9d11',
    ]) {
      expect(isSafeRedirect(value)).toBe(true);
    }
  });

  it('rejects absolute URLs', () => {
    for (const value of [
      'https://evil.example.com/x',
      'http://evil.example.com',
      'HTTPS://EVIL.EXAMPLE.COM',
      'evil.example.com',
    ]) {
      expect(isSafeRedirect(value)).toBe(false);
    }
  });

  it('rejects protocol-relative URLs that begin with a slash', () => {
    // The trap in the original check: `next.startsWith('/')` is true here.
    expect('//evil.example.com'.startsWith('/')).toBe(true);
    expect(isSafeRedirect('//evil.example.com')).toBe(false);
    expect(isSafeRedirect('//evil.example.com/path')).toBe(false);
    expect(isSafeRedirect('///evil.example.com')).toBe(false);
  });

  it('rejects backslash and control-character smuggling', () => {
    const backslash = String.fromCharCode(0x5c);
    expect(isSafeRedirect(`/${backslash}evil.example.com`)).toBe(false);
    expect(isSafeRedirect(`/${backslash}${backslash}evil.example.com`)).toBe(false);
    expect(isSafeRedirect('/\tevil')).toBe(false);
    expect(isSafeRedirect('/\nevil')).toBe(false);
    expect(isSafeRedirect('/\r\nSet-Cookie: x=1')).toBe(false);
    expect(isSafeRedirect('/ /evil')).toBe(false);
  });

  it('rejects schemes in the first path segment', () => {
    expect(isSafeRedirect('/javascript:alert(1)')).toBe(false);
    expect(isSafeRedirect('/data:text/html,x')).toBe(false);
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty, absurd and non-string values', () => {
    expect(isSafeRedirect('')).toBe(false);
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect(undefined)).toBe(false);
    expect(isSafeRedirect(`/${'a'.repeat(600)}`)).toBe(false);
  });
});

describe('safeRedirect', () => {
  it('falls back to /today for anything off-site', () => {
    expect(safeRedirect('https://evil.example.com')).toBe(DEFAULT_REDIRECT);
    expect(safeRedirect('//evil.example.com')).toBe(DEFAULT_REDIRECT);
    expect(safeRedirect(null)).toBe(DEFAULT_REDIRECT);
    expect(DEFAULT_REDIRECT).toBe('/today');
  });

  it('passes a valid path through untouched', () => {
    expect(safeRedirect('/progress')).toBe('/progress');
  });

  it('honours an explicit fallback', () => {
    expect(safeRedirect('https://evil.example.com', '/onboarding')).toBe('/onboarding');
  });
});
