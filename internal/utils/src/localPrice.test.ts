import { describe, expect, it } from 'vitest';
import { currencyForTimeZone, formatLocalPrice } from './localPrice';

describe('currencyForTimeZone', () => {
  it.each([
    ['Europe/London', 'GBP'],
    ['Europe/Jersey', 'GBP'],
    ['Europe/Paris', 'EUR'],
    ['Europe/Dublin', 'EUR'],
    ['Atlantic/Canary', 'EUR'],
    ['Europe/Zurich', 'USD'],
    ['America/New_York', 'USD'],
    ['Asia/Hong_Kong', 'USD'],
  ])('reads %s as %s', (timeZone, currency) => {
    expect(currencyForTimeZone(timeZone)).toBe(currency);
  });
});

describe('formatLocalPrice', () => {
  const prices = { USD: 10, GBP: 9, EUR: 11 };

  it('picks the price in the time zone’s currency', () => {
    expect(formatLocalPrice(prices, 'Europe/London', 'en-GB')).toBe('£9');
    expect(formatLocalPrice(prices, 'America/Chicago', 'en-US')).toBe('$10');
  });

  it('writes it in the locale’s style', () => {
    expect(formatLocalPrice(prices, 'America/Chicago', 'en-GB')).toBe('$10');
    expect(formatLocalPrice(prices, 'Europe/Berlin', 'de-DE')).toBe('11\u00A0€');
  });
});
