import { describe, expect, it } from 'vitest';
import { zip } from './zip';

describe('zip', () => {
  it('pairs elements of two equal-length arrays', () => {
    expect(zip([1, 2, 3], ['a', 'b', 'c'])).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
  });

  it('truncates to the shorter array (a shorter)', () => {
    expect(zip([1, 2], ['a', 'b', 'c', 'd'])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('truncates to the shorter array (b shorter)', () => {
    expect(zip([1, 2, 3, 4], ['a', 'b'])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('returns an empty array if either side is empty', () => {
    expect(zip([], [1, 2, 3])).toEqual([]);
    expect(zip([1, 2, 3], [])).toEqual([]);
  });

  it('preserves undefined elements (iterator-based, not index assertion)', () => {
    expect(zip<number | undefined, string>([1, undefined, 3], ['a', 'b', 'c'])).toEqual([
      [1, 'a'],
      [undefined, 'b'],
      [3, 'c'],
    ]);
  });
});
