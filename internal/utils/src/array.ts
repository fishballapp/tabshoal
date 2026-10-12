export const shuffled = <T>(xs: Iterable<T>): T[] => {
  const arr = Array.isArray(xs) ? [...xs] : Array.from(xs);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const pickRandom = <T>(xs: readonly T[]): T => {
  if (xs.length <= 0) {
    throw new Error('Cannot pickRandom from empty arrays');
  }
  // biome-ignore lint/style/noNonNullAssertion: xs.length is guaranteed to be > 0, so the index is always valid
  return xs[Math.floor(Math.random() * xs.length)]!;
};

export const chunk = <T>(xs: readonly T[], n: number): T[][] => {
  if (n <= 0) throw new Error('Chunk size must be greater than 0');
  const result: T[][] = [];
  for (let i = 0; i < xs.length; i += n) {
    result.push(xs.slice(i, i + n));
  }
  return result;
};

/** How many elements satisfy the predicate. */
export const count = <T>(xs: readonly T[], predicate: (x: T) => boolean): number =>
  xs.reduce((n, x) => (predicate(x) ? n + 1 : n), 0);

/** Dedupe by a derived key, keeping the first occurrence of each key. */
export const uniqBy = <T, K>(xs: readonly T[], getKey: (x: T) => K): T[] => {
  const seen = new Set<K>();
  return xs.filter(x => {
    const key = getKey(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const limitMatches = <T>(
  items: T[],
  predicate: (item: T) => boolean,
  limit: number,
): T[] => {
  let count = 0;
  return items.filter(item => {
    if (predicate(item)) {
      if (count < limit) {
        count++;
        return true;
      }
      return false;
    }
    return true; // non-matching items are always included
  });
};

/** Fuzzy sorts options by substring matches, then Levenshtein distance. */
export function fuzzySort(input: string, options: string[]): string[] {
  const lowerInput = input.toLowerCase();
  // Helper: Levenshtein distance
  function levenshtein(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
      new Array(b.length + 1).fill(0),
    );
    // biome-ignore lint/style/noNonNullAssertion: dp is initialized with a.length + 1 rows, so dp[i] is always defined
    for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
    // biome-ignore lint/style/noNonNullAssertion: dp[0] is initialized with b.length + 1 columns, so dp[0][j] is always defined
    for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          // biome-ignore lint/style/noNonNullAssertion: dp[i-1][j-1] is always defined within the loop bounds
          dp[i]![j] = dp[i - 1]![j - 1]!;
        } else {
          // biome-ignore lint/style/noNonNullAssertion: dp[i-1][j], dp[i][j-1], and dp[i-1][j-1] are always defined within the loop bounds
          dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
        }
      }
    }
    // biome-ignore lint/style/noNonNullAssertion: dp[a.length][b.length] is always defined by construction
    return dp[a.length]![b.length]!;
  }
  // Score and sort
  return options
    .map(option => {
      const lowerOption = option.toLowerCase();
      const isSubstring = lowerOption.includes(lowerInput);
      const lev = levenshtein(lowerInput, lowerOption);
      return { option, isSubstring, lev };
    })
    .sort((a, b) => {
      if (a.isSubstring !== b.isSubstring) {
        return a.isSubstring ? -1 : 1; // substring matches first
      }
      return a.lev - b.lev; // then by Levenshtein distance
    })
    .map(x => x.option);
}
