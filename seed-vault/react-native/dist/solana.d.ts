import type { SolanaSeedVaultSeed } from "./types.ts";
export type { SolanaSeedVaultAccount, SolanaSeedVaultSeed } from "./types.ts";
/** Whether the native module is linked (Android only). */
export declare function isSupported(): boolean;
/** Whether the Solana Mobile Seed Vault app is installed on the device. */
export declare function isInstalled(): boolean;
/** Android permission the app must be granted before reading seeds. */
export declare function getPermission(): string;
/** Whether the vault holds seeds this app has not yet been authorized to use. */
export declare function hasUnauthorizedSeeds(): boolean;
/** Authorized seeds and their user-wallet accounts. Rejects without the ACCESS_SEED_VAULT permission. */
export declare function getAuthorizedSeeds(): Promise<SolanaSeedVaultSeed[]>;
/** Opens the Seed Vault to authorize a seed; resolves its auth token. */
export declare function authorizeSeed(): Promise<number>;
/** Signs a raw message with the account's Ed25519 key; resolves a 64-byte signature, or null if rejected. */
export declare function signMessage(
  address: string,
  message: Uint8Array,
): Promise<Uint8Array | null>;
/** Signs a serialized Solana transaction message; resolves a 64-byte signature, or null if rejected. */
export declare function signTransaction(
  address: string,
  transaction: Uint8Array,
): Promise<Uint8Array | null>;
//# sourceMappingURL=solana.d.ts.map
