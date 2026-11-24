/** Algorithm identifier used to route operations to the deterministic-P256 decorator. */
export declare const DP256_ALGORITHM = "Deterministic-P256";
/**
 * Default salt for the PBKDF2-HMAC-SHA512 derived-main-key step, matching the
 * canonical Liquid Auth / `@algorandfoundation/dp256` contract. Passkeys are
 * only reproducible across devices and native signers when every party uses the
 * same salt, so this default must not drift.
 */
export declare const DP256_DEFAULT_SALT: Uint8Array;
/** Default PBKDF2 iteration count for the derived-main-key step. */
export declare const DP256_DEFAULT_ITERATIONS = 210000;
/** Default derived-main-key length, in bytes (512 bits). */
export declare const DP256_DEFAULT_KEY_LENGTH_BYTES = 64;
/**
 * The subset of the deterministic-P256 primitive that {@link withSubtleDP256}
 * needs. Mirrors the public surface of `@algorandfoundation/dp256`'s
 * `DeterministicP256` class one-to-one, so a platform can supply either the
 * JS implementation or a native binding (e.g. the Kotlin/Swift signers) as long
 * as the derivation is byte-compatible.
 *
 * There are two derivation levels, and both must be reproduced identically by
 * every party that regenerates a passkey:
 *
 * 1. `genDerivedMainKey` — PBKDF2-HMAC-SHA512 over the entropy, producing the
 *    **derived main key** (the parent/root of the deterministic hierarchy). Run
 *    once per device; the result is what {@link withSubtleDP256.generateKey}
 *    persists.
 * 2. `genDomainSpecificKeyPair` — `SHA-512(mainKey ‖ origin ‖ userHandle ‖
 *    counter)[0..32]`, producing the domain-specific P-256 private scalar.
 */
export interface DP256Binding {
    /**
     * Derives the main key from entropy using PBKDF2-HMAC-SHA512.
     *
     * @param entropy - The entropy source (e.g. BIP39 entropy bytes).
     * @param salt - PBKDF2 salt; defaults to {@link DP256_DEFAULT_SALT}.
     * @param iterationCount - PBKDF2 iterations; defaults to {@link DP256_DEFAULT_ITERATIONS}.
     * @param keyLengthBytes - Derived key length in bytes; defaults to {@link DP256_DEFAULT_KEY_LENGTH_BYTES}.
     * @returns The derived main key.
     */
    genDerivedMainKey(entropy: Uint8Array, salt: Uint8Array, iterationCount: number, keyLengthBytes: number): Promise<Uint8Array>;
    /**
     * Derives the domain-specific P-256 private scalar from the main key and the
     * `{ origin, userHandle, counter }` domain descriptor.
     *
     * @param derivedMainKey - The main key from {@link genDerivedMainKey}.
     * @param origin - The service origin/domain.
     * @param userHandle - The user's unique identifier on that service.
     * @param counter - Optional counter for multiple passkeys per service; defaults to 0.
     * @returns The 32-byte P-256 private scalar.
     */
    genDomainSpecificKeyPair(derivedMainKey: Uint8Array, origin: string, userHandle: string, counter?: number): Promise<Uint8Array>;
    /**
     * Produces a compact (64-byte `r ‖ s`) ECDSA-P256 signature over `payload`.
     */
    signWithDomainSpecificKeyPair(privateKey: Uint8Array, payload: Uint8Array): Uint8Array;
    /**
     * Returns the raw P-256 public key coordinates (64 bytes, `X ‖ Y`, without the
     * `0x04` uncompressed-point prefix) for a private scalar.
     */
    getPurePKBytes(privateKey: Uint8Array): Uint8Array;
}
/**
 * Derives the main key through a host {@link SubtleCrypto}'s built-in PBKDF2
 * (`importKey("raw", entropy, "PBKDF2")` + `deriveBits({ name: "PBKDF2",
 * hash: "SHA-512" })`).
 *
 * This is the same PBKDF2-HMAC-SHA512 contract as
 * {@link DP256Binding.genDerivedMainKey} — WebCrypto's PBKDF2 is fully
 * parameterised by hash, salt and iteration count, so the output is
 * byte-identical to the bundled `@algorandfoundation/dp256` implementation. The
 * difference is *where* it runs: every real host Subtle (Node's
 * `crypto.subtle`, browsers, `react-native-quick-crypto`) implements PBKDF2
 * natively, while the bundled binding runs it in pure JS (`@noble/hashes`) —
 * at the default 210,000 iterations that can block a slower JS runtime (React
 * Native's Hermes) for minutes.
 *
 * @param subtle - A Subtle implementation with PBKDF2 + SHA-512 support.
 * @param entropy - The entropy source (e.g. BIP39 entropy bytes).
 * @param salt - PBKDF2 salt (see {@link DP256_DEFAULT_SALT}).
 * @param iterationCount - PBKDF2 iterations (see {@link DP256_DEFAULT_ITERATIONS}).
 * @param keyLengthBytes - Derived key length in bytes (see {@link DP256_DEFAULT_KEY_LENGTH_BYTES}).
 * @returns The derived main key.
 * @throws When `subtle` does not implement PBKDF2 with SHA-512 (WebCrypto
 *   leaves per-algorithm support implementation-defined).
 */
export declare function genDerivedMainKeyWithSubtle(subtle: SubtleCrypto, entropy: Uint8Array, salt: Uint8Array, iterationCount: number, keyLengthBytes: number): Promise<Uint8Array>;
/**
 * Returns a copy of `dp256` whose {@link DP256Binding.genDerivedMainKey} runs
 * through the host Subtle's native PBKDF2
 * ({@link genDerivedMainKeyWithSubtle}), falling back to the binding's own
 * implementation when the host does not support PBKDF2 with SHA-512.
 *
 * All other operations (domain-key derivation, signing, public-key extraction)
 * are single SHA-512/ECDSA steps and pass through unchanged — only the
 * 210,000-iteration main-key derivation is worth routing to the host.
 *
 * @param host - The Subtle implementation whose PBKDF2 to prefer.
 * @param dp256 - The binding to decorate (also the derivation fallback).
 * @returns A {@link DP256Binding} with the host-preferring main-key derivation.
 */
export declare function withSubtleDerivedMainKey(host: SubtleCrypto, dp256: DP256Binding): DP256Binding;
/**
 * Parameters accepted for deterministic-P256 (`Deterministic-P256`) operations.
 */
export interface DP256Params {
    name: typeof DP256_ALGORITHM;
    /** Service origin/domain; part of the domain descriptor for `sign`/`deriveKey`/`deriveBits`. */
    origin?: string;
    /** User identifier on the service; part of the domain descriptor. */
    userHandle?: string;
    /** Optional counter for multiple passkeys per service; defaults to 0. */
    counter?: number;
    /**
     * Entropy consumed by `generateKey` to derive the main key via
     * PBKDF2-HMAC-SHA512, so the hierarchy is recoverable from a mnemonic. Only
     * read by `generateKey`.
     */
    entropy?: BufferSource;
    /** PBKDF2 salt for `generateKey`; defaults to {@link DP256_DEFAULT_SALT}. */
    salt?: BufferSource;
    /** PBKDF2 iterations for `generateKey`; defaults to {@link DP256_DEFAULT_ITERATIONS}. */
    iterationCount?: number;
    /** Derived key length in bytes for `generateKey`; defaults to {@link DP256_DEFAULT_KEY_LENGTH_BYTES}. */
    keyLengthBytes?: number;
    /**
     * The derived main key, injected just-in-time for `sign`/`deriveBits`. It is
     * only reachable inside the operation call frame and never retained by the
     * shim (it is zero-filled as soon as the operation completes).
     */
    mainKey?: BufferSource;
    /** For `deriveBits`: return the private scalar instead of the public key. */
    isPrivate?: boolean;
    /**
     * The raw P-256 public key (64 bytes `X ‖ Y`, or 65 bytes with a leading
     * `0x04`), supplied for `verify`. Public material is not secret, so
     * verification needs no storage-engine unlock.
     */
    publicKey?: BufferSource;
}
/**
 * Extends a host {@link SubtleCrypto} with deterministic-P256 (passkey) key
 * support, delegating every other algorithm to the host untouched.
 *
 * Deterministic-P256 is a two-level derivation, mirroring the XHD shim's shape:
 * a **derived main key** (`generateKey`, PBKDF2-HMAC-SHA512 over entropy) is the
 * parent, and **domain-specific keys** are derived from it along a
 * `{ origin, userHandle, counter }` descriptor (the analogue of a BIP44 path).
 * The child is an ordinary P-256 key, so `verify` uses the host's native ECDSA
 * once the public point is imported.
 *
 * `generateKey` mints the derived main key and returns a handle that
 * *transiently* carries it, so the calling storage engine can consume it once
 * (via `consumeKeyMaterial`) and persist it encrypted at rest. `deriveKey`
 * mints a material-free metadata handle recording only the domain descriptor: a
 * derived key is treated like an ordinary key whose main key is fetched and the
 * child re-derived at `sign` time. For `sign`/`deriveBits` the main key is
 * injected just-in-time via the `mainKey` parameter and wiped when the operation
 * completes, and `verify` reads only the (non-secret) `publicKey` parameter, so
 * decrypted material lives only inside the operation call frame.
 * `importKey`/`exportKey` throw {@link MaterialAccessError} — material never
 * moves *through* the public surface after birth.
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`). Its
 *   native ECDSA-P256 support is used for `verify`.
 * @param dp256 - The deterministic-P256 primitive binding.
 * @returns A new `SubtleCrypto` that also understands `"Deterministic-P256"`.
 *
 * @example
 * ```typescript
 * const subtle = withSubtleDP256(crypto.subtle, dp256);
 *
 * // The storage engine births the main key, persists it, then records a passkey.
 * const main = await subtle.generateKey({ name: "Deterministic-P256", entropy }, false, ["sign"]);
 * const mainKey = consumeKeyMaterial(main, (m) => persist(m)); // encrypted at rest, then wiped
 *
 * const descriptor = { origin: "https://example.com", userHandle: "user-123" };
 * const passkey = await subtle.deriveKey(
 *   { name: "Deterministic-P256", ...descriptor },
 *   main,
 *   { name: "Deterministic-P256" },
 *   false,
 *   ["sign"],
 * );
 *
 * // Signing re-derives the domain key from the fetched main key.
 * const sig = await subtle.sign({ name: "Deterministic-P256", ...descriptor, mainKey }, passkey, message);
 * ```
 */
export declare function withSubtleDP256(host: SubtleCrypto, dp256: DP256Binding): SubtleCrypto;
