import type { MigrationReport } from "./types.ts";
/**
 * Base class for every error raised by the migrations engine.
 */
export declare class MigrationError extends Error {
    /**
     * @param message - The human-readable message.
     * @param name - The concrete error name.
     * @param cause - The underlying error, if any.
     */
    constructor(message: string, name: string, cause?: Error);
}
/**
 * Thrown when `WithMigrations` is constructed without `options.migrations.ledger`.
 *
 * Defaulting silently to an in-memory ledger would make every migration re-run
 * on every launch, forever.
 */
export declare class MissingLedgerError extends MigrationError {
    constructor();
}
/**
 * Thrown when a module's manifest is malformed: non-positive, duplicate, or
 * out-of-order revision ids, or the same module registered twice.
 */
export declare class InvalidMigrationsError extends MigrationError {
    /**
     * @param module - The offending module id.
     * @param reason - What is wrong with the manifest.
     */
    constructor(module: string, reason: string);
}
/** Thrown when a secret scratch is used after the runner has wiped it. */
export declare class SecretScratchDisposedError extends MigrationError {
    constructor();
}
/** Thrown when reading a label that holds no secret. */
export declare class SecretNotFoundError extends MigrationError {
    /**
     * @param label - The label that was not found.
     */
    constructor(label: string);
}
/**
 * Aggregate thrown at the end of a run in which at least one module failed.
 * Carries the full {@link MigrationReport}, including whatever succeeded.
 */
export declare class MigrationFailedError extends MigrationError {
    /** The full report for the run, including successful revisions. */
    readonly report: MigrationReport;
    /**
     * @param report - The report for the completed run.
     */
    constructor(report: MigrationReport);
}
