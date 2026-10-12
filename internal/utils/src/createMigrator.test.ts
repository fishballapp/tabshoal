import { describe, expect, it } from 'vitest';
import { createMigrator, type Migrator } from './createMigrator';

describe('createMigrator', () => {
  it('returns the state unchanged when already at the current version', () => {
    const state = { hello: 'world' };
    expect(createMigrator({}, 3)(state, 3)).toBe(state);
  });

  it('refuses to downgrade', () => {
    expect(() => createMigrator({}, 1)({}, 2)).toThrow(/refusing to downgrade/);
  });

  it('throws when a migrator is missing in the chain', () => {
    expect(() => createMigrator({}, 1)({}, 0)).toThrow(/no migrator registered for v0/);
  });

  it('chains migrators across multiple versions in order', () => {
    type V = { value: number };
    const migrations: Record<number, Migrator> = {
      0: state => ({ value: (state as V).value + 1 }),
      1: state => ({ value: (state as V).value * 10 }),
      2: state => ({ value: (state as V).value + 5 }),
    };
    expect(createMigrator(migrations, 3)({ value: 1 }, 0)).toEqual({ value: 25 });
  });
});
