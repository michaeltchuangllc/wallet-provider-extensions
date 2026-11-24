/** Algorithm identifier used to route operations to the Falcon decorator. */
export declare const FALCON_ALGORITHM = "Falcon-1024";
/**
 * Parameters accepted for Falcon-1024 `sign`/`verify` calls.
 *
 * The shim never holds key material: the private key is injected just-in-time
 * for `sign` and the (non-secret) public key is supplied for `verify`.
 */
export interface FalconParams {
    name: typeof FALCON_ALGORITHM;
    /**
     * Seed used by `generateKey` to derive the keypair deterministically, so the
     * key is recoverable from a mnemonic.
     */
    seed?: BufferSource;
    /** Private key material, injected just-in-time for `sign`. */
    privateKey?: BufferSource;
    /** Public key, supplied for `verify`. */
    publicKey?: BufferSource;
}
/**
 * The subset of the Falcon-1024 primitive that {@link withSubtleFalcon1024}
 * needs. Mirrors the pure functions exported by `falcon-1024`.
 */
export interface Falcon1024Binding {
    /**
     * Generates a Falcon-1024 keypair, deterministically when a `seed` is given.
     */
    generateKey(seed?: Uint8Array): {
        publicKey: Uint8Array;
        privateKey: Uint8Array;
    };
    /**
     * Produces a compressed (variable-length) Falcon-1024 signature.
     */
    signCompressed(privateKey: Uint8Array, message: Uint8Array): Uint8Array;
    /**
     * Verifies a compressed Falcon-1024 signature.
     */
    verifyCompressed(publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array): boolean;
}
/**
 * Extends a host {@link SubtleCrypto} with Falcon-1024 post-quantum signature
 * support, delegating every other algorithm to the host untouched.
 *
 * The decorator adds responsibilities for the `"Falcon-1024"` algorithm to
 * `sign` and `verify`; anything else passes straight through. Because it
 * neither reads globals nor mutates the host, it composes with other decorators
 * and can be used by any consumer that already has a `SubtleCrypto` instance.
 *
 * The shim never *holds* key material: `sign` receives the private key
 * just-in-time via {@link FalconParams.privateKey} and `verify` receives the
 * (non-secret) {@link FalconParams.publicKey}, so decrypted secrets only live
 * inside the operation call frame. `generateKey` is the one exception: it mints
 * a keypair and returns handles that *transiently* carry the fresh material so
 * the calling storage engine can consume it once (via `consumeKeyMaterial`) and
 * persist it encrypted at rest. `importKey` and `exportKey` still throw
 * {@link MaterialAccessError} — material never moves *through* the public
 * surface after birth. The `key` argument is an opaque metadata handle (see
 * `createKeyHandle`).
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`).
 * @param falcon - The Falcon-1024 primitive binding (e.g. the `falcon-1024` module).
 * @returns A new `SubtleCrypto` that also understands `"Falcon-1024"`.
 *
 * @example
 * ```typescript
 * import * as falcon from "falcon-1024";
 * const subtle = withSubtleFalcon1024(crypto.subtle, falcon);
 *
 * // A storage engine births the keypair, reads the fresh material to persist,
 * // then injects it per operation.
 * const { privateKey } = (await subtle.generateKey(
 *   { name: "Falcon-1024", seed },
 *   false,
 *   ["sign", "verify"],
 * )) as CryptoKeyPair;
 * // Persisted encrypted at rest, then wiped from memory when `use` returns.
 * const privMaterial = consumeKeyMaterial(privateKey, (m) => persist(m));
 *
 * const sig = await subtle.sign({ name: "Falcon-1024", privateKey: privMaterial }, privateKey, message);
 * const ok = await subtle.verify({ name: "Falcon-1024", publicKey }, privateKey, sig, message);
 * ```
 */
export declare function withSubtleFalcon1024(host: SubtleCrypto, falcon: Falcon1024Binding): SubtleCrypto;
