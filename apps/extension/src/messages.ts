import type { Validation } from '@fishballapps/extension-licence/polar';

/** What the panel asks of the service worker. */
export type Message = { type: 'regroup-all' } | { type: 'activate-licence'; key: string };

export type Reply<M extends Message> = M extends { type: 'activate-licence' }
  ? Validation['type']
  : null;

export const send = <M extends Message>(message: M): Promise<Reply<M>> =>
  chrome.runtime.sendMessage(message);
