/**
 * Display formatting.
 *
 * Numbers that represent a measurement are rendered with a fixed number of
 * decimals and tabular figures so columns don't jitter as values change.
 */

export function formatWeight(kg: number | null | undefined, decimals = 1): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
  return `${kg.toFixed(decimals)} kg`;
}

export function formatWeightNumber(kg: number | null | undefined, decimals = 1): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
  return kg.toFixed(decimals);
}

/** Always signed — a delta reads wrong without its direction. */
export function formatDelta(value: number | null | undefined, unit = 'kg', decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function formatRatio(done: number, total: number): string {
  return `${done} / ${total}`;
}

/** Height in cm rendered as feet and inches, for a user who thinks in both. */
export function formatHeightImperial(cm: number | null | undefined): string {
  if (!cm || !Number.isFinite(cm)) return '—';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  const rounded = Math.round(inches * 2) / 2; // nearest half inch
  if (rounded === 12) return `${feet + 1}'0"`;
  return `${feet}'${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}"`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || !Number.isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** kg with trailing zeros trimmed — "40" not "40.0", but "42.5" kept. */
export function formatLoad(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function initialsFrom(name: string | null | undefined, fallback = 'G'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase() || fallback;
}
