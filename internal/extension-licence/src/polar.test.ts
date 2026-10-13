import { afterEach, describe, expect, it, vi } from 'vitest';
import { readValidation, validateKey } from './polar';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('readValidation', () => {
  it('grants a key Polar says is granted', async () => {
    expect(await readValidation(json(200, { id: 'x', status: 'granted' }))).toEqual({
      type: 'granted',
    });
  });

  it('reads when a key expires', async () => {
    expect(
      await readValidation(
        json(200, { status: 'granted', expires_at: '2027-10-13T01:34:41.813291Z' }),
      ),
    ).toEqual({ type: 'granted', expiresAt: Date.UTC(2027, 9, 13, 1, 34, 41, 813) });
    expect(await readValidation(json(200, { status: 'granted', expires_at: null }))).toEqual({
      type: 'granted',
    });
  });

  it('rejects a revoked or disabled key', async () => {
    expect(await readValidation(json(200, { status: 'revoked' }))).toEqual({ type: 'rejected' });
  });

  it('rejects the 404 Polar answers once a subscription is cancelled', async () => {
    expect(await readValidation(json(404, { detail: 'License key is no longer active.' }))).toEqual(
      { type: 'rejected' },
    );
  });

  it('rejects a malformed key', async () => {
    expect(await readValidation(json(422, { detail: [] }))).toEqual({ type: 'rejected' });
  });

  it('reads retry-after from a rate limit', async () => {
    expect(await readValidation(json(429, {}, { 'retry-after': '50' }))).toEqual({
      type: 'rate-limited',
      retryAfterSeconds: 50,
    });
    expect(await readValidation(json(429, {}))).toEqual({
      type: 'rate-limited',
      retryAfterSeconds: 60,
    });
  });

  it('treats a server error or an unexpected body as no answer', async () => {
    expect(await readValidation(json(502, {}))).toEqual({ type: 'unreachable' });
    expect(await readValidation(json(200, { nope: true }))).toEqual({ type: 'unreachable' });
  });
});

describe('validateKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const server = {
    api: 'https://polar.test',
    organizationId: 'org',
    benefitIds: ['one-year', 'supporter'],
  } as const;
  const bodies = (fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>) =>
    fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
  const notThisBenefit = () =>
    json(404, { error: 'ResourceNotFound', detail: 'License key does not match given benefit.' });

  it('asks about the extension’s benefits, so another Fishball app’s key is refused', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => notThisBenefit());
    vi.stubGlobal('fetch', fetch);
    expect(await validateKey('OTHER-APP-KEY', server)).toEqual({ type: 'rejected' });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://polar.test/v1/customer-portal/license-keys/validate',
    );
    expect(bodies(fetch)).toEqual([
      { key: 'OTHER-APP-KEY', organization_id: 'org', benefit_id: 'one-year' },
      { key: 'OTHER-APP-KEY', organization_id: 'org', benefit_id: 'supporter' },
    ]);
  });

  it('grants a key of the second benefit', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_, init) =>
      JSON.parse(String(init?.body)).benefit_id === 'supporter'
        ? json(200, { status: 'granted', expires_at: null })
        : notThisBenefit(),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await validateKey('SUPPORTER-KEY', server)).toEqual({ type: 'granted' });
  });

  it('stops at an answer that isn’t a rejection', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(429, {}, { 'retry-after': '5' }));
    vi.stubGlobal('fetch', fetch);
    expect(await validateKey('KEY', server)).toEqual({
      type: 'rate-limited',
      retryAfterSeconds: 5,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
