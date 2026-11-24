/**
 * Shared helpers for the composable Subtle decorators.
 *
 * WebCrypto only mints real {@link CryptoKey} objects for the algorithms its
 * host implementation understands. For non-standard algorithms (BIP32-Ed25519,
 * Falcon-1024) we therefore create structurally-identical, opaque metadata
 * handles that carry **no** key material.
 *
 * The shims are deliberately stateless: raw private material never lives on a
 * handle nor in a module-level registry. Instead it is supplied just-in-time
 * through the algorithm parameters of the operation that needs it (so it is
 * only reachable inside that call frame), while a storage engine owns the
 * encrypted-at-rest material and injects it on demand.
 */
import { MaterialAccessError } from "../errors.js";
/**
 * Symbol under which a freshly-minted handle transiently carries its raw key
 * material, so a storage engine can read it once (at birth) and persist it
 * encrypted at rest.
 *
 * The property is defined non-enumerable and is keyed by a module-private
 * symbol, so it is invisible to ordinary {@link CryptoKey} consumers and to
 * enumeration/serialisation — only {@link consumeKeyMaterial} can reach it. It
 * exists solely for the `generateKey`/`deriveKey` birth moment; every other
 * operation supplies material just-in-time through algorithm parameters.
 */
const MATERIAL = Symbol("keystore.material");
/**
 * Tags a composable {@link SubtleShim} with the algorithm identifier it adds, so
 * a keystore can report which algorithm add-ons are active (surfaced as
 * {@link import("../types/extension.ts").KeyStoreState.algorithms}). Mutates and
 * returns the same function with its `algorithm` property set.
 *
 * @param algorithm - The algorithm identifier the shim adds (e.g. `"Falcon-1024"`).
 * @param shim - The composable decorator to tag.
 * @returns The same `shim`, now carrying `shim.algorithm`.
 *
 * @example
 * ```typescript
 * const shim = tagShim(FALCON_ALGORITHM, (host) => withSubtleFalcon1024(host, falcon));
 * shim.algorithm; // "Falcon-1024"
 * ```
 */
export function tagShim(algorithm, shim) {
    const tagged = shim;
    tagged.algorithm = algorithm;
    return tagged;
}
/**
 * Resolves the string name of an {@link AlgorithmIdentifier}.
 */
export function algorithmName(algorithm) {
    return typeof algorithm === "string" ? algorithm : algorithm.name;
}
/**
 * Normalises any {@link BufferSource} into a `Uint8Array` view.
 */
export function toBytes(data) {
    if (data instanceof Uint8Array)
        return data;
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
/**
 * Copies a `Uint8Array` into a standalone `ArrayBuffer` (the WebCrypto
 * return type for `sign`/`deriveBits`/`exportKey`).
 */
export function toArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
/**
 * Creates an opaque, `CryptoKey`-shaped **metadata handle** for a shim
 * algorithm.
 *
 * The handle mirrors the public shape of a real {@link CryptoKey}
 * (`type`/`algorithm`/`extractable`/`usages`). For ordinary operations it is a
 * token that identifies which key is referred to; the raw material is supplied
 * separately, through the operation's algorithm parameters, only for the
 * duration of that call.
 *
 * At the `generateKey`/`deriveKey` birth moment, an `optional` `material`
 * argument may be attached so a storage engine can read it once (via
 * {@link consumeKeyMaterial}) and persist it encrypted at rest. It is stored
 * under a non-enumerable, symbol-keyed property, so it never appears on the
 * public `CryptoKey` shape and is invisible to ordinary consumers.
 */
export function createKeyHandle(type, algorithm, extractable, usages, material) {
    const handle = {
        type,
        extractable,
        algorithm,
        usages: [...usages],
    };
    if (material !== undefined) {
        // Transiently attach the just-born material so a storage engine can consume
        // it via consumeKeyMaterial and persist it. It is non-enumerable and
        // symbol-keyed, so it never appears on the public CryptoKey shape, and
        // `configurable` so consumeKeyMaterial can delete the reference after wiping
        // the plaintext.
        Object.defineProperty(handle, MATERIAL, {
            value: material,
            enumerable: false,
            writable: false,
            configurable: true,
        });
    }
    return handle;
}
/**
 * Reads — exactly **once** — the raw material a `generateKey`/`deriveKey` call
 * attached to a freshly minted handle, hands it to `use`, then deterministically
 * erases it: the plaintext buffer is zero-filled and the handle's reference is
 * dropped in a `finally`, so the secret is removed from memory the instant the
 * storage engine finishes with it (rather than lingering until GC).
 *
 * This is the privileged channel a platform storage engine uses to capture
 * newly-created key material at birth and persist it (encrypted at rest). It is
 * intentionally *not* part of the {@link SubtleCrypto} surface: `sign`,
 * `verify` and `deriveBits` never read it and instead receive material
 * just-in-time through their algorithm parameters.
 *
 * @param key - A handle minted by `generateKey`/`deriveKey` carrying material.
 * @param use - Consumer that persists the material (e.g. encrypts at rest). The
 *   `Uint8Array` it receives is only valid for the synchronous duration of the
 *   call — it is wiped as soon as `use` returns, so copy out anything you need
 *   to retain.
 * @returns Whatever `use` returns.
 * @throws {MaterialAccessError} If the handle carries no material, or its
 *   material was already consumed.
 *
 * @remarks Only the buffer minted by the shim is erased; any copies an injected
 * `xhd`/`falcon` binding keeps internally are that binding's responsibility.
 */
export function consumeKeyMaterial(key, use) {
    const record = key;
    const material = record[MATERIAL];
    if (material === undefined) {
        throw new MaterialAccessError("key material has already been consumed or the handle carries none");
    }
    try {
        return use(material);
    }
    finally {
        // Deterministically erase the plaintext, then drop the reference so the
        // (now-zeroed) buffer is GC-eligible and can never be read a second time.
        material.fill(0);
        delete record[MATERIAL];
    }
}
/**
 * Returns true when `key` is a handle for the shim algorithm `name`.
 *
 * Routing is based purely on the handle's advertised algorithm — the shims
 * hold no registry of the keys they have minted.
 */
export function isShimKey(key, name) {
    return key.algorithm.name === name;
}
/**
 * Reads required material out of an operation's algorithm parameters.
 *
 * @throws {MaterialAccessError} If the parameter is missing — material must be
 *   injected just-in-time by the caller (typically a storage engine).
 */
export function paramMaterial(algorithm, field) {
    const source = typeof algorithm === "string"
        ? undefined
        : algorithm[field];
    if (source === undefined || source === null) {
        throw new MaterialAccessError(`algorithm parameter "${field}" is required and must be supplied per-operation`);
    }
    return toBytes(source);
}
/**
 * Reads the private material a caller injected through an operation's algorithm
 * parameters, hands it to `use`, then deterministically **zero-fills** it in a
 * `finally` — so the seed or root key the storage engine decrypted for this one
 * operation is erased from memory the instant the operation completes, rather
 * than lingering until GC.
 *
 * Because {@link toBytes} returns a view over the caller's buffer, the wipe
 * clears the very bytes that were passed in: the injected secret does not
 * survive the call. Callers that still need the material afterwards must pass a
 * copy (the storage-engine pattern decrypts a fresh copy per operation).
 *
 * @param algorithm - The operation's algorithm parameters carrying `field`.
 * @param field - The parameter holding the private material (e.g. `"rootKey"`,
 *   `"privateKey"`).
 * @param use - Consumer that performs the crypto operation with the material.
 * @returns Whatever `use` returns.
 * @throws {MaterialAccessError} If the parameter is missing.
 *
 * @remarks Only the buffer reachable from the parameter is erased; any copies an
 * injected `xhd`/`falcon` binding keeps internally are that binding's
 * responsibility.
 */
export async function consumeParamMaterial(algorithm, field, use) {
    const material = paramMaterial(algorithm, field);
    try {
        return await use(material);
    }
    finally {
        material.fill(0);
    }
}
/**
 * Runs `use` with `material`, then deterministically zero-fills the buffer in a
 * `finally`, so a transient secret (such as a `generateKey` seed) is erased from
 * memory the instant it has been consumed.
 *
 * @param material - The secret bytes to wipe once `use` returns.
 * @param use - Consumer that uses the material (e.g. derives a key from a seed).
 * @returns Whatever `use` returns.
 */
export async function consumeMaterial(material, use) {
    try {
        return await use(material);
    }
    finally {
        material.fill(0);
    }
}
/**
 * Wraps a host {@link SubtleCrypto} so that the provided `overrides` take
 * precedence, while every other member transparently delegates to the host
 * (preserving `this` binding). Composable: the returned object can itself be
 * wrapped again by another decorator.
 */
export function extendSubtle(host, overrides) {
    return new Proxy(host, {
        get(target, property) {
            if (Object.prototype.hasOwnProperty.call(overrides, property)) {
                return overrides[property];
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function"
                ? value.bind(target)
                : value;
        },
    });
}
