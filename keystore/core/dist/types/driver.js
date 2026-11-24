/**
 * The storage-driver contract that a platform backend implements so the shared
 * {@link import("../create.ts").createKeyStore} orchestrator can persist and
 * retrieve key material without knowing anything about *how* a given platform
 * stores it.
 *
 * A driver is a **material custodian**: it owns encrypted-at-rest persistence of
 * secret material plus the platform-specific unlock flow, and it stores the
 * UI-safe metadata for each key. The orchestrator stays crypto-only — it never
 * touches storage directly, only this contract.
 *
 * @remarks
 * The two axes along which real backends genuinely diverge are captured
 * first-class here so they can evolve without forking the contract:
 *
 * - {@link DriverCapabilities.nativeCryptoKey} — whether the backend can hold a
 *   non-extractable {@link CryptoKey} natively (IndexedDB can structured-clone
 *   one; a Keychain/MMKV byte store cannot and must serialize to sealed bytes).
 * - The generic **context** `Ctx` threaded through every material-touching
 *   method. It is opaque to the orchestrator; an interactive backend (React
 *   Native biometrics) types it as its own auth-prompt/cancellation options,
 *   while a non-interactive backend (IndexedDB) ignores it. This mirrors the
 *   "rely on a general type in core, bind differently per platform" rule the
 *   crypto shims already follow.
 */
export {};
