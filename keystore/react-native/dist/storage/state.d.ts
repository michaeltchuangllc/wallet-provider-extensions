import { type KeyData, type KeyId, type KeyStoreState } from "@algorandfoundation/keystore-core";
import type { Store } from "@tanstack/store";
import { type MMKV } from "react-native-mmkv";
import type { AuthenticationOptions } from "../types.ts";
export declare const storage: MMKV;
/**
 * Fetches a secret from persistent storage and decrypts it using the master key.
 * @param params - The fetch parameters.
 * @param params.keyId - The ID of the key to fetch
 * @param params.options - Options to override the biometrics and masterkey
 * @returns The decrypted secret data or null if not found
 */
export declare function fetchSecret<T>({ keyId, options, }: {
    keyId: KeyId;
    options?: AuthenticationOptions & {
        masterKey?: Buffer;
    };
}): Promise<T | null>;
/**
 * Removes a secret from persistent storage.
 * @param params - The removal parameters.
 * @param params.keyId - The ID of the key to remove
 */
export declare function removeSecret({ keyId }: {
    keyId: KeyId;
}): Promise<void>;
/**
 * Commits a key to persistent storage and updates the reactive store.
 * The private key is encrypted before storage and cleared from memory.
 * @param params - The commit parameters.
 * @param params.store - The reactive store instance
 * @param params.keyData - The key data to store
 */
export declare function commit({ store, keyData, options, }: {
    store: Store<KeyStoreState>;
    keyData: KeyData;
    options?: AuthenticationOptions;
}): Promise<void>;
/**
 * Serializes {@link KeyData} to a string, wrapping every `Uint8Array` field as
 * `{ $u8: base64 }`. This is the same codec the Keychain driver uses for
 * metadata, so all React Native persistence shares one serialization scheme.
 */
export declare function encode(key: KeyData): string;
/**
 * Reverses {@link encode}, restoring `Uint8Array` fields.
 *
 * For a non-destructive migration it transparently reads **both** formats: the
 * new `{ $u8: base64 }` JSON payload and the legacy `base64url`-of-JSON payload
 * (whose byte fields were plain number arrays). Records written by the old
 * scheme therefore still decrypt and are re-sealed in the new format on their
 * next write.
 */
export declare function decode(data: string): KeyData;
