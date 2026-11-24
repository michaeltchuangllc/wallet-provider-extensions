import type { KeyValueStore, MigrationLedger, Revision } from "./types.ts";
/** Default storage key under which the whole ledger map is serialised. */
export declare const DEFAULT_LEDGER_KEY: string;
/**
 * An in-memory {@link MigrationLedger}.
 *
 * Nothing survives a restart, so every migration re-runs on the next launch.
 * Intended for tests and deliberately ephemeral use — never as an application's
 * durable ledger.
 *
 * @param initial - Revisions to seed the ledger with.
 * @returns An in-memory {@link MigrationLedger}.
 *
 * @example
 * ```typescript
 * const ledger = memoryLedger({ "@scope/pkg": { id: 1, name: "first", appliedAt: iso } });
 * ```
 */
export declare function memoryLedger(initial?: Record<string, Revision>): MigrationLedger;
/**
 * A {@link MigrationLedger} backed by any string key/value store.
 *
 * The whole map is serialised as one JSON blob under a single key, so a run
 * resolves the entire graph with one read. An absent, unparseable, or
 * non-object payload reads as empty — which re-runs every migration, and is
 * safe precisely because migrations are required to be idempotent.
 *
 * @param kv - The backing store. MMKV, `localStorage`, AsyncStorage, or a file
 *   wrapper all adapt in two lines.
 * @param options - Optional storage key override.
 * @returns A durable {@link MigrationLedger}.
 *
 * @example
 * ```typescript
 * keyValueLedger({ get: (k) => mmkv.getString(k), set: (k, v) => mmkv.set(k, v) });
 * ```
 */
export declare function keyValueLedger(kv: KeyValueStore, options?: {
    key?: string;
}): MigrationLedger;
