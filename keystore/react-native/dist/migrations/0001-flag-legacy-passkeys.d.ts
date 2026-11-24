import type { Migration } from "@algorandfoundation/provider-migrations";
import type { KeystoreMigrationContext } from "../types.ts";
/**
 * Flags legacy passkeys — those derived from the XHD root before the
 * deterministic-P256 split — as needing migration.
 *
 * Previously this ran unconditionally on every engine start. As a tracked
 * revision it runs once, and the ledger records that it has.
 *
 * The scan is metadata-only (`k/` bucket): no material is decrypted and no
 * biometric prompt fires. It is idempotent — an already-flagged record and a
 * new-scheme passkey are both skipped — and a no-op on empty storage.
 */
export declare const migration: Migration<KeystoreMigrationContext>;
export default migration;
