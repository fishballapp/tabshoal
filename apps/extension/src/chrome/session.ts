import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { GroupId, TabId, WindowId } from '../grouping/plan';

/**
 * What TabShoal remembers about this browser session, in `storage.session`: it survives the service
 * worker sleeping and is cleared when Chrome quits, as tab and window IDs change on restart anyway.
 */
type SessionState = {
  /** Tabs the user took out of one of our groups. */
  untrackedTabIds: ReadonlySet<TabId>;
  /** Windows paused from the panel. */
  pausedWindowIds: ReadonlySet<WindowId>;
  /** Tabs in one of our groups as of the last thing TabShoal saw, to recognise a drag out. */
  ourTabIds: ReadonlySet<TabId>;
  /** Groups we created and haven't yet seen titled with the watermark. */
  provisionalGroupIds: ReadonlySet<GroupId>;
  /** The tab each tab was opened from, as Chrome reported it when the tab was created. */
  openerByTabId: ReadonlyMap<TabId, TabId>;
  /** The tab that was active in each window the last time TabShoal saw it change. */
  lastActiveTabByWindowId: ReadonlyMap<WindowId, TabId>;
  /** When each tab last stopped being its window's active tab, in milliseconds since the epoch. */
  leftAtByTabId: ReadonlyMap<TabId, number>;
};

const IdsSchema = Schema.Array(Schema.Int);
const decodeIds = (value: unknown) =>
  Option.getOrElse(Schema.decodeUnknownOption(IdsSchema)(value), () => []);

const PairsSchema = Schema.Array(Schema.Tuple([Schema.Int, Schema.Int]));
const decodePairs = (value: unknown) =>
  Option.getOrElse(Schema.decodeUnknownOption(PairsSchema)(value), () => []);

export const loadSession = async (): Promise<SessionState> => {
  const stored = await chrome.storage.session.get([
    'untrackedTabIds',
    'pausedWindowIds',
    'ourTabIds',
    'provisionalGroupIds',
    'openerByTabId',
    'lastActiveTabByWindowId',
    'leftAtByTabId',
  ]);
  return {
    untrackedTabIds: new Set(decodeIds(stored.untrackedTabIds).map(TabId)),
    pausedWindowIds: new Set(decodeIds(stored.pausedWindowIds).map(WindowId)),
    ourTabIds: new Set(decodeIds(stored.ourTabIds).map(TabId)),
    provisionalGroupIds: new Set(decodeIds(stored.provisionalGroupIds).map(GroupId)),
    openerByTabId: new Map(
      decodePairs(stored.openerByTabId).map(([opened, opener]): [TabId, TabId] => [
        TabId(opened),
        TabId(opener),
      ]),
    ),
    lastActiveTabByWindowId: new Map(
      decodePairs(stored.lastActiveTabByWindowId).map(([windowId, tabId]): [WindowId, TabId] => [
        WindowId(windowId),
        TabId(tabId),
      ]),
    ),
    leftAtByTabId: new Map(
      decodePairs(stored.leftAtByTabId).map(([tabId, leftAt]): [TabId, number] => [
        TabId(tabId),
        leftAt,
      ]),
    ),
  };
};

/** A map is stored as its entries, so each value is the array of its pairs. */
export const saveSession = (state: Partial<SessionState>) =>
  chrome.storage.session.set(
    Object.fromEntries(Object.entries(state).map(([key, ids]) => [key, [...ids]])),
  );

/**
 * Whether a tab is untracked after the user moved it between groups. Leaving one of our groups
 * untracks it, unless it left because it was pinned (Chrome ungroups a tab it pins); entering one
 * of ours tracks it again; any other move keeps what it was.
 */
export const isUntrackedAfterMove = ({
  wasInOurGroup,
  isInOurGroup,
  isPinned,
  wasUntracked,
}: {
  wasInOurGroup: boolean;
  isInOurGroup: boolean;
  isPinned: boolean;
  wasUntracked: boolean;
}) => {
  if (isInOurGroup) return false;
  if (wasInOurGroup && !isPinned) return true;
  return wasUntracked;
};
