import { base64 } from "@scure/base";
import { requireOptionalNativeModule } from "expo-modules-core";
const native = requireOptionalNativeModule("ReactNativeSolanaSeedVault");
function requireNative() {
  if (native === null) {
    throw new Error(
      "Solana Seed Vault is only available on Android builds that include this module",
    );
  }
  return native;
}
/** Whether the native module is linked (Android only). */
export function isSupported() {
  return native !== null;
}
/** Whether the Solana Mobile Seed Vault app is installed on the device. */
export function isInstalled() {
  return native?.isInstalled() ?? false;
}
/** Android permission the app must be granted before reading seeds. */
export function getPermission() {
  return requireNative().PERMISSION;
}
/** Whether the vault holds seeds this app has not yet been authorized to use. */
export function hasUnauthorizedSeeds() {
  return native?.hasUnauthorizedSeeds() ?? false;
}
/** Authorized seeds and their user-wallet accounts. Rejects without the ACCESS_SEED_VAULT permission. */
export function getAuthorizedSeeds() {
  return requireNative().getAuthorizedSeeds();
}
/** Opens the Seed Vault to authorize a seed; resolves its auth token. */
export function authorizeSeed() {
  return requireNative().authorizeSeed();
}
/** Signs a raw message with the account's Ed25519 key; resolves a 64-byte signature, or null if rejected. */
export async function signMessage(address, message) {
  const signature = await requireNative().signMessage(address, base64.encode(message));
  return signature === null ? null : base64.decode(signature);
}
/** Signs a serialized Solana transaction message; resolves a 64-byte signature, or null if rejected. */
export async function signTransaction(address, transaction) {
  const signature = await requireNative().signTransaction(address, base64.encode(transaction));
  return signature === null ? null : base64.decode(signature);
}
//# sourceMappingURL=solana.js.map
