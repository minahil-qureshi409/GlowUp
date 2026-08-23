import { describe, expect, it } from 'vitest';

import {
  formatDateKey,
  formatDateLong,
  formatRelativeDay,
  getUserToday,
  toUserDate,
  weekDayKeys,
  weekStartKey,
  dayOfWeek,
  DAY_NAMES_SHORT,
} from '@/lib/date';

/**
 * The date bug this suite exists to stop coming back.
 *
 * Three symptoms, one family of causes:
 *   - a brand-new Karachi account created at 00:01 on Monday 24 August got a
 *     first weigh-in dated 22 August, because "today" was read from the
 *     server's clock rather than the user's;
 *   - `/progress` said "Today · 22 Aug" while the header said Sunday 23 August,
 *     because a date key parsed at local midnight was then *formatted* in UTC,
 *     which subtracts the host's offset and lands on the previous day;
 *   - the calendar week strip rendered MON 17 … SUN 23 while its own
 *     `aria-label`s read "Sunday 16 August … Saturday 22 August", because the
 *     visible number and the accessible name were computed separately.
 *
 * These tests are written to fail on a host in *any* timezone. `TZ` is not set
 * for the suite on purpose: the assertions must hold east and west of UTC.
 */

describe('getUserToday / toUserDate', () => {
  it('gives each user their own local day near midnight', () => {
    // 2026-08-23T19:01Z. In Karachi it is already 00:01 on the 24th; in Los
    // Angeles it is still noon on the 23rd.
    const instant = new Date('2026-08-23T19:01:00.000Z');

    expect(getUserToday('Asia/Karachi', instant)).toBe('2026-08-24');
    expect(getUserToday('America/Los_Angeles', instant)).toBe('2026-08-23');
    expect(getUserToday('UTC', instant)).toBe('2026-08-23');
  });

  it('is right for a user 12 hours ahead of UTC logging at 23:30 local', () => {
    // 23:30 on 2026-08-24 in Auckland (UTC+12) is 11:30Z on the 24th.
    const instant = new Date('2026-08-24T11:30:00.000Z');
    expect(toUserDate(instant, 'Pacific/Auckland')).toBe('2026-08-24');
  });

  it('is right for a user 8 hours behind UTC logging at 23:30 local', () => {
    // 23:30 on 2026-08-24 in Los Angeles (UTC-7 in August) is 06:30Z on the 25th.
    const instant = new Date('2026-08-25T06:30:00.000Z');
    expect(toUserDate(instant, 'America/Los_Angeles')).toBe('2026-08-24');
  });

  it('gives two users at the same instant different days', () => {
    // 2026-08-24T11:30Z: late evening in Auckland, early morning in LA.
    const instant = new Date('2026-08-24T11:30:00.000Z');
    expect(toUserDate(instant, 'Pacific/Auckland')).toBe('2026-08-24');
    expect(toUserDate(instant, 'America/Los_Angeles')).toBe('2026-08-24');

    // …and eleven hours later they are a day apart.
    const later = new Date('2026-08-24T22:30:00.000Z');
    expect(toUserDate(later, 'Pacific/Auckland')).toBe('2026-08-25');
    expect(toUserDate(later, 'America/Los_Angeles')).toBe('2026-08-24');
  });

  it('handles the day a DST transition happens', () => {
    // Auckland leaves DST on 2026-04-05 (UTC+13 -> UTC+12). 13:30Z is 01:30
    // local on the 6th either way; the calendar day must not slip.
    expect(toUserDate(new Date('2026-04-05T11:30:00.000Z'), 'Pacific/Auckland')).toBe('2026-04-05');
    expect(toUserDate(new Date('2026-04-05T13:30:00.000Z'), 'Pacific/Auckland')).toBe('2026-04-06');

    // Los Angeles springs forward on 2026-03-08.
    expect(toUserDate(new Date('2026-03-08T09:00:00.000Z'), 'America/Los_Angeles')).toBe(
      '2026-03-08',
    );
  });
});

describe('formatDateKey', () => {
  it('renders the date it was given, whatever the host timezone is', () => {
    expect(formatDateKey('2026-08-23', 'yyyy-MM-dd')).toBe('2026-08-23');
    expect(formatDateKey('2026-08-23', 'EEEE d MMMM')).toBe('Sunday 23 August');
    expect(formatDateKey('2026-08-24', 'EEEE d MMMM')).toBe('Monday 24 August');
  });

  it('does not shift across month or year boundaries', () => {
    expect(formatDateKey('2026-01-01', 'd MMM yyyy')).toBe('1 Jan 2026');
    expect(formatDateKey('2025-12-31', 'd MMM yyyy')).toBe('31 Dec 2025');
    expect(formatDateKey('2026-03-01', 'd MMM yyyy')).toBe('1 Mar 2026');
  });

  it('agrees with formatDateLong', () => {
    expect(formatDateLong('2026-08-22')).toBe('Saturday, 22 August 2026');
  });
});

describe('week strip', () => {
  it('starts on Monday and labels every day from the date itself', () => {
    const weekStart = weekStartKey('2026-08-23'); // a Sunday
    expect(weekStart).toBe('2026-08-17');

    const keys = weekDayKeys(weekStart);
    expect(keys).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);

    // The regression: the visible short name, the day number and the accessible
    // label must all describe the same date.
    const rendered = keys.map((date) => ({
      shortName: DAY_NAMES_SHORT[dayOfWeek(date)],
      dayOfMonth: Number(date.slice(8)),
      label: formatDateKey(date, 'EEEE d MMMM'),
    }));

    expect(rendered.map((day) => day.shortName)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(rendered[0]).toEqual({
      shortName: 'Mon',
      dayOfMonth: 17,
      label: 'Monday 17 August',
    });
    expect(rendered[6]).toEqual({
      shortName: 'Sun',
      dayOfMonth: 23,
      label: 'Sunday 23 August',
    });
  });
});

describe('formatRelativeDay', () => {
  it('calls the user local today "Today"', () => {
    const instant = new Date('2026-08-23T19:01:00.000Z');
    const today = getUserToday('Asia/Karachi', instant); // 2026-08-24

    expect(formatRelativeDay(today, today)).toBe('Today');
    expect(formatRelativeDay('2026-08-23', today)).toBe('Yesterday');
    expect(formatRelativeDay('2026-08-25', today)).toBe('Tomorrow');
  });

  it('does not disagree with the date it prints beside itself', () => {
    // The exact pairing shown on /progress: "Today · 24 Aug 2026". Before the
    // fix this read "Today · 23 Aug 2026" on any host east of UTC.
    const today = '2026-08-24';
    expect(formatRelativeDay(today, today)).toBe('Today');
    expect(formatDateKey(today, 'd MMM yyyy')).toBe('24 Aug 2026');
  });
});
