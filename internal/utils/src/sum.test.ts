import { describe, expect, it } from 'vitest';
import { sum } from './sum';

describe('sum', () => {
  it('adds positive numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it('handles negative numbers', () => {
    expect(sum([5, -3, 2])).toBe(4);
  });

  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('returns the single element for a one-element array', () => {
    expect(sum([42])).toBe(42);
  });
});
