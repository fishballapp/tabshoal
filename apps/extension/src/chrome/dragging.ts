/** Chrome refuses tab and group edits while the user drags a tab. */
export const isDragging = (error: unknown) =>
  error instanceof Error && error.message.includes('user may be dragging a tab');

/**
 * Runs `call`, retrying after each delay while the user is dragging a tab; any other error, or
 * still dragging after the last delay, throws.
 */
export const retryWhileDragging = async <T>(
  call: () => Promise<T>,
  delays: readonly number[] = [100, 200, 400, 800],
): Promise<T> => {
  for (const delay of delays) {
    try {
      return await call();
    } catch (error) {
      if (!isDragging(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return call();
};
