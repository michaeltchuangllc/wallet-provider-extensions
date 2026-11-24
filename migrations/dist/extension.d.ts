import type { Extension } from "@algorandfoundation/wallet-provider";
import type { MigrationsExtension } from "./types.ts";
/**
 * Provider extension that discovers and applies pending data migrations.
 *
 * Place it **first** in the extensions array. It contributes
 * `provider.migrations`, which every later extension can register with using the
 * optional-dependency probe (`provider.migrations?.register(...)`). Because the
 * `Provider` constructor applies extensions synchronously and the run is
 * scheduled on a microtask, the registry is always complete before the first
 * revision executes.
 *
 * When this extension is absent, `provider.migrations` is `undefined` and every
 * `register` call is a no-op — that is the opt-in mechanism.
 *
 * @param provider - The provider being extended.
 * @param options - {@link MigrationsOptions}. `migrations.ledger` is required.
 * @returns The `migrations` API.
 * @throws {MissingLedgerError} When no ledger is configured.
 *
 * @example
 * ```typescript
 * const MyProvider = Provider.withExtensions([WithMigrations, WithKeyStore]);
 * const provider = new MyProvider(
 *   { id: "wallet", name: "Wallet" },
 *   { migrations: { ledger: keyValueLedger(kv) }, keystore: { store, hooks } },
 * );
 * await provider.migrations.ready;
 * ```
 */
export declare const WithMigrations: Extension<MigrationsExtension>;
