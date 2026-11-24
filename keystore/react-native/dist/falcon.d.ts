/**
 * React Native Falcon-1024 binding.
 *
 * The shared core keystore understands Falcon-1024 through a
 * {@link Falcon1024Binding}. On the web / Node the binding is backed by the
 * `falcon-1024` WASM module, but **older React Native runtimes cannot load
 * WASM**, so React Native instead uses the native `@joe-p/react-native-falcon`
 * module (a Nitro HybridObject with an Android/iOS C++ backend).
 *
 * This module adapts that native module onto the core {@link Falcon1024Binding}
 * surface. The two differ in exactly two ways, both handled here:
 *
 * 1. the native module speaks `ArrayBuffer`, the binding speaks `Uint8Array`;
 * 2. the native `verify` *throws* on a bad signature, whereas the binding's
 *    `verifyCompressed` returns a `boolean` (WebCrypto's contract).
 */
import type { Falcon1024Binding } from "@algorandfoundation/keystore-core";
/**
 * The subset of the `@joe-p/react-native-falcon` native module (`FalconModule`)
 * that {@link createFalconBinding} needs. Declared locally so this package
 * depends on the native module only as an (optional) peer at runtime, never on
 * its types.
 */
export interface ReactNativeFalconModule {
    /** Generates a Falcon-1024 keypair, deterministically when a `seed` is given. */
    generateKey(seed?: ArrayBuffer): {
        publicKey: ArrayBuffer;
        privateKey: ArrayBuffer;
    };
    /** Produces a compressed (variable-length) Falcon-1024 signature. */
    signCompressed(privateKey: ArrayBuffer, msg: ArrayBuffer): ArrayBuffer;
    /** Verifies a compressed signature; throws when it is invalid. */
    verify(publicKey: ArrayBuffer, signature: ArrayBuffer, msg: ArrayBuffer): void;
}
/**
 * Adapts a `@joe-p/react-native-falcon` {@link ReactNativeFalconModule} onto the
 * core {@link Falcon1024Binding}, so it can be injected into the keystore's
 * default shim set exactly like the WASM `falcon-1024` binding is on other
 * platforms.
 *
 * @param module - The native Falcon module (e.g. `FalconModule` from `@joe-p/react-native-falcon`).
 * @returns A {@link Falcon1024Binding} backed by the native module.
 *
 * @example
 * ```typescript
 * import { FalconModule } from "@joe-p/react-native-falcon";
 * const falcon = createFalconBinding(FalconModule);
 * const keystore = createReactNativeKeyStore({ store, subtle, falcon });
 * ```
 */
export declare function createFalconBinding(module: ReactNativeFalconModule): Falcon1024Binding;
/**
 * Lazily loads the native `@joe-p/react-native-falcon` module and adapts it to a
 * {@link Falcon1024Binding}, or resolves to `undefined` when the module is not
 * installed/linked. The React Native engine uses this to enable Falcon-1024 in
 * its default shim set without a hard dependency on the native package.
 *
 * @returns A {@link Falcon1024Binding}, or `undefined` when
 *   `@joe-p/react-native-falcon` is unavailable.
 */
export declare function loadDefaultFalconBinding(): Promise<Falcon1024Binding | undefined>;
