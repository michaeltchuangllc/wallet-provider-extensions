import { MaterialAccessError } from "../errors.js";
import { algorithmName, consumeParamMaterial, createKeyHandle, extendSubtle, isShimKey, toArrayBuffer, } from "./shim.js";
/** Algorithm identifier used to route operations to the BIP39 decorator. */
export const BIP39_ALGORITHM = "BIP39";
/** Default mnemonic entropy strength, in bits (a 24-word phrase). */
export const BIP39_DEFAULT_STRENGTH = 256;
/**
 * Extends a host {@link SubtleCrypto} with BIP39 mnemonic-seed support,
 * delegating every other algorithm to the host untouched.
 *
 * BIP39 is a *seed source*, not a signing algorithm: it produces the seed bytes
 * that downstream key derivation (BIP32-Ed25519, standalone Ed25519, …)
 * consumes. Modelling it as a Subtle decorator unifies key birth so every key's
 * material is minted through the same read-once channel the other shims use.
 *
 * `generateKey` mints a fresh mnemonic and returns a handle that *transiently*
 * carries its **entropy** (not the derived seed), so the calling storage engine
 * can consume it once (via `consumeKeyMaterial`) and persist it encrypted at
 * rest. Persisting the entropy — rather than the one-way PBKDF2 seed — keeps the
 * mnemonic phrase fully recoverable for backup/restore. `deriveBits` converts a
 * just-in-time-injected `entropy` into the 64-byte seed and wipes the injected
 * entropy when the operation completes. `importKey`/`exportKey` throw
 * {@link MaterialAccessError} — material never moves *through* the public
 * surface after birth.
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`).
 * @param bip39 - The BIP39 primitive binding.
 * @returns A new `SubtleCrypto` that also understands `"BIP39"`.
 *
 * @example
 * ```typescript
 * const subtle = withSubtleBIP39(crypto.subtle, bip39);
 *
 * // The storage engine births the entropy, persists it, then records a seed.
 * const key = await subtle.generateKey({ name: "BIP39", strength: 256 }, false, ["deriveBits"]);
 * const entropy = consumeKeyMaterial(key, (m) => persist(m)); // encrypted at rest, then wiped
 *
 * // Later, derive the 64-byte seed by injecting the fetched entropy.
 * const seed = await subtle.deriveBits({ name: "BIP39", entropy }, key);
 * ```
 */
export function withSubtleBIP39(host, bip39) {
    const generateKey = async (algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== BIP39_ALGORITHM) {
            return host.generateKey(algo, extractable, keyUsages);
        }
        // Mint a fresh mnemonic and persist its ENTROPY (not the one-way seed), so
        // the phrase stays recoverable. The entropy rides on the returned handle
        // (non-enumerable, symbol-keyed) purely so the storage engine can read it
        // once and persist it encrypted at rest.
        const params = typeof algo === "string" ? undefined : algo;
        const strength = params?.strength ?? BIP39_DEFAULT_STRENGTH;
        const mnemonic = bip39.generateMnemonic(strength);
        const entropy = bip39.mnemonicToEntropy(mnemonic);
        return createKeyHandle("private", { name: BIP39_ALGORITHM }, extractable, keyUsages, entropy);
    };
    const importKey = async (format, keyData, algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== BIP39_ALGORITHM) {
            return host.importKey(format, keyData, algo, extractable, keyUsages);
        }
        throw new MaterialAccessError("BIP39 entropy is owned by a storage engine; importKey is not supported");
    };
    const exportKey = async (format, key) => {
        if (!isShimKey(key, BIP39_ALGORITHM)) {
            return host.exportKey(format, key);
        }
        throw new MaterialAccessError("BIP39 entropy never leaves the storage engine; exportKey is not supported");
    };
    const deriveBits = async (algo, baseKey, length) => {
        if (algorithmName(algo) !== BIP39_ALGORITHM) {
            return host.deriveBits(algo, baseKey, length);
        }
        const passphrase = typeof algo === "string" ? undefined : algo.passphrase;
        // The injected entropy is wiped as soon as the seed is derived.
        return consumeParamMaterial(algo, "entropy", async (entropy) => {
            const mnemonic = bip39.entropyToMnemonic(entropy);
            const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
            try {
                return toArrayBuffer(seed);
            }
            finally {
                seed.fill(0);
            }
        });
    };
    const deriveKey = async (algo, baseKey, derivedKeyType, extractable, keyUsages) => {
        if (algorithmName(algo) !== BIP39_ALGORITHM) {
            return host.deriveKey(algo, baseKey, derivedKeyType, extractable, keyUsages);
        }
        // A BIP39 seed is raw private material, so a `deriveKey` that returned a
        // usable key object would leak it through the public surface. Callers take
        // the raw seed via `deriveBits` (into a storage engine) instead.
        throw new MaterialAccessError("BIP39 produces raw seed material; use deriveBits into a storage engine, not deriveKey");
    };
    return extendSubtle(host, {
        generateKey,
        importKey,
        exportKey,
        deriveBits,
        deriveKey,
    });
}
