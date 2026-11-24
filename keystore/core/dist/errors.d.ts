/**
 * Base error class for keystore operations.
 */
export declare class KeyStoreError extends Error {
    constructor(message: string, name: string, cause?: Error);
}
/**
 * Error thrown when a requested key cannot be found in the keystore.
 */
export declare class KeyNotFoundError extends KeyStoreError {
    /**
     * @param keyId - The ID of the key that was not found.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(keyId: string, cause?: Error);
}
/**
 * Error thrown when an attempt is made to generate a key with an unsupported algorithm.
 */
export declare class KeyGenerationNotSupportedError extends KeyStoreError {
    /**
     * @param algorithm - The name of the unsupported algorithm.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(algorithm: string, cause?: Error);
}
/**
 * Error thrown when key data is provided in an invalid or unsupported format.
 */
export declare class InvalidKeyFormatError extends KeyStoreError {
    /**
     * @param format - The name of the invalid format.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(format: string, cause?: Error);
}
/**
 * Error thrown when an attempt is made to import or generate a key with an ID that already exists.
 */
export declare class DuplicateKeyIdError extends KeyStoreError {
    /**
     * @param keyId - The duplicate key ID.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(keyId: string, cause?: Error);
}
/**
 * Error thrown when raw key material is requested from, or supplied to, the
 * public Subtle surface directly.
 *
 * The composable shims never own key material: `sign`/`deriveBits` receive it
 * just-in-time through their algorithm parameters, and `importKey`/`exportKey`
 * are delegated to a platform storage engine that owns encrypted-at-rest
 * material. Any attempt to move material across the public `SubtleCrypto`
 * surface therefore throws this error.
 */
export declare class MaterialAccessError extends KeyStoreError {
    /**
     * @param reason - A description of why material access was refused.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(reason: string, cause?: Error);
}
/**
 * Error thrown when provided key data is malformed or invalid for the operation.
 */
export declare class InvalidKeyDataError extends KeyStoreError {
    /**
     * @param reason - A description of why the key data is invalid.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(reason: string, cause?: Error);
}
