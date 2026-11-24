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
/** Copies a `Uint8Array` into a standalone `ArrayBuffer` (never a shared view). */
function toArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
/** Views an `ArrayBuffer` returned by the native module as a `Uint8Array`. */
function toBytes(buffer) {
    return new Uint8Array(buffer);
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
export function createFalconBinding(module) {
    return {
        generateKey: (seed) => {
            const pair = module.generateKey(seed ? toArrayBuffer(seed) : undefined);
            return { publicKey: toBytes(pair.publicKey), privateKey: toBytes(pair.privateKey) };
        },
        signCompressed: (privateKey, message) => toBytes(module.signCompressed(toArrayBuffer(privateKey), toArrayBuffer(message))),
        verifyCompressed: (publicKey, signature, message) => {
            // The native module throws on an invalid signature; translate that into
            // the boolean contract WebCrypto's `verify` (and the shim) expects.
            try {
                module.verify(toArrayBuffer(publicKey), toArrayBuffer(signature), toArrayBuffer(message));
                return true;
            }
            catch {
                return false;
            }
        },
    };
}
/**
 * Lazily loads the native `@joe-p/react-native-falcon` module and adapts it to a
 * {@link Falcon1024Binding}, or resolves to `undefined` when the module is not
 * installed/linked. The React Native engine uses this to enable Falcon-1024 in
 * its default shim set without a hard dependency on the native package.
 *
 * @returns A {@link Falcon1024Binding}, or `undefined` when
 *   `@joe-p/react-native-falcon` is unavailable.
 */
export async function loadDefaultFalconBinding() {
    try {
        // The import lives inside this `try` so the package stays an *optional*
        // dependency: bundlers that honour optional dependencies (Metro's
        // `allowOptionalDependencies`, on by default in React Native/Expo) keep the
        // build working when `@joe-p/react-native-falcon` is absent and let the
        // failed resolution throw at runtime, where it is caught here and the Falcon
        // shim is simply left out of the default stack.
        //
        // The specifier must be a plain string literal: a non-literal specifier is
        // rewritten by TypeScript's `rewriteRelativeImportExtensions` into
        // `import(__rewriteRelativeImportExtension(specifier))`, whose computed
        // argument Metro rejects ("Invalid call") and refuses to bundle.
        // @ts-ignore -- `@joe-p/react-native-falcon` is an optional runtime peer that
        // this package deliberately does not depend on, so it may be absent at compile time.
        const mod = (await import("@joe-p/react-native-falcon"));
        if (!mod?.FalconModule)
            return undefined;
        return createFalconBinding(mod.FalconModule);
    }
    catch {
        return undefined;
    }
}
