import { describe, expect, it } from 'vitest';
import { TabId, WindowId } from '../grouping/plan';
import { RECENT_OPENER_MS, tabToReturnTo } from './opener';

const WINDOW = WindowId(1);
const OPENER = TabId(10);
const NOW = 1_000_000_000;

const returnTo = (overrides: Partial<Parameters<typeof tabToReturnTo>[0]> = {}) =>
  tabToReturnTo({
    wasActive: true,
    isWindowClosing: false,
    windowId: WINDOW,
    opener: { id: OPENER, windowId: WINDOW, leftAt: NOW - 1000 },
    shouldReturnToOpener: true,
    isGroupingAllowed: true,
    isWindowPaused: false,
    now: NOW,
    ...overrides,
  });

describe('tabToReturnTo', () => {
  it('activates the opener when the active tab closes and the opener is open in its window', () => {
    expect(returnTo()).toBe(OPENER);
  });

  it('leaves a background tab closing alone', () => {
    expect(returnTo({ wasActive: false })).toBeUndefined();
  });

  it('leaves a window closing alone, as it closes its tabs in turn', () => {
    expect(returnTo({ isWindowClosing: true })).toBeUndefined();
  });

  it('does nothing once the opener has closed', () => {
    expect(returnTo({ opener: undefined })).toBeUndefined();
  });

  it('does nothing when the opener has moved to another window', () => {
    expect(
      returnTo({ opener: { id: OPENER, windowId: WindowId(2), leftAt: NOW - 1000 } }),
    ).toBeUndefined();
  });

  it('still goes back when you left the opener just within the limit', () => {
    expect(
      returnTo({ opener: { id: OPENER, windowId: WINDOW, leftAt: NOW - RECENT_OPENER_MS } }),
    ).toBe(OPENER);
  });

  it('does nothing once you left the opener longer ago than the limit', () => {
    expect(
      returnTo({ opener: { id: OPENER, windowId: WINDOW, leftAt: NOW - RECENT_OPENER_MS - 1 } }),
    ).toBeUndefined();
  });

  it('does nothing when TabShoal never saw you leave the opener', () => {
    expect(
      returnTo({ opener: { id: OPENER, windowId: WINDOW, leftAt: undefined } }),
    ).toBeUndefined();
  });

  it('does nothing when the setting is off', () => {
    expect(returnTo({ shouldReturnToOpener: false })).toBeUndefined();
  });

  it('does nothing without a trial or a licence', () => {
    expect(returnTo({ isGroupingAllowed: false })).toBeUndefined();
  });

  it('does nothing in a paused window', () => {
    expect(returnTo({ isWindowPaused: true })).toBeUndefined();
  });
});
