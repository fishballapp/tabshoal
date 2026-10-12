import { describe, expect, it } from 'vitest';
import { afterValidation, entitlementOf, type Licence } from './entitlement';

const DAY = 24 * 60 * 60 * 1000;
const installedAt = Date.UTC(2026, 9, 1);
const licence = (overrides: Partial<Licence> = {}): Licence => ({
  key: 'TABSHOAL-1',
  status: 'granted',
  grantedAt: installedAt,
  nextCheckAt: installedAt + DAY,
  ...overrides,
});

describe('entitlementOf', () => {
  it('counts the trial down from install', () => {
    expect(entitlementOf({ installedAt, licence: undefined, now: installedAt })).toEqual({
      status: 'trial',
      daysLeft: 14,
    });
    expect(
      entitlementOf({ installedAt, licence: undefined, now: installedAt + 13.5 * DAY }),
    ).toEqual({ status: 'trial', daysLeft: 1 });
  });

  it('ends the trial after 14 days', () => {
    expect(entitlementOf({ installedAt, licence: undefined, now: installedAt + 14 * DAY })).toEqual(
      { status: 'trial-ended' },
    );
  });

  it('licenses a granted key for 14 days without reaching Polar, then pauses', () => {
    const now = installedAt + 40 * DAY;
    expect(
      entitlementOf({ installedAt, licence: licence({ grantedAt: now - 14 * DAY }), now }),
    ).toEqual({ status: 'licensed' });
    expect(
      entitlementOf({ installedAt, licence: licence({ grantedAt: now - 15 * DAY }), now }),
    ).toEqual({ status: 'unreachable' });
  });

  it('says the licence ended once Polar does, after the trial', () => {
    const ended = licence({ status: 'ended' });
    expect(entitlementOf({ installedAt, licence: ended, now: installedAt + 20 * DAY })).toEqual({
      status: 'ended',
    });
    expect(entitlementOf({ installedAt, licence: ended, now: installedAt + DAY })).toEqual({
      status: 'trial',
      daysLeft: 13,
    });
  });
});

describe('afterValidation', () => {
  const now = installedAt + 30 * DAY;

  it('renews a granted licence and checks again in a day', () => {
    expect(afterValidation(licence(), { type: 'granted' }, now)).toMatchObject({
      status: 'granted',
      grantedAt: now,
      nextCheckAt: now + DAY,
    });
  });

  it('ends a licence Polar rejects', () => {
    expect(afterValidation(licence(), { type: 'rejected' }, now)).toMatchObject({
      status: 'ended',
      grantedAt: installedAt,
    });
  });

  it('waits out a rate limit without changing the status', () => {
    expect(
      afterValidation(licence(), { type: 'rate-limited', retryAfterSeconds: 50 }, now),
    ).toEqual({ ...licence(), nextCheckAt: now + 50_000 });
  });

  it('retries within the hour when Polar is unreachable', () => {
    expect(afterValidation(licence(), { type: 'unreachable' }, now)).toEqual({
      ...licence(),
      nextCheckAt: now + 60 * 60 * 1000,
    });
  });
});
