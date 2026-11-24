/**
 * A minimal RFC 9180 (Hybrid Public Key Encryption) implementation covering
 * exactly what {@link import("./create.ts").KeyStore.encryptWithKey} needs:
 * **Auth mode** (`mode_auth`, `0x02`), **single-shot** seal/open, in the fixed
 * ciphersuite `DHKEM(P-256, HKDF-SHA256)` (`0x0010`) + `HKDF-SHA256` (`0x0001`)
 * + `AES-128-GCM` (`0x0001`).
 *
 * Every primitive runs through the **injected host {@link SubtleCrypto}**
 * (ECDH `deriveBits`, `HMAC` sign for HKDF-Extract/Expand, `AES-GCM`), never
 * through `globalThis.crypto`, so the module honours the keystore's
 * injected-host seam — the reason an off-the-shelf HPKE package (which
 * discovers the runtime WebCrypto itself) is not used here. Conformance is
 * pinned by the RFC 9180 Appendix A.3.3 test vectors in `hpke.test.ts`.
 */
/** Uncompressed P-256 point length (`Npk` = `Nenc`). */
export declare const HPKE_P256_POINT_LENGTH = 65;
/**
 * An ephemeral KEM key pair. Normally minted per seal inside
 * {@link hpkeSealAuth}; injectable only so the RFC 9180 test vectors (which
 * fix `skEm`) can drive the exact code path.
 */
export interface HpkeEphemeralKey {
    /** The ephemeral ECDH private key (`deriveBits`-capable). */
    privateKey: CryptoKey;
    /** The matching uncompressed public point (`enc`). */
    publicKey: Uint8Array;
}
/** Inputs for {@link hpkeSealAuth}. */
export interface HpkeSealOptions {
    /** The recipient's uncompressed P-256 public point (`pkRm`). */
    recipientPublicKey: Uint8Array;
    /** The sender's static ECDH private key (`skS`), `deriveBits`-capable. */
    senderPrivateKey: CryptoKey;
    /** The sender's uncompressed P-256 public point (`pkSm`). */
    senderPublicKey: Uint8Array;
    /** Application-supplied `info` binding the derived keys to their purpose. */
    info: Uint8Array;
    /** Additional authenticated data for the AEAD. */
    aad: Uint8Array;
    /** The plaintext to seal. */
    plaintext: Uint8Array;
    /** Test-vector injection only; omit in production so `enc` is fresh. */
    ephemeralKey?: HpkeEphemeralKey;
}
/**
 * Single-shot Auth-mode seal (`SealAuth`): encrypts `plaintext` so that only
 * the holder of the recipient private key can open it, and so that opening
 * also proves the sender held `senderPrivateKey`.
 *
 * @returns The encapsulated key (`enc`, 65 bytes) and the AEAD ciphertext.
 */
export declare function hpkeSealAuth(host: SubtleCrypto, options: HpkeSealOptions): Promise<{
    enc: Uint8Array;
    ciphertext: Uint8Array;
}>;
/** Inputs for {@link hpkeOpenAuth}. */
export interface HpkeOpenOptions {
    /** The encapsulated ephemeral public key (`enc`) from the sealed message. */
    enc: Uint8Array;
    /** The recipient's static ECDH private key (`skR`), `deriveBits`-capable. */
    recipientPrivateKey: CryptoKey;
    /** The recipient's uncompressed P-256 public point (`pkRm`). */
    recipientPublicKey: Uint8Array;
    /** The sender's uncompressed P-256 public point (`pkSm`). */
    senderPublicKey: Uint8Array;
    /** The `info` value the sealer used. */
    info: Uint8Array;
    /** The additional authenticated data the sealer used. */
    aad: Uint8Array;
    /** The AEAD ciphertext to open. */
    ciphertext: Uint8Array;
}
/**
 * Single-shot Auth-mode open (`OpenAuth`): the inverse of
 * {@link hpkeSealAuth}. Fails (the host AEAD rejects) when the ciphertext was
 * not sealed to this recipient by the claimed sender, or when any input was
 * tampered with.
 *
 * @returns The recovered plaintext.
 */
export declare function hpkeOpenAuth(host: SubtleCrypto, options: HpkeOpenOptions): Promise<Uint8Array>;
