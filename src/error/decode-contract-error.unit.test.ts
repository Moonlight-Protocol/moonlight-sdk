import { assertEquals } from "@std/assert";
import { decodeContractError } from "./decode-contract-error.ts";
import { MoonlightContractError } from "./contract-errors.ts";

/** Mimics Colibri's contract-error-matcher thrown-error envelope. */
function matcherError(code: number): unknown {
  return Object.assign(new Error(`Contract error: code ${code}`), {
    meta: { data: { match: { code } } },
  });
}

Deno.test("decodeContractError", async (t) => {
  await t.step("decodes a direct matcher error to its catalog identity", () => {
    const decoded = decodeContractError(matcherError(1010));
    assertEquals(decoded, {
      code: 1010,
      name: MoonlightContractError[1010].message,
      details: MoonlightContractError[1010].details,
      source: "onchain",
    });
  });

  await t.step("walks the cause chain when the match is wrapped", () => {
    const wrapped = new Error("Slot execution failed", {
      cause: new Error("submit failed", { cause: matcherError(2002) }),
    });
    assertEquals(decodeContractError(wrapped)?.code, 2002);
    assertEquals(decodeContractError(wrapped)?.name, "UtxoAlreadySpent");
  });

  await t.step("recovers the code from the rendered message", () => {
    // No structured match payload — only the "Contract error: <Variant>" text,
    // as when a wrapper copies just the message.
    const wrapped = new Error("Contract error: SignatureExpired", {
      cause: new Error("submit failed"),
    });
    const d = decodeContractError(wrapped);
    assertEquals(d?.code, 1010);
    assertEquals(d?.name, "SignatureExpired");
  });

  await t.step("returns null for a non-contract (network) error", () => {
    assertEquals(decodeContractError(new Error("RPC timeout")), null);
    assertEquals(decodeContractError(undefined), null);
    assertEquals(decodeContractError({ meta: { data: {} } }), null);
  });

  await t.step("returns null for an unmapped code (catalog drift)", () => {
    assertEquals(decodeContractError(matcherError(9999)), null);
  });
});
