import { describe, expect, it, vi } from 'vitest';
import { retryWhileDragging } from './dragging';

const dragging = () => new Error('Tabs cannot be edited right now (user may be dragging a tab).');

describe('retryWhileDragging', () => {
  it('retries while the user drags, then succeeds', async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(dragging())
      .mockRejectedValueOnce(dragging())
      .mockResolvedValue('done');
    expect(await retryWhileDragging(call, [0, 0, 0])).toBe('done');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last delay', async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(dragging());
    await expect(retryWhileDragging(call, [0, 0])).rejects.toThrow('dragging');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry any other error', async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('No tab with id: 4.'));
    await expect(retryWhileDragging(call, [0, 0])).rejects.toThrow('No tab');
    expect(call).toHaveBeenCalledTimes(1);
  });
});
