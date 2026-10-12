export const sortBy = <T>(getKey: (t: T) => number | string, list: readonly T[]): T[] =>
  [...list].sort((a, b) => {
    const ka = getKey(a);
    const kb = getKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
