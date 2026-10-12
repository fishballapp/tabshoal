import { describe, expect, it } from 'vitest';
import { isUntrackedAfterMove } from './session';

const move = (overrides: Partial<Parameters<typeof isUntrackedAfterMove>[0]>) =>
  isUntrackedAfterMove({
    wasInOurGroup: false,
    isInOurGroup: false,
    isPinned: false,
    wasUntracked: false,
    ...overrides,
  });

describe('isUntrackedAfterMove', () => {
  it('untracks a tab dragged out of one of our groups, or ungrouped from its menu', () => {
    expect(move({ wasInOurGroup: true })).toBe(true);
  });

  it('keeps tracking a tab Chrome ungrouped because it was pinned', () => {
    expect(move({ wasInOurGroup: true, isPinned: true })).toBe(false);
  });

  it('tracks a tab again once it is dragged into one of our groups', () => {
    expect(move({ isInOurGroup: true, wasUntracked: true })).toBe(false);
  });

  it('leaves a tab moved between the user’s own groups as it was', () => {
    expect(move({ wasUntracked: true })).toBe(true);
    expect(move({})).toBe(false);
  });
});
