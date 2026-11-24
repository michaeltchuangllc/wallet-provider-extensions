/**
 * The IndexedDB {@link KeyStoreDriver}: the browser's "material custodian" for
 * the shared {@link createKeyStore} orchestrator.
 *
 * IndexedDB's defining capability is that it can structured-clone a
 * **non-extractable {@link CryptoKey}**, so standard-algorithm keys are
 * persisted as real keys that never become raw bytes in JS
 * ({@link DriverCapabilities.nativeCryptoKey} is `true`, unless a `masterKey`
 * provider is supplied — see {@link IndexedDBDriverOptions.masterKey}). Shim key material
 * (BIP32-Ed25519 roots, Falcon private keys) and raw seeds cannot be
 * structured-cloned, so those are sealed with the vault master key and stored
 * as bytes encrypted at rest.
 *
 * The driver is non-interactive: it never prompts, so its per-operation context
 * is ignored.
 */
import type { KeyStoreDriver } from "@algorandfoundation/keystore-core";
/** Options for {@link createIndexedDBDriver}. */
export interface IndexedDBDriverOptions {
    /** Host Subtle used for the AES-GCM vault master key (never a shim decorator). */
    host: SubtleCrypto;
    /** IndexedDB factory; defaults to `globalThis.indexedDB`. Injectable for tests. */
    indexedDB?: IDBFactory;
    /** Database name; defaults to `"keystore"`. */
    databaseName?: string;
    /**
     * Supplies the AES-GCM key that seals byte material, in place of the one the
     * vault mints and persists itself.
     *
     * Hand this in to bind material to a secret the browser cannot produce on
     * its own — one derived from a user password, or held by another context —
     * so that a copy of the profile directory is not enough to open material
     * written from here on. `ready` then only opens the database, the reserved
     * {@link MASTER_KEY_ID} record is never minted, and the driver reports
     * `nativeCryptoKey: false` so that keys which would otherwise persist as
     * non-extractable `CryptoKey`s are sealed with this key as well. That trade
     * is deliberate but real: sealed keys are decrypted into JS memory for each
     * use, where a native `CryptoKey` never is.
     *
     * It is not a migration, and switching it on over a database the default
     * vault wrote splits that database in two. Byte material the vault already
     * sealed — seeds, HD roots, Falcon keys — stops opening, because `use()`
     * asks the provider for a key that did not seal it and AES-GCM rejects; it
     * cannot be re-imported either, since it can no longer be read. Migrate by
     * reading such material out under the default driver and re-writing it
     * under the provider before switching, or the user re-imports from their
     * recovery phrase. Records persisted natively as `CryptoKey`s keep working,
     * which is its own caveat: they were never sealed, so they stay openable
     * from a copy of the profile.
     *
     * It is called afresh for every operation that seals or opens byte material,
     * never captured: a provider is free to reject while the key is unavailable
     * (a locked vault) and to resolve again once it is not. Its rejection
     * surfaces unchanged.
     *
     * The key it resolves must be an AES-GCM `CryptoKey` with both `encrypt`
     * and `decrypt` usages; anything else is refused before a byte is sealed. A
     * key that fails to open a record is refused the same way, with the host's
     * `OperationError` as the `cause` — AES-GCM cannot tell a wrong key from a
     * damaged record. Both surface as a {@link KeyStoreError} named
     * `"UnlockingError"`.
     */
    masterKey?: () => Promise<CryptoKey>;
}
/**
 * Creates a {@link KeyStoreDriver} backed by IndexedDB.
 *
 * Standard keys persist as non-extractable {@link CryptoKey}s; byte material is
 * encrypted at rest with a non-extractable AES-GCM master key held in the same
 * database. Intended to be handed to {@link createKeyStore}.
 *
 * Byte material that fails to open — damaged, or sealed under another master
 * key — rejects with a {@link KeyStoreError} named `"UnlockingError"`, with the
 * host's `OperationError` as its `cause`, whether or not a `masterKey`
 * provider is set.
 *
 * @param options - {@link IndexedDBDriverOptions}.
 * @returns A ready-to-use {@link KeyStoreDriver}. Its `ready` promise resolves
 *   once the database is open and, unless a `masterKey` provider supplies one,
 *   the vault master key is available.
 */
export declare function createIndexedDBDriver(options: IndexedDBDriverOptions): KeyStoreDriver;
