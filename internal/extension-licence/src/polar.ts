import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

/** Where an extension's keys are checked: its Polar organization and the benefits a key may come from. */
export type LicenceServer = {
  api: string;
  organizationId: string;
  benefitIds: readonly [string, ...string[]];
};

/** What Polar said about a key. */
export type Validation =
  /** `expiresAt` (epoch ms) for a key that expires. */
  | { type: 'granted'; expiresAt?: number }
  /** Unknown, malformed, revoked, expired, or "no longer active" after the subscription was cancelled. */
  | { type: 'rejected' }
  | { type: 'rate-limited'; retryAfterSeconds: number }
  | { type: 'unreachable' };

const ValidatedKeySchema = Schema.Struct({
  status: Schema.String,
  expires_at: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

/**
 * Asks Polar about a key, against each of the extension's benefits in turn. The sandbox organization
 * is shared by every Fishball app, so a key is checked against a benefit too: without one, another
 * app's key would validate. A key of another benefit answers 404 "License key does not match given
 * benefit.", so a rejection moves on to the next benefit; any other answer is final.
 */
export const validateKey = async (
  key: string,
  { api, organizationId, benefitIds }: LicenceServer,
): Promise<Validation> => {
  for (const benefitId of benefitIds) {
    const validation = await validateForBenefit({ key, api, organizationId, benefitId });
    if (validation.type !== 'rejected') return validation;
  }
  return { type: 'rejected' };
};

/**
 * Polar's customer-portal validate endpoint: no auth, so the browser calls it directly. A cancelled
 * subscription answers 404 "License key is no longer active.", an expired key 404 "License key has
 * expired.", not a 200 with a revoked status.
 */
const validateForBenefit = async ({
  key,
  api,
  organizationId,
  benefitId,
}: {
  key: string;
  api: string;
  organizationId: string;
  benefitId: string;
}): Promise<Validation> => {
  const response = await fetch(`${api}/v1/customer-portal/license-keys/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, organization_id: organizationId, benefit_id: benefitId }),
  }).catch(() => undefined);
  if (response === undefined) return { type: 'unreachable' };
  return readValidation(response);
};

export const readValidation = async (response: Response): Promise<Validation> => {
  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    return { type: 'rate-limited', retryAfterSeconds: Number.isNaN(retryAfter) ? 60 : retryAfter };
  }
  if ([400, 403, 404, 422].includes(response.status)) return { type: 'rejected' };
  if (!response.ok) return { type: 'unreachable' };
  const body = Schema.decodeUnknownOption(ValidatedKeySchema)(
    await response.json().catch(() => null),
  );
  if (Option.isNone(body)) return { type: 'unreachable' };
  const { status, expires_at } = body.value;
  if (status !== 'granted') return { type: 'rejected' };
  return expires_at == null
    ? { type: 'granted' }
    : { type: 'granted', expiresAt: Temporal.Instant.from(expires_at).epochMilliseconds };
};
