import type { Migration } from "@algorandfoundation/provider-migrations";
import type { KeystoreMigrationContext } from "../types.ts";
/**
 * Every revision this package declares, ascending by id.
 *
 * Registered with the provider by {@link import("../extension.ts").WithKeyStore}
 * when a migrations extension is present.
 */
export declare const migrations: readonly Migration<KeystoreMigrationContext>[];
