/**
 * A minimal promise-based wrapper over IndexedDB used by the browser keystore
 * storage engine.
 *
 * IndexedDB is the browser's structured, transactional key/value store. Its
 * defining capability for a keystore is that it can **structured-clone
 * non-extractable {@link CryptoKey} objects**: standard-algorithm keys can be
 * persisted as real, non-exportable keys that never exist as raw bytes in JS.
 * Shim keys (BIP32-Ed25519 roots, Falcon private keys) and raw seeds cannot be
 * structured-cloned, so those are stored as bytes encrypted at rest (see
 * `./vault.ts`).
 *
 * The factory is injectable so the engine can be exercised in a non-browser
 * test environment (e.g. `fake-indexeddb`).
 */
import type { KeyId } from "@algorandfoundation/keystore-core";
/** Object store holding UI-safe {@link import("@algorandfoundation/keystore-core").Key} metadata. */
export declare const METADATA_STORE = "metadata";
/** Object store holding the secret material for each key (a {@link MaterialRecord}). */
export declare const MATERIAL_STORE = "material";
/**
 * A persisted secret for a single key.
 *
 * - `cryptokey` — a genuine non-extractable {@link CryptoKey} structured-cloned
 *   into IndexedDB. Used for standard host algorithms (Ed25519, ECDSA, AES, …)
 *   so private material never materialises as bytes in JS.
 * - `bytes` — AES-GCM ciphertext (with its IV) for material that cannot be a
 *   `CryptoKey`: shim key material (BIP32-Ed25519 roots, Falcon private keys)
 *   and raw BIP39 seeds. Encrypted at rest with the vault master key.
 */
export type MaterialRecord = {
    id: KeyId;
    kind: "cryptokey";
    privateKey: CryptoKey;
    publicKey?: CryptoKey;
} | {
    id: KeyId;
    kind: "bytes";
    iv: Uint8Array;
    ciphertext: Uint8Array;
};
/**
 * Opens (creating/upgrading as needed) the keystore IndexedDB database and
 * returns a small promise-based handle over it.
 *
 * @param name - The database name (allows isolating multiple keystores).
 * @param factory - The {@link IDBFactory} to use; defaults to the global
 *   `indexedDB`. Injectable for tests.
 * @returns A {@link KeyStoreDatabase} handle.
 */
export declare function openDatabase(name: string, factory: IDBFactory): Promise<KeyStoreDatabase>;
/**
 * A thin, promise-based handle over an open keystore {@link IDBDatabase}.
 */
export declare class KeyStoreDatabase {
    #private;
    constructor(db: IDBDatabase);
    /** Name of the underlying IndexedDB database. */
    get name(): string;
    /** Reads a single record from a store, or `undefined` when absent. */
    get<T>(store: string, id: string): Promise<T | undefined>;
    /** Reads every record from a store, optionally excluding specific IDs. */
    getAll<T extends {
        id: string;
    }>(store: string, exclude?: string[]): Promise<T[]>;
    /** Writes (inserts or replaces) a record into a store. */
    put<T>(store: string, value: T): Promise<void>;
    /** Deletes a record from a store by id. */
    delete(store: string, id: string): Promise<void>;
    /** Removes an id from **both** the metadata and material stores atomically. */
    deleteKey(id: string): Promise<void>;
    /**
     * Empties both object stores.
     *
     * Material IDs in the `preserve` list are kept in the {@link MATERIAL_STORE}.
     * The {@link METADATA_STORE} is always cleared completely.
     *
     * @param preserve - Material IDs to preserve.
     */
    clear(preserve?: string[]): Promise<void>;
    /** Closes the underlying database connection. */
    close(): void;
}
