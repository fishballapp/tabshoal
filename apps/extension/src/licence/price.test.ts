import { describe, expect, it } from 'vitest';
import { currencyFor, formatYearlyPrice } from './price';

describe('currencyFor', () => {
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
    expect(currencyFor(timeZone)).toBe(currency);
  });
});

describe('formatYearlyPrice', () => {
  it('writes the price in the locale’s style', () => {
    expect(formatYearlyPrice('Europe/London', 'en-GB')).toBe('£5');
    expect(formatYearlyPrice('America/Chicago', 'en-US')).toBe('$5');
    expect(formatYearlyPrice('America/Chicago', 'en-GB')).toBe('$5');
    expect(formatYearlyPrice('Europe/Berlin', 'de-DE')).toBe('5\u00A0€');
  });
});
