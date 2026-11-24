/**
 * Per-operation authentication prompt resolution.
 *
 * Every material-touching keystore call needs *some* wording for the platform
 * unlock dialog, but a host app rarely wants to pass one at every call site.
 * This module owns the single precedence chain used to pick that wording, so
 * the engine (which tags calls with their {@link AuthenticationOperation}) and
 * the Keychain helpers in `storage/crypto.ts` always agree.
 */
import type { Key, KeyId } from "@algorandfoundation/keystore-core";
import type { AuthenticationOperation, AuthenticationOptions, AuthenticationPrompt } from "./types.ts";
/**
 * Normalizes the `string | AuthenticationPrompt` shorthand: a bare string
 * becomes `{ title }`.
 *
 * @param prompt - The configured prompt, if any.
 * @returns The prompt object to hand to `react-native-keychain`, falling back
 *   to a neutral title when nothing was configured.
 */
export declare function toAuthenticationPrompt(prompt: string | AuthenticationPrompt | undefined): AuthenticationPrompt;
/**
 * Resolves the prompt shown for one operation.
 *
 * Precedence, highest first:
 *  1. `context.prompt` — a prompt passed for *this* call; the caller asked for
 *     exactly this wording, so nothing may override it.
 *  2. `resolvePrompt(target)` — the host's formatter, which can name the key
 *     ("Sign with your Algorand account"). Returning `undefined` falls through.
 *  3. `prompts[operation]` — the host's per-operation map.
 *  4. `defaults.prompt` — the app-wide catch-all.
 *  5. A short built-in sentence for `operation`.
 *
 * The per-call `context` and the app-wide `defaults` are taken separately on
 * purpose: once they are merged, a caller-supplied `prompt` is
 * indistinguishable from the app-wide one, and steps 1 and 4 would collapse.
 *
 * @param context - The per-call authentication context, if the caller passed one.
 * @param defaults - The app-wide authentication policy from the engine options.
 * @param target - What is being unlocked: the operation, and the key it targets
 *   when there is one. `key` carries metadata only — never decrypt anything to
 *   build a prompt.
 * @returns The prompt object to pass to the Keychain call.
 */
export declare function resolveAuthenticationPrompt(context: AuthenticationOptions | undefined, defaults: AuthenticationOptions | undefined, target: {
    operation?: AuthenticationOperation;
    keyId?: KeyId;
    key?: Key;
}): AuthenticationPrompt;
