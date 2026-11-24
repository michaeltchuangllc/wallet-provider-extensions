/** Algorithm identifier used to route operations to the Algo25 decorator. */
export declare const ALGO25_ALGORITHM = "Algo25";
/** The fixed seed length, in bytes, of an Algo25 (Algorand 25-word) mnemonic. */
export declare const ALGO25_SEED_LENGTH = 32;
/**
 * The subset of the Algo25 primitive that {@link withSubtleAlgo25} needs.
 *
 * Algo25 is the Algorand-style 25-word mnemonic: a **reversible** encoding of a
 * 32-byte seed (24 words of 11 bits + a checksum word). Unlike BIP39, there is
 * no PBKDF2 step — the mnemonic *is* the seed — so the stored 32-byte value is
 * simultaneously the recoverable "entropy" and the derivation seed.
 *
 * Mirrors a small mnemonic-codec surface so a platform can supply an
 * `algosdk`-compatible implementation or the demo helpers; core only depends on
 * the binding *types*.
 */
export interface Algo25Binding {
    /**
     * Generates a fresh 25-word Algo25 mnemonic (encoding a random 32-byte seed).
     *
     * @returns A space-delimited 25-word mnemonic phrase.
     */
    generateMnemonic(): string;
    /**
     * Encodes a 32-byte seed as a 25-word Algo25 mnemonic (reversible).
     *
     * @param seed - The 32-byte seed.
     * @returns The 25-word mnemonic phrase.
     */
    seedToMnemonic(seed: Uint8Array): string;
    /**
     * Decodes a 25-word Algo25 mnemonic back to its 32-byte seed.
     *
     * @param mnemonic - The 25-word mnemonic phrase.
     * @returns The 32-byte seed.
     */
    mnemonicToSeed(mnemonic: string): Uint8Array;
}
/**
 * Parameters accepted for Algo25 (`"Algo25"`) operations.
 */
export interface Algo25Params {
    name: typeof ALGO25_ALGORITHM;
    /**
     * The 32-byte seed ("entropy"), injected just-in-time for `deriveBits`. It is
     * only reachable inside the operation call frame and never retained by the
     * shim (it is zero-filled as soon as the operation completes).
     */
    entropy?: BufferSource;
}
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
export declare function withSubtleAlgo25(host: SubtleCrypto, algo25: Algo25Binding): SubtleCrypto;
