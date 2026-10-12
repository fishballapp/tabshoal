import { describe, expect, it } from 'vitest';
import {
  colorFor,
  GROUP_COLORS,
  isExcluded,
  isOurTitle,
  siteOf,
  TITLE_PREFIX,
  titleFor,
  WATERMARK,
} from './site';

describe('siteOf', () => {
  it.each([
    ['https://mail.google.com/mail/u/0', 'google.com'],
    ['https://www.bbc.co.uk/news', 'bbc.co.uk'],
    ['http://localhost:5173/', 'localhost'],
    ['http://127.0.0.1:8080', '127.0.0.1'],
    ['http://[::1]:3000/', '::1'],
    ['https://foo.github.io', 'foo.github.io'],
  ])('keys %s on %s', (url, key) => {
    expect(siteOf(url)?.key).toBe(key);
  });

  it.each([
    'chrome://newtab/',
    'chrome-extension://abc/popup.html',
    'about:blank',
    'file:///srv/a.txt',
    'data:text/plain,hi',
    undefined,
  ])('leaves %s alone', url => {
    expect(siteOf(url)).toBeUndefined();
  });
});

describe('titleFor', () => {
  it('drops the public suffix in the name style', () => {
    expect(titleFor('bbc.co.uk', 'name')).toBe(`🐟 bbc${WATERMARK}`);
    expect(titleFor('localhost', 'name')).toBe(`🐟 localhost${WATERMARK}`);
    expect(titleFor('10.0.0.1', 'name')).toBe(`🐟 10.0.0.1${WATERMARK}`);
  });

  it('names a private-suffix site by its own label', () => {
    expect(titleFor('alice.github.io', 'name')).toBe(`🐟 alice${WATERMARK}`);
  });

  it('keeps the registrable domain in the domain style', () => {
    expect(titleFor('bbc.co.uk', 'domain')).toBe(`🐟 bbc.co.uk${WATERMARK}`);
  });

  it('marks the title as ours by the watermark, never by the fish', () => {
    expect(isOurTitle(titleFor('a.com', 'name'))).toBe(true);
    expect(isOurTitle('a')).toBe(false);
    expect(isOurTitle(`${TITLE_PREFIX}a`)).toBe(false);
    expect(isOurTitle(undefined)).toBe(false);
  });
});

describe('colorFor', () => {
  it('gives a site the same Chrome colour every time', () => {
    expect(colorFor('github.com')).toBe(colorFor('github.com'));
    expect(GROUP_COLORS).toContain(colorFor('github.com'));
  });

  it('spreads sites across the colours', () => {
    const colors = new Set(
      [
        'google.com',
        'github.com',
        'bbc.co.uk',
        'example.org',
        'reddit.com',
        'x.com',
        'nytimes.com',
      ].map(colorFor),
    );
    expect(colors.size).toBeGreaterThan(3);
  });
});

describe('isExcluded', () => {
  const site = (hostname: string) => ({ key: hostname, hostname });

  it('covers the entry and its subdomains, not lookalikes', () => {
    expect(isExcluded(site('google.com'), ['google.com'])).toBe(true);
    expect(isExcluded(site('mail.google.com'), ['google.com'])).toBe(true);
    expect(isExcluded(site('notgoogle.com'), ['google.com'])).toBe(false);
    expect(isExcluded(site('google.com'), ['mail.google.com'])).toBe(false);
  });
});
