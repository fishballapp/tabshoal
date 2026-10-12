import { quansync } from 'quansync';

// biome-ignore lint/suspicious/noExplicitAny: a constructor type must accept any arg signature
type ConstructorType<T> = new (...args: any[]) => T;

type Result<R, E> = [returnValue: R, error: undefined] | [returnValue: undefined, error: E];

export const tryCatch = quansync(function* (
  fn: () => unknown,
  knownErrors?: readonly (typeof Error)[],
) {
  try {
    return [(yield fn()) as unknown, undefined] as const;
  } catch (e) {
    if (!knownErrors || knownErrors.some(Err => e instanceof Err)) {
      return [undefined, e] as const;
    }

    throw e;
  }
  // quansync's inferred surface (readonly tuples, loose args) doesn't overlap the precise
  // sync/async signatures exposed below, so the conversion must bridge through unknown.
}) as unknown as {
  sync: <T extends () => unknown, E extends readonly ConstructorType<Error>[] = []>(
    fn: T,
    /** When provided, tryCatch catches only the listed error instances; otherwise all errors. */
    onlyCatch?: E,
  ) => Result<Awaited<ReturnType<T>>, E extends [] ? unknown : InstanceType<E[number]>>;
  async: <T extends () => Promise<unknown>, E extends readonly ConstructorType<Error>[] = []>(
    fn: T,
    /** When provided, tryCatch catches only the listed error instances; otherwise all errors. */
    onlyCatch?: E,
  ) => Promise<Result<Awaited<ReturnType<T>>, E extends [] ? unknown : InstanceType<E[number]>>>;
};
