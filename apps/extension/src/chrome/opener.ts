import type { TabId, WindowId } from '../grouping/plan';

/**
 * How recently the opener must have been the tab you were on. Past it, you have likely forgotten
 * where the closing tab came from, and landing there surprises more than it helps.
 */
export const RECENT_OPENER_MS = 10 * 60 * 1000;

/**
 * The tab to activate when a tab closes: the one that opened it, if the closed tab was the active
 * one, its window isn't closing, and the opener is still open in that same window and was the
 * active tab within the last `RECENT_OPENER_MS`. `undefined` leaves the choice to Chrome.
 */
export const tabToReturnTo = ({
  wasActive,
  isWindowClosing,
  windowId,
  opener,
  shouldReturnToOpener,
  isGroupingAllowed,
  isWindowPaused,
  now,
}: {
  /** Whether the closed tab was the active tab of its window. */
  wasActive: boolean;
  isWindowClosing: boolean;
  windowId: WindowId;
  /**
   * The opener, or `undefined` once it has closed. `leftAt` is when it last stopped being its
   * window's active tab, `undefined` if TabShoal never saw that.
   */
  opener: { id: TabId; windowId: WindowId; leftAt: number | undefined } | undefined;
  shouldReturnToOpener: boolean;
  isGroupingAllowed: boolean;
  isWindowPaused: boolean;
  now: number;
}): TabId | undefined => {
  if (!shouldReturnToOpener || !isGroupingAllowed || isWindowPaused) return undefined;
  if (!wasActive || isWindowClosing || opener === undefined) return undefined;
  if (opener.windowId !== windowId) return undefined;
  if (opener.leftAt === undefined || now - opener.leftAt > RECENT_OPENER_MS) return undefined;
  return opener.id;
};
