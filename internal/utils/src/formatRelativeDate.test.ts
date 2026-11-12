import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeDate, type RelativeDateLabels } from './formatRelativeDate';

// A wall-clock time in the device's zone, which is the zone formatRelativeDate reads days in.
const at = (dateTime: string): Temporal.Instant =>
  Temporal.PlainDateTime.from(dateTime).toZonedDateTime(Temporal.Now.timeZoneId()).toInstant();

const now = at('2026-05-11T12:00:00');

describe('formatRelativeDate', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns 今日 for the same calendar day, even across hour boundaries', () => {
    expect(formatRelativeDate(at('2026-05-11T00:00:01'), now)).toBe('今日');
    expect(formatRelativeDate(at('2026-05-11T23:59:59'), now)).toBe('今日');
  });

  it('returns 尋日 for one calendar day ago', () => {
    expect(formatRelativeDate(at('2026-05-10T00:00:01'), now)).toBe('尋日');
    expect(formatRelativeDate(at('2026-05-10T23:59:59'), now)).toBe('尋日');
  });

  it('returns 前日 for two calendar days ago', () => {
    expect(formatRelativeDate(at('2026-05-09T12:00:00'), now)).toBe('前日');
  });

  it('returns N日前 for 3–6 days ago', () => {
    expect(formatRelativeDate(at('2026-05-08T12:00:00'), now)).toBe('3日前'); // Fri
    expect(formatRelativeDate(at('2026-05-07T12:00:00'), now)).toBe('4日前'); // Thu
    expect(formatRelativeDate(at('2026-05-06T12:00:00'), now)).toBe('5日前'); // Wed
    expect(formatRelativeDate(at('2026-05-05T12:00:00'), now)).toBe('6日前'); // Tue
  });

  it('returns 上個禮拜X for 7–13 days ago, using the target weekday', () => {
    expect(formatRelativeDate(at('2026-05-04T12:00:00'), now)).toBe('上個禮拜一'); // Mon, 7d
    expect(formatRelativeDate(at('2026-05-03T12:00:00'), now)).toBe('上個禮拜日'); // Sun, 8d
    expect(formatRelativeDate(at('2026-05-02T12:00:00'), now)).toBe('上個禮拜六'); // Sat, 9d
    expect(formatRelativeDate(at('2026-05-01T12:00:00'), now)).toBe('上個禮拜五'); // Fri, 10d
    expect(formatRelativeDate(at('2026-04-30T12:00:00'), now)).toBe('上個禮拜四'); // Thu, 11d
    expect(formatRelativeDate(at('2026-04-29T12:00:00'), now)).toBe('上個禮拜三'); // Wed, 12d
    expect(formatRelativeDate(at('2026-04-28T12:00:00'), now)).toBe('上個禮拜二'); // Tue, 13d
  });

  it('returns M月D日 for 14+ days ago', () => {
    expect(formatRelativeDate(at('2026-04-27T12:00:00'), now)).toBe('4月27日');
    expect(formatRelativeDate(at('2024-01-15T12:00:00'), now)).toBe('1月15日');
  });

  it('treats day boundaries by calendar date, not by 24-hour windows', () => {
    const nextMidnight = at('2026-05-12T00:01:00');
    expect(formatRelativeDate(at('2026-05-11T23:59:00'), nextMidnight)).toBe('尋日');
  });

  it('handles cross-month boundaries cleanly', () => {
    const mar1 = at('2026-03-01T12:00:00');
    expect(formatRelativeDate(at('2026-02-27T12:00:00'), mar1)).toBe('前日');
  });

  it('falls back to absolute date for future dates', () => {
    expect(formatRelativeDate(at('2026-06-11T12:00:00'), now)).toBe('6月11日');
  });

  it('renders via a caller-supplied label set (language-neutral)', () => {
    const en: RelativeDateLabels = {
      today: 'today',
      yesterday: 'yesterday',
      dayBeforeYesterday: '2 days ago',
      daysAgo: days => `${days} days ago`,
      lastWeekday: weekdayIndex =>
        `last ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekdayIndex]}`,
      absolute: date => `${date.month}/${date.day}`,
    };
    expect(formatRelativeDate(at('2026-05-11T09:00:00'), now, en)).toBe('today');
    expect(formatRelativeDate(at('2026-05-08T12:00:00'), now, en)).toBe('3 days ago');
    expect(formatRelativeDate(at('2026-05-04T12:00:00'), now, en)).toBe('last Mon');
    expect(formatRelativeDate(at('2026-04-27T12:00:00'), now, en)).toBe('4/27');
  });

  it('counts calendar days across a clock change (New York, spring forward 2026-03-08)', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const newYork = (dateTime: string) =>
      Temporal.PlainDateTime.from(dateTime).toZonedDateTime('America/New_York').toInstant();
    // The local midnights 03-08 → 03-09 are 23h apart: a fixed 24h divisor floors that to "today".
    expect(formatRelativeDate(newYork('2026-03-08T12:00'), newYork('2026-03-09T12:00'))).toBe(
      '尋日',
    );
    expect(formatRelativeDate(newYork('2026-03-02T12:00'), newYork('2026-03-09T12:00'))).toBe(
      '上個禮拜一',
    );
  });
});
