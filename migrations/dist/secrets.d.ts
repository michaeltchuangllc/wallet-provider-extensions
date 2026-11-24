import type { SecretScratch } from "./types.ts";
/**
 * A {@link SecretScratch} paired with the wipe control the runner retains.
 *
 * The migration only ever receives `scratch`, so it cannot extend the lifetime
 * of the material it holds.
 */
export interface SecretScratchHandle {
    /** Handed to the migration as `utils.secrets`. */
    scratch: SecretScratch;
    /** Zeroes every entry and disposes the scratch. Idempotent. */
    wipeAll(): void;
}
/**
 * Creates a run-scoped, in-memory scratch for secret material.
 *
 * Material is held as raw `Uint8Array` — never strings, which are immutable,
 * cannot be zeroed, and leak into logs. Nothing is ever written to durable
 * storage. The runner creates one scratch per revision and wipes it in a
 * `finally`, so buffers are zeroed whether the revision succeeds or throws.
 *
 * @returns A {@link SecretScratchHandle}.
 *
 * @example
 * ```typescript
 * const { scratch, wipeAll } = createSecretScratch();
 * try {
 *   scratch.put("seed", await oldStore.read(id));
 *   await scratch.use("seed", (bytes) => newStore.write(id, bytes));
 * } finally {
 *   wipeAll();
 * }
 * ```
 */
export declare function createSecretScratch(): SecretScratchHandle;
