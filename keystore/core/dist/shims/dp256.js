import { InvalidKeyDataError, InvalidKeyFormatError, MaterialAccessError } from "../errors.js";
import { algorithmName, consumeMaterial, consumeParamMaterial, createKeyHandle, extendSubtle, isShimKey, paramMaterial, toArrayBuffer, toBytes, } from "./shim.js";
/** Algorithm identifier used to route operations to the deterministic-P256 decorator. */
export const DP256_ALGORITHM = "Deterministic-P256";
/**
 * Default salt for the PBKDF2-HMAC-SHA512 derived-main-key step, matching the
 * canonical Liquid Auth / `@algorandfoundation/dp256` contract. Passkeys are
 * only reproducible across devices and native signers when every party uses the
 * same salt, so this default must not drift.
 */
export const DP256_DEFAULT_SALT = new TextEncoder().encode("liquid");
/** Default PBKDF2 iteration count for the derived-main-key step. */
export const DP256_DEFAULT_ITERATIONS = 210_000;
/** Default derived-main-key length, in bytes (512 bits). */
export const DP256_DEFAULT_KEY_LENGTH_BYTES = 64;
/**
 * Derives the main key through a host {@link SubtleCrypto}'s built-in PBKDF2
 * (`importKey("raw", entropy, "PBKDF2")` + `deriveBits({ name: "PBKDF2",
 * hash: "SHA-512" })`).
 *
 * This is the same PBKDF2-HMAC-SHA512 contract as
 * {@link DP256Binding.genDerivedMainKey} — WebCrypto's PBKDF2 is fully
 * parameterised by hash, salt and iteration count, so the output is
 * byte-identical to the bundled `@algorandfoundation/dp256` implementation. The
 * difference is *where* it runs: every real host Subtle (Node's
 * `crypto.subtle`, browsers, `react-native-quick-crypto`) implements PBKDF2
 * natively, while the bundled binding runs it in pure JS (`@noble/hashes`) —
 * at the default 210,000 iterations that can block a slower JS runtime (React
 * Native's Hermes) for minutes.
 *
 * @param subtle - A Subtle implementation with PBKDF2 + SHA-512 support.
 * @param entropy - The entropy source (e.g. BIP39 entropy bytes).
 * @param salt - PBKDF2 salt (see {@link DP256_DEFAULT_SALT}).
 * @param iterationCount - PBKDF2 iterations (see {@link DP256_DEFAULT_ITERATIONS}).
 * @param keyLengthBytes - Derived key length in bytes (see {@link DP256_DEFAULT_KEY_LENGTH_BYTES}).
 * @returns The derived main key.
 * @throws When `subtle` does not implement PBKDF2 with SHA-512 (WebCrypto
 *   leaves per-algorithm support implementation-defined).
 */
export async function genDerivedMainKeyWithSubtle(subtle, entropy, salt, iterationCount, keyLengthBytes) {
    // `toArrayBuffer` copies, so the caller's entropy view stays untouched (and
    // remains the caller's to wipe); our copy is zeroed as soon as the
    // non-extractable base key has been imported.
    const entropyCopy = toArrayBuffer(entropy);
    try {
        const baseKey = await subtle.importKey("raw", entropyCopy, "PBKDF2", false, ["deriveBits"]);
        const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-512", salt: toArrayBuffer(salt), iterations: iterationCount }, baseKey, keyLengthBytes * 8);
        return new Uint8Array(bits);
    }
    finally {
        new Uint8Array(entropyCopy).fill(0);
    }
}
/**
 * Returns a copy of `dp256` whose {@link DP256Binding.genDerivedMainKey} runs
 * through the host Subtle's native PBKDF2
 * ({@link genDerivedMainKeyWithSubtle}), falling back to the binding's own
 * implementation when the host does not support PBKDF2 with SHA-512.
 *
 * All other operations (domain-key derivation, signing, public-key extraction)
 * are single SHA-512/ECDSA steps and pass through unchanged — only the
 * 210,000-iteration main-key derivation is worth routing to the host.
 *
 * @param host - The Subtle implementation whose PBKDF2 to prefer.
 * @param dp256 - The binding to decorate (also the derivation fallback).
 * @returns A {@link DP256Binding} with the host-preferring main-key derivation.
 */
export function withSubtleDerivedMainKey(host, dp256) {
    return {
        ...dp256,
        genDerivedMainKey: async (entropy, salt, iterationCount, keyLengthBytes) => {
            try {
                return await genDerivedMainKeyWithSubtle(host, entropy, salt, iterationCount, keyLengthBytes);
            }
            catch {
                // WebCrypto leaves per-algorithm support implementation-defined, so a
                // host without PBKDF2/SHA-512 throws on importKey/deriveBits; the
                // binding's own (pure JS) derivation is the universal fallback.
                return dp256.genDerivedMainKey(entropy, salt, iterationCount, keyLengthBytes);
            }
        },
    };
}
function originOf(algo) {
    const origin = typeof algo === "string" ? undefined : algo.origin;
    if (typeof origin !== "string") {
        throw new InvalidKeyFormatError("Deterministic-P256 operations require an origin");
    }
    return origin;
}
function userHandleOf(algo) {
    const userHandle = typeof algo === "string" ? undefined : algo.userHandle;
    if (typeof userHandle !== "string") {
        throw new InvalidKeyFormatError("Deterministic-P256 operations require a userHandle");
    }
    return userHandle;
}
function counterOf(algo) {
    const counter = typeof algo === "string" ? undefined : algo.counter;
    return counter ?? 0;
}
/**
 * Prepends the `0x04` uncompressed-point marker to a 64-byte `X ‖ Y` public key
 * so it can be imported via WebCrypto's `"raw"` EC key format, which expects the
 * full uncompressed point. Bytes already carrying the prefix pass through.
 */
function toUncompressedPoint(publicKey) {
    if (publicKey.length === 65 && publicKey[0] === 0x04)
        return publicKey;
    if (publicKey.length !== 64) {
        throw new InvalidKeyFormatError(`Deterministic-P256 public key must be 64 (X‖Y) or 65 (0x04‖X‖Y) bytes, got ${publicKey.length}`);
    }
    const point = new Uint8Array(65);
    point[0] = 0x04;
    point.set(publicKey, 1);
    return point;
}
/**
 * Extends a host {@link SubtleCrypto} with deterministic-P256 (passkey) key
 * support, delegating every other algorithm to the host untouched.
 *
 * Deterministic-P256 is a two-level derivation, mirroring the XHD shim's shape:
 * a **derived main key** (`generateKey`, PBKDF2-HMAC-SHA512 over entropy) is the
 * parent, and **domain-specific keys** are derived from it along a
 * `{ origin, userHandle, counter }` descriptor (the analogue of a BIP44 path).
 * The child is an ordinary P-256 key, so `verify` uses the host's native ECDSA
 * once the public point is imported.
 *
 * `generateKey` mints the derived main key and returns a handle that
 * *transiently* carries it, so the calling storage engine can consume it once
 * (via `consumeKeyMaterial`) and persist it encrypted at rest. `deriveKey`
 * mints a material-free metadata handle recording only the domain descriptor: a
 * derived key is treated like an ordinary key whose main key is fetched and the
 * child re-derived at `sign` time. For `sign`/`deriveBits` the main key is
 * injected just-in-time via the `mainKey` parameter and wiped when the operation
 * completes, and `verify` reads only the (non-secret) `publicKey` parameter, so
 * decrypted material lives only inside the operation call frame.
 * `importKey`/`exportKey` throw {@link MaterialAccessError} — material never
 * moves *through* the public surface after birth.
 *
 * @param host - The Subtle implementation to extend (e.g. `crypto.subtle`). Its
 *   native ECDSA-P256 support is used for `verify`.
 * @param dp256 - The deterministic-P256 primitive binding.
 * @returns A new `SubtleCrypto` that also understands `"Deterministic-P256"`.
 *
 * @example
 * ```typescript
 * const subtle = withSubtleDP256(crypto.subtle, dp256);
 *
 * // The storage engine births the main key, persists it, then records a passkey.
 * const main = await subtle.generateKey({ name: "Deterministic-P256", entropy }, false, ["sign"]);
 * const mainKey = consumeKeyMaterial(main, (m) => persist(m)); // encrypted at rest, then wiped
 *
 * const descriptor = { origin: "https://example.com", userHandle: "user-123" };
 * const passkey = await subtle.deriveKey(
 *   { name: "Deterministic-P256", ...descriptor },
 *   main,
 *   { name: "Deterministic-P256" },
 *   false,
 *   ["sign"],
 * );
 *
 * // Signing re-derives the domain key from the fetched main key.
 * const sig = await subtle.sign({ name: "Deterministic-P256", ...descriptor, mainKey }, passkey, message);
 * ```
 */
export function withSubtleDP256(host, dp256) {
    const generateKey = async (algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.generateKey(algo, extractable, keyUsages);
        }
        // Derive the main key from entropy via PBKDF2 so the deterministic
        // hierarchy is recoverable from a mnemonic. The fresh main key rides on the
        // returned handle (non-enumerable, symbol-keyed) purely so the calling
        // storage engine can read it once and persist it encrypted at rest.
        const params = typeof algo === "string" ? undefined : algo;
        const entropy = params?.entropy;
        if (!entropy) {
            throw new InvalidKeyDataError("Deterministic-P256 generateKey requires entropy");
        }
        const salt = params?.salt ? toBytes(params.salt) : DP256_DEFAULT_SALT;
        const iterationCount = params?.iterationCount ?? DP256_DEFAULT_ITERATIONS;
        const keyLengthBytes = params?.keyLengthBytes ?? DP256_DEFAULT_KEY_LENGTH_BYTES;
        // Derive the main key, then wipe the entropy: it is private material the
        // caller injected and must not linger in memory after birth.
        const mainKey = await consumeMaterial(toBytes(entropy), (e) => dp256.genDerivedMainKey(e, salt, iterationCount, keyLengthBytes));
        return createKeyHandle("private", { name: DP256_ALGORITHM }, extractable, keyUsages, mainKey);
    };
    const deriveKey = async (algo, baseKey, derivedKeyType, extractable, keyUsages) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.deriveKey(algo, baseKey, derivedKeyType, extractable, keyUsages);
        }
        // A derived key is pure metadata: it records the domain descriptor so the
        // storage engine can treat it like an ordinary key and re-derive the child
        // from the persisted main key at sign time. No material is produced here.
        const algorithm = {
            name: DP256_ALGORITHM,
            origin: originOf(algo),
            userHandle: userHandleOf(algo),
            counter: counterOf(algo),
        };
        const type = keyUsages.includes("sign") ? "private" : "public";
        return createKeyHandle(type, algorithm, extractable, keyUsages);
    };
    const importKey = async (format, keyData, algo, extractable, keyUsages) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.importKey(format, keyData, algo, extractable, keyUsages);
        }
        throw new MaterialAccessError("Deterministic-P256 key material is owned by a storage engine; importKey is not supported");
    };
    const exportKey = async (format, key) => {
        if (!isShimKey(key, DP256_ALGORITHM)) {
            return host.exportKey(format, key);
        }
        throw new MaterialAccessError("Deterministic-P256 key material never leaves the storage engine; exportKey is not supported");
    };
    const deriveBits = async (algo, baseKey, _length) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.deriveBits(algo, baseKey, _length);
        }
        const origin = originOf(algo);
        const userHandle = userHandleOf(algo);
        const counter = counterOf(algo);
        const isPrivate = typeof algo === "string" ? false : Boolean(algo.isPrivate);
        // The injected main key is wiped as soon as the domain key is derived.
        return consumeParamMaterial(algo, "mainKey", async (mainKey) => {
            const scalar = await dp256.genDomainSpecificKeyPair(mainKey, origin, userHandle, counter);
            try {
                // By default expose the (non-secret) public key; the private scalar is
                // only returned when explicitly requested (into a storage engine).
                return toArrayBuffer(isPrivate ? scalar : dp256.getPurePKBytes(scalar));
            }
            finally {
                scalar.fill(0);
            }
        });
    };
    const sign = async (algo, key, data) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.sign(algo, key, data);
        }
        const origin = originOf(algo);
        const userHandle = userHandleOf(algo);
        const counter = counterOf(algo);
        // ES256 signs the SHA-256 digest of the message, not the raw bytes. The
        // binding's signer treats its payload as the digest directly (it does not
        // prehash), so we hash here to keep `sign`/`verify` symmetric and to emit a
        // standard ES256 signature the host's ECDSA `verify` (and any relying party)
        // accepts. The message is not secret, so it is hashed outside the unlock.
        const digest = new Uint8Array(await host.digest("SHA-256", toArrayBuffer(toBytes(data))));
        // The injected main key is wiped as soon as signing completes.
        const signature = await consumeParamMaterial(algo, "mainKey", async (mainKey) => {
            const scalar = await dp256.genDomainSpecificKeyPair(mainKey, origin, userHandle, counter);
            try {
                return dp256.signWithDomainSpecificKeyPair(scalar, digest);
            }
            finally {
                // The re-derived domain private scalar is secret too; wipe it as soon
                // as the signature has been produced.
                scalar.fill(0);
            }
        });
        return toArrayBuffer(signature);
    };
    const verify = async (algo, key, signature, data) => {
        if (algorithmName(algo) !== DP256_ALGORITHM) {
            return host.verify(algo, key, signature, data);
        }
        // The derived key is an ordinary P-256 key, so verification uses the host's
        // native ECDSA once the public point has been imported. It needs only the
        // (non-secret) public key, so no storage-engine unlock is required.
        const point = toUncompressedPoint(paramMaterial(algo, "publicKey"));
        const publicKey = await host.importKey("raw", toArrayBuffer(point), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        return host.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, toArrayBuffer(toBytes(signature)), toArrayBuffer(toBytes(data)));
    };
    return extendSubtle(host, {
        generateKey,
        deriveKey,
        importKey,
        exportKey,
        deriveBits,
        sign,
        verify,
    });
}
