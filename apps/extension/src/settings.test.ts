import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normaliseSiteEntry, SettingsSchema } from './settings';

describe('settings', () => {
  it('defaults to two tabs, nothing excluded, short names, groups left as they are', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      minimumTabs: 2,
      neverGroup: [],
      titleStyle: 'name',
      shouldCollapseInactive: false,
      shouldKeepGroupsAtStart: false,
    });
  });

  it('fills a missing setting from its default', () => {
    expect(Schema.decodeSync(SettingsSchema)({ minimumTabs: 4 })).toEqual({
      ...DEFAULT_SETTINGS,
      minimumTabs: 4,
    });
  });

  it('rejects a minimum outside 2–10', () => {
    expect(() => Schema.decodeSync(SettingsSchema)({ minimumTabs: 1 })).toThrow();
  });
});

describe('normaliseSiteEntry', () => {
  it.each([
    ['localhost', 'localhost'],
    ['  Example.COM ', 'example.com'],
    ['https://mail.google.com/u/0', 'mail.google.com'],
    ['www.reddit.com', 'reddit.com'],
    ['localhost:3000', 'localhost'],
  ])('reads %j as %j', (entry, hostname) => {
    expect(normaliseSiteEntry(entry)).toBe(hostname);
  });

  it('reads nothing from a blank entry', () => {
    expect(normaliseSiteEntry('   ')).toBeUndefined();
  });
});
