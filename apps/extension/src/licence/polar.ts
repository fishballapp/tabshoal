import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { POLAR, type PolarConfig } from './polar-config';

export const polar: PolarConfig =
  import.meta.env.MODE === 'release' ? POLAR.production : POLAR.sandbox;

/** What Polar said about a key. */
export type Validation =
  | { type: 'granted' }
  /** Unknown, malformed, revoked, or "no longer active" after the subscription was cancelled. */
  | { type: 'rejected' }
  | { type: 'rate-limited'; retryAfterSeconds: number }
  | { type: 'unreachable' };

const ValidatedKeySchema = Schema.Struct({ status: Schema.String });

/**
 * Polar's customer-portal validate endpoint: no auth, so the browser calls it directly. A cancelled
 * subscription answers 404 "License key is no longer active.", not a 200 with a revoked status, and
 * a key for another benefit (another Fishball app) 404 "License key does not match given benefit."
 */
export const validateKey = async (
  key: string,
  {
    api,
    organizationId,
    benefitId,
  }: Pick<PolarConfig, 'api' | 'organizationId' | 'benefitId'> = polar,
): Promise<Validation> => {
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
  return body.value.status === 'granted' ? { type: 'granted' } : { type: 'rejected' };
};
