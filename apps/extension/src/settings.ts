import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

export const MINIMUM_TABS_RANGE = { minimum: 2, maximum: 10 } as const;

export const SettingsSchema = Schema.Struct({
  minimumTabs: Schema.Int.check(Schema.isBetween(MINIMUM_TABS_RANGE)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(2)),
  ),
  /** Hostnames never grouped, each covering its subdomains too. */
  neverGroup: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  titleStyle: Schema.Literals(['name', 'domain']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('name' as const)),
  ),
  shouldCollapseInactive: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  /** Our groups sit together right after the pinned tabs, in their current order. */
  shouldKeepGroupsAtStart: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
  /** Closing the tab you're on activates the tab that opened it, if that is still open here. */
  shouldReturnToOpener: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
});

export type Settings = typeof SettingsSchema.Type;

export const DEFAULT_SETTINGS: Settings = Schema.decodeSync(SettingsSchema)({});

/**
 * Settings sync across the user's Chromes. A stored value that no longer decodes falls back to the
 * defaults rather than stopping grouping.
 */
export const loadSettings = async (): Promise<Settings> => {
  const { settings }: Record<string, unknown> = await chrome.storage.sync.get('settings');
  return Option.getOrElse(
    Schema.decodeUnknownOption(SettingsSchema)(settings),
    () => DEFAULT_SETTINGS,
  );
};

export const saveSettings = (settings: Settings) =>
  chrome.storage.sync.set({ settings: Schema.encodeSync(SettingsSchema)(settings) });

/**
 * The hostname a "never group" entry names, accepting what people paste: `localhost`,
 * `https://mail.google.com/u/0`, `Example.com:8080`. `undefined` when there is no hostname in it.
 */
export const normaliseSiteEntry = (entry: string): string | undefined => {
  const trimmed = entry.trim().toLowerCase();
  if (trimmed === '') return undefined;
  const hostname = URL.parse(
    /^[a-z][a-z\d+.-]*:\/\//u.test(trimmed) ? trimmed : `http://${trimmed}`,
  )?.hostname;
  return hostname === undefined || hostname === '' ? undefined : hostname.replace(/^www\./u, '');
};
