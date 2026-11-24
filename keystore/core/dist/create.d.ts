/**
 * The shared, platform-neutral keystore orchestrator.
 *
 * {@link createKeyStore} implements the {@link KeyStoreAPI} on top of two
 * injected seams and nothing else:
 *
 * - a **host {@link SubtleCrypto}** (plus an optional array of composable
 *   {@link SubtleShim} decorators layered over it), which performs all
 *   cryptography, and
 * - a **{@link KeyStoreDriver}**, which owns encrypted-at-rest persistence of
 *   material and metadata plus any platform-specific unlock flow.
 *
 * The orchestrator itself is crypto-only: it fetches + decrypts material
 * just-in-time via {@link KeyStoreDriver.use}, injects it into the shim
 * algorithm parameters for a single operation, and mirrors only UI-safe
 * metadata into the reactive {@link KeyStoreState} store. This is the body that
 * used to live inside the browser engine; every backend now supplies a driver
 * instead of copying it.
 */
import type { Store } from "@tanstack/store";
import type { HookCollection } from "before-after-hook";
import { type SubtleShim } from "./shims/index.ts";
import type { KeyStoreAPI } from "./types/backend.ts";
import type { KeyStoreDriver } from "./types/driver.ts";
import type { KeyStoreState } from "./types/extension.ts";
/**
 * Options for {@link createKeyStore}.
 *
 * @typeParam Ctx - The driver's per-operation context, threaded through the
 *   returned {@link KeyStoreAPI}.
 */
export interface CreateKeyStoreOptions<Ctx = unknown> {
    /** The storage backend that persists material + metadata for this keystore. */
    driver: KeyStoreDriver<Ctx>;
    /** Reactive store mirroring the persisted metadata (never private material). */
    store: Store<KeyStoreState>;
    /** Host Subtle implementation (never a shim); defaults to `globalThis.crypto.subtle`. */
    subtle?: SubtleCrypto;
    /**
     * Composable Subtle decorators layered over the host, in order, so a single
     * Subtle understands the extra algorithms the keystore needs (BIP32-Ed25519,
     * Falcon-1024, Deterministic-P256, BIP39/Algo25 seeds, …). Each entry is a
     * `withSubtle*` shim with its primitive binding already applied, e.g.
     * `(host) => withSubtleXHD(host, xhd)`. Unknown algorithms fall straight
     * through to the host, and an operation that needs a shim which was not
     * supplied surfaces the host's own "unsupported algorithm" error. Injected
     * this way, core never depends on any specific `xhd`/`falcon`/… binding.
     *
     * Defaults to {@link createDefaultShims} — every supported algorithm add-on
     * (BIP32-Ed25519, Falcon-1024, Deterministic-P256, BIP39 and Algo25) enabled
     * with its bundled binding. Pass an explicit array (including `[]`) to
     * override this and supply your own/platform-native bindings.
     *
     * May also be a (possibly async) factory, resolved once as part of
     * {@link KeyStore.ready}. This lets a synchronous platform engine defer
     * building its default stack — e.g. React Native asynchronously loads its
     * native `@joe-p/react-native-falcon` binding and folds it into
     * {@link createDefaultShims} — without blocking construction.
     */
    shims?: SubtleShim[] | (() => SubtleShim[] | Promise<SubtleShim[]>);
    /**
     * Optional hook collection applied at creation. When provided, every
     * material-touching {@link KeyStoreAPI} method is wrapped so `before`/`after`
     * hooks can intercept, observe or short-circuit the operation, and the
     * collection is exposed as {@link KeyStore.hooks}. This is how the Wallet
     * Provider extension threads its hooks into the engine — the hooks are bound
     * once, when the keystore is created, rather than per call site.
     */
    hooks?: HookCollection<any>;
    /**
     * The standard algorithms the host {@link SubtleCrypto} is expected to
     * provide, reported (tagged `source: "host"`) alongside the active shim
     * add-ons in {@link KeyStoreState.algorithms}. Defaults to
     * {@link DEFAULT_HOST_ALGORITHMS}. WebCrypto cannot be enumerated, so this is
     * a documented baseline a platform can override to match its host (e.g. a
     * React Native Subtle polyfill lacking `Ed25519`).
     */
    hostAlgorithms?: readonly string[];
}
/**
 * A {@link KeyStoreAPI} plus a `ready` promise that resolves once the driver is
 * open and the reactive store has been hydrated from persisted metadata.
 *
 * @typeParam Ctx - The driver's per-operation context.
 */
export interface KeyStore<Ctx = unknown> extends KeyStoreAPI<Ctx> {
    /** Resolves once the driver is ready and existing metadata is loaded. */
    ready: Promise<void>;
    /**
     * The hook collection bound at creation, when {@link CreateKeyStoreOptions.hooks}
     * was supplied. Consumers register `before`/`after`/`error` hooks against
     * operation ids (`"generate"`, `"sign"`, `"verify"`, `"remove"`, `"clear"`,
     * `"deriveFromSeed"`, `"encryptWithKey"`, `"decryptWithKey"`,
     * `"deriveSharedSecret"`, `"batchSign"`, …).
     */
    hooks?: HookCollection<any>;
}
/**
 * Creates a keystore that fulfils the {@link KeyStoreAPI} by orchestrating an
 * injected host {@link SubtleCrypto} (with any composable {@link SubtleShim}
 * decorators layered over it for BIP32-Ed25519 / Falcon-1024 / …) and an
 * injected {@link KeyStoreDriver} for persistence.
 *
 * Standard host keys (Ed25519, ECDSA, AES, …) are persisted as non-extractable
 * {@link CryptoKey}s when the driver supports it
 * ({@link DriverCapabilities.nativeCryptoKey}), otherwise serialized to sealed
 * bytes. Shim keys (BIP32-Ed25519 roots, Falcon private keys) and raw seeds are
 * always stored as bytes the driver encrypts at rest. Secret material is
 * decrypted just-in-time inside {@link KeyStoreDriver.use}, injected into the
 * shim algorithm parameters and wiped once the operation completes. The
 * reactive `store` mirrors only UI-safe metadata.
 *
 * @typeParam Ctx - The driver's per-operation context, threaded verbatim
 *   through the returned API's material-touching methods.
 * @param options - {@link CreateKeyStoreOptions}.
 * @returns A {@link KeyStore} (a `KeyStoreAPI` plus a `ready` promise).
 *
 * @example
 * ```typescript
 * const keystore = createKeyStore({
 *   driver,
 *   store,
 *   shims: [(host) => withSubtleXHD(host, xhd), (host) => withSubtleFalcon1024(host, falcon)],
 * });
 * await keystore.ready;
 * const id = await keystore.generate({
 *   type: "ed25519",
 *   algorithm: "EdDSA",
 *   extractable: false,
 *   keyUsages: ["sign", "verify"],
 * });
 * const signature = await keystore.sign(id, new TextEncoder().encode("hi"));
 * ```
 */
export declare function createKeyStore<Ctx = unknown>(options: CreateKeyStoreOptions<Ctx>): KeyStore<Ctx>;
