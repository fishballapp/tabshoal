import { createAsyncQueue } from '@fishballapps/utils';
import { applyOperation, isOurEcho, ourTabIdsIn, takeSnapshot } from './chrome/browser';
import { isDragging } from './chrome/dragging';
import { isUntrackedAfterMove, loadSession, saveSession } from './chrome/session';
import { GroupId, isOurGroup, NO_GROUP, plan, TabId, WindowId } from './grouping/plan';
import { isOurTitle } from './grouping/site';
import { afterValidation, grantedLicence, isGroupingAllowed } from './licence/entitlement';
import { validateKey } from './licence/polar';
import { loadEntitlement, loadLicensing, recordInstall, saveLicence } from './licence/store';
import type { Message, Reply } from './messages';
import { loadSettings } from './settings';

// Every listener is registered synchronously at the top level, so Chrome can wake this worker for
// any of them. Nothing about tabs or groups is kept between events: each run reads the browser.

/** One queue for everything that reads or writes tabs, so runs never interleave. */
const enqueue = createAsyncQueue();

const reconcile = async () => {
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
  const operations = plan({ windows, settings, ...session, provisionalGroupIds });
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
  try {
    await reconcile();
    retryAttempt = 0;
  } catch (error) {
    if (retryAttempt >= RETRY_LIMIT) {
      retryAttempt = 0;
      // biome-ignore lint/suspicious/noConsole: the service worker's console is an extension's only log.
      console.error('TabShoal gave up grouping after retries', error);
      return;
    }
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

chrome.tabs.onCreated.addListener(() => scheduleReconcile());
chrome.tabs.onAttached.addListener(() => scheduleReconcile());
chrome.tabs.onDetached.addListener(() => scheduleReconcile());
chrome.tabs.onActivated.addListener(() => scheduleReconcile());
// A group dragged out of our block at the start swims back on the next run.
chrome.tabs.onMoved.addListener(() => scheduleReconcile());
chrome.tabGroups.onMoved.addListener(() => scheduleReconcile());

chrome.tabs.onRemoved.addListener((rawTabId, { isWindowClosing }) => {
  const only = new Set([TabId(rawTabId)]);
  void enqueue(async () => {
    const { untrackedTabIds, ourTabIds } = await loadSession();
    await saveSession({
      untrackedTabIds: untrackedTabIds.difference(only),
      ourTabIds: ourTabIds.difference(only),
    });
  });
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
  if (isRelevant) scheduleReconcile();
});

// --- The licence: one daily check against Polar, kept apart from grouping so a slow network
// never holds up a tab.

const enqueueLicence = createAsyncQueue();
const LICENCE_ALARM = 'licence-check';

const checkLicence = () =>
  enqueueLicence(async () => {
    const now = Date.now();
    const { licence } = await loadLicensing(now);
    if (licence === undefined || now < licence.nextCheckAt) return;
    await saveLicence(afterValidation(licence, await validateKey(licence.key), now));
  });

const activateLicence = (key: string) =>
  enqueueLicence(async () => {
    const trimmed = key.trim();
    const validation = await validateKey(trimmed);
    if (validation.type === 'granted') await saveLicence(grantedLicence(trimmed, Date.now()));
    return validation.type;
  });

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === LICENCE_ALARM) void checkLicence();
});

const startAlarm = () => chrome.alarms.create(LICENCE_ALARM, { periodInMinutes: 60 });

chrome.runtime.onInstalled.addListener(() => {
  void recordInstall();
  void startAlarm();
  scheduleReconcile(0);
});

// Tab IDs change across a restart, so whatever was untracked is gone: start as Regroup all does.
chrome.runtime.onStartup.addListener(() => {
  void startAlarm();
  void regroupAll();
  void checkLicence();
});

const answer = async (message: Message): Promise<Reply<Message>> => {
  switch (message.type) {
    case 'regroup-all':
      await regroupAll();
      return null;
    case 'activate-licence':
      return activateLicence(message.key);
  }
};

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  void Promise.try(async () => sendResponse(await answer(message)));
  // Keeps the channel open for the asynchronous reply.
  return true;
});
