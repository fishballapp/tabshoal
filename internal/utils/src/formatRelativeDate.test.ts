import { describe, expect, it } from 'vitest';
import { formatRelativeDate, type RelativeDateLabels } from './formatRelativeDate';

const now = new Date(2026, 4, 11, 12, 0, 0);

describe('formatRelativeDate', () => {
  it('returns 今日 for the same calendar day, even across hour boundaries', () => {
    expect(formatRelativeDate(new Date(2026, 4, 11, 0, 0, 1), now)).toBe('今日');
    expect(formatRelativeDate(new Date(2026, 4, 11, 23, 59, 59), now)).toBe('今日');
  });

  it('returns 尋日 for one calendar day ago', () => {
    expect(formatRelativeDate(new Date(2026, 4, 10, 0, 0, 1), now)).toBe('尋日');
    expect(formatRelativeDate(new Date(2026, 4, 10, 23, 59, 59), now)).toBe('尋日');
  });

  it('returns 前日 for two calendar days ago', () => {
    expect(formatRelativeDate(new Date(2026, 4, 9, 12), now)).toBe('前日');
  });

  it('returns N日前 for 3–6 days ago', () => {
    expect(formatRelativeDate(new Date(2026, 4, 8, 12), now)).toBe('3日前'); // Fri
    expect(formatRelativeDate(new Date(2026, 4, 7, 12), now)).toBe('4日前'); // Thu
    expect(formatRelativeDate(new Date(2026, 4, 6, 12), now)).toBe('5日前'); // Wed
    expect(formatRelativeDate(new Date(2026, 4, 5, 12), now)).toBe('6日前'); // Tue
  });

  it('returns 上個禮拜X for 7–13 days ago, using the target weekday', () => {
    expect(formatRelativeDate(new Date(2026, 4, 4, 12), now)).toBe('上個禮拜一'); // Mon, 7d
    expect(formatRelativeDate(new Date(2026, 4, 3, 12), now)).toBe('上個禮拜日'); // Sun, 8d
    expect(formatRelativeDate(new Date(2026, 4, 2, 12), now)).toBe('上個禮拜六'); // Sat, 9d
    expect(formatRelativeDate(new Date(2026, 4, 1, 12), now)).toBe('上個禮拜五'); // Fri, 10d
    expect(formatRelativeDate(new Date(2026, 3, 30, 12), now)).toBe('上個禮拜四'); // Thu, 11d
    expect(formatRelativeDate(new Date(2026, 3, 29, 12), now)).toBe('上個禮拜三'); // Wed, 12d
    expect(formatRelativeDate(new Date(2026, 3, 28, 12), now)).toBe('上個禮拜二'); // Tue, 13d
  });

  it('returns M月D日 for 14+ days ago', () => {
    expect(formatRelativeDate(new Date(2026, 3, 27, 12), now)).toBe('4月27日');
    expect(formatRelativeDate(new Date(2024, 0, 15, 12), now)).toBe('1月15日');
  });

  it('treats day boundaries by calendar date, not by 24-hour windows', () => {
    const nextMidnight = new Date(2026, 4, 12, 0, 1, 0);
    expect(formatRelativeDate(new Date(2026, 4, 11, 23, 59), nextMidnight)).toBe('尋日');
  });

  it('handles cross-month boundaries cleanly', () => {
    const mar1 = new Date(2026, 2, 1, 12);
    expect(formatRelativeDate(new Date(2026, 1, 27, 12), mar1)).toBe('前日');
  });

  it('falls back to absolute date for future dates', () => {
    expect(formatRelativeDate(new Date(2026, 5, 11, 12), now)).toBe('6月11日');
  });

  it('renders via a caller-supplied label set (language-neutral)', () => {
    const en: RelativeDateLabels = {
      today: 'today',
      yesterday: 'yesterday',
      dayBeforeYesterday: '2 days ago',
      daysAgo: days => `${days} days ago`,
      lastWeekday: weekdayIndex =>
        `last ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekdayIndex]}`,
      absolute: date => `${date.getMonth() + 1}/${date.getDate()}`,
    };
    expect(formatRelativeDate(new Date(2026, 4, 11, 9), now, en)).toBe('today');
    expect(formatRelativeDate(new Date(2026, 4, 8, 12), now, en)).toBe('3 days ago');
    expect(formatRelativeDate(new Date(2026, 4, 4, 12), now, en)).toBe('last Mon');
    expect(formatRelativeDate(new Date(2026, 3, 27, 12), now, en)).toBe('4/27');
  });

  it('handles Temporal.Instant inputs', () => {
    const nowInstant = Temporal.Instant.fromEpochMilliseconds(
      new Date(2026, 4, 11, 12, 0, 0).getTime(),
    );
    const todayInstant = Temporal.Instant.fromEpochMilliseconds(
      new Date(2026, 4, 11, 10, 0, 0).getTime(),
    );
    const yesterdayInstant = Temporal.Instant.fromEpochMilliseconds(
      new Date(2026, 4, 10, 10, 0, 0).getTime(),
    );

    expect(formatRelativeDate(todayInstant, nowInstant)).toBe('今日');
    expect(formatRelativeDate(yesterdayInstant, nowInstant)).toBe('尋日');
    expect(formatRelativeDate(yesterdayInstant, now)).toBe('尋日');
    expect(formatRelativeDate(new Date(2026, 4, 10, 10, 0, 0), nowInstant)).toBe('尋日');
  });
});
