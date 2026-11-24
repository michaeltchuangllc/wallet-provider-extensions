import Hook from "before-after-hook";
import { applyMigrations } from "./apply.js";
import { MissingLedgerError } from "./errors.js";
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
export const WithMigrations = (provider, options) => {
    const ledger = options?.migrations?.ledger;
    if (!ledger) {
        throw new MissingLedgerError();
    }
    const hooks = options.migrations.hooks ?? new Hook.Collection();
    const autoRun = options.migrations.autoRun ?? true;
    const registry = [];
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    // An application is free never to await `ready`. Without this the rejection
    // would surface as an unhandled promise rejection; callers still see it.
    ready.catch(() => {
        /* surfaced through `ready` / `run()` to whoever awaits them */
    });
    let started = false;
    const run = () => {
        if (!started) {
            started = true;
            applyMigrations({
                registry,
                ledger,
                hooks,
                // Resolved here, not at construction time: this extension runs first,
                // so a log extension applied after it does not exist yet above.
                log: provider?.log,
            }).then(resolveReady, rejectReady);
        }
        return ready;
    };
    if (autoRun) {
        // A microtask cannot run until the synchronous `EXTENSIONS.forEach` loop in
        // the Provider constructor has finished, so every module is registered by
        // the time the first revision executes.
        void Promise.resolve().then(() => {
            void run();
        });
    }
    const api = {
        register(module) {
            registry.push(module);
        },
        get ready() {
            return ready;
        },
        run,
        hooks,
    };
    return { migrations: api };
};
