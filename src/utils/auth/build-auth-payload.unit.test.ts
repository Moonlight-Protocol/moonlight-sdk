import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import { Condition } from "../../conditions/index.ts";
import type { Condition as ConditionType } from "../../conditions/types.ts";
import { buildAuthPayloadHash } from "./build-auth-payload.ts";
import { sha256Buffer } from "../hash/sha256Buffer.ts";

/**
 * A1 encoding lockstep with soroban-core `moonlight-primitives::hash_payload`
 * (PR #38, `fix/b3-hash-payload-docstring` @ 97922db).
 *
 * The digest the contract verifies is
 *   SHA-256( contractId_bytes ++ ToXdr(Vec<Condition>) ++ live_until_ledger_LE ).
 * The SDK builds the preimage; the P256 signer applies the SHA-256. The vectors
 * below are the exact `hash_payload(...).to_bytes()` outputs produced by the Rust
 * contract for these fixed inputs, so `SHA-256(buildAuthPayloadHash(...))` must
 * reproduce them byte-for-byte.
 */

// Fixed strkeys shared verbatim with the Rust known-answer test.
const CONTRACT_ID = "CBSGKZTHNBUWU23MNVXG64DROJZXI5LWO54HS6T3PR6X474AQGBIHDKP";
const ADDRESS = "GAAQEAYEAUDAOCAJBIFQYDIOB4IBCEQTCQKRMFYYDENBWHA5DYPSABOV";

// Known-answer digests emitted by soroban-core `hash_payload` for the same inputs.
const KAT = {
  // [ExtDeposit(ADDRESS, 1000)], live_until_ledger = 100
  deposit: "0224255e3cf3bce91f9d0a1dc125cbc1667ed310eb07bd71341168e8beeb046c",
  // [ExtWithdraw(ADDRESS, 1000)], live_until_ledger = 100
  withdraw: "939cf8d8ba52e468a1e3ad762bce1ea9f0759b194d931d238e776249e1230b2c",
  // [ExtDeposit(ADDRESS, 1000), ExtWithdraw(ADDRESS, 2000)], live_until_ledger = 777
  both: "ab6f0370f0c6c3bc5ddce845627d9436ee2251dcaf0b3095bf92faf35b6ad7f9",
} as const;

async function sdkDigestHex(
  conditions: ConditionType[],
  liveUntilLedger: number,
): Promise<string> {
  const preimage = buildAuthPayloadHash({
    contractId: CONTRACT_ID,
    conditions,
    liveUntilLedger,
  });
  return Buffer.from(await sha256Buffer(preimage)).toString("hex");
}

describe("buildAuthPayloadHash — A1 encoding (soroban-core #38 lockstep)", () => {
  it("SDK digest == contract digest for a single deposit", async () => {
    const deposit = Condition.deposit(ADDRESS, 1000n);
    assertEquals(await sdkDigestHex([deposit], 100), KAT.deposit);
  });

  it("SDK digest == contract digest for a single withdraw", async () => {
    const withdraw = Condition.withdraw(ADDRESS, 1000n);
    assertEquals(await sdkDigestHex([withdraw], 100), KAT.withdraw);
  });

  it("deposit and withdraw over the same (address, amount) hash differently", async () => {
    const deposit = Condition.deposit(ADDRESS, 1000n);
    const withdraw = Condition.withdraw(ADDRESS, 1000n);
    const depositDigest = await sdkDigestHex([deposit], 100);
    const withdrawDigest = await sdkDigestHex([withdraw], 100);

    // The A1 fix: the variant-tagged XDR closes the deposit/withdraw collision.
    assertNotEquals(depositDigest, withdrawDigest);
    assertEquals(depositDigest, KAT.deposit);
    assertEquals(withdrawDigest, KAT.withdraw);
  });

  it("SDK digest == contract digest for an ordered multi-condition payload", async () => {
    const conditions = [
      Condition.deposit(ADDRESS, 1000n),
      Condition.withdraw(ADDRESS, 2000n),
    ];
    assertEquals(await sdkDigestHex(conditions, 777), KAT.both);
  });

  it("reordering the conditions changes the digest", async () => {
    const forward = [
      Condition.deposit(ADDRESS, 1000n),
      Condition.withdraw(ADDRESS, 2000n),
    ];
    const reversed = [forward[1], forward[0]];
    assertNotEquals(
      await sdkDigestHex(forward, 777),
      await sdkDigestHex(reversed, 777),
    );
  });
});
