// Like the other platform packages (`keystore-node`, `keystore-web`), re-export
// the platform-neutral core (types, errors, shims, `createKeyStore`, constants)
// so a React Native app has a single import surface and never needs the
// `@algorandfoundation/keystore` meta package — whose dependency tree drags the
// wasm-backed web build into React Native installs.
export * from "@algorandfoundation/keystore-core";
export * from "./engine.js";
export * from "./errors.js";
export * from "./falcon.js";
// Both core and `./falcon.ts` export a `createFalconBinding`; ambiguous star
// exports are silently dropped, so pick the native-module one explicitly.
export { createFalconBinding } from "./falcon.js";
export * from "./extension.js";
export * from "./prompts.js";
export * from "./storage/index.js";
export * from "./types.js";
