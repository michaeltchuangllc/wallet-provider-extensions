/**
 * Encryption-at-rest for material that cannot be persisted as a
 * {@link CryptoKey} (shim key material and raw seeds).
 *
 * The vault owns a single AES-GCM **master key** that is itself a
 * non-extractable {@link CryptoKey} persisted in IndexedDB (structured-cloned,
 * so its bytes never live in JS). All byte-material is sealed with it before it
 * is written and only ever opened just-in-time for a single operation.
 */
import type { KeyStoreDatabase } from "./db.ts";
/** Reserved material id under which the vault master key is persisted. */
export declare const MASTER_KEY_ID = "__keystore.master__";
/**
 * A sealed payload: AES-GCM ciphertext together with the IV used to produce it.
 */
export interface SealedBytes {
    iv: Uint8Array;
    ciphertext: Uint8Array;
}
/**
 * Loads the vault master key from storage, creating and persisting a fresh
 * non-extractable AES-GCM key on first use.
 *
 * Creation is serialised with a Web Lock where the API is available, so
 * callers racing from other same-origin contexts converge on one key instead
 * of each keeping the one it minted.
 *
 * @param db - The keystore database handle.
 * @param subtle - The host {@link SubtleCrypto} (never a shim decorator — this
 *   is a standard AES-GCM key).
 * @returns The master {@link CryptoKey}.
 */
export declare function getMasterKey(db: KeyStoreDatabase, subtle: SubtleCrypto): Promise<CryptoKey>;
/**
 * Seals plaintext bytes with the master key (AES-GCM).
 *
 * @param subtle - The host {@link SubtleCrypto}.
 * @param master - The vault master key.
 * @param plaintext - The bytes to encrypt.
 * @returns The {@link SealedBytes} to persist.
 */
export declare function seal(subtle: SubtleCrypto, master: CryptoKey, plaintext: Uint8Array): Promise<SealedBytes>;
/**
 * Opens sealed bytes with the master key (AES-GCM).
 *
 * @param subtle - The host {@link SubtleCrypto}.
 * @param master - The vault master key.
 * @param sealed - The {@link SealedBytes} previously produced by {@link seal}.
 * @returns The decrypted plaintext. The caller owns this buffer and should wipe
 *   or hand it straight to a shim (which wipes injected material after use).
 */
export declare function open(subtle: SubtleCrypto, master: CryptoKey, sealed: SealedBytes): Promise<Uint8Array>;
