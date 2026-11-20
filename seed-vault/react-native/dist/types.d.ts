/** One Falcon-1024 account of a seed. `publicKey` is base64. */
export interface SeedVaultAccount {
  index: number;
  address: string;
  publicKey: string;
  isAutosign: boolean;
  requiresApproval: boolean;
  supportsKeyDerivation: boolean;
}
export interface SeedVaultSeed {
  id: number;
  name: string;
  accounts: SeedVaultAccount[];
}
export interface SeedVaultConstants {
  PACKAGE: string;
  DERIVE_DOMAIN_PREFIX: string;
  DERIVE_MIN_LENGTH: number;
  DERIVE_MAX_LENGTH: number;
  MAX_BATCH_TRANSACTIONS: number;
}
/** Native surface; binary values are base64 strings. */
export interface NativeSeedVaultModule extends SeedVaultConstants {
  isInstalled(): boolean;
  isConnected(): boolean;
  bind(): Promise<boolean>;
  unbind(): void;
  getAuthorizedSeeds(): Promise<SeedVaultSeed[]>;
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
//# sourceMappingURL=types.d.ts.map
