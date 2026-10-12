import { describe, expect, it } from 'vitest';
import { sortBy } from './sortBy';

describe('sortBy', () => {
  it('sorts by a numeric key in ascending order', () => {
    const xs = [{ n: 3 }, { n: 1 }, { n: 2 }];
    expect(sortBy(x => x.n, xs)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('sorts by a string key', () => {
    const xs = [{ k: 'b' }, { k: 'a' }, { k: 'c' }];
    expect(sortBy(x => x.k, xs)).toEqual([{ k: 'a' }, { k: 'b' }, { k: 'c' }]);
  });

  it('does not mutate the input', () => {
    const xs = [{ n: 3 }, { n: 1 }];
    const out = sortBy(x => x.n, xs);
    expect(xs).toEqual([{ n: 3 }, { n: 1 }]);
    expect(out).not.toBe(xs);
  });

  it('returns an empty array for empty input', () => {
    expect(sortBy(x => x, [])).toEqual([]);
  });

  it('keeps equal-key items in input order (stable enough for our needs)', () => {
    const a = { id: 1, k: 'x' };
    const b = { id: 2, k: 'x' };
    expect(sortBy(x => x.k, [a, b])).toEqual([a, b]);
  });
});
