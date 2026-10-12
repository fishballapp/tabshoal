import type { Promisable } from 'type-fest';
import { createAsyncLock } from './createAsyncLock';

// Serial task queue — same semantics as the trusted implementations
// (sindresorhus/p-limit at concurrency 1, async-mutex's runExclusive) minus the
// knobs we don't need: tasks run strictly in enqueue order, each caller gets its
// own task's result/rejection, and a failed task never wedges the queue.
export const createAsyncQueue = () => {
  const lock = createAsyncLock();
  return async <T>(task: () => Promisable<T>): Promise<T> => {
    const release = await lock.acquire();
    try {
      // `await` (not a bare `return task()`) so the finally releases only once the task settles,
      // and a failed task releases without being swallowed.
      return await task();
    } finally {
      release();
    }
  };
};
