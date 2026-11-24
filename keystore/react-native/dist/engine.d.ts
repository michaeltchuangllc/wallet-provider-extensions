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
import { type Falcon1024Binding, type KeyStore, type KeyStoreState, type SubtleShim } from "@algorandfoundation/keystore-core";
import type { Store } from "@tanstack/store";
import type { HookCollection } from "before-after-hook";
import { type KeychainStorage } from "./storage/driver.ts";
import type { AuthenticationOptions } from "./types.ts";
/** Options for {@link createReactNativeKeyStore}. */
export interface ReactNativeKeyStoreOptions {
    /** Reactive store that mirrors the persisted metadata (never private material). */
    store: Store<KeyStoreState>;
    /**
     * Host Subtle implementation. On React Native there is no reliable global, so
     * pass `react-native-quick-crypto`'s `subtle`.
     */
    subtle: SubtleCrypto;
    /**
     * Composable Subtle decorators layered over the host, in order, to add the
     * algorithms the keystore needs (e.g. `(host) => withSubtleXHD(host, xhd)`,
     * `(host) => withSubtleFalcon1024(host, falcon)`,
     * `(host) => withSubtleDP256(host, dp256)`). Injected this way, the engine
     * stays free of a hard dependency on any specific primitive binding. A
     * function is resolved lazily, as `createKeyStore` does, so a binding that
     * loads asynchronously (the native Falcon module) can be folded in.
     */
    shims?: SubtleShim[] | (() => SubtleShim[] | Promise<SubtleShim[]>);
    /**
     * Falcon-1024 binding used to enable post-quantum keys in the **default** shim
     * set (i.e. when `shims` is not supplied). React Native cannot load the WASM
     * `falcon-1024` used elsewhere, so this is normally the native
     * `@joe-p/react-native-falcon` module adapted via `createFalconBinding`. When
     * omitted, the engine tries to load `@joe-p/react-native-falcon` automatically
     * and simply leaves Falcon out of the default set if it is unavailable. Ignored
     * when an explicit `shims` array is provided.
     */
    falcon?: Falcon1024Binding;
    /**
     * MMKV-style store for sealed material + metadata; defaults to the package's
     * shared `keystore` MMKV instance. Injectable for tests / multiple stores.
     */
    storage?: KeychainStorage;
    /**
     * Optional hook collection bound at creation. When provided, every
     * material-touching operation is interceptable via `before`/`after` hooks and
     * is exposed as `keystore.hooks`. This is how the Wallet Provider
     * `WithKeyStore` extension threads its hooks into the engine.
     */
    hooks?: HookCollection<any>;
    /**
     * Default {@link AuthenticationOptions} applied to master-key reads/writes
     * when a caller does not pass a per-operation context. Lets the extension
     * bind an app-wide biometric/prompt policy once, matching the legacy
     * behaviour where authentication options were applied to every operation.
     */
    authentication?: AuthenticationOptions;
    /**
     * Work that must complete before the engine reads any persisted state.
     *
     * The keystore hydrates its reactive store from the driver during `ready`, so
     * anything that rewrites persisted metadata — notably a migration run — has to
     * finish first or the store mirrors pre-migration data. `WithKeyStore` passes
     * `provider.migrations?.ready` here.
     *
     * A rejection propagates to `ready`: a keystore whose data failed to migrate
     * is not one an application should read from.
     */
    before?: Promise<unknown>;
}
/**
 * The React Native keystore: the shared {@link KeyStore} (a `KeyStoreAPI` plus a
 * `ready` promise) backed by MMKV + Keychain. Its per-operation context is
 * {@link AuthenticationOptions}, threaded into every material-touching call.
 */
export type ReactNativeKeyStore = KeyStore<AuthenticationOptions>;
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
export declare function createReactNativeKeyStore(options: ReactNativeKeyStoreOptions): ReactNativeKeyStore;
