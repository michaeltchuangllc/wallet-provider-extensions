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
import { InvalidKeyDataError, KeyNotFoundError, KeyStoreError, } from "@algorandfoundation/keystore-core";
import { MATERIAL_STORE, METADATA_STORE, openDatabase, } from "./db.js";
import { getMasterKey, MASTER_KEY_ID, open, seal } from "./vault.js";
const CAPABILITIES = {
    nativeCryptoKey: true,
    interactiveUnlock: false,
    authFactors: [],
};
/**
 * Rejects any operation addressing {@link MASTER_KEY_ID}.
 *
 * The vault master key lives in the same object store as user material, so an
 * id collision is not merely a naming clash: writing over it would orphan every
 * sealed record in the database, and deleting it would do the same on the next
 * reload. The id is reserved — it is never listed, never removed and never
 * overwritten — so a caller that picks it gets a loud error instead of a
 * silently broken vault.
 */
function assertNotReserved(id) {
    if (id === MASTER_KEY_ID) {
        throw new InvalidKeyDataError(`${MASTER_KEY_ID} is reserved for the vault master key`);
    }
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
export function createIndexedDBDriver(options) {
    const host = options.host;
    const factory = options.indexedDB ?? globalThis.indexedDB;
    const databaseName = options.databaseName ?? "keystore";
    const provided = options.masterKey;
    let db;
    let master;
    const ready = (async () => {
        db = await openDatabase(databaseName, factory);
        if (!provided)
            master = await getMasterKey(db, host);
    })();
    // Resolved per operation rather than once in `ready`. A provider may be
    // unable to answer yet — a vault the user has not unlocked — and a key
    // captured at startup would outlive the next lock; awaiting it in `ready`
    // would instead reject the driver for good in a context that boots locked.
    const resolveMaster = async () => {
        if (!provided)
            return master;
        const key = await provided();
        // Checked before anything is sealed: an encrypt-only key would otherwise
        // write material that nothing can open again. Optional chains because a
        // provider can resolve anything at runtime, raw key bytes included.
        if (key?.algorithm?.name !== "AES-GCM" ||
            !key.usages?.includes("encrypt") ||
            !key.usages?.includes("decrypt")) {
            // TODO: throw keystore-core's `UnlockingError` once it moves there.
            throw new KeyStoreError("masterKey must resolve to an AES-GCM CryptoKey with encrypt and decrypt usages", "UnlockingError");
        }
        return key;
    };
    // An externally supplied key is only worth supplying if everything is bound
    // to it: left on, the native path would persist private keys as
    // non-extractable `CryptoKey`s the vault never seals, openable from a copy
    // of the profile without the secret behind the provider.
    const capabilities = provided
        ? { ...CAPABILITIES, nativeCryptoKey: false }
        : CAPABILITIES;
    return {
        capabilities,
        ready,
        async put(id, material) {
            assertNotReserved(id);
            if (material.kind === "cryptokey") {
                // Only a genuine CryptoKey keeps its secret across a structured clone.
                // A shim's look-alike handle would lose its material, or write plain
                // fields into IndexedDB unsealed; shim material must arrive as bytes.
                const isCryptoKey = (k) => k instanceof CryptoKey;
                if (!isCryptoKey(material.privateKey) ||
                    (material.publicKey !== undefined && !isCryptoKey(material.publicKey))) {
                    throw new InvalidKeyDataError(`refusing to persist ${id}: "cryptokey" material must be a host CryptoKey (seal shim keys as bytes)`);
                }
                await db.put(MATERIAL_STORE, {
                    id,
                    kind: "cryptokey",
                    privateKey: material.privateKey,
                    publicKey: material.publicKey,
                });
                return;
            }
            let sealed;
            try {
                sealed = await seal(host, await resolveMaster(), material.bytes);
            }
            finally {
                // Defence-in-depth, as in `use()`: the driver owns the buffer from
                // here, so neither a provider that rejects nor a host that rejects the
                // encrypt may leave the plaintext behind.
                material.bytes.fill(0);
            }
            await db.put(MATERIAL_STORE, { id, kind: "bytes", ...sealed });
        },
        async use(id, _ctx, fn) {
            const record = await db.get(MATERIAL_STORE, id);
            if (!record)
                throw new KeyNotFoundError(id);
            if (record.kind === "cryptokey") {
                return fn({
                    kind: "cryptokey",
                    privateKey: record.privateKey,
                    publicKey: record.publicKey,
                });
            }
            // Resolved outside the `try` below: a provider's own rejection is about
            // the provider, not this record, and surfaces as itself.
            const key = await resolveMaster();
            let bytes;
            try {
                bytes = await open(host, key, record);
            }
            catch (error) {
                // AES-GCM's authentication failure. The cipher cannot tell a key that
                // did not seal this record from a damaged record, so neither can we.
                if (error instanceof DOMException && error.name === "OperationError") {
                    // TODO: throw keystore-core's `UnlockingError` once it moves there.
                    throw new KeyStoreError(`master key cannot open ${id} (wrong key or damaged record)`, "UnlockingError", error);
                }
                throw error;
            }
            try {
                return await fn({ kind: "bytes", bytes });
            }
            finally {
                // Defence-in-depth: the shims wipe injected material, but a decrypted
                // buffer must never outlive the operation regardless of the consumer.
                bytes.fill(0);
            }
        },
        /**
         * Removes a key's material and metadata. The vault master key
         * ({@link MASTER_KEY_ID}) is reserved and cannot be removed.
         */
        async remove(id) {
            assertNotReserved(id);
            await db.deleteKey(id);
        },
        /**
         * Empties the keystore, removing all user keys and metadata. The vault
         * master key is preserved so that subsequently written material remains
         * openable after a reload — unless a `masterKey` provider supplies one, in
         * which case the vault's own record seals nothing this driver writes and
         * goes with everything it did seal. That is safe because the provider
         * holds the key independently of the database — but it would orphan a
         * driver still running *without* a provider over the same database.
         */
        async clear() {
            await db.clear(provided ? [] : [MASTER_KEY_ID]);
        },
        async putMeta(key) {
            assertNotReserved(key.id);
            await db.put(METADATA_STORE, key);
        },
        async getMeta(id) {
            return db.get(METADATA_STORE, id);
        },
        async listMeta() {
            return db.getAll(METADATA_STORE, [MASTER_KEY_ID]);
        },
    };
}
