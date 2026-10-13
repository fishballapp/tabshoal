import { createAsyncQueue } from '@fishballapps/utils';
import { afterValidation, grantedLicence } from './entitlement';
import { type LicenceServer, type Validation, validateKey } from './polar';
import { loadLicensing, saveLicence } from './store';

/** The alarm that wakes the service worker hourly to see whether the daily check is due. */
export const LICENCE_ALARM = 'licence-check';

export const startLicenceAlarm = () => chrome.alarms.create(LICENCE_ALARM, { periodInMinutes: 60 });

/**
 * The service worker's side of the licence: the daily check and entering a key, in one queue of
 * their own so a slow network never holds up the extension's real work.
 */
export const createLicenceWorker = (server: LicenceServer) => {
  const enqueue = createAsyncQueue();
  return {
    /** Asks Polar about the stored key once its `nextCheckAt` has passed. */
    check: () =>
      enqueue(async () => {
        const now = Date.now();
        const { licence } = await loadLicensing(now);
        if (licence === undefined || now < licence.nextCheckAt) return;
        await saveLicence(afterValidation(licence, await validateKey(licence.key, server), now));
      }),
    /** Stores a key Polar grants; the answer says why one wasn't. */
    activate: (key: string) =>
      enqueue(async (): Promise<Validation['type']> => {
        const trimmed = key.trim();
        const validation = await validateKey(trimmed, server);
        if (validation.type === 'granted') {
          await saveLicence(grantedLicence(trimmed, validation, Date.now()));
        }
        return validation.type;
      }),
  };
};
