export const throwError = (m: string | Error): never => {
  if (typeof m === 'string') {
    throw new Error(m);
  }
  throw m;
};
