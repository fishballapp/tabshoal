import { describe, expect, it } from 'vitest';
import { formatThousands } from './number';

describe('formatThousands', () => {
  it('leaves sub-thousand numbers unchanged', () => {
    expect(formatThousands(0)).toBe('0');
    expect(formatThousands(7)).toBe('7');
    expect(formatThousands(300)).toBe('300');
  });

  it('groups thousands with commas', () => {
    expect(formatThousands(1940)).toBe('1,940');
    expect(formatThousands(2593)).toBe('2,593');
    expect(formatThousands(1000000)).toBe('1,000,000');
  });
});
