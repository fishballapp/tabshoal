import { isGroupingAllowed } from '@fishballapps/extension-licence/entitlement';
import { loadEntitlement, recordInstall } from '@fishballapps/extension-licence/store';
import {
  createLicenceWorker,
  LICENCE_ALARM,
  startLicenceAlarm,
} from '@fishballapps/extension-licence/worker';
import { createAsyncQueue } from '@fishballapps/utils';
import { applyOperation, isOurEcho, ourTabIdsIn, takeSnapshot } from './chrome/browser';
import { isDragging } from './chrome/dragging';
import { tabToReturnTo } from './chrome/opener';
import { isUntrackedAfterMove, loadSession, saveSession } from './chrome/session';
import { GroupId, isOurGroup, NO_GROUP, plan, TabId, WindowId } from './grouping/plan';
import { isOurTitle } from './grouping/site';
import { licenceServer } from './licence/polar';
import type { Message, Reply } from './messages';
import { loadSettings } from './settings';

// Every listener is registered synchronously at the top level, so Chrome can wake this worker for
// any of them. Nothing about tabs or groups is kept between events, only which windows changed
// their active tab since the last run: each run reads the browser.

/** One queue for everything that reads or writes tabs, so runs never interleave. */
const enqueue = createAsyncQueue();

type CollapseDue = ReadonlySet<WindowId> | 'every-window';

/**
 * Where the next run collapses the groups away from the active tab: the windows whose active tab
 * changed, or every window after a settings change or Regroup all.
 */
let collapseDue: CollapseDue = new Set();

const markCollapseDue = (due: CollapseDue) => {
  collapseDue =
    due === 'every-window' || collapseDue === 'every-window'
      ? 'every-window'
      : collapseDue.union(due);
};

const reconcile = async (due: CollapseDue) => {
  if (!isGroupingAllowed(await loadEntitlement())) return;
  const [windows, settings, session] = await Promise.all([
    takeSnapshot(),
    loadSettings(),
    loadSession(),
  ]);
  // A provisional group stops being one once it carries the watermark, or once it's gone.
  const untitledGroupIds = new Set(
    windows.flatMap(({ groups }) =>
      groups.filter(({ title }) => !isOurTitle(title)).map(({ id }) => id),
    ),
  );
  const provisionalGroupIds = session.provisionalGroupIds.intersection(untitledGroupIds);
  await saveSession({ ourTabIds: ourTabIdsIn(windows, provisionalGroupIds), provisionalGroupIds });
  const collapsingWindowIds = due === 'every-window' ? new Set(windows.map(({ id }) => id)) : due;
  const operations = plan({
    windows,
    settings,
    ...session,
    provisionalGroupIds,
    collapsingWindowIds,
  });
  if (operations.length === 0) return;
  for (const operation of operations) await applyOperation(operation);
  const [after, latest] = await Promise.all([takeSnapshot(), loadSession()]);
  await saveSession({ ourTabIds: ourTabIdsIn(after, latest.provisionalGroupIds) });
};

const RETRY_LIMIT = 6;
let retryAttempt = 0;

/**
 * A failed run is retried with backoff: Chrome refuses edits mid-drag, and a tab can close between
 * the snapshot and the call. Each retry plans afresh.
 */
const reconcileOrRetry = async () => {
  const due = collapseDue;
  collapseDue = new Set();
  try {
    await reconcile(due);
    retryAttempt = 0;
  } catch (error) {
    if (retryAttempt >= RETRY_LIMIT) {
      retryAttempt = 0;
      // biome-ignore lint/suspicious/noConsole: the service worker's console is an extension's only log.
      console.error('TabShoal gave up grouping after retries', error);
      return;
    }
    markCollapseDue(due);
    scheduleReconcile((isDragging(error) ? 300 : 100) * 2 ** retryAttempt++);
  }
};

let debounce: ReturnType<typeof setTimeout> | undefined;

/** Bursts (session restore, opening 30 tabs) settle into one run. */
const scheduleReconcile = (delay = 150) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void enqueue(reconcileOrRetry), delay);
};

/** Forgets every untracked mark outside the user's own groups, then groups every window afresh. */
const regroupAll = () =>
  enqueue(async () => {
    const [windows, { untrackedTabIds, provisionalGroupIds }] = await Promise.all([
      takeSnapshot(),
      loadSession(),
    ]);
    const inUserGroups = new Set(
      windows.flatMap(({ tabs, groups }) => {
        const userGroupIds = new Set(
          groups.filter(group => !isOurGroup(group, provisionalGroupIds)).map(({ id }) => id),
        );
        return tabs.filter(({ groupId }) => userGroupIds.has(groupId)).map(({ id }) => id);
      }),
    );
    await saveSession({ untrackedTabIds: untrackedTabIds.intersection(inUserGroups) });
    markCollapseDue('every-window');
    await reconcileOrRetry();
  });

const recordUserMove = async ({
  tabId,
  groupId,
  isPinned,
  wasInOurGroup,
}: {
  tabId: TabId;
  groupId: GroupId;
  isPinned: boolean;
  wasInOurGroup: Promise<boolean>;
}) => {
  const group =
    groupId === NO_GROUP ? undefined : await chrome.tabGroups.get(groupId).catch(() => undefined);
  const { untrackedTabIds, ourTabIds, provisionalGroupIds } = await loadSession();
  const isInOurGroup = isOurTitle(group?.title) || provisionalGroupIds.has(groupId);
  const isUntracked = isUntrackedAfterMove({
    wasInOurGroup: await wasInOurGroup,
    isInOurGroup,
    isPinned,
    wasUntracked: untrackedTabIds.has(tabId),
  });
  const only = new Set([tabId]);
  await saveSession({
    untrackedTabIds: isUntracked ? untrackedTabIds.union(only) : untrackedTabIds.difference(only),
    ourTabIds: isInOurGroup ? ourTabIds.union(only) : ourTabIds.difference(only),
  });
};

/** Remembers which tab opened `tab`, a link to it or `window.open`, `noopener` or not. */
const recordOpener = async ({ id, openerTabId }: chrome.tabs.Tab) => {
  if (id === undefined || openerTabId === undefined) return;
  const { openerByTabId } = await loadSession();
  await saveSession({ openerByTabId: new Map(openerByTabId).set(TabId(id), TabId(openerTabId)) });
};

/** Records the window's new active tab, and when the one before it was left. */
const recordActive = async (tabId: TabId, windowId: WindowId) => {
  const { lastActiveTabByWindowId, leftAtByTabId } = await loadSession();
  const left = lastActiveTabByWindowId.get(windowId);
  await saveSession({
    lastActiveTabByWindowId: new Map(lastActiveTabByWindowId).set(windowId, tabId),
    leftAtByTabId:
      left === undefined || left === tabId
        ? leftAtByTabId
        : new Map(leftAtByTabId).set(left, Date.now()),
  });
};

const openerOf = async (tabId: TabId | undefined, leftAtByTabId: ReadonlyMap<TabId, number>) => {
  if (tabId === undefined) return undefined;
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (tab?.id === undefined) return undefined;
  return { id: TabId(tab.id), windowId: WindowId(tab.windowId), leftAt: leftAtByTabId.get(tabId) };
};

/**
 * Forgets the closed tab, then activates its opener if the rules say so. Queued straight after the
 * close, so the window's last active tab is still the closed one: Chrome reports the close before
 * it activates the next tab, and that activation is recorded after this job.
 */
const returnToOpener = async ({
  tabId,
  windowId,
  isWindowClosing,
}: {
  tabId: TabId;
  windowId: WindowId;
  isWindowClosing: boolean;
}) => {
  const [settings, entitlement, session] = await Promise.all([
    loadSettings(),
    loadEntitlement(),
    loadSession(),
  ]);
  const wasActive = session.lastActiveTabByWindowId.get(windowId) === tabId;
  await saveSession({
    openerByTabId: new Map(
      [...session.openerByTabId].filter(([opened, opener]) => opened !== tabId && opener !== tabId),
    ),
    lastActiveTabByWindowId: new Map(
      [...session.lastActiveTabByWindowId].filter(([, active]) => active !== tabId),
    ),
    leftAtByTabId: new Map([...session.leftAtByTabId].filter(([left]) => left !== tabId)),
  });
  const target = tabToReturnTo({
    wasActive,
    isWindowClosing,
    windowId,
    opener: await openerOf(session.openerByTabId.get(tabId), session.leftAtByTabId),
    shouldReturnToOpener: settings.shouldReturnToOpener,
    isGroupingAllowed: isGroupingAllowed(entitlement),
    isWindowPaused: session.pausedWindowIds.has(windowId),
    now: Date.now(),
  });
  if (target === undefined) return;
  await chrome.tabs.update(target, { active: true });
};

chrome.tabs.onUpdated.addListener((rawTabId, changeInfo, tab) => {
  const tabId = TabId(rawTabId);
  if (changeInfo.groupId !== undefined) {
    const groupId = GroupId(changeInfo.groupId);
    if (isOurEcho(tabId, groupId)) return;
    // Read what the tab was before anything else runs: a run in flight rewrites it.
    // ponytail: a drag out landing mid-run can still be missed; the tab is regrouped once and the
    // user drags it out again.
    const wasInOurGroup = loadSession().then(({ ourTabIds }) => ourTabIds.has(tabId));
    void enqueue(() => recordUserMove({ tabId, groupId, isPinned: tab.pinned, wasInOurGroup }));
    scheduleReconcile();
    return;
  }
  // Only a URL change can move a tab between sites; it covers redirects and pushState.
  if (changeInfo.url !== undefined || changeInfo.pinned !== undefined) scheduleReconcile();
});

chrome.tabs.onCreated.addListener(tab => {
  void enqueue(() => recordOpener(tab));
  scheduleReconcile();
});
chrome.tabs.onAttached.addListener(() => scheduleReconcile());
chrome.tabs.onDetached.addListener(() => scheduleReconcile());
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void enqueue(() => recordActive(TabId(tabId), WindowId(windowId)));
  markCollapseDue(new Set([WindowId(windowId)]));
  scheduleReconcile();
});
// A group dragged out of our block at the start swims back on the next run.
chrome.tabs.onMoved.addListener(() => scheduleReconcile());
chrome.tabGroups.onMoved.addListener(() => scheduleReconcile());

chrome.tabs.onRemoved.addListener((rawTabId, { windowId, isWindowClosing }) => {
  const tabId = TabId(rawTabId);
  const only = new Set([tabId]);
  void enqueue(async () => {
    const { untrackedTabIds, ourTabIds } = await loadSession();
    await saveSession({
      untrackedTabIds: untrackedTabIds.difference(only),
      ourTabIds: ourTabIds.difference(only),
    });
  });
  void enqueue(() => returnToOpener({ tabId, windowId: WindowId(windowId), isWindowClosing }));
  if (!isWindowClosing) scheduleReconcile();
});

chrome.windows.onRemoved.addListener(windowId => {
  void enqueue(async () => {
    const { pausedWindowIds } = await loadSession();
    await saveSession({
      pausedWindowIds: pausedWindowIds.difference(new Set([WindowId(windowId)])),
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  const isRelevant =
    area === 'sync' ||
    (area === 'local' && ('licence' in changes || 'installedAt' in changes)) ||
    (area === 'session' && 'pausedWindowIds' in changes);
  if (area === 'sync') markCollapseDue('every-window');
  if (isRelevant) scheduleReconcile();
});

// --- The licence: one daily check against Polar, kept apart from grouping so a slow network
// never holds up a tab.

const licence = createLicenceWorker(licenceServer);

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === LICENCE_ALARM) void licence.check();
});

chrome.runtime.onInstalled.addListener(() => {
  void recordInstall();
  void startLicenceAlarm();
  scheduleReconcile(0);
});

// Tab IDs change across a restart, so whatever was untracked is gone: start as Regroup all does.
chrome.runtime.onStartup.addListener(() => {
  void startLicenceAlarm();
  void regroupAll();
  void licence.check();
});

const answer = async (message: Message): Promise<Reply<Message>> => {
  switch (message.type) {
    case 'regroup-all':
      await regroupAll();
      return null;
    case 'activate-licence':
      return licence.activate(message.key);
  }
};

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  void Promise.try(async () => sendResponse(await answer(message)));
  // Keeps the channel open for the asynchronous reply.
  return true;
});
