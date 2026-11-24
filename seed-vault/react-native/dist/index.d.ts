import type { AlgorandSeedVaultConstants, AlgorandSeedVaultSeed } from "./types.ts";
export type {
  AlgorandSeedVaultAccount,
  AlgorandSeedVaultConstants,
  AlgorandSeedVaultSeed,
} from "./types.ts";
/** Whether the native module is linked (Android only). */
export declare function isSupported(): boolean;
export declare function getConstants(): AlgorandSeedVaultConstants;
/** Whether the Algorand Seed Vault Service app is installed on the device. */
export declare function isInstalled(): boolean;
export declare function isConnected(): boolean;
/** Binds to the service; resolves its readiness. Rejects without the ACCESS_SEED_VAULT permission. */
export declare function bind(): Promise<boolean>;
export declare function unbind(): void;
/** Seeds the user has authorized this app to use. Requires {@link bind}. */
export declare function getAuthorizedSeeds(): Promise<AlgorandSeedVaultSeed[]>;
/** Opens the Algorand Seed Vault authorization screen; resolves true when the user approved. */
export declare function authorizeApp(): Promise<boolean>;
/** Opens the approval screen; call {@link signBytes} with the same values after it resolves true. */
export declare function confirmSignBytes(address: string, data: Uint8Array): Promise<boolean>;
export declare function signBytes(address: string, data: Uint8Array): Promise<Uint8Array | null>;
export declare function confirmSignTransaction(
  address: string,
  transaction: Uint8Array,
): Promise<boolean>;
/** Signs an unsigned msgpack Algorand transaction whose sender is `address`. */
export declare function signTransaction(
  address: string,
  transaction: Uint8Array,
): Promise<Uint8Array | null>;
/** One approval for a group; then call {@link signTransaction} for each within a minute. */
export declare function confirmSignTransactions(
  address: string,
  transactions: Uint8Array[],
): Promise<boolean>;
export declare function confirmDeriveKeyMaterial(
  address: string,
  domain: string,
  info: Uint8Array,
  length?: number,
): Promise<boolean>;
/** `domain` must start with `DERIVE_DOMAIN_PREFIX`. Needs a prior {@link confirmDeriveKeyMaterial}. */
export declare function deriveKeyMaterial(
  address: string,
  domain: string,
  info: Uint8Array,
  length?: number,
): Promise<Uint8Array | null>;
/** Solana Mobile Seed Vault (Ed25519 accounts); separate from the Algorand Seed Vault above. */
export * as solana from "./solana.ts";
//# sourceMappingURL=index.d.ts.map
