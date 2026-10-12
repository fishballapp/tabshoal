import { useEffect, useState } from 'react';

/**
 * A value read from `chrome.storage`, read again whenever it changes, including from the service
 * worker or another page. `undefined` until the first read.
 */
export const useStored = <T>(
  area: 'sync' | 'local' | 'session',
  keys: readonly string[],
  read: () => Promise<T>,
): T | undefined => {
  const [value, setValue] = useState<T>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `keys` and `read` are fixed per caller.
  useEffect(() => {
    let isCurrent = true;
    const refresh = async () => {
      const next = await read();
      if (isCurrent) setValue(next);
    };
    const onChanged = (changes: Record<string, unknown>, changedArea: string) => {
      if (changedArea === area && keys.some(key => key in changes)) void refresh();
    };
    void refresh();
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      isCurrent = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [area]);
  return value;
};
