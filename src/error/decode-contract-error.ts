import { MoonlightContractError } from "./contract-errors.ts";

/**
 * A soroban contract error decoded back to its catalog identity.
 *
 * `code` is the numeric code from `soroban-core/modules/errors/src/lib.rs`
 * (AUTH 1000–1099, UTXO 2000–2099, CHANNEL 3000–3099, HELPER 4000–4099);
 * `name`/`details` come from {@link MoonlightContractError}.
 */
export interface DecodedContractError {
  /** Numeric soroban error code, e.g. `1010`. */
  code: number;
  /** Catalog variant name, e.g. `"SignatureExpired"`. */
  name: string;
  /** Catalog human description of the variant. */
  details: string;
  /** Origin layer — always on-chain for a decoded contract error. */
  source: "onchain";
}

/** Duck-typed shape of Colibri's contract-error-matcher payload. */
interface MatchCarrier {
  meta?: { data?: { match?: { code?: unknown } } };
  message?: unknown;
  cause?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Reverse index: catalog variant name (e.g. "SignatureExpired") → code. */
const CODE_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(MoonlightContractError).map((
    [code, entry],
  ) => [entry.message, Number(code)]),
);

/**
 * Colibri renders a matched contract error as `Contract error: <Variant>`.
 * Recovering the code from that message is the fallback when the structured
 * `meta.data.match` payload is not present on the (possibly re-wrapped) error.
 */
function codeFromMessage(message: unknown): number | null {
  if (typeof message !== "string") return null;
  const m = message.match(/Contract error:\s*([A-Za-z0-9]+)/);
  if (!m) return null;
  const code = CODE_BY_NAME[m[1]];
  return typeof code === "number" ? code : null;
}

function decoded(code: number): DecodedContractError | null {
  const entry = MoonlightContractError[code];
  if (!entry) return null;
  return {
    code,
    name: entry.message,
    details: entry.details ?? "",
    source: "onchain",
  };
}

/**
 * Decode a caught error into its soroban contract identity, if it carries one.
 *
 * Colibri's `createContractErrorMatcherPlugin` (wired by
 * {@link createMoonlightContractErrorPlugins}) runs on both the simulate and
 * submit pipelines and attaches the decoded variant at
 * `error.meta.data.match.code`. Provider-side wrappers copy the envelope onto
 * their own error (`Object.assign(this, originalError)`) and may nest the
 * original under `cause`, so this walks the cause chain to find the match.
 *
 * This is the single submit-time decoder for the whole chain: it turns an
 * opaque thrown error into the stable numeric code that the API boundary
 * translates into a `StructuredError`. Returns `null` when the error is not a
 * contract revert (e.g. a network/RPC failure), so callers can distinguish
 * deterministic on-chain reverts from transient failures.
 */
export function decodeContractError(err: unknown): DecodedContractError | null {
  let current: unknown = err;
  // Bounded walk of the cause chain; wrapping is shallow in practice.
  for (let depth = 0; depth < 8 && isRecord(current); depth++) {
    const carrier = current as MatchCarrier;
    // Primary: the structured match payload from the matcher plugin.
    const code = carrier.meta?.data?.match?.code;
    if (typeof code === "number") {
      // An unmapped code means catalog drift — surface null rather than a
      // misleading half-decode.
      return decoded(code);
    }
    // Fallback: recover the code from the rendered "Contract error: <Variant>"
    // message (survives re-wrapping that copies only the message).
    const fromMsg = codeFromMessage(carrier.message);
    if (fromMsg !== null) return decoded(fromMsg);

    current = carrier.cause;
  }
  return null;
}
