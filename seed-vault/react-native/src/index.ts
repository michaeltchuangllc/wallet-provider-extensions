import { base64 } from "@scure/base";
import { requireOptionalNativeModule } from "expo-modules-core";
import type {
  NativeAlgorandSeedVaultModule,
  AlgorandSeedVaultConstants,
  AlgorandSeedVaultSeed,
} from "./types.ts";

export type {
  AlgorandSeedVaultAccount,
  AlgorandSeedVaultConstants,
  AlgorandSeedVaultSeed,
} from "./types.ts";

const native: NativeAlgorandSeedVaultModule | null =
  requireOptionalNativeModule<NativeAlgorandSeedVaultModule>("ReactNativeSeedVault");

const DEFAULT_CONSTANTS: AlgorandSeedVaultConstants = {
  PACKAGE: "com.michaeltchuang.seedvault.service",
  DERIVE_DOMAIN_PREFIX: "passkey/",
  DERIVE_MIN_LENGTH: 32,
  DERIVE_MAX_LENGTH: 64,
  MAX_BATCH_TRANSACTIONS: 16,
};

function requireNative(): NativeAlgorandSeedVaultModule {
  if (native === null) {
    throw new Error(
      "Algorand Seed Vault is only available on Android builds that include this module",
    );
  }
  return native;
}

function toBase64(bytes: Uint8Array): string {
  return base64.encode(bytes);
}

function fromBase64(value: string | null): Uint8Array | null {
  return value === null ? null : base64.decode(value);
}

/** Whether the native module is linked (Android only). */
export function isSupported(): boolean {
  return native !== null;
}

export function getConstants(): AlgorandSeedVaultConstants {
  return native === null
    ? DEFAULT_CONSTANTS
    : {
        PACKAGE: native.PACKAGE,
        DERIVE_DOMAIN_PREFIX: native.DERIVE_DOMAIN_PREFIX,
        DERIVE_MIN_LENGTH: native.DERIVE_MIN_LENGTH,
        DERIVE_MAX_LENGTH: native.DERIVE_MAX_LENGTH,
        MAX_BATCH_TRANSACTIONS: native.MAX_BATCH_TRANSACTIONS,
      };
}

/** Whether the Algorand Seed Vault Service app is installed on the device. */
export function isInstalled(): boolean {
  return native?.isInstalled() ?? false;
}

export function isConnected(): boolean {
  return native?.isConnected() ?? false;
}

/** Binds to the service; resolves its readiness. Rejects without the ACCESS_SEED_VAULT permission. */
export function bind(): Promise<boolean> {
  return requireNative().bind();
}

export function unbind(): void {
  native?.unbind();
}

/** Seeds the user has authorized this app to use. Requires {@link bind}. */
export function getAuthorizedSeeds(): Promise<AlgorandSeedVaultSeed[]> {
  return requireNative().getAuthorizedSeeds();
}

/** Opens the Algorand Seed Vault authorization screen; resolves true when the user approved. */
export function authorizeApp(): Promise<boolean> {
  return requireNative().authorizeApp();
}

/** Opens the approval screen; call {@link signBytes} with the same values after it resolves true. */
export function confirmSignBytes(address: string, data: Uint8Array): Promise<boolean> {
  return requireNative().confirmSignBytes(address, toBase64(data));
}

export async function signBytes(address: string, data: Uint8Array): Promise<Uint8Array | null> {
  return fromBase64(await requireNative().signBytes(address, toBase64(data)));
}

export function confirmSignTransaction(address: string, transaction: Uint8Array): Promise<boolean> {
  return requireNative().confirmSignTransaction(address, toBase64(transaction));
}

/** Signs an unsigned msgpack Algorand transaction whose sender is `address`. */
export async function signTransaction(
  address: string,
  transaction: Uint8Array,
): Promise<Uint8Array | null> {
  return fromBase64(await requireNative().signTransaction(address, toBase64(transaction)));
}

/** One approval for a group; then call {@link signTransaction} for each within a minute. */
export function confirmSignTransactions(
  address: string,
  transactions: Uint8Array[],
): Promise<boolean> {
  return requireNative().confirmSignTransactions(address, transactions.map(toBase64));
}

export function confirmDeriveKeyMaterial(
  address: string,
  domain: string,
  info: Uint8Array,
  length: number = getConstants().DERIVE_MAX_LENGTH,
): Promise<boolean> {
  return requireNative().confirmDeriveKeyMaterial(address, domain, toBase64(info), length);
}

/** `domain` must start with `DERIVE_DOMAIN_PREFIX`. Needs a prior {@link confirmDeriveKeyMaterial}. */
export async function deriveKeyMaterial(
  address: string,
  domain: string,
  info: Uint8Array,
  length: number = getConstants().DERIVE_MAX_LENGTH,
): Promise<Uint8Array | null> {
  return fromBase64(
    await requireNative().deriveKeyMaterial(address, domain, toBase64(info), length),
  );
}

/** Solana Mobile Seed Vault (Ed25519 accounts); separate from the Algorand Seed Vault above. */
export * as solana from "./solana.ts";
