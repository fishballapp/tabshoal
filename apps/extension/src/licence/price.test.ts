import { describe, expect, it } from 'vitest';
import { formatYearlyPrice } from './price';

describe('formatYearlyPrice', () => {
  it('is the yearly price in the time zone’s currency', () => {
    expect(formatYearlyPrice('Europe/Berlin', 'de-DE')).toBe('10\u00A0€');
  });
});
