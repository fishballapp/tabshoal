import { count, sum } from '@fishballapps/utils';
import * as Brand from 'effect/Brand';
import type { Settings } from '../settings';
import {
  colorFor,
  type GroupColor,
  isExcluded,
  isOurTitle,
  type Site,
  siteOf,
  titleFor,
} from './site';

export type TabId = number & Brand.Brand<'TabId'>;
export const TabId = Brand.nominal<TabId>();
export type GroupId = number & Brand.Brand<'GroupId'>;
export const GroupId = Brand.nominal<GroupId>();
export type WindowId = number & Brand.Brand<'WindowId'>;
export const WindowId = Brand.nominal<WindowId>();

/** Chrome's `TAB_GROUP_ID_NONE`. */
export const NO_GROUP = GroupId(-1);

export type TabSnapshot = {
  id: TabId;
  url: string | undefined;
  groupId: GroupId;
  isPinned: boolean;
  isActive: boolean;
  isInSplitView: boolean;
};

export type GroupSnapshot = { id: GroupId; title: string | undefined; isCollapsed: boolean };

/** A normal window, its tabs in strip order. */
export type WindowSnapshot = { id: WindowId; tabs: TabSnapshot[]; groups: GroupSnapshot[] };

export type PlanInput = {
  windows: readonly WindowSnapshot[];
  settings: Settings;
  /** Tabs the user took out of one of our groups; left alone until Regroup all. */
  untrackedTabIds: ReadonlySet<TabId>;
  pausedWindowIds: ReadonlySet<WindowId>;
  /** Groups we created but may not have titled yet (see {@link isOurGroup}). */
  provisionalGroupIds: ReadonlySet<GroupId>;
};

/**
 * Ours: the title ends with the watermark, or we created the group and haven't seen it titled yet,
 * which the next plan then titles like any other.
 */
export const isOurGroup = (
  { id, title }: GroupSnapshot,
  provisionalGroupIds: ReadonlySet<GroupId>,
): boolean => isOurTitle(title) || provisionalGroupIds.has(id);

export type Operation =
  | {
      type: 'create';
      windowId: WindowId;
      tabIds: TabId[];
      title: string;
      color: GroupColor;
      isCollapsed: boolean;
    }
  | { type: 'move'; groupId: GroupId; tabIds: TabId[] }
  /**
   * Moves the group holding `tabId` so its first tab lands at `index` (`tabGroups.move`). Named by
   * a member because a group created earlier in the same plan has no ID yet.
   */
  | { type: 'move-group'; tabId: TabId; index: number }
  | { type: 'ungroup'; tabIds: TabId[] }
  | { type: 'update'; groupId: GroupId; title?: string; color?: GroupColor; isCollapsed?: boolean };

/**
 * The operations that bring every window in line with the grouping rules. Applying them and
 * planning again yields nothing: the plan is a pure function of what the browser shows now, so
 * the service worker keeps no state of its own about groups.
 */
export const plan = ({
  windows,
  settings,
  untrackedTabIds,
  pausedWindowIds,
  provisionalGroupIds,
}: PlanInput) =>
  windows
    .filter(({ id }) => !pausedWindowIds.has(id))
    .flatMap(window => planWindow(window, settings, untrackedTabIds, provisionalGroupIds));

type TrackedTab = TabSnapshot & { site: Site };

const planWindow = (
  { id: windowId, tabs, groups }: WindowSnapshot,
  settings: Settings,
  untrackedTabIds: ReadonlySet<TabId>,
  provisionalGroupIds: ReadonlySet<GroupId>,
): Operation[] => {
  const ourGroups = groups.filter(group => isOurGroup(group, provisionalGroupIds));
  const ourGroupIds = new Set(ourGroups.map(({ id }) => id));
  const isInOurGroup = (tab: TabSnapshot) => ourGroupIds.has(tab.groupId);

  const siteToTrack = (tab: TabSnapshot): Site | undefined => {
    if (tab.isPinned || tab.isInSplitView) return undefined;
    if (tab.groupId !== NO_GROUP && !isInOurGroup(tab)) return undefined;
    if (!isInOurGroup(tab) && untrackedTabIds.has(tab.id)) return undefined;
    const site = siteOf(tab.url);
    if (site === undefined || isExcluded(site, settings.neverGroup)) return undefined;
    return site;
  };
  const tracked = tabs.flatMap((tab): TrackedTab[] => {
    const site = siteToTrack(tab);
    return site === undefined ? [] : [{ ...tab, site }];
  });

  const shoals = new Map(
    [...Map.groupBy(tracked, ({ site }) => site.key)].filter(
      ([, members]) => members.length >= settings.minimumTabs,
    ),
  );
  const groupOf = assignGroups(ourGroups, shoals, settings);

  const activeKey = tracked.find(({ isActive }) => isActive)?.site.key;
  const collapsedFor = (key: string, current: boolean) =>
    settings.shouldCollapseInactive ? key !== activeKey : current;

  const kept = [...shoals].flatMap(([key, members]) => {
    const group = groupOf.get(key);
    return group === undefined ? [] : [{ key, members, group }];
  });
  const fresh = [...shoals].filter(([key]) => !groupOf.has(key));

  const keptOperations = kept.flatMap(({ key, members, group }): Operation[] => {
    const title = titleFor(key, settings.titleStyle);
    const strays = members.filter(({ groupId }) => groupId !== group.id).map(({ id }) => id);
    const isCollapsed = collapsedFor(key, group.isCollapsed);
    return [
      ...(strays.length > 0 ? [{ type: 'move' as const, groupId: group.id, tabIds: strays }] : []),
      ...(group.title !== title || group.isCollapsed !== isCollapsed
        ? [
            {
              type: 'update' as const,
              groupId: group.id,
              ...(group.title !== title ? { title } : {}),
              // A group we created but never titled has Chrome's colour, not the site's.
              ...(isOurTitle(group.title) ? {} : { color: colorFor(key) }),
              ...(group.isCollapsed !== isCollapsed ? { isCollapsed } : {}),
            },
          ]
        : []),
    ];
  });

  const firstIndexOf = (groupId: GroupId) => tabs.findIndex(tab => tab.groupId === groupId);

  const shoaledTabIds = new Set([...shoals.values()].flat().map(({ id }) => id));
  const flattened = tabs
    .filter(tab => isInOurGroup(tab) && !shoaledTabIds.has(tab.id))
    .map(({ id }) => id);

  const keptInStripOrder = kept.toSorted(
    (a, b) => firstIndexOf(a.group.id) - firstIndexOf(b.group.id),
  );
  // Our groups in their current order, then the new ones, each starting where the last one ends.
  const starts = startIndices(
    [...keptInStripOrder, ...fresh.map(([, members]) => ({ members }))].map(
      ({ members }) => members.length,
    ),
    count(tabs, ({ isPinned }) => isPinned),
  );
  // Tabs changing groups move in the strip; nothing from the first of them on can be trusted to stay.
  const strayMoves = keptOperations.flatMap(operation =>
    operation.type === 'move' ? [operation] : [],
  );
  const firstDisturbed = Math.min(
    tabs.length,
    ...[
      ...flattened,
      ...strayMoves.flatMap(({ tabIds }) => tabIds),
      ...fresh.flatMap(([, members]) => members.map(({ id }) => id)),
    ].map(tabId => tabs.findIndex(({ id }) => id === tabId)),
    ...strayMoves.map(({ groupId }) => firstIndexOf(groupId)),
  );
  const isInPlace = (groupId: GroupId, start: number, size: number) =>
    start + size <= firstDisturbed &&
    count(tabs, tab => tab.groupId === groupId) === size &&
    tabs.slice(start, start + size).every(tab => tab.groupId === groupId);

  const blocks = [
    ...keptInStripOrder.map(({ group, members }) => ({ group, members })),
    ...fresh.map(([, members]) => ({ group: undefined, members })),
  ];
  // After membership has settled, front to back: each move goes left or nowhere and lands on the
  // boundary where the groups before it end, never inside another group (which Chrome refuses).
  const groupMoves = settings.shouldKeepGroupsAtStart
    ? blocks.flatMap(({ group, members }, i): Operation[] => {
        const index = starts[i];
        const [first] = members;
        if (index === undefined || first === undefined) throw new Error(`No block ${i} to place`);
        if (group !== undefined && isInPlace(group.id, index, members.length)) return [];
        return [{ type: 'move-group', tabId: first.id, index }];
      })
    : [];

  const creates = fresh.map(
    ([key, members]): Operation => ({
      type: 'create',
      windowId,
      tabIds: members.map(({ id }) => id),
      title: titleFor(key, settings.titleStyle),
      color: colorFor(key),
      isCollapsed: collapsedFor(key, false),
    }),
  );

  // Membership first, so no tab of one group is left inside another when groups start to move.
  return [
    ...creates,
    ...keptOperations,
    ...(flattened.length > 0 ? [{ type: 'ungroup' as const, tabIds: flattened }] : []),
    ...groupMoves,
  ];
};

/** Where each of a run of blocks starts, laid end to end from `start`. */
const startIndices = (sizes: readonly number[], start: number) =>
  sizes.map((_, i) => start + sum(sizes.slice(0, i)));

/**
 * Which of our groups each shoal keeps. A group's site is read from its members, not its title,
 * since titles drop the public suffix (`google` is both google.com and google.co.uk). A group whose
 * title already names the site wins, then the one holding most of it; each group serves one site,
 * and a group left without one empties out and disappears.
 */
const assignGroups = (
  ourGroups: readonly GroupSnapshot[],
  shoals: ReadonlyMap<string, readonly TrackedTab[]>,
  settings: Settings,
): Map<string, GroupSnapshot> => {
  const claims = ourGroups
    .flatMap(group =>
      [...shoals].map(([key, members]) => ({
        group,
        key,
        count: members.filter(({ groupId }) => groupId === group.id).length,
        isTitleMatch: group.title === titleFor(key, settings.titleStyle),
      })),
    )
    .filter(({ count }) => count > 0)
    .toSorted((a, b) => Number(b.isTitleMatch) - Number(a.isTitleMatch) || b.count - a.count);

  const groupOf = new Map<string, GroupSnapshot>();
  const claimed = new Set<GroupId>();
  for (const { group, key } of claims) {
    if (groupOf.has(key) || claimed.has(group.id)) continue;
    groupOf.set(key, group);
    claimed.add(group.id);
  }
  return groupOf;
};
