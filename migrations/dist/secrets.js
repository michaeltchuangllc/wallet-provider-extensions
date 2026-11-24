import { SecretNotFoundError, SecretScratchDisposedError } from "./errors.js";
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
export function createSecretScratch() {
    const entries = new Map();
    let disposed = false;
    function assertLive() {
        if (disposed) {
            throw new SecretScratchDisposedError();
        }
    }
    function read(label) {
        assertLive();
        const bytes = entries.get(label);
        if (bytes === undefined) {
            throw new SecretNotFoundError(label);
        }
        return bytes;
    }
    const scratch = {
        put(label, bytes) {
            assertLive();
            const previous = entries.get(label);
            if (previous !== undefined) {
                previous.fill(0);
            }
            entries.set(label, bytes);
        },
        async use(label, fn) {
            return fn(read(label));
        },
        has(label) {
            assertLive();
            return entries.has(label);
        },
        wipe(label) {
            assertLive();
            const bytes = entries.get(label);
            if (bytes === undefined) {
                return;
            }
            bytes.fill(0);
            entries.delete(label);
        },
        toJSON() {
            return "[SecretScratch]";
        },
    };
    // Node's inspector bypasses `toJSON`, so redact that path too. Non-enumerable
    // so it never shows up in a spread or `Object.keys`.
    Object.defineProperty(scratch, Symbol.for("nodejs.util.inspect.custom"), {
        value: () => "[SecretScratch]",
        enumerable: false,
    });
    return {
        scratch,
        wipeAll() {
            for (const bytes of entries.values()) {
                bytes.fill(0);
            }
            entries.clear();
            disposed = true;
        },
    };
}
