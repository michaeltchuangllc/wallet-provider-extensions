import type { ApplyMigrationsOptions, Migration, MigrationReport } from "./types.ts";
/**
 * Validates a module's manifest: every revision id must be a positive integer,
 * unique, and strictly ascending.
 *
 * Exported so an adopting package can assert its own barrel in a unit test,
 * catching a duplicate id from a bad merge in CI rather than on a device. The
 * runner calls it for every module before executing anything.
 *
 * @param migrations - The module's revisions, in declaration order.
 * @param module - The module id, used in the error message.
 * @throws {InvalidMigrationsError} When the manifest is malformed.
 *
 * @example
 * ```typescript
 * it("has a valid manifest", () => {
 *   expect(() => validateMigrations(migrations, "@scope/pkg")).not.toThrow();
 * });
 * ```
 */
export declare function validateMigrations(migrations: readonly Migration<any>[], module?: string): void;
/**
 * Applies every pending revision across the registry.
 *
 * Modules run sequentially in registration order. For each module the ledger is
 * consulted, the manifest validated, and the context resolved **only** when
 * something is pending. Each revision runs with a fresh secret scratch that is
 * wiped once it settles, and the ledger is written immediately after each
 * success — never once at the end — so a killed run resumes exactly where it
 * stopped.
 *
 * A failing revision halts only its own module; the ledger keeps that module's
 * last successful revision and remaining modules still run. If anything failed,
 * the returned promise rejects with a {@link MigrationFailedError} carrying the
 * full report.
 *
 * @param options - {@link ApplyMigrationsOptions}.
 * @returns The {@link MigrationReport} for a fully successful run.
 * @throws {MigrationFailedError} When any module failed.
 *
 * @example
 * ```typescript
 * const report = await applyMigrations({ registry, ledger: memoryLedger() });
 * console.log(`${report.applied.length} revisions applied`);
 * ```
 */
export declare function applyMigrations(options: ApplyMigrationsOptions): Promise<MigrationReport>;
