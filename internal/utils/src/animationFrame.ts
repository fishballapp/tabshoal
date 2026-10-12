const animationFrame = (fn: (time: number) => void): (() => void) => {
  const id = requestAnimationFrame(fn);
  return () => cancelAnimationFrame(id);
};
export const animationFrameRecursive = (
  fn: (data: { stop: () => void; currentTime: number; elapsedTimeSinceLast: number }) => void,
  fps: number = Number.POSITIVE_INFINITY,
): (() => void) => {
  const minimumMsPerFrame = 1000 / fps;
  let isStopped = false;
  const stop = () => {
    isStopped = true;
  };

  void (async () => {
    let previousTime: number = Number.NEGATIVE_INFINITY;
    while (!isStopped) {
      const currentTime = await new Promise<number>(res => animationFrame(res));
      const elapsedTimeSinceLast = currentTime - previousTime;
      if (isStopped) break;
      if (elapsedTimeSinceLast < minimumMsPerFrame) continue;

      fn({
        stop,
        currentTime,
        elapsedTimeSinceLast,
      });
      previousTime = currentTime;
    }
  })();

  return stop;
};
