import { count } from '@fishballapps/utils';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import {
  GroupId,
  type GroupSnapshot,
  NO_GROUP,
  type Operation,
  type PlanInput,
  plan,
  TabId,
  type TabSnapshot,
  WindowId,
  type WindowSnapshot,
} from './plan';
import { TITLE_PREFIX, WATERMARK } from './site';

const title = (label: string) => `${TITLE_PREFIX}${label}${WATERMARK}`;

const WINDOW = WindowId(1);

const tab = (
  id: number,
  url: string,
  overrides: Partial<Omit<TabSnapshot, 'id' | 'url'>> = {},
): TabSnapshot => ({
  id: TabId(id),
  url,
  groupId: NO_GROUP,
  isPinned: false,
  isActive: false,
  isInSplitView: false,
  ...overrides,
});

const ours = (id: number, label: string, isCollapsed = false): GroupSnapshot => ({
  id: GroupId(id),
  title: title(label),
  isCollapsed,
});

const theirs = (id: number, title: string): GroupSnapshot => ({
  id: GroupId(id),
  title,
  isCollapsed: false,
});

const input = (
  window: Omit<WindowSnapshot, 'id'>,
  overrides: Partial<Omit<PlanInput, 'windows' | 'settings'>> & {
    settings?: Partial<Settings>;
  } = {},
): PlanInput => ({
  windows: [{ id: WINDOW, ...window }],
  untrackedTabIds: new Set(),
  pausedWindowIds: new Set(),
  collapsingWindowIds: new Set([WINDOW]),
  provisionalGroupIds: new Set(),
  ...overrides,
  settings: { ...DEFAULT_SETTINGS, ...overrides.settings },
});

/**
 * Applies operations the way Chrome does: tabs joining a group move to its end, an ungrouped tab
 * moves out past the group's end, a new group gathers at its first tab, `move-group` lifts the
 * group out and puts its first tab at `index`, and a group goes once its last tab leaves.
 */
const apply = (snapshot: PlanInput, operations: readonly Operation[]): PlanInput => {
  let nextGroupId = 1000;
  const windows = snapshot.windows.map(window => {
    let { tabs, groups } = window;
    const place = (tabIds: readonly TabId[], at: (rest: TabSnapshot[]) => number) => {
      const moving = tabs.filter(({ id }) => tabIds.includes(id));
      const rest = tabs.filter(({ id }) => !tabIds.includes(id));
      const index = at(rest);
      tabs = [...rest.slice(0, index), ...moving, ...rest.slice(index)];
    };
    const setGroup = (tabIds: readonly TabId[], groupId: GroupId) => {
      tabs = tabs.map(t => (tabIds.includes(t.id) ? { ...t, groupId } : t));
    };
    const afterGroup = (groupId: GroupId) => (rest: TabSnapshot[]) =>
      rest.findLastIndex(t => t.groupId === groupId) + 1;
    /** Whether `index` in `rest` falls between two tabs of one group. */
    const isInsideGroup = (rest: TabSnapshot[], index: number) => {
      const before = rest[index - 1]?.groupId;
      return before !== undefined && before !== NO_GROUP && before === rest[index]?.groupId;
    };
    const moveGroup = (groupId: GroupId, index: number) =>
      place(
        tabs.filter(t => t.groupId === groupId).map(({ id }) => id),
        rest => {
          if (isInsideGroup(rest, index)) {
            throw new Error(
              'Cannot move the group to an index that is in the middle of another group.',
            );
          }
          return index;
        },
      );
    for (const operation of operations) {
      switch (operation.type) {
        case 'create': {
          if (operation.windowId !== window.id) break;
          const id = GroupId(nextGroupId++);
          groups = [...groups, { id, title: operation.title, isCollapsed: operation.isCollapsed }];
          const first = tabs.findIndex(t => operation.tabIds.includes(t.id));
          // Gathered at its first tab, or just past the group that tab was inside.
          place(operation.tabIds, rest => {
            const enclosing = rest[first - 1]?.groupId ?? NO_GROUP;
            return isInsideGroup(rest, first) ? afterGroup(enclosing)(rest) : first;
          });
          setGroup(operation.tabIds, id);
          break;
        }
        case 'move':
          if (!groups.some(({ id }) => id === operation.groupId)) break;
          setGroup(operation.tabIds, operation.groupId);
          place(operation.tabIds, afterGroup(operation.groupId));
          break;
        case 'ungroup':
          for (const tabId of operation.tabIds) {
            const index = tabs.findIndex(({ id }) => id === tabId);
            const groupId = tabs[index]?.groupId ?? NO_GROUP;
            setGroup([tabId], NO_GROUP);
            // The group's last tab stays where it is; any other leaves past the group's end.
            place([tabId], rest => {
              const end = afterGroup(groupId)(rest);
              return end === 0 ? index : end;
            });
          }
          break;
        case 'move-group': {
          const groupId = tabs.find(({ id }) => id === operation.tabId)?.groupId;
          if (groupId === undefined || groupId === NO_GROUP) throw new Error('No group to move');
          moveGroup(groupId, operation.index);
          break;
        }
        case 'update':
          groups = groups.map(g =>
            g.id === operation.groupId
              ? {
                  ...g,
                  title: operation.title ?? g.title,
                  isCollapsed: operation.isCollapsed ?? g.isCollapsed,
                }
              : g,
          );
          break;
      }
    }
    groups = groups.filter(({ id }) => tabs.some(({ groupId }) => groupId === id));
    return { ...window, tabs, groups };
  });
  return { ...snapshot, windows };
};

/** A group's tabs are always side by side in Chrome; the simulation must keep it so. */
const expectContiguousGroups = ({ tabs }: WindowSnapshot) => {
  const runs = tabs
    .map(({ groupId }) => groupId)
    .filter((groupId, i, all) => groupId !== NO_GROUP && groupId !== all[i - 1]);
  expect(new Set(runs).size).toBe(runs.length);
};

/** Plans, applies, and checks the result is stable: a second plan has nothing left to do. */
const settle = (snapshot: PlanInput) => {
  const operations = plan(snapshot);
  const after = apply(snapshot, operations);
  expect(plan(after)).toEqual([]);
  const window = after.windows[0]!;
  expectContiguousGroups(window);
  const membersOf = (groupId: GroupId) =>
    window.tabs
      .filter(t => t.groupId === groupId)
      .map(({ id }) => id)
      .toSorted((a, b) => a - b);
  return {
    operations,
    groups: window.groups.map(g => ({ title: g.title, tabIds: membersOf(g.id) })),
    ungrouped: membersOf(NO_GROUP),
    strip: window.tabs.map(({ id, groupId }) => {
      const group = window.groups.find(g => g.id === groupId);
      return group === undefined ? id : `${group.title?.replace(/\W/gu, '') ?? '?'}:${id}`;
    }),
  };
};

describe('plan', () => {
  it('groups a site once it has two tabs in the window', () => {
    const { operations } = settle(
      input({ tabs: [tab(1, 'https://a.com/x'), tab(2, 'https://a.com/y')], groups: [] }),
    );
    expect(operations).toEqual([
      {
        type: 'create',
        windowId: WINDOW,
        tabIds: [1, 2],
        title: title('a'),
        color: expect.any(String),
        isCollapsed: false,
      },
    ]);
  });

  it('leaves a lone tab alone', () => {
    expect(plan(input({ tabs: [tab(1, 'https://a.com')], groups: [] }))).toEqual([]);
  });

  it('shares one group between subdomains of a registrable domain', () => {
    const { groups } = settle(
      input({
        tabs: [tab(1, 'https://mail.google.com'), tab(2, 'https://docs.google.com')],
        groups: [],
      }),
    );
    expect(groups).toEqual([{ title: title('google'), tabIds: [1, 2] }]);
  });

  it('keys IPs and localhost on the hostname, across ports', () => {
    const { groups } = settle(
      input({
        tabs: [
          tab(1, 'http://localhost:3000'),
          tab(2, 'http://localhost:5173'),
          tab(3, 'http://192.168.0.1/a'),
          tab(4, 'http://192.168.0.1/b'),
        ],
        groups: [],
      }),
    );
    expect(groups).toEqual([
      { title: title('localhost'), tabIds: [1, 2] },
      { title: title('192.168.0.1'), tabIds: [3, 4] },
    ]);
  });

  it('ignores pages that are not http(s)', () => {
    const tabs = ['chrome://newtab/', 'chrome://newtab/', 'about:blank', 'about:blank']
      .map((url, i) => tab(i + 1, url))
      .concat([tab(5, 'file:///a.txt'), tab(6, 'file:///b.txt')]);
    expect(plan(input({ tabs, groups: [] }))).toEqual([]);
  });

  it('adds a new tab of a site to its existing group', () => {
    const { operations } = settle(
      input({
        tabs: [
          tab(1, 'https://a.com', { groupId: GroupId(7) }),
          tab(2, 'https://a.com', { groupId: GroupId(7) }),
          tab(3, 'https://a.com'),
        ],
        groups: [ours(7, 'a')],
      }),
    );
    expect(operations).toEqual([{ type: 'move', groupId: 7, tabIds: [3] }]);
  });

  it('flattens our group when it drops below the minimum', () => {
    const { operations, ungrouped } = settle(
      input({ tabs: [tab(1, 'https://a.com', { groupId: GroupId(7) })], groups: [ours(7, 'a')] }),
    );
    expect(operations).toEqual([{ type: 'ungroup', tabIds: [1] }]);
    expect(ungrouped).toEqual([1]);
  });

  describe('navigation', () => {
    it('moves a tab from site A to site B’s group', () => {
      const { groups, ungrouped } = settle(
        input({
          tabs: [
            tab(1, 'https://a.com', { groupId: GroupId(7) }),
            tab(2, 'https://a.com', { groupId: GroupId(7) }),
            tab(3, 'https://a.com', { groupId: GroupId(7) }),
            tab(4, 'https://b.com', { groupId: GroupId(8) }),
            tab(5, 'https://b.com', { groupId: GroupId(8) }),
          ].map(t => (t.id === 3 ? { ...t, url: 'https://b.com' } : t)),
          groups: [ours(7, 'a'), ours(8, 'b')],
        }),
      );
      expect(groups).toEqual([
        { title: title('a'), tabIds: [1, 2] },
        { title: title('b'), tabIds: [3, 4, 5] },
      ]);
      expect(ungrouped).toEqual([]);
    });

    it('ungroups it when site B has too few tabs, and flattens what A leaves behind', () => {
      const { groups, ungrouped } = settle(
        input({
          tabs: [
            tab(1, 'https://a.com', { groupId: GroupId(7) }),
            tab(2, 'https://b.com', { groupId: GroupId(7) }),
          ],
          groups: [ours(7, 'a')],
        }),
      );
      expect(groups).toEqual([]);
      expect(ungrouped).toEqual([1, 2]);
    });

    it('keeps A’s group for A when the navigated tab would tie it with B', () => {
      const { groups } = settle(
        input({
          tabs: [
            tab(1, 'https://a.com', { groupId: GroupId(7) }),
            tab(2, 'https://a.com', { groupId: GroupId(7) }),
            tab(3, 'https://b.com', { groupId: GroupId(7) }),
            tab(4, 'https://b.com', { groupId: GroupId(7) }),
          ],
          groups: [ours(7, 'a')],
        }),
      );
      expect(groups).toEqual([
        { title: title('a'), tabIds: [1, 2] },
        { title: title('b'), tabIds: [3, 4] },
      ]);
    });

    it('does nothing on a navigation within the same site', () => {
      expect(
        plan(
          input({
            tabs: [
              tab(1, 'https://mail.google.com', { groupId: GroupId(7) }),
              tab(2, 'https://www.google.com/search', { groupId: GroupId(7) }),
            ],
            groups: [ours(7, 'google')],
          }),
        ),
      ).toEqual([]);
    });
  });

  it('adds the fish to a title set before it, in place', () => {
    const { operations, groups } = settle(
      input({
        tabs: [
          tab(1, 'https://a.com', { groupId: GroupId(7) }),
          tab(2, 'https://a.com', { groupId: GroupId(7) }),
        ],
        groups: [{ id: GroupId(7), title: `a${WATERMARK}`, isCollapsed: false }],
      }),
    );
    expect(operations).toEqual([{ type: 'update', groupId: 7, title: title('a') }]);
    expect(groups).toEqual([{ title: title('a'), tabIds: [1, 2] }]);
  });

  it('merges two of our groups for the same site into the larger', () => {
    const { groups } = settle(
      input({
        tabs: [
          tab(1, 'https://a.com', { groupId: GroupId(7) }),
          tab(2, 'https://a.com', { groupId: GroupId(8) }),
          tab(3, 'https://a.com', { groupId: GroupId(8) }),
        ],
        groups: [ours(7, 'a'), ours(8, 'a')],
      }),
    );
    expect(groups).toEqual([{ title: title('a'), tabIds: [1, 2, 3] }]);
  });

  it('never touches a pinned tab', () => {
    expect(
      plan(
        input({
          tabs: [tab(1, 'https://a.com', { isPinned: true }), tab(2, 'https://a.com')],
          groups: [],
        }),
      ),
    ).toEqual([]);
  });

  it('skips tabs in a split view', () => {
    expect(
      plan(
        input({
          tabs: [tab(1, 'https://a.com', { isInSplitView: true }), tab(2, 'https://a.com')],
          groups: [],
        }),
      ),
    ).toEqual([]);
  });

  describe('the user’s groups', () => {
    it('ignores a group without the watermark, and does not count its tabs', () => {
      expect(
        plan(
          input({
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(9) }),
              tab(2, 'https://a.com', { groupId: GroupId(9) }),
              tab(3, 'https://a.com'),
            ],
            groups: [theirs(9, 'a')],
          }),
        ),
      ).toEqual([]);
    });

    it('treats a group titled like ours but without the watermark as the user’s', () => {
      expect(
        plan(
          input({
            tabs: [tab(1, 'https://a.com', { groupId: GroupId(9) })],
            groups: [theirs(9, `${title('a')}x`)],
          }),
        ),
      ).toEqual([]);
    });

    it('treats a fish-prefixed group without the watermark as the user’s', () => {
      expect(
        plan(
          input({
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(9) }),
              tab(2, 'https://a.com', { groupId: GroupId(9) }),
            ],
            groups: [theirs(9, `${TITLE_PREFIX}a`)],
          }),
        ),
      ).toEqual([]);
    });

    it('treats an untitled group as the user’s', () => {
      expect(
        plan(
          input({
            tabs: [tab(1, 'https://a.com', { groupId: GroupId(9) })],
            groups: [{ id: GroupId(9), title: undefined, isCollapsed: false }],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('groups we created but have not titled', () => {
    const untitled = (id: number): GroupSnapshot => ({
      id: GroupId(id),
      title: '',
      isCollapsed: false,
    });

    it('titles and colours a provisional group instead of leaving it as the user’s', () => {
      const { operations, groups } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'https://a.com', { groupId: GroupId(7) }),
            ],
            groups: [untitled(7)],
          },
          { provisionalGroupIds: new Set([GroupId(7)]) },
        ),
      );
      expect(operations).toEqual([
        { type: 'update', groupId: 7, title: title('a'), color: expect.any(String) },
      ]);
      expect(groups).toEqual([{ title: title('a'), tabIds: [1, 2] }]);
    });

    it('lets go of a provisional group’s tabs when their site no longer has enough', () => {
      const { ungrouped } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'https://b.com', { groupId: GroupId(7) }),
            ],
            groups: [untitled(7)],
          },
          { provisionalGroupIds: new Set([GroupId(7)]) },
        ),
      );
      expect(ungrouped).toEqual([1, 2]);
    });

    it('leaves the same untitled group alone when it is not provisional', () => {
      expect(
        plan(
          input({
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'https://a.com', { groupId: GroupId(7) }),
            ],
            groups: [untitled(7)],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('untracked tabs', () => {
    it('leaves an untracked tab out, even when its site has a group', () => {
      expect(
        plan(
          input(
            {
              tabs: [
                tab(1, 'https://a.com', { groupId: GroupId(7) }),
                tab(2, 'https://a.com', { groupId: GroupId(7) }),
                tab(3, 'https://a.com'),
              ],
              groups: [ours(7, 'a')],
            },
            { untrackedTabIds: new Set([TabId(3)]) },
          ),
        ),
      ).toEqual([]);
    });

    it('does not count an untracked tab toward the minimum', () => {
      const { ungrouped } = settle(
        input(
          {
            tabs: [tab(1, 'https://a.com', { groupId: GroupId(7) }), tab(2, 'https://a.com')],
            groups: [ours(7, 'a')],
          },
          { untrackedTabIds: new Set([TabId(2)]) },
        ),
      );
      expect(ungrouped).toEqual([1, 2]);
    });

    it('tracks a marked tab again once it is back in one of our groups', () => {
      expect(
        plan(
          input(
            {
              tabs: [
                tab(1, 'https://a.com', { groupId: GroupId(7) }),
                tab(2, 'https://a.com', { groupId: GroupId(7) }),
              ],
              groups: [ours(7, 'a')],
            },
            { untrackedTabIds: new Set([TabId(2)]) },
          ),
        ),
      ).toEqual([]);
    });
  });

  describe('settings', () => {
    it('waits for the minimum number of tabs', () => {
      const tabs = [tab(1, 'https://a.com'), tab(2, 'https://a.com')];
      expect(plan(input({ tabs, groups: [] }, { settings: { minimumTabs: 3 } }))).toEqual([]);
      const { groups } = settle(
        input(
          { tabs: [...tabs, tab(3, 'https://a.com')], groups: [] },
          { settings: { minimumTabs: 3 } },
        ),
      );
      expect(groups).toEqual([{ title: title('a'), tabIds: [1, 2, 3] }]);
    });

    it('never groups an excluded site or its subdomains, and lets go of one already grouped', () => {
      const { groups, ungrouped } = settle(
        input(
          {
            tabs: [
              tab(1, 'http://localhost:3000'),
              tab(2, 'http://localhost:4000'),
              tab(3, 'https://mail.google.com', { groupId: GroupId(7) }),
              tab(4, 'https://google.com', { groupId: GroupId(7) }),
              tab(5, 'https://notgoogle.com'),
              tab(6, 'https://notgoogle.com'),
            ],
            groups: [ours(7, 'google')],
          },
          { settings: { neverGroup: ['localhost', 'google.com'] } },
        ),
      );
      expect(groups).toEqual([{ title: title('notgoogle'), tabIds: [5, 6] }]);
      expect(ungrouped).toEqual([1, 2, 3, 4]);
    });

    it('titles a group with the full domain in the domain style, and retitles on a switch', () => {
      const { operations } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://bbc.co.uk', { groupId: GroupId(7) }),
              tab(2, 'https://bbc.co.uk', { groupId: GroupId(7) }),
            ],
            groups: [ours(7, 'bbc')],
          },
          { settings: { titleStyle: 'domain' } },
        ),
      );
      expect(operations).toEqual([{ type: 'update', groupId: 7, title: title('bbc.co.uk') }]);
    });

    it('collapses every group but the one with the active tab', () => {
      const { operations } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7), isActive: true }),
              tab(2, 'https://a.com', { groupId: GroupId(7) }),
              tab(3, 'https://b.com', { groupId: GroupId(8) }),
              tab(4, 'https://b.com', { groupId: GroupId(8) }),
              tab(5, 'https://c.com'),
              tab(6, 'https://c.com'),
            ],
            groups: [ours(7, 'a', true), ours(8, 'b')],
          },
          { settings: { shouldCollapseInactive: true } },
        ),
      );
      expect(operations).toEqual([
        expect.objectContaining({ type: 'create', tabIds: [5, 6], isCollapsed: true }),
        { type: 'update', groupId: 7, isCollapsed: false },
        { type: 'update', groupId: 8, isCollapsed: true },
      ]);
    });

    it('leaves a group the user opened alone until the active tab changes', () => {
      const { operations } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7), isActive: true }),
              tab(2, 'https://a.com', { groupId: GroupId(7) }),
              tab(3, 'https://b.com', { groupId: GroupId(8) }),
              tab(4, 'https://b.com', { groupId: GroupId(8) }),
              tab(5, 'https://c.com'),
              tab(6, 'https://c.com'),
            ],
            groups: [ours(7, 'a'), ours(8, 'b')],
          },
          { settings: { shouldCollapseInactive: true }, collapsingWindowIds: new Set() },
        ),
      );
      expect(operations).toEqual([
        expect.objectContaining({ type: 'create', tabIds: [5, 6], isCollapsed: true }),
      ]);
    });

    it('leaves collapsing to the user when the setting is off', () => {
      expect(
        plan(
          input({
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'https://a.com', { groupId: GroupId(7), isActive: true }),
            ],
            groups: [ours(7, 'a', true)],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('keeping our groups at the start', () => {
    const atStart = { settings: { shouldKeepGroupsAtStart: true } };
    // A pinned tab, a stray tab, our `b`, the user's group, our `a`: the strip as a user leaves it.
    const scattered = () => ({
      tabs: [
        tab(1, 'https://pinned.com', { isPinned: true }),
        tab(2, 'chrome://settings'),
        tab(3, 'https://b.com', { groupId: GroupId(8) }),
        tab(4, 'https://b.com', { groupId: GroupId(8) }),
        tab(5, 'https://u.com', { groupId: GroupId(9) }),
        tab(6, 'https://u.com', { groupId: GroupId(9) }),
        tab(7, 'https://a.com', { groupId: GroupId(7) }),
        tab(8, 'https://a.com', { groupId: GroupId(7) }),
      ],
      groups: [ours(7, 'a'), ours(8, 'b'), theirs(9, 'mine')],
    });

    it('leaves the strip alone when the setting is off', () => {
      expect(plan(input(scattered()))).toEqual([]);
    });

    it('moves our groups right after the pinned tabs, in their order, the user’s after them', () => {
      const { operations, strip } = settle(input(scattered(), atStart));
      expect(operations).toEqual([
        { type: 'move-group', tabId: 3, index: 1 },
        { type: 'move-group', tabId: 7, index: 3 },
      ]);
      expect(strip).toEqual([1, 'b:3', 'b:4', 'a:7', 'a:8', 2, 'mine:5', 'mine:6']);
    });

    it('does nothing once they are in place', () => {
      const tabs = [
        tab(1, 'https://pinned.com', { isPinned: true }),
        tab(3, 'https://b.com', { groupId: GroupId(8) }),
        tab(4, 'https://b.com', { groupId: GroupId(8) }),
        tab(7, 'https://a.com', { groupId: GroupId(7) }),
        tab(8, 'https://a.com', { groupId: GroupId(7) }),
        tab(2, 'chrome://settings'),
      ];
      expect(plan(input({ tabs, groups: [ours(7, 'a'), ours(8, 'b')] }, atStart))).toEqual([]);
    });

    it('brings back one of our groups dragged out of the block', () => {
      const { strip } = settle(
        input(
          {
            tabs: [
              tab(3, 'https://b.com', { groupId: GroupId(8) }),
              tab(4, 'https://b.com', { groupId: GroupId(8) }),
              tab(2, 'chrome://settings'),
              tab(7, 'https://a.com', { groupId: GroupId(7) }),
              tab(8, 'https://a.com', { groupId: GroupId(7) }),
            ],
            groups: [ours(7, 'a'), ours(8, 'b')],
          },
          atStart,
        ),
      );
      expect(strip).toEqual(['b:3', 'b:4', 'a:7', 'a:8', 2]);
    });

    it('puts a new group at the end of our block', () => {
      const { operations, strip } = settle(
        input(
          {
            tabs: [
              tab(7, 'https://a.com', { groupId: GroupId(7) }),
              tab(8, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'chrome://settings'),
              tab(5, 'https://u.com', { groupId: GroupId(9) }),
              tab(10, 'https://c.com'),
              tab(11, 'https://c.com'),
            ],
            groups: [ours(7, 'a'), theirs(9, 'mine')],
          },
          atStart,
        ),
      );
      expect(operations).toEqual([
        expect.objectContaining({ type: 'create', tabIds: [10, 11] }),
        { type: 'move-group', tabId: 10, index: 2 },
      ]);
      expect(strip).toEqual(['a:7', 'a:8', 'c:10', 'c:11', 2, 'mine:5']);
    });

    it('pulls a new site out of one of our groups before moving any group', () => {
      // `a` holds two tabs that navigated to `b`; moving `c` to index 2 first would land inside `a`.
      const { operations, strip } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://a.com', { groupId: GroupId(7) }),
              tab(2, 'https://a.com', { groupId: GroupId(7) }),
              tab(3, 'https://b.com', { groupId: GroupId(7) }),
              tab(4, 'https://b.com', { groupId: GroupId(7) }),
              tab(5, 'https://c.com', { groupId: GroupId(8) }),
              tab(6, 'https://c.com', { groupId: GroupId(8) }),
            ],
            groups: [ours(7, 'a'), ours(8, 'c')],
          },
          atStart,
        ),
      );
      expect(operations[0]).toMatchObject({ type: 'create', tabIds: [3, 4] });
      expect(strip).toEqual(['a:1', 'a:2', 'c:5', 'c:6', 'b:3', 'b:4']);
    });

    it('refuses, as Chrome does, to move a group into the middle of another', () => {
      const snapshot = input(
        {
          tabs: [
            tab(1, 'https://a.com', { groupId: GroupId(7) }),
            tab(2, 'https://a.com', { groupId: GroupId(7) }),
            tab(3, 'https://c.com', { groupId: GroupId(8) }),
            tab(4, 'https://c.com', { groupId: GroupId(8) }),
          ],
          groups: [ours(7, 'a'), ours(8, 'c')],
        },
        atStart,
      );
      expect(() => apply(snapshot, [{ type: 'move-group', tabId: TabId(3), index: 1 }])).toThrow(
        'middle of another group',
      );
    });

    it('settles membership and order together in one pass', () => {
      const { strip } = settle(
        input(
          {
            tabs: [
              tab(1, 'https://pinned.com', { isPinned: true }),
              tab(20, 'https://c.com'),
              tab(5, 'https://u.com', { groupId: GroupId(9) }),
              tab(3, 'https://b.com', { groupId: GroupId(8) }),
              tab(4, 'https://b.com', { groupId: GroupId(8) }),
              tab(7, 'https://a.com', { groupId: GroupId(7) }),
              tab(8, 'https://b.com', { groupId: GroupId(7) }),
              tab(9, 'https://a.com', { groupId: GroupId(7) }),
              tab(21, 'https://c.com'),
              tab(22, 'https://lone.com', { groupId: GroupId(6) }),
            ],
            groups: [ours(6, 'lone'), ours(7, 'a'), ours(8, 'b'), theirs(9, 'mine')],
          },
          atStart,
        ),
      );
      expect(strip).toEqual([1, 'b:3', 'b:4', 'b:8', 'a:7', 'a:9', 'c:20', 'c:21', 'mine:5', 22]);
    });

    it('settles any strip in one pass', () => {
      // A seeded LCG, so a failure reproduces.
      let seed = 42;
      const random = (n: number) => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed % n;
      };
      for (let round = 0; round < 300; round++) {
        const sites = ['a', 'b', 'c', 'd'];
        const tabs = Array.from({ length: 4 + random(10) }, (_, i) => {
          const kind = random(10);
          return tab(i + 1, `https://${sites[random(sites.length)]}.com/${i}`, {
            isPinned: i < 2 && kind === 0,
            groupId: GroupId(
              (() => {
                if (kind < 4) return 70 + random(4);
                if (kind === 4) return 90;
                return -1;
              })(),
            ),
          });
        });
        // Chrome keeps pinned tabs first and every group contiguous.
        const strip = [
          ...tabs.filter(t => t.isPinned).map(t => ({ ...t, groupId: NO_GROUP })),
          ...tabs
            .filter(t => !t.isPinned)
            .toSorted(
              (a, b) =>
                (a.groupId === NO_GROUP ? a.id : a.groupId) -
                (b.groupId === NO_GROUP ? b.id : b.groupId),
            ),
        ];
        const groups = [...new Set(strip.map(t => t.groupId))]
          .filter(id => id !== NO_GROUP)
          .map(id => (id === 90 ? theirs(id, 'mine') : ours(id, sites[id - 70] ?? 'x')));
        const { strip: after } = settle(input({ tabs: strip, groups }, atStart));
        const pinned = count(strip, t => t.isPinned);
        const ourRun = after
          .slice(pinned)
          .findIndex(cell => typeof cell === 'number' || cell.startsWith('mine'));
        const ourCount = count(after, cell => typeof cell === 'string' && !cell.startsWith('mine'));
        expect(ourRun === -1 ? after.length - pinned : ourRun).toBe(ourCount);
      }
    });

    it('leaves a paused window as it is', () => {
      expect(plan(input(scattered(), { ...atStart, pausedWindowIds: new Set([WINDOW]) }))).toEqual(
        [],
      );
    });
  });

  it('plans nothing for a paused window', () => {
    expect(
      plan(
        input(
          { tabs: [tab(1, 'https://a.com'), tab(2, 'https://a.com')], groups: [] },
          { pausedWindowIds: new Set([WINDOW]) },
        ),
      ),
    ).toEqual([]);
  });

  it('plans each window on its own, never across windows', () => {
    const operations = plan({
      ...input({ tabs: [tab(1, 'https://a.com')], groups: [] }),
      windows: [
        { id: WindowId(1), tabs: [tab(1, 'https://a.com')], groups: [] },
        { id: WindowId(2), tabs: [tab(2, 'https://a.com')], groups: [] },
      ],
    });
    expect(operations).toEqual([]);
  });

  it('settles a busy window in one pass', () => {
    const { groups, ungrouped } = settle(
      input({
        tabs: [
          tab(1, 'https://github.com/a', { groupId: GroupId(9) }),
          tab(2, 'https://news.ycombinator.com'),
          tab(3, 'https://gist.github.com/b', { isPinned: true }),
          tab(4, 'chrome://settings'),
          tab(5, 'https://mail.google.com'),
          tab(6, 'https://github.com/c'),
          tab(7, 'https://docs.google.com'),
          tab(8, 'https://example.org'),
        ],
        groups: [theirs(9, 'work')],
      }),
    );
    expect(groups).toEqual([
      { title: 'work', tabIds: [1] },
      { title: title('google'), tabIds: [5, 7] },
    ]);
    expect(ungrouped).toEqual([2, 3, 4, 6, 8]);
  });
});
