/** One Falcon-1024 account of a seed. `publicKey` is base64. */
export interface AlgorandSeedVaultAccount {
  index: number;
  address: string;
  publicKey: string;
  isAutosign: boolean;
  requiresApproval: boolean;
  supportsKeyDerivation: boolean;
}
export interface AlgorandSeedVaultSeed {
  id: number;
  name: string;
  accounts: AlgorandSeedVaultAccount[];
}
export interface AlgorandSeedVaultConstants {
  PACKAGE: string;
  DERIVE_DOMAIN_PREFIX: string;
  DERIVE_MIN_LENGTH: number;
  DERIVE_MAX_LENGTH: number;
  MAX_BATCH_TRANSACTIONS: number;
}
/** Native surface; binary values are base64 strings. */
export interface NativeAlgorandSeedVaultModule extends AlgorandSeedVaultConstants {
  isInstalled(): boolean;
  isConnected(): boolean;
  bind(): Promise<boolean>;
  unbind(): void;
  getAuthorizedSeeds(): Promise<AlgorandSeedVaultSeed[]>;
  signBytes(address: string, data: string): Promise<string | null>;
  signTransaction(address: string, transaction: string): Promise<string | null>;
  deriveKeyMaterial(
    address: string,
    domain: string,
    info: string,
    length: number,
  ): Promise<string | null>;
  authorizeApp(): Promise<boolean>;
  confirmSignBytes(address: string, data: string): Promise<boolean>;
  confirmSignTransaction(address: string, transaction: string): Promise<boolean>;
  confirmSignTransactions(address: string, transactions: string[]): Promise<boolean>;
  confirmDeriveKeyMaterial(
    address: string,
    domain: string,
    info: string,
    length: number,
  ): Promise<boolean>;
}
/** One account of a Solana Mobile Seed Vault seed. `address` is the base58 Ed25519 public key. */
export interface SolanaSeedVaultAccount {
  id: number;
  address: string;
  name: string | null;
  derivationPath: string;
}
export interface SolanaSeedVaultSeed {
  authToken: number;
  name: string;
  accounts: SolanaSeedVaultAccount[];
}
/** Native surface of the Solana Seed Vault module; binary values are base64 strings. */
export interface NativeSolanaSeedVaultModule {
  PERMISSION: string;
  PURPOSE_SIGN_SOLANA_TRANSACTION: number;
  isInstalled(): boolean;
  hasUnauthorizedSeeds(): boolean;
  getAuthorizedSeeds(): Promise<SolanaSeedVaultSeed[]>;
  authorizeSeed(): Promise<number>;
  signMessage(address: string, message: string): Promise<string | null>;
  signTransaction(address: string, transaction: string): Promise<string | null>;
}
//# sourceMappingURL=types.d.ts.map
