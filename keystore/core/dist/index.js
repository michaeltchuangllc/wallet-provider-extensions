/**
 * @module default
 * @packageDocumentation
 *
 * `@algorandfoundation/keystore-core` holds the platform-neutral surface of the
 * keystore: the type contracts, error classes, composable Subtle shims, the
 * shared `createKeyStore` orchestrator and the shared constants. The composable
 * shims stay binding-agnostic (core only depends on the binding *types*), but
 * the package also ships a batteries-included default set
 * ({@link createDefaultShims}) wired to the bundled primitive libraries so a
 * keystore understands every supported algorithm with zero configuration. The
 * platform packages (`@algorandfoundation/keystore-node`,
 * `@algorandfoundation/keystore-web`, `@algorandfoundation/react-native-keystore`)
 * depend on and re-export this package, adding only their persistence engine.
 *
 * Most consumers should import the meta package `@algorandfoundation/keystore`,
 * which resolves to the correct platform implementation via package export
 * conditions.
 */
export * from "./algo25.js";
export * from "./constants.js";
export * from "./create.js";
export * from "./defaults.js";
export * from "./errors.js";
export * from "./shims/index.js";
export * from "./types/index.js";
