/**
 * BIP32 derivation variants understood by the XHD binding.
 *
 * - `Khovratovich` (32) — the original BIP32-Ed25519 amendment.
 * - `Peikert` (9) — Peikert's amendment, the keystore default.
 */
export declare const BIP32DerivationType: {
    readonly Khovratovich: 32;
    readonly Peikert: 9;
};
/** Algorithm identifier used to route operations to the XHD decorator. */
export declare const XHD_ALGORITHM = "BIP32-Ed25519";
/**
 * The subset of the BIP32-Ed25519 primitive that {@link withSubtleXHD} needs.
 *
 * Mirrors the public surface of `@algorandfoundation/xhd-wallet-api`'s
 * `XHDWalletAPI` (plus its otherwise-private `rawSign`) so a platform can
 * supply any compatible binding.
 */
export interface XHDBinding {
    /**
     * Derives the 96-byte extended root key `(kL, kR, c)` from a seed.
     *
     * @param seed - The seed bytes (e.g. from a BIP39 mnemonic).
     * @returns The extended root key, 96 bytes.
     */
    fromSeed(seed: Uint8Array): Uint8Array;
    /**
     * Derives a child key from an extended root key along a BIP44 path.
     *
     * @param rootKey - Extended root key `(kL, kR, c)`, 96 bytes.
     * @param bip44Path - BIP44 path segments.
     * @param isPrivate - When true returns the extended private key, otherwise the public key.
     * @param derivationType - One of {@link BIP32DerivationType}.
     */
    deriveKey(rootKey: Uint8Array, bip44Path: number[], isPrivate: boolean, derivationType: number): Promise<Uint8Array>;
    /**
     * Signs raw data with the scalar derived from the root key at `bip44Path`.
     *
     * @param rootKey - Extended root key `(kL, kR, c)`, 96 bytes.
     * @param bip44Path - BIP44 path segments.
     * @param data - The message bytes to sign.
     * @param derivationType - One of {@link BIP32DerivationType}.
     * @returns A 64-byte Ed25519 signature.
     */
    rawSign(rootKey: Uint8Array, bip44Path: number[], data: Uint8Array, derivationType: number): Promise<Uint8Array>;
    /**
     * Verifies a standard Ed25519 signature against a 32-byte public key.
     */
    verifyWithPublicKey(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
    /**
     * Performs Elliptic-Curve Diffie-Hellman against `otherPartyPub`, producing a
     * 32-byte shared secret between the child key at `bip44Path` and the remote
     * party. Used for the private-channel/negotiation (Diffie-Hellman) path.
     *
     * @param rootKey - Extended root key `(kL, kR, c)`, 96 bytes.
     * @param bip44Path - BIP44 path segments identifying the local child key.
     * @param otherPartyPub - The remote party's 32-byte public key.
     * @param meFirst - Whether the local key is ordered first in the derivation.
     * @param derivationType - One of {@link BIP32DerivationType}.
     * @returns The 32-byte shared secret.
     */
    ecdh(rootKey: Uint8Array, bip44Path: number[], otherPartyPub: Uint8Array, meFirst: boolean, derivationType: number): Promise<Uint8Array>;
}
/**
 * Parameters accepted for XHD (`BIP32-Ed25519`) `sign`/`deriveBits` calls.
 */
export interface XHDParams {
    name: typeof XHD_ALGORITHM;
    /** BIP44 path segments identifying the child key. */
    bip44Path: number[];
    /** Derivation variant; defaults to {@link BIP32DerivationType.Peikert}. */
    derivationType?: number;
    /** For `deriveBits`: derive the extended private key instead of the public key. */
    isPrivate?: boolean;
    /**
     * Seed used by `generateKey` to derive the extended root key, so the root is
     * recoverable from a mnemonic. Only read by `generateKey`.
     */
    seed?: BufferSource;
    /**
     * The 96-byte extended root key `(kL, kR, c)`, injected just-in-time for
     * `sign`/`deriveBits`. It is only reachable inside the operation call frame
     * and never retained by the shim.
     */
    rootKey?: BufferSource;
    /**
     * The 32-byte derived Ed25519 public key, supplied for `verify`. Public
     * material is not secret, so verification needs no storage-engine unlock.
     */
    publicKey?: BufferSource;
    /**
     * The remote party's 32-byte public key. When present on a `deriveBits`
     * call, the operation performs ECDH (shared-secret derivation) against the
     * injected `rootKey` instead of a child-key derivation.
     */
    otherPartyPub?: BufferSource;
    /** ECDH key ordering; defaults to `true` (local key first). */
    meFirst?: boolean;
}
/**
 * Extends a host {@link SubtleCrypto} with BIP32-Ed25519 (extended
 * hierarchical-deterministic) key support, delegating every other algorithm to
 * the host untouched.
 *
 * The decorator adds responsibilities for the `"BIP32-Ed25519"` algorithm to
 * `generateKey`, `deriveKey`, `deriveBits`, `sign` and `verify`; anything else
 * passes straight through. It reads no globals and does not mutate the host, so
 * it composes with other decorators and works for any consumer holding a
 * `SubtleCrypto` instance.
 *
 * A BIP32-Ed25519 private key is the 96-byte extended root key `(kL, kR, c)`.
 * `generateKey` derives that root from a `seed` and returns a handle that
 * *transiently* carries it, so the calling storage engine can consume it once
 * (via `consumeKeyMaterial`) and persist it encrypted at rest. `deriveKey`
 * mints a material-free metadata handle that merely records the child's `bip44Path`
 * (and `derivationType`): a derived key is treated like an ordinary key whose
 * associated root is fetched and re-derived at `sign` time. For `sign` and
 * `deriveBits` the root is injected just-in-time via the `rootKey` parameter,
 * and `verify` reads only the (non-secret) `publicKey` parameter, so decrypted
 * material lives only inside the operation call frame. `importKey`/`exportKey`
 * throw {@link MaterialAccessError} — material never moves *through* the public
 * surface after birth. The `key` argument is an opaque metadata handle (see
 * `createKeyHandle`).
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`).
 * @param xhd - The BIP32-Ed25519 primitive binding.
 * @returns A new `SubtleCrypto` that also understands `"BIP32-Ed25519"`.
 *
 * @example
 * ```typescript
 * const subtle = withSubtleXHD(crypto.subtle, xhd);
 *
 * // The storage engine births the root, persists it, then records a derived key.
 * const root = await subtle.generateKey({ name: "BIP32-Ed25519", seed }, false, ["sign"]);
 * const rootKey = consumeKeyMaterial(root, (m) => persist(m)); // encrypted at rest, then wiped
 *
 * const path = [harden(44), harden(283), harden(0), 0, 0];
 * const account = await subtle.deriveKey({ name: "BIP32-Ed25519", bip44Path: path }, root, { name: "BIP32-Ed25519" }, false, ["sign"]);
 *
 * // Signing re-derives from the fetched root along the recorded path.
 * const sig = await subtle.sign({ name: "BIP32-Ed25519", bip44Path: path, rootKey }, account, message);
 * ```
 */
export declare function withSubtleXHD(host: SubtleCrypto, xhd: XHDBinding): SubtleCrypto;
