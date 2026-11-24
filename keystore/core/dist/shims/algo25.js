import { InvalidKeyFormatError, MaterialAccessError } from "../errors.js";
import { algorithmName, consumeParamMaterial, createKeyHandle, extendSubtle, isShimKey, toArrayBuffer, } from "./shim.js";
/** Algorithm identifier used to route operations to the Algo25 decorator. */
export const ALGO25_ALGORITHM = "Algo25";
/** The fixed seed length, in bytes, of an Algo25 (Algorand 25-word) mnemonic. */
export const ALGO25_SEED_LENGTH = 32;
/**
 * Extends a host {@link SubtleCrypto} with Algo25 (Algorand 25-word mnemonic)
 * seed support, delegating every other algorithm to the host untouched.
 *
 * Like {@link import("./bip39.ts").withSubtleBIP39}, Algo25 is a *seed source*,
 * not a signing algorithm. Because the Algo25 mnemonic is a reversible encoding
 * of the 32-byte seed (no PBKDF2), the persisted "entropy" is the seed itself.
 *
 * `generateKey` mints a fresh mnemonic and returns a handle that *transiently*
 * carries the 32-byte seed, so the calling storage engine can consume it once
 * (via `consumeKeyMaterial`) and persist it encrypted at rest — the mnemonic
 * stays fully recoverable via the binding. `deriveBits` returns the injected
 * 32-byte seed and wipes the injected copy when the operation completes.
 * `importKey`/`exportKey`/`deriveKey` throw {@link MaterialAccessError} —
 * material never moves *through* the public surface after birth.
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`).
 * @param algo25 - The Algo25 primitive binding.
 * @returns A new `SubtleCrypto` that also understands `"Algo25"`.
 *
 * @example
 * ```typescript
 * const subtle = withSubtleAlgo25(crypto.subtle, algo25);
 *
 * const key = await subtle.generateKey({ name: "Algo25" }, false, ["deriveBits"]);
 * const entropy = consumeKeyMaterial(key, (m) => persist(m)); // 32-byte seed, then wiped
 *
 * const seed = await subtle.deriveBits({ name: "Algo25", entropy }, key);
 * ```
 */
export function withSubtleAlgo25(host, algo25) {
    const generateKey = async (algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== ALGO25_ALGORITHM) {
            return host.generateKey(algo, extractable, keyUsages);
        }
        // Mint a fresh mnemonic and persist the 32-byte seed it encodes. The seed
        // rides on the returned handle (non-enumerable, symbol-keyed) purely so the
        // storage engine can read it once and persist it encrypted at rest; the
        // mnemonic is recoverable from the seed via the binding.
        const mnemonic = algo25.generateMnemonic();
        const seed = algo25.mnemonicToSeed(mnemonic);
        return createKeyHandle("private", { name: ALGO25_ALGORITHM }, extractable, keyUsages, seed);
    };
    const importKey = async (format, keyData, algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== ALGO25_ALGORITHM) {
            return host.importKey(format, keyData, algo, extractable, keyUsages);
        }
        throw new MaterialAccessError("Algo25 seed is owned by a storage engine; importKey is not supported");
    };
    const exportKey = async (format, key) => {
        if (!isShimKey(key, ALGO25_ALGORITHM)) {
            return host.exportKey(format, key);
        }
        throw new MaterialAccessError("Algo25 seed never leaves the storage engine; exportKey is not supported");
    };
    const deriveBits = async (algo, baseKey, length) => {
        if (algorithmName(algo) !== ALGO25_ALGORITHM) {
            return host.deriveBits(algo, baseKey, length);
        }
        // The Algo25 mnemonic is the seed, so the "entropy" already is the 32-byte
        // derivation seed. Return a copy and wipe the injected buffer.
        return consumeParamMaterial(algo, "entropy", (entropy) => {
            if (entropy.length !== ALGO25_SEED_LENGTH) {
                throw new InvalidKeyFormatError(`Algo25 seed must be ${ALGO25_SEED_LENGTH} bytes, got ${entropy.length}`);
            }
            return toArrayBuffer(entropy);
        });
    };
    const deriveKey = async (algo, baseKey, derivedKeyType, extractable, keyUsages) => {
        if (algorithmName(algo) !== ALGO25_ALGORITHM) {
            return host.deriveKey(algo, baseKey, derivedKeyType, extractable, keyUsages);
        }
        throw new MaterialAccessError("Algo25 produces raw seed material; use deriveBits into a storage engine, not deriveKey");
    };
    return extendSubtle(host, {
        generateKey,
        importKey,
        exportKey,
        deriveBits,
        deriveKey,
    });
}
