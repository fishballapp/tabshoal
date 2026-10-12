import { describe, expect, it } from 'vitest';
import { createAsyncQueue } from './createAsyncQueue';

describe('createAsyncQueue', () => {
  it('runs tasks strictly in enqueue order, one at a time', async () => {
    const enqueue = createAsyncQueue();
    const events: string[] = [];
    const first = enqueue(async () => {
      events.push('a:start');
      await new Promise(resolve => setTimeout(resolve, 20));
      events.push('a:end');
      return 'a';
    });
    const second = enqueue(async () => {
      events.push('b:start');
      events.push('b:end');
      return 'b';
    });
    await expect(Promise.all([first, second])).resolves.toEqual(['a', 'b']);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('propagates a rejection to its caller without wedging the queue', async () => {
    const enqueue = createAsyncQueue();
    const failing = enqueue(() => Promise.reject(new Error('boom')));
    const following = enqueue(() => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(following).resolves.toBe('ok');
  });

  it('captures a synchronous throw as a rejection', async () => {
    const enqueue = createAsyncQueue();
    const throwing = enqueue(() => {
      throw new Error('sync boom');
    });
    await expect(throwing).rejects.toThrow('sync boom');
    await expect(enqueue(() => 'still fine')).resolves.toBe('still fine');
  });
});
