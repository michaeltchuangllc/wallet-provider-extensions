import type { Migration } from "./types.ts";
/** Arguments for {@link assertIdempotent}. */
export interface AssertIdempotentOptions<Ctx> {
    /** The revision under test. */
    migration: Migration<Ctx>;
    /** Builds the context. Called once — both runs share it, as in production. */
    context: () => Ctx | Promise<Ctx>;
    /** Captures the observable state after a run, for comparison. */
    snapshot: (context: Ctx) => unknown | Promise<unknown>;
    /** Module id used in `utils.revision`. Defaults to `"assertIdempotent"`. */
    module?: string;
}
/**
 * Asserts that a migration converges: running it twice against the same context
 * must leave identical state.
 *
 * Every revision must satisfy this. The runner records the ledger after each
 * revision, so a re-run only happens when something else went wrong — a failed
 * ledger write, storage cleared underneath the application, a partially applied
 * revision resumed. Those are exactly the cases where a non-idempotent
 * migration corrupts data.
 *
 * Snapshots are compared structurally: object key order is normalised and
 * `Uint8Array` values are compared by content, so a rewrite that only changes
 * insertion order does not read as a difference.
 *
 * @param options - {@link AssertIdempotentOptions}.
 * @throws {Error} When the two runs produce different snapshots.
 * @throws {Error} When `snapshot` returns `undefined` (almost always a missing
 *   `return`) — an undefined snapshot always compares equal to itself, which
 *   would otherwise let a non-idempotent migration pass unnoticed.
 * @throws {Error} When the snapshot contains a `Map` or `Set` — neither
 *   survives structural comparison (both normalise to `{}` regardless of
 *   content); convert to an array or plain object first.
 *
 * @example
 * ```typescript
 * await assertIdempotent({
 *   migration,
 *   context: () => seededStorage(),
 *   snapshot: (storage) => storage.entries(),
 * });
 * ```
 */
export declare function assertIdempotent<Ctx>(options: AssertIdempotentOptions<Ctx>): Promise<void>;
