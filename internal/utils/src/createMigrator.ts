// A persisted-state version-chain migrator. Given a registry keyed by the
// *old* version (each step takes raw JSON-shaped state at version N and
// returns it shaped for version N + 1) and the current version, returns the
// `(state, fromVersion) => unknown` function that createPersistedMmkvStorage's
// `migrate` option expects. Walks from the on-disk version up to current;
// a gap or a downgrade throws so the caller can treat it as a corrupt payload.
//
// Engine only — each app owns its own MIGRATIONS registry + STORAGE_VERSION.

export type Migrator = (state: unknown) => unknown;

export const createMigrator =
  (migrations: Readonly<Record<number, Migrator>>, currentVersion: number) =>
  (state: unknown, fromVersion: number): unknown => {
    if (fromVersion === currentVersion) return state;
    if (fromVersion > currentVersion) {
      throw new Error(
        `createMigrator: refusing to downgrade from v${fromVersion} to v${currentVersion}`,
      );
    }
    let current = state;
    for (let v = fromVersion; v < currentVersion; v++) {
      const migrator = migrations[v];
      if (migrator === undefined) {
        throw new Error(`createMigrator: no migrator registered for v${v} → v${v + 1}`);
      }
      current = migrator(current);
    }
    return current;
  };
