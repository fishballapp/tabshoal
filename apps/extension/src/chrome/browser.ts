import {
  GroupId,
  isOurGroup,
  NO_GROUP,
  type Operation,
  TabId,
  WindowId,
  type WindowSnapshot,
} from '../grouping/plan';
import { retryWhileDragging } from './dragging';
import { loadSession, saveSession } from './session';

/** Every normal window with its tabs and groups, read fresh: the service worker holds no copy. */
export const takeSnapshot = async (): Promise<WindowSnapshot[]> => {
  const [windows, groups] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
    chrome.tabGroups.query({}),
  ]);
  return windows.flatMap(({ id, tabs = [] }) => {
    if (id === undefined) return [];
    return [
      {
        id: WindowId(id),
        tabs: tabs
          .toSorted((a, b) => a.index - b.index)
          .flatMap(tab =>
            tab.id === undefined
              ? []
              : [
                  {
                    id: TabId(tab.id),
                    // A tab still loading reports its destination as `pendingUrl`.
                    url: tab.pendingUrl ?? tab.url,
                    groupId: GroupId(tab.groupId),
                    isPinned: tab.pinned,
                    isActive: tab.active,
                    isInSplitView: (tab.splitViewId ?? -1) !== -1,
                  },
                ],
          ),
        groups: groups
          .filter(group => group.windowId === id)
          .map(({ id: groupId, title, collapsed }) => ({
            id: GroupId(groupId),
            title,
            isCollapsed: collapsed,
          })),
      },
    ];
  });
};

/** The tabs in one of our groups. */
export const ourTabIdsIn = (
  windows: readonly WindowSnapshot[],
  provisionalGroupIds: ReadonlySet<GroupId>,
) =>
  new Set(
    windows.flatMap(({ tabs, groups }) => {
      const ourGroupIds = new Set(
        groups.filter(g => isOurGroup(g, provisionalGroupIds)).map(({ id }) => id),
      );
      return tabs.filter(({ groupId }) => ourGroupIds.has(groupId)).map(({ id }) => id);
    }),
  );

/**
 * The group each tab is being put in by a call of ours that hasn't resolved yet. Chrome fires every
 * `tabs.onUpdated{groupId}` a call causes before the call resolves, so an event matching an entry
 * is our own echo, and anything else was the user.
 */
const pending = new Map<TabId, GroupId | 'new'>();

export const isOurEcho = (tabId: TabId, groupId: GroupId) => {
  const expected = pending.get(tabId);
  if (expected === undefined) return false;
  return expected === 'new' ? groupId !== NO_GROUP : expected === groupId;
};

const expecting = async <T>(
  tabIds: readonly TabId[],
  groupId: GroupId | 'new',
  call: () => Promise<T>,
): Promise<T> => {
  for (const tabId of tabIds) pending.set(tabId, groupId);
  try {
    return await call();
  } finally {
    for (const tabId of tabIds) {
      if (pending.get(tabId) === groupId) pending.delete(tabId);
    }
  }
};

/** `tabs.group` silently unpins a pinned tab, so check again right before every call. */
const unpinned = async (tabIds: readonly TabId[]) => {
  const tabs = await Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => undefined)));
  return tabs.flatMap(tab => (tab?.id === undefined || tab.pinned ? [] : [TabId(tab.id)]));
};

const nonEmpty = <T>([first, ...rest]: readonly T[]): [T, ...T[]] => {
  if (first === undefined) throw new Error('Expected at least one tab');
  return [first, ...rest];
};

/**
 * A group we made but haven't titled yet is still ours: if titling fails, or the worker stops in
 * between, the next run titles it. Once titled, the watermark says so, and the mark must go at once,
 * or a user renaming the group straight away would see the next run overwrite their name.
 */
const setProvisional = async (groupId: GroupId, isProvisional: boolean) => {
  const { provisionalGroupIds } = await loadSession();
  const only = new Set([groupId]);
  await saveSession({
    provisionalGroupIds: isProvisional
      ? provisionalGroupIds.union(only)
      : provisionalGroupIds.difference(only),
  });
};

export const applyOperation = async (operation: Operation): Promise<void> => {
  switch (operation.type) {
    case 'create': {
      const tabIds = await unpinned(operation.tabIds);
      if (tabIds.length === 0) return;
      const groupId = await expecting(tabIds, 'new', () =>
        chrome.tabs.group({
          tabIds: nonEmpty(tabIds),
          createProperties: { windowId: operation.windowId },
        }),
      );
      await setProvisional(GroupId(groupId), true);
      await retryWhileDragging(() =>
        chrome.tabGroups.update(groupId, {
          title: operation.title,
          color: operation.color,
          collapsed: operation.isCollapsed,
        }),
      );
      await setProvisional(GroupId(groupId), false);
      return;
    }
    case 'move-group': {
      const { groupId } = await chrome.tabs.get(operation.tabId);
      // Moves tabs without changing any tab's group, so no membership event to expect.
      await retryWhileDragging(() => chrome.tabGroups.move(groupId, { index: operation.index }));
      return;
    }
    case 'move': {
      const tabIds = await unpinned(operation.tabIds);
      if (tabIds.length === 0) return;
      await expecting(tabIds, operation.groupId, () =>
        chrome.tabs.group({ tabIds: nonEmpty(tabIds), groupId: operation.groupId }),
      );
      return;
    }
    case 'ungroup':
      await expecting(operation.tabIds, NO_GROUP, () =>
        chrome.tabs.ungroup(nonEmpty(operation.tabIds)),
      );
      return;
    case 'update':
      await chrome.tabGroups.update(operation.groupId, {
        ...(operation.title !== undefined ? { title: operation.title } : {}),
        ...(operation.color !== undefined ? { color: operation.color } : {}),
        ...(operation.isCollapsed !== undefined ? { collapsed: operation.isCollapsed } : {}),
      });
      // Every title we set carries the watermark, so a group retitled here no longer needs the mark.
      if (operation.title !== undefined) await setProvisional(operation.groupId, false);
      return;
  }
};
