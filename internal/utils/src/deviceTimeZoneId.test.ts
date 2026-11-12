import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceTimeZoneId } from './deviceTimeZoneId';

// Only this helper's own read is faked (`Once`): the polyfill validates ids through Intl too.
const deviceReports = (timeZone: string | undefined, utcOffsetMinutes = 0): void => {
  const resolved = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValueOnce({
    ...resolved,
    // `timeZone` is typed as always present, but older Hermes builds leave it out.
    timeZone: timeZone as string,
  });
  // getTimezoneOffset is minutes behind UTC: +08:00 reads -480.
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-utcOffsetMinutes);
};

afterEach(() => vi.restoreAllMocks());

describe('deviceTimeZoneId', () => {
  it.each([
    ['Asia/Hong_Kong', 'Asia/Hong_Kong'],
    ['Europe/London', 'Europe/London'],
    ['America/St_Johns', 'America/St_Johns'],
    ['UTC', 'UTC'],
    ['EST', 'EST'],
  ])('keeps an id Temporal accepts (%s)', (reported, expected) => {
    deviceReports(reported, 123);
    expect(deviceTimeZoneId()).toBe(expected);
  });

  it.each([
    ['GMT+08:00', 480, '+08:00'],
    ['GMT-05:30', -330, '-05:30'],
    ['PST', -480, '-08:00'],
    ['Etc/Unknown', 0, '+00:00'],
    [undefined, 345, '+05:45'],
  ])('falls back to the current UTC offset for %s', (reported, utcOffsetMinutes, expected) => {
    deviceReports(reported, utcOffsetMinutes);
    const timeZone = deviceTimeZoneId();
    expect(timeZone).toBe(expected);
    expect(() => Temporal.Now.zonedDateTimeISO(timeZone)).not.toThrow();
  });
});
