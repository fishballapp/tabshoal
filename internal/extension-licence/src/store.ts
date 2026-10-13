import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { entitlementOf, type Licence, LicenceSchema } from './entitlement';

/** The trial start and the licence live in `storage.local`: per browser, never synced. */
export const loadLicensing = async (now = Date.now()) => {
  const stored: Record<string, unknown> = await chrome.storage.local.get([
    'installedAt',
    'licence',
  ]);
  const installedAt = Option.getOrElse(
    Schema.decodeUnknownOption(Schema.Int)(stored.installedAt),
    () => now,
  );
  const licence = Option.getOrUndefined(Schema.decodeUnknownOption(LicenceSchema)(stored.licence));
  return { installedAt, licence };
};

export const loadEntitlement = async (now = Date.now()) =>
  entitlementOf({ ...(await loadLicensing(now)), now });

/** Starts the trial clock, once. */
export const recordInstall = async (now = Date.now()) => {
  const { installedAt } = await chrome.storage.local.get('installedAt');
  if (installedAt === undefined) await chrome.storage.local.set({ installedAt: now });
};

export const saveLicence = (licence: Licence) =>
  chrome.storage.local.set({ licence: Schema.encodeSync(LicenceSchema)(licence) });
