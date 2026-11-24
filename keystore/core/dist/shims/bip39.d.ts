/** Algorithm identifier used to route operations to the BIP39 decorator. */
export declare const BIP39_ALGORITHM = "BIP39";
/** Default mnemonic entropy strength, in bits (a 24-word phrase). */
export declare const BIP39_DEFAULT_STRENGTH = 256;
/**
 * The subset of the BIP39 primitive that {@link withSubtleBIP39} needs.
 *
 * Mirrors the public surface of `@scure/bip39` so a platform can supply either
 * that library or a native binding, as long as the mnemonic encoding and the
 * PBKDF2 seed derivation are byte-compatible. Core only depends on the binding
 * *types*.
 *
 * There are two reversible encodings and one one-way derivation:
 *
 * - `entropy ⟷ mnemonic` — a reversible wordlist encoding
 *   ({@link entropyToMnemonic} / {@link mnemonicToEntropy}). Persisting the
 *   entropy therefore keeps the phrase fully recoverable/displayable.
 * - `mnemonic (+passphrase) → seed` — a one-way PBKDF2-HMAC-SHA512 derivation
 *   ({@link mnemonicToSeed}) producing the 64-byte seed downstream key
 *   derivation consumes.
 */
export interface BIP39Binding {
    /**
     * Generates a fresh mnemonic phrase for the given entropy `strength`.
     *
     * @param strength - Entropy strength in bits (128/160/192/224/256).
     * @returns A space-delimited mnemonic phrase.
     */
    generateMnemonic(strength?: number): string;
    /**
     * Encodes entropy bytes as a mnemonic phrase (reversible).
     *
     * @param entropy - The entropy bytes (16/20/24/28/32 bytes).
     * @returns The mnemonic phrase for that entropy.
     */
    entropyToMnemonic(entropy: Uint8Array): string;
    /**
     * Recovers the entropy bytes encoded by a mnemonic phrase.
     *
     * @param mnemonic - The mnemonic phrase.
     * @returns The entropy bytes.
     */
    mnemonicToEntropy(mnemonic: string): Uint8Array;
    /**
     * Derives the 64-byte seed from a mnemonic via PBKDF2-HMAC-SHA512.
     *
     * @param mnemonic - The mnemonic phrase.
     * @param passphrase - Optional passphrase mixed into the derivation.
     * @returns The 64-byte seed.
     */
    mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Uint8Array>;
}
/**
 * Parameters accepted for BIP39 (`"BIP39"`) operations.
 */
export interface BIP39Params {
    name: typeof BIP39_ALGORITHM;
    /** Entropy strength in bits for `generateKey`; defaults to {@link BIP39_DEFAULT_STRENGTH}. */
    strength?: number;
    /** Optional passphrase mixed into the seed derivation for `deriveBits`. */
    passphrase?: string;
    /**
     * The mnemonic entropy, injected just-in-time for `deriveBits`. It is only
     * reachable inside the operation call frame and never retained by the shim
     * (it is zero-filled as soon as the operation completes).
     */
    entropy?: BufferSource;
}
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
export declare function withSubtleBIP39(host: SubtleCrypto, bip39: BIP39Binding): SubtleCrypto;
