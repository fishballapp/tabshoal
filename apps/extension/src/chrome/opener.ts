import type { TabId, WindowId } from '../grouping/plan';

/**
 * The tab to activate when a tab closes: the one that opened it, if the closed tab was the active
 * one, its window isn't closing, and the opener is still open in that same window. `undefined`
 * leaves the choice to Chrome.
 */
export const tabToReturnTo = ({
  wasActive,
  isWindowClosing,
  windowId,
  opener,
  shouldReturnToOpener,
  isGroupingAllowed,
  isWindowPaused,
}: {
  /** Whether the closed tab was the active tab of its window. */
  wasActive: boolean;
  isWindowClosing: boolean;
  windowId: WindowId;
  /** The opener, or `undefined` once it has closed. */
  opener: { id: TabId; windowId: WindowId } | undefined;
  shouldReturnToOpener: boolean;
  isGroupingAllowed: boolean;
  isWindowPaused: boolean;
}): TabId | undefined => {
  if (!shouldReturnToOpener || !isGroupingAllowed || isWindowPaused) return undefined;
  if (!wasActive || isWindowClosing || opener === undefined) return undefined;
  if (opener.windowId !== windowId) return undefined;
  return opener.id;
};
