import { describe, expect, it } from 'vitest';
import { chunk, count, fuzzySort, limitMatches, pickRandom, shuffled, uniqBy } from './array';

describe('array.ts', () => {
  describe('fuzzySort', () => {
    it('prioritizes substring matches', () => {
      const options = ['apple', 'pineapple', 'grape', 'apricot'];
      const result = fuzzySort('app', options);
      expect(result.slice(0, 2)).toEqual(['apple', 'pineapple']);
    });

    it('sorts by Levenshtein distance when no substring', () => {
      const options = ['bat', 'dog', 'fish']; // only 'bat' is closest to 'hat'
      const result = fuzzySort('hat', options);
      expect(result[0]).toBe('bat'); // 'bat' is closest to 'hat'
    });

    it('is case-insensitive', () => {
      const options = ['Apple', 'PineApple', 'Grape'];
      const result = fuzzySort('apple', options);
      expect(result[0]?.toLowerCase()).toContain('apple');
    });

    it('returns all options if input is empty', () => {
      const options = ['a', 'b', 'c'];
      const result = fuzzySort('', options);
      expect(result.toSorted()).toEqual(options.toSorted());
    });

    it('handles empty options', () => {
      expect(fuzzySort('test', [])).toEqual([]);
    });
  });

  describe('shuffled', () => {
    it('returns array with same elements in any order', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffled(arr);
      expect(result.toSorted()).toEqual(arr);
      expect(result).toHaveLength(arr.length);
    });
  });

  describe('pickRandom', () => {
    it('returns an element from the array', () => {
      const arr = [1, 2, 3];
      expect(arr).toContain(pickRandom(arr));
    });
  });

  describe('chunk', () => {
    it('splits array into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
    it('throws on non-positive chunk size', () => {
      expect(() => chunk([1, 2], 0)).toThrow();
    });
  });

  describe('limitMatches', () => {
    it('limits number of matches', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = limitMatches(arr, x => x % 2 === 1, 2);
      expect(result).toEqual([1, 2, 3, 4]); // only first two odd numbers included
    });
    it('returns all if limit is high', () => {
      const arr = [1, 2, 3];
      expect(limitMatches(arr, () => true, 10)).toEqual(arr);
    });
  });

  describe('count', () => {
    it('counts matching elements', () => {
      expect(count([1, 2, 3, 4], x => x % 2 === 0)).toBe(2);
    });
    it('returns 0 when nothing matches', () => {
      expect(count([1, 3, 5], x => x % 2 === 0)).toBe(0);
    });
  });

  describe('uniqBy', () => {
    it('keeps the first occurrence of each key', () => {
      const xs = [
        { id: 1, v: 'a' },
        { id: 2, v: 'b' },
        { id: 1, v: 'c' },
      ];
      expect(uniqBy(xs, x => x.id)).toEqual([
        { id: 1, v: 'a' },
        { id: 2, v: 'b' },
      ]);
    });
    it('returns empty for empty input', () => {
      expect(uniqBy([], x => x)).toEqual([]);
    });
  });
});
