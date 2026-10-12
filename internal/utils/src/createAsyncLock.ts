// Async mutual exclusion (async-mutex's Mutex, minus the knobs we don't need):
// acquire() resolves with this turn's release once every earlier acquirer has
// released, so acquirers proceed strictly in acquire order.
export const createAsyncLock = () => {
  let tail: Promise<void> = Promise.resolve();
  return {
    acquire: async (): Promise<() => void> => {
      // The capture+swap runs in the async body's synchronous pre-await window,
      // so a second acquire queues behind a still-held first. Turn signals only
      // ever resolve (release takes no error), hence the bare `await`.
      const { promise, resolve } = Promise.withResolvers<void>();
      const last = tail;
      tail = promise;
      await last;
      return resolve;
    },
  };
};
