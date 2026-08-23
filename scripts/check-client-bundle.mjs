#!/usr/bin/env node
/**
 * Fails the build if a server-only secret reached the browser bundle.
 *
 * Next inlines `process.env.*` at build time, so one careless import of a
 * server module into a `"use client"` file is enough to publish a service-role
 * key to every visitor — and nothing about the app would look broken. The only
 * reliable check is to read what actually shipped.
 *
 * Run after `next build`:  npm run check:bundle
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const NEWLINE = String.fromCharCode(10);

/**
 * Loads `.env.local` the way `next build` does.
 *
 * Without this the script would run with an empty environment, find no secret
 * values to search for, and report "clean" — a check that passes because it
 * checked nothing is worse than no check at all.
 */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, 'utf8').split(NEWLINE)) {
    const line = rawLine.trim();
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    process.env[name] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const CLIENT_DIRS = [
  path.join('.next', 'static'),
  // Server chunks are not shipped as files, but the RSC payload they produce
  // is. Anything inlined as a literal here can end up on the wire.
  path.join('.next', 'server', 'app'),
];

/** Values that must never appear, read from the environment being built with. */
const SECRET_ENV_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CALENDAR_TOKEN_KEY',
  'CALENDAR_SYNC_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_SECRET',
  'SENTRY_AUTH_TOKEN',
];

/**
 * Shapes that betray a leak even when the value itself is not in this
 * environment — a CI runner may build without the secret set at all.
 */
const FORBIDDEN_PATTERNS = [
  { label: 'a decoded service-role JWT', pattern: /"role"\s*:\s*"service_role"/ },
  { label: 'an encoded service-role JWT', pattern: /InNlcnZpY2Vfcm9sZSI/ },
  {
    label: 'an inlined SUPABASE_SERVICE_ROLE_KEY',
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']{20,}/,
  },
  {
    label: 'an inlined CALENDAR_TOKEN_KEY',
    pattern: /CALENDAR_TOKEN_KEY\s*[:=]\s*["'][^"']{20,}/,
  },
];

/** Shorter values would false-positive against minified identifiers. */
const MIN_SECRET_LENGTH = 16;

async function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(js|mjs|cjs|json|txt|html|rsc)$/.test(entry.name)) yield full;
  }
}

const secrets = SECRET_ENV_VARS.map((name) => ({ name, value: process.env[name] })).filter(
  (entry) => typeof entry.value === 'string' && entry.value.length >= MIN_SECRET_LENGTH,
);

const findings = [];
let scanned = 0;

for (const dir of CLIENT_DIRS) {
  for await (const file of walk(dir)) {
    scanned += 1;
    const contents = await readFile(file, 'utf8');

    for (const secret of secrets) {
      if (contents.includes(secret.value)) {
        findings.push(`${file}: contains the value of ${secret.name}`);
      }
    }

    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(contents)) findings.push(`${file}: matches ${label}`);
    }
  }
}

if (scanned === 0) {
  console.error('No build output found. Run `next build` first.');
  process.exit(1);
}

if (secrets.length === 0) {
  console.warn('Warning: none of the tracked secrets are set here, so only the patterns ran.');
}

if (findings.length > 0) {
  console.error(`Secret material found in the build output (${findings.length}):`);
  for (const finding of findings) console.error(`  x ${finding}`);
  console.error(
    'A server-only module has been pulled into a client bundle. Find the import chain from a "use client" file and break it.',
  );
  process.exit(1);
}

console.log(
  `Client bundle clean: ${scanned} files scanned, ${secrets.length} secret value(s) and ${FORBIDDEN_PATTERNS.length} patterns checked.`,
);
