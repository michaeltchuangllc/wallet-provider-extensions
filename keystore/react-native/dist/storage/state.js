import { InvalidKeyDataError, } from "@algorandfoundation/keystore-core";
import { clearBuffer } from "@algorandfoundation/wallet-provider";
import { base64, base64url } from "@scure/base";
import { createMMKV } from "react-native-mmkv";
import { MasterKeyNotFoundError } from "../errors.js";
import { createMasterKey, openData, readMasterKey, sealData } from "./crypto.js";
export const storage = createMMKV({
    id: "keystore",
    mode: "multi-process",
});
/**
 * Sets the reactive store status.
 */
function setStatus({ store, status }) {
    store.setState((state) => ({ ...state, status }));
}
/**
 * Zeroes and removes the private key material from a {@link KeyData} object.
 */
function clearKeyData(key) {
    if (key && key.privateKey instanceof Uint8Array) {
        clearBuffer(key.privateKey);
        delete key.privateKey;
    }
}
async function readOrCreateMasterKeyForEmptyStorage(options) {
    try {
        return await readMasterKey(options);
    }
    catch (error) {
        if (!(error instanceof MasterKeyNotFoundError))
            throw error;
        if (storage.getAllKeys().length > 0)
            throw error;
        return createMasterKey(options);
    }
}
/**
 * Fetches a secret from persistent storage and decrypts it using the master key.
 * @param params - The fetch parameters.
 * @param params.keyId - The ID of the key to fetch
 * @param params.options - Options to override the biometrics and masterkey
 * @returns The decrypted secret data or null if not found
 */
export async function fetchSecret({ keyId, options, }) {
    let key = options?.masterKey;
    let isInternalKey = false;
    try {
        const encryptedData = storage.getString(keyId);
        if (!encryptedData)
            return null;
        if (!key) {
            key = await readMasterKey(options);
            isInternalKey = true;
        }
        return decode(await openData(globalThis.crypto.subtle, key, encryptedData));
    }
    finally {
        if (isInternalKey && key) {
            clearBuffer(key);
        }
    }
}
/**
 * Removes a secret from persistent storage.
 * @param params - The removal parameters.
 * @param params.keyId - The ID of the key to remove
 */
export async function removeSecret({ keyId }) {
    storage.remove(keyId);
}
/**
 * Commits a key to persistent storage and updates the reactive store.
 * The private key is encrypted before storage and cleared from memory.
 * @param params - The commit parameters.
 * @param params.store - The reactive store instance
 * @param params.keyData - The key data to store
 */
export async function commit({ store, keyData, options, }) {
    if (typeof keyData.id === "undefined")
        throw new InvalidKeyDataError("KeyData must have an ID before committing to storage. Please use generateKey() to generate a new key.");
    setStatus({ store, status: "commiting" });
    try {
        // Never allow the master key to touch memory.
        storage.set(keyData.id, await sealData(globalThis.crypto.subtle, await readOrCreateMasterKeyForEmptyStorage(options), encode(keyData)));
        // remove the private keys from keyData
        const { privateKey, seed, ...keyState } = keyData;
        // clear then delete the keys from the keyData object to remove it from memory, even from the caller 😈
        clearBuffer(privateKey);
        clearBuffer(seed);
        delete keyData.privateKey;
        delete keyData.seed;
        // Reflect the change in the reactive store
        store.setState((state) => ({
            ...state,
            keys: [{ ...keyState }, ...state.keys],
        }));
    }
    finally {
        clearKeyData(keyData);
        setStatus({ store, status: "idle" });
    }
}
/**
 * Serializes {@link KeyData} to a string, wrapping every `Uint8Array` field as
 * `{ $u8: base64 }`. This is the same codec the Keychain driver uses for
 * metadata, so all React Native persistence shares one serialization scheme.
 */
export function encode(key) {
    return JSON.stringify(key, (_key, value) => {
        if (value instanceof Uint8Array ||
            (value?.constructor && value.constructor.name === "Uint8Array")) {
            return { $u8: base64.encode(value) };
        }
        return value;
    });
}
/**
 * Reverses {@link encode}, restoring `Uint8Array` fields.
 *
 * For a non-destructive migration it transparently reads **both** formats: the
 * new `{ $u8: base64 }` JSON payload and the legacy `base64url`-of-JSON payload
 * (whose byte fields were plain number arrays). Records written by the old
 * scheme therefore still decrypt and are re-sealed in the new format on their
 * next write.
 */
export function decode(data) {
    // New format: JSON whose byte fields are `{ $u8: base64 }` wrappers.
    if (data.startsWith("{")) {
        return JSON.parse(data, (_key, value) => {
            if (value && typeof value === "object" && typeof value.$u8 === "string") {
                return base64.decode(value.$u8);
            }
            return value;
        });
    }
    // Legacy format (pre-unification): `base64url(utf8(JSON))` with byte fields
    // stored as number arrays, reconstructed by key name.
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(base64url.decode(data)), (key, value) => {
        if ((key.endsWith("Key") ||
            key === "privateKey" ||
            key === "publicKey" ||
            key === "seed" ||
            key === "key") &&
            Array.isArray(value)) {
            return new Uint8Array(value);
        }
        return value;
    });
}
