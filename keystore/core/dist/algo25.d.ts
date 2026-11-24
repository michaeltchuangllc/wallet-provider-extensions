/**
 * A small, self-contained Algo25 (Algorand 25-word mnemonic) implementation.
 *
 * Algo25 is a **reversible** encoding of a 32-byte seed: 24 words of 11 bits
 * each (the seed) plus a checksum word derived from `sha512_256(seed)[0..2]`.
 * Unlike BIP39 there is no PBKDF2 step — the mnemonic *is* the seed.
 *
 * @remarks
 * This is a deliberately minimal implementation so the keystore can enable the
 * `Algo25` shim out of the box (see {@link createAlgo25Binding}). It uses the
 * BIP39 English wordlist, matching the wallet example's demo helpers. It is
 * **not** a hardened, audited replacement for `algosdk.mnemonic` and is meant
 * to be swapped for a canonical package binding once one is available.
 */
import type { Algo25Binding } from "./shims/index.ts";
/**
 * Builds a small {@link Algo25Binding} backed by the BIP39 English wordlist.
 *
 * Intended as a sensible default so the `Algo25` shim works without the caller
 * supplying a binding. Replace it with a canonical (`algosdk`-compatible)
 * binding when one is packaged.
 *
 * @returns An {@link Algo25Binding}.
 */
export declare function createAlgo25Binding(): Algo25Binding;
