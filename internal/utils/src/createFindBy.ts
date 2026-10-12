export const createFindBy = <T, U>(
  ts: readonly T[],
  getComparer: (t: T) => U,
): ((u: U) => T | undefined) => {
  const comparerToTMap = new Map(ts.map(t => [getComparer(t), t]));
  return u => comparerToTMap.get(u);
};
