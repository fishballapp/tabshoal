import * as Schema from 'effect/Schema';
import type { Validation } from './polar';

const DAY = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 14;
/** How long a licence keeps working without reaching Polar. */
export const OFFLINE_DAYS = 14;
const UNREACHABLE_RETRY = 60 * 60 * 1000;

export const LicenceSchema = Schema.Struct({
  key: Schema.String,
  status: Schema.Literals(['granted', 'ended']),
  /** Epoch ms of Polar's last "granted". */
  grantedAt: Schema.Int,
  /** Epoch ms before which the daily check doesn't ask Polar again. */
  nextCheckAt: Schema.Int,
  /** Epoch ms the key stops working, for a key that expires (Vinimal's One year). */
  expiresAt: Schema.optionalKey(Schema.Int),
});

export type Licence = typeof LicenceSchema.Type;

export type Entitlement =
  | { status: 'trial'; daysLeft: number }
  | { status: 'trial-ended' }
  | { status: 'licensed' }
  /** A licence that hasn't reached Polar for longer than {@link OFFLINE_DAYS}. */
  | { status: 'unreachable' }
  /** Polar said the licence ended, or it expired, and the trial is over. */
  | { status: 'ended' };

export const entitlementOf = ({
  installedAt,
  licence,
  now,
}: {
  installedAt: number;
  licence: Licence | undefined;
  now: number;
}): Entitlement => {
  if (licence?.status === 'granted' && !isExpired(licence, now)) {
    return now - licence.grantedAt <= OFFLINE_DAYS * DAY
      ? { status: 'licensed' }
      : { status: 'unreachable' };
  }
  const daysLeft = Math.ceil((installedAt + TRIAL_DAYS * DAY - now) / DAY);
  if (daysLeft > 0) return { status: 'trial', daysLeft };
  return licence === undefined ? { status: 'trial-ended' } : { status: 'ended' };
};

export type StoppedEntitlement = Exclude<Entitlement, { status: 'trial' | 'licensed' }>;

export const isGroupingAllowed = (
  entitlement: Entitlement,
): entitlement is Exclude<Entitlement, StoppedEntitlement> =>
  entitlement.status === 'trial' || entitlement.status === 'licensed';

/** An expiring key stops on time, without waiting for the daily check to hear it from Polar. */
const isExpired = ({ expiresAt }: Licence, now: number) =>
  expiresAt !== undefined && expiresAt <= now;

/** A key Polar has just granted. */
export const grantedLicence = (
  key: string,
  { expiresAt }: Extract<Validation, { type: 'granted' }>,
  now: number,
): Licence => ({
  key,
  status: 'granted',
  grantedAt: now,
  nextCheckAt: now + DAY,
  ...(expiresAt === undefined ? {} : { expiresAt }),
});

/**
 * The licence after asking Polar about it. Only Polar's answer changes the status; a rate limit or
 * no answer only moves the next check, so a paying customer offline keeps grouping until
 * {@link OFFLINE_DAYS} pass.
 */
export const afterValidation = (licence: Licence, validation: Validation, now: number): Licence => {
  switch (validation.type) {
    case 'granted':
      return grantedLicence(licence.key, validation, now);
    case 'rejected':
      return { ...licence, status: 'ended', nextCheckAt: now + DAY };
    case 'rate-limited':
      return { ...licence, nextCheckAt: now + validation.retryAfterSeconds * 1000 };
    case 'unreachable':
      return { ...licence, nextCheckAt: now + UNREACHABLE_RETRY };
  }
};
