export const zip = <A, B>(a: readonly A[], b: readonly B[]): [A, B][] => {
  const len = Math.min(a.length, b.length);
  const iterA = a[Symbol.iterator]();
  const iterB = b[Symbol.iterator]();
  return Array.from({ length: len }, (): [A, B] => {
    const ra = iterA.next();
    const rb = iterB.next();
    if (ra.done || rb.done) {
      // Unreachable: `len` bounds iteration to within both arrays' lengths.
      throw new Error('zip: iterator exhausted before len');
    }
    return [ra.value, rb.value];
  });
};
