import { parse } from 'tldts';

/** The group key of a tab: its registrable domain (eTLD+1), or the hostname where there is none. */
export type Site = { key: string; hostname: string };

// The PSL's private section too, so `alice.github.io` and `bob.github.io` are different sites.
const PSL_OPTIONS = { allowPrivateDomains: true };

/**
 * The site a URL belongs to, or `undefined` for anything that isn't a web page (`chrome://`, the
 * new tab page, `about:blank`, `file://`), which TabShoal leaves alone.
 */
export const siteOf = (url: string | undefined): Site | undefined => {
  if (url === undefined || !/^https?:\/\//iu.test(url)) return undefined;
  const { hostname, domain, isIp } = parse(url, PSL_OPTIONS);
  if (hostname === null || hostname === '') return undefined;
  return { key: isIp === true || domain === null ? hostname : domain, hostname };
};

export type TitleStyle = 'name' | 'domain';

/**
 * Appended to the title of every group TabShoal makes. A group without it is the user's, and
 * TabShoal never touches it. Zero-width characters, so it renders invisibly.
 */
export const WATERMARK = '\u200B\u200C\u200D\u2060';

/** Shown before every title we set, so people can tell our groups at a glance; never read back. */
export const TITLE_PREFIX = '🐟 ';

export const isOurTitle = (title: string | undefined): boolean =>
  title?.endsWith(WATERMARK) ?? false;

/** What people see as a group's title: `🐟 google` in the `name` style, `🐟 google.com` in `domain`. */
export const visibleTitleFor = (key: string, style: TitleStyle): string => {
  const label = style === 'domain' ? key : (parse(key, PSL_OPTIONS).domainWithoutSuffix ?? key);
  return `${TITLE_PREFIX}${label === '' ? key : label}`;
};

/** The title we set: the visible title, then the watermark. */
export const titleFor = (key: string, style: TitleStyle): string =>
  `${visibleTitleFor(key, style)}${WATERMARK}`;

export const GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

/** A stable colour per site (FNV-1a over the key), so a site keeps its colour across groups. */
export const colorFor = (key: string): GroupColor => {
  const hash = [...key].reduce(
    (acc, char) => Math.imul(acc ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0,
    0x811c9dc5,
  );
  const color = GROUP_COLORS[hash % GROUP_COLORS.length];
  if (color === undefined) throw new Error(`No group colour at ${hash % GROUP_COLORS.length}`);
  return color;
};

/** Whether `site` falls under a "never group" entry: the entry itself or any of its subdomains. */
export const isExcluded = (site: Site, neverGroup: readonly string[]): boolean =>
  neverGroup.some(entry => site.hostname === entry || site.hostname.endsWith(`.${entry}`));
