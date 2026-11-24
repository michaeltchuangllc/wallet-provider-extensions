/**
 * Decoding failed.
 */
export declare class DecodingError extends Error {
    constructor(message: string, cause?: Error);
}
export declare class EncodingError extends Error {
    constructor(message: string, cause?: Error);
}
export declare class UnlockingError extends Error {
    constructor(message: string, cause?: Error);
}
export declare class MasterKeyNotFoundError extends Error {
    constructor(message?: string, cause?: Error);
}
