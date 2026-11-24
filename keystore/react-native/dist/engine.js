/**
 * The React Native keystore engine.
 *
 * Like the browser engine, this is a thin wrapper: it builds a Keychain/MMKV
 * {@link KeyStoreDriver} and hands it to the shared, platform-neutral
 * {@link createKeyStore} orchestrator in `@algorandfoundation/keystore-core`.
 * All crypto orchestration lives in core and is shared with every other
 * backend; this
 * package only supplies the mobile persistence — MMKV for storage,
 * `react-native-keychain` for the master key and the host `SubtleCrypto`
 * (`react-native-quick-crypto`'s `subtle`) for AES-256-GCM sealing, the same
 * scheme used by the web and node engines.
 *
 * The engine's per-operation context is {@link AuthenticationOptions}, so a
 * biometric/passcode prompt can be requested exactly when a secret is needed
 * (e.g. `keystore.sign(id, data, undefined, { biometrics: true })`). `verify`
 * stays context-free — it only touches the public key and never unlocks.
 */
import { createDefaultShims, createKeyStore, } from "@algorandfoundation/keystore-core";
import { Alert } from "react-native";
import { MasterKeyNotFoundError } from "./errors.js";
import { loadDefaultFalconBinding } from "./falcon.js";
import { resolveAuthenticationPrompt } from "./prompts.js";
import { createMasterKey, openData, readMasterKey, sealData } from "./storage/crypto.js";
import { createKeychainDriver, } from "./storage/driver.js";
import { storage as defaultStorage } from "./storage/state.js";
/**
 * The explicit name -> method table of every material-touching `KeyStoreAPI`
 * call, deliberately mirroring the table core itself uses when it binds hooks
 * (`keystore/core/src/create.ts`), so the two stay recognisably parallel and a
 * new API method is obviously missing from both.
 *
 * The context is always the last positional parameter and always optional, but
 * each method has a fixed shape, so the indices are hard-coded from the
 * signatures in `keystore/core/src/types/backend.ts`. `verify` is absent on
 * purpose: it only touches the public key and never unlocks.
 *
 * `batchSign` carries no `keyId` — it spans many keys, and naming one of them
 * in the prompt would be misleading.
 */
const OPERATION_BINDINGS = {
    generate: { operation: "generate", ctxIndex: 1 },
    import: { operation: "import", ctxIndex: 2 },
    export: { operation: "export", ctxIndex: 2, keyIdIndex: 0 },
    remove: { operation: "remove", ctxIndex: 1, keyIdIndex: 0 },
    clear: { operation: "clear", ctxIndex: 0 },
    sign: { operation: "sign", ctxIndex: 3, keyIdIndex: 0 },
    encryptWithKey: { operation: "encryptWithKey", ctxIndex: 3, keyIdIndex: 0 },
    decryptWithKey: { operation: "decryptWithKey", ctxIndex: 3, keyIdIndex: 0 },
    deriveSharedSecret: { operation: "deriveSharedSecret", ctxIndex: 4, keyIdIndex: 0 },
    importSeed: { operation: "importSeed", ctxIndex: 2 },
    deriveFromSeed: { operation: "deriveFromSeed", ctxIndex: 3, keyIdIndex: 0 },
    deriveDomainKey: { operation: "deriveDomainKey", ctxIndex: 2, keyIdIndex: 0 },
    batchSign: { operation: "batchSign", ctxIndex: 2 },
};
/** The same table for the nested `secrets` store (`SecretStoreAPI`). */
const SECRET_BINDINGS = {
    put: { operation: "secret.put", ctxIndex: 2 },
    get: { operation: "secret.get", ctxIndex: 1, keyIdIndex: 0 },
    remove: { operation: "secret.remove", ctxIndex: 1, keyIdIndex: 0 },
};
/**
 * Wraps every material-touching method so the context it forwards carries the
 * {@link AuthenticationOperation} it belongs to, the {@link KeyId} it targets
 * and the prompt resolved for that pair.
 *
 * Contexts are merged, never mutated: each call builds a fresh object from
 * `{ ...defaults, ...callerCtx, operation, keyId }`, so a caller's
 * `prompt`/`biometrics` always wins and the caller's own object is untouched.
 * A caller who sets `operation`/`keyId` explicitly keeps their value.
 *
 * `verify`, `ready`, `hooks`, `store` and every other non-tagged property pass
 * through unchanged.
 *
 * @param keystore - The keystore returned by `createKeyStore`.
 * @param store - The reactive store, used to look up key metadata for the
 *   prompt formatter. Metadata only — nothing is ever decrypted for a prompt.
 * @param defaults - The app-wide authentication policy, if configured.
 * @returns A keystore with the same surface whose calls are operation-tagged.
 */
function withOperationTags(keystore, store, defaults) {
    const tag = (method, thisArg, binding) => {
        return (...args) => {
            // Pad so the context lands at its fixed index even when the caller
            // omitted the optional parameters before it.
            const next = [...args];
            while (next.length <= binding.ctxIndex)
                next.push(undefined);
            const callerCtx = next[binding.ctxIndex];
            const operation = callerCtx?.operation ?? binding.operation;
            const keyId = callerCtx?.keyId ??
                (binding.keyIdIndex === undefined
                    ? undefined
                    : args[binding.keyIdIndex]);
            const key = keyId === undefined ? undefined : store.state.keys?.find((k) => k.id === keyId);
            next[binding.ctxIndex] = {
                ...defaults,
                ...callerCtx,
                operation,
                keyId,
                prompt: resolveAuthenticationPrompt(callerCtx, defaults, { operation, keyId, key }),
            };
            // TEMP: proves the linked clone's sign API ran; remove after testing.
            if (operation === "sign")
                Alert.alert("Mithilesh");
            return method.apply(thisArg, next);
        };
    };
    const tagAll = (source, bindings) => {
        const tagged = { ...source };
        for (const [name, binding] of Object.entries(bindings)) {
            const method = source[name];
            // Optional API methods are simply absent on backends that lack them.
            if (typeof method !== "function")
                continue;
            tagged[name] = tag(method, source, binding);
        }
        return tagged;
    };
    const source = keystore;
    const wrapped = tagAll(source, OPERATION_BINDINGS);
    if (keystore.secrets) {
        wrapped.secrets = tagAll(keystore.secrets, SECRET_BINDINGS);
    }
    return wrapped;
}
/**
 * Creates a React Native keystore backed by MMKV + Keychain and the core
 * composable Subtle shims.
 *
 * Because MMKV cannot hold a {@link CryptoKey}, every key (standard, HD root,
 * Falcon and seeds alike) is serialized to bytes and sealed at rest via the
 * host `SubtleCrypto` AES-256-GCM with a Keychain-backed master key; the key
 * is created on first write and unlocked — optionally behind biometrics — on
 * read. The reactive `store` mirrors only UI-safe metadata.
 *
 * @param options - {@link ReactNativeKeyStoreOptions}.
 * @returns A {@link ReactNativeKeyStore} (a `KeyStoreAPI` plus a `ready` promise).
 *
 * @example
 * ```typescript
 * import { Store } from "@tanstack/store";
 * import { subtle } from "react-native-quick-crypto";
 * import { withSubtleXHD } from "@algorandfoundation/keystore-core";
 * import { fromSeed, XHDWalletAPI } from "@algorandfoundation/xhd-wallet-api";
 *
 * const store = new Store({ keys: [], status: "idle" });
 * const api = new XHDWalletAPI();
 * const xhd = {
 *   fromSeed: (seed) => fromSeed(Buffer.from(seed)),
 *   deriveKey: (r, p, isPriv, d) => api.deriveKey(r, p, isPriv, d),
 *   rawSign: (r, p, data, d) => (api as any).rawSign(r, p, data, d),
 *   verifyWithPublicKey: (sig, msg, pk) => api.verifyWithPublicKey(sig, msg, pk),
 * };
 * const keystore = createReactNativeKeyStore({
 *   store,
 *   subtle,
 *   shims: [(host) => withSubtleXHD(host, xhd)],
 * });
 * await keystore.ready;
 *
 * const seedId = await keystore.importSeed!(bip39Seed);
 * const rootId = await keystore.generate(
 *   { type: "hd-root-key", algorithm: "raw", extractable: false, keyUsages: ["sign"],
 *     params: { parentKeyId: seedId } },
 *   { biometrics: true },
 * );
 * const acctId = await keystore.deriveFromSeed!(rootId, "m/44'/283'/0'/0/0");
 * const sig = await keystore.sign(acctId, data, undefined, { biometrics: true });
 * ```
 */
export function createReactNativeKeyStore(options) {
    const storage = options.storage ?? defaultStorage;
    const defaultAuth = options.authentication;
    const crypto = {
        masterKeyForWrite: async (auth) => {
            const effective = auth ?? defaultAuth;
            try {
                return await readMasterKey(effective);
            }
            catch (error) {
                // Only mint a fresh master key when the store is still empty; otherwise
                // an existing master is genuinely missing and creating one would
                // orphan every previously-sealed record.
                if (!(error instanceof MasterKeyNotFoundError))
                    throw error;
                if (storage.getAllKeys().length > 0)
                    throw error;
                return createMasterKey(effective);
            }
        },
        masterKeyForRead: (auth) => readMasterKey(auth ?? defaultAuth),
        seal: (key, data) => sealData(options.subtle, key, data),
        open: (key, payload) => openData(options.subtle, key, payload),
        wipe: (key) => key.fill(0),
    };
    const driver = createKeychainDriver({ storage, crypto });
    // Anything that rewrites persisted metadata (a migration run) must finish
    // before core hydrates its reactive store from the driver, otherwise the
    // store mirrors pre-migration data.
    const gated = options.before
        ? { ...driver, ready: options.before.then(() => driver.ready) }
        : driver;
    // When the caller passes no explicit `shims`, build the default set lazily so
    // the native `@joe-p/react-native-falcon` binding can be loaded asynchronously and
    // folded in as the Falcon-1024 provider (React Native cannot use the WASM
    // `falcon-1024` the other platforms default to). All other default shims
    // (XHD, dp256, BIP39, Algo25) come from core unchanged.
    const shims = options.shims ??
        (async () => {
            const falcon = options.falcon ?? (await loadDefaultFalconBinding());
            return createDefaultShims({ falcon });
        });
    const keystore = createKeyStore({
        driver: gated,
        store: options.store,
        subtle: options.subtle,
        shims,
        hooks: options.hooks,
    });
    // An application is free never to await `keystore.ready` (e.g. it renders a
    // "migration failed" screen and never touches `key.store`). Core's `ready`
    // awaits `driver.ready` — the `before`-gated promise above — internally, so
    // when `before` rejects, that rejection propagates to `keystore.ready`
    // itself; without a handler attached to it, that would surface as an
    // unhandled promise rejection. `.catch()` registers a handler on this exact
    // promise (not just on the derived one it returns), so it does not swallow
    // anything: a caller who does `await keystore.ready` still observes the
    // rejection normally.
    keystore.ready.catch(() => {
        /* surfaced through `ready` to whoever awaits it */
    });
    return withOperationTags(keystore, options.store, defaultAuth);
}
