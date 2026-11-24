import type { AuthenticationOptions } from "../types.ts";
/**
 * Reads the existing master key from the Keychain.
 *
 * This never creates a replacement key. A falsey Keychain result can mean
 * either "missing" or "failed to read"; callers must decide whether creation
 * is safe for their current storage state.
 *
 * @returns The master key as a Buffer
 */
export declare function readMasterKey(options?: AuthenticationOptions): Promise<Buffer>;
/**
 * Creates and stores a new master key.
 *
 * Only call this from explicit initialization paths where there are no
 * encrypted keystore records that depend on a previous master key.
 *
 * @returns The newly created master key as a Buffer
 */
export declare function createMasterKey(options?: AuthenticationOptions): Promise<Buffer>;
/**
 * Seals `data` at rest using the host {@link SubtleCrypto} AES-256-GCM, the
 * same sealing scheme used by the web and node engines. A fresh 96-bit IV is
 * drawn for every call.
 *
 * @param subtle - The host Subtle implementation (`react-native-quick-crypto`'s
 *   `subtle` in production; Node's `globalThis.crypto.subtle` in tests).
 * @param key - The AES-256 master key bytes.
 * @param data - The plaintext string to seal.
 * @returns A JSON string containing the base64 IV and base64 ciphertext (the
 *   GCM authentication tag is appended to the ciphertext by Subtle).
 */
export declare function sealData(subtle: SubtleCrypto, key: Buffer | Uint8Array, data: string): Promise<string>;
/**
 * Opens a payload produced by {@link sealData} using the host
 * {@link SubtleCrypto} AES-256-GCM.
 *
 * @param subtle - The host Subtle implementation (`react-native-quick-crypto`'s
 *   `subtle` in production; Node's `globalThis.crypto.subtle` in tests).
 * @param key - The AES-256 master key bytes.
 * @param payload - The JSON string produced by {@link sealData}.
 * @returns The decrypted plaintext string.
 */
export declare function openData(subtle: SubtleCrypto, key: Buffer | Uint8Array, payload: string): Promise<string>;
