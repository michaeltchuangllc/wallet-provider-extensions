import type { KeyStoreExtension } from "@algorandfoundation/keystore-core";
import type { Extension } from "@algorandfoundation/wallet-provider";
/**
 * Wallet Provider Extension that adds Keystore functionality.
 *
 * The extension is a thin Provider/Extensions wrapper around the shared
 * {@link createReactNativeKeyStore} engine. There is a single code path to the
 * keystore API:
 *
 * - If a concrete {@link import("@algorandfoundation/keystore-core").KeyStoreAPI}
 *   is injected via `options.api.keystore`, it is used as-is.
 * - Otherwise the extension **builds** the React Native engine from the
 *   `options.keystore` block (the reactive `store`, the `hooks` collection, the
 *   host `subtle`, the composable `shims`, an optional MMKV `storage`, and a
 *   default `authentication` policy). The keystore hooks are applied when the
 *   engine is created, so every material-touching operation is interceptable.
 *
 * The reactive `keys`/`status` getters mirror the engine's metadata store. The
 * engine already exposes its `hooks` collection on the returned keystore, so the
 * extension surfaces `key.store` as-is without re-assigning it.
 *
 * @param provider - The host provider (may carry `log` and `migrations`
 *   extensions). When a `migrations` extension is present, this package's
 *   revisions (see `./migrations/index.ts`) are registered against it and the
 *   engine defers hydration until they have run.
 * @param options - {@link ReactKeystoreOptions}. `options.keystore.store` and
 *   `options.keystore.hooks` are required; the crypto bindings are required only
 *   when the extension builds the engine itself.
 *
 * @returns The {@link KeyStoreExtension} surface with reactive `keys`/`status`
 *   and the `key.store` keystore API (which already exposes `hooks` when the
 *   engine was built with them).
 *
 * @remarks
 * Migration registration (`migrationsApi?.register(...)`) always runs,
 * regardless of which code path above supplies the keystore API — but the
 * `before` gate (which sequences `createReactNativeKeyStore`'s hydration
 * behind `provider.migrations?.ready`) only exists on the engine-building
 * path. When `options.api.keystore` is injected, `createReactNativeKeyStore`
 * is never called, so that gate never exists: this package's migrations
 * still run against `options.keystore.storage ?? defaultStorage`, but with no
 * ordering guarantee relative to the injected backend. A consumer who injects
 * `options.api.keystore` owns sequencing the injected backend against
 * `provider.migrations.ready` itself.
 *
 * @example
 * ```typescript
 * const ProviderWithKeystore = Provider.withExtensions([WithKeyStore]);
 * const provider = new ProviderWithKeystore({
 *   keystore: {
 *     store,
 *     hooks,
 *     subtle,
 *     shims: [(host) => withSubtleXHD(host, xhd), (host) => withSubtleFalcon1024(host, falcon)],
 *   },
 * });
 *
 * // Intercept operations
 * provider.key.store.hooks.before("sign", ({ args }) => {
 *   console.log("About to sign", args);
 * });
 * ```
 */
export declare const WithKeyStore: Extension<KeyStoreExtension>;
