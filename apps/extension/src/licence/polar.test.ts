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

  it('asks about TabShoal’s benefit, so another Fishball app’s key is refused', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json(404, { error: 'ResourceNotFound', detail: 'License key does not match given benefit.' }),
    );
    vi.stubGlobal('fetch', fetch);
    const validation = await validateKey('OTHER-APP-KEY', {
      api: 'https://polar.test',
      organizationId: 'org',
      benefitId: 'tabshoal-benefit',
    });
    expect(validation).toEqual({ type: 'rejected' });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://polar.test/v1/customer-portal/license-keys/validate');
    expect(JSON.parse(String(init?.body))).toEqual({
      key: 'OTHER-APP-KEY',
      organization_id: 'org',
      benefit_id: 'tabshoal-benefit',
    });
  });
});
