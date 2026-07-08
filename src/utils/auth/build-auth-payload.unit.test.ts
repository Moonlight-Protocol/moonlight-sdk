import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { ContractId, Ed25519PublicKey } from "@colibri/core";
import type { UTXOPublicKey } from "../../core/utxo-keypair-base/types.ts";
import { Condition } from "../../conditions/index.ts";
import type { Condition as ConditionInput } from "../../conditions/types.ts";
import { buildAuthPayloadHash } from "./build-auth-payload.ts";
import { sha256Buffer } from "../hash/sha256Buffer.ts";

/**
 * Known-answer cross-check against soroban-core's `hash_payload`
 * (`modules/primitives/src/lib.rs`, PR #38 — A1 injective encoding,
 * head efb41c83d8b725e0423dbf5485abf40a54f2811d).
 *
 * The expected digests below were produced by running the contract's own
 * `hash_payload` over these exact inputs (fixed strkeys / amounts / ledgers).
 * The SDK builds the same pre-image and SHA-256s it here; matching digests
 * prove the off-chain signer and the on-chain verifier are byte-for-byte in
 * sync. If PR #38's encoding shifts before merge, regenerate these vectors.
 */

// Fixed strkeys shared with the contract KAT (StrKey.encodeContract(0x11*32) /
// StrKey.encodeEd25519PublicKey(0x22*32)).
const CONTRACT_ID =
  "CAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRDB3V" as ContractId;
const ACCOUNT =
  "GARCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCFRVX" as Ed25519PublicKey;
// Create UTXO key: BytesN<65> of 0x07, matching the contract's [7u8; 65].
const UTXO: UTXOPublicKey = new Uint8Array(65).fill(7);

// Ground-truth digests from soroban-core `hash_payload` (SHA-256, hex).
const KAT_DEPOSIT =
  "4482986e3d9f950235296f63e6b72e4ae7ba11817fdcce77dc0533a062e75b73";
const KAT_WITHDRAW =
  "bb0354a93c12f979c2ee14a849ca85f382af5ab88e0ec23fbe8b5fc8883bc57e";
const KAT_COMBINED =
  "506acd6b0043da9aa0d3a7a6596e823fcef742eef4c1aa5122e6e31e9232faee";

const digestHex = async (
  conditions: ConditionInput[],
  liveUntilLedger: number,
): Promise<string> => {
  const preimage = buildAuthPayloadHash({
    contractId: CONTRACT_ID,
    conditions,
    liveUntilLedger,
  });
  const digest = new Uint8Array(await sha256Buffer(preimage));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
};

describe("buildAuthPayloadHash — cross-check with soroban-core hash_payload", () => {
  it("matches the contract digest for a single ExtDeposit", async () => {
    const conditions = [Condition.deposit(ACCOUNT, 1000n)];
    assertEquals(await digestHex(conditions, 100), KAT_DEPOSIT);
  });

  it("matches the contract digest for a single ExtWithdraw", async () => {
    const conditions = [Condition.withdraw(ACCOUNT, 1000n)];
    assertEquals(await digestHex(conditions, 100), KAT_WITHDRAW);
  });

  it("hashes ExtDeposit(X,a) and ExtWithdraw(X,a) differently (A1)", async () => {
    const deposit = await digestHex([Condition.deposit(ACCOUNT, 1000n)], 100);
    const withdraw = await digestHex([Condition.withdraw(ACCOUNT, 1000n)], 100);
    // The whole point of A1: same address + amount must not share a digest.
    assertNotEquals(deposit, withdraw);
  });

  it("matches the contract digest for a mixed Deposit+Create list", async () => {
    const conditions = [
      Condition.deposit(ACCOUNT, 42n),
      Condition.create(UTXO, 99n),
    ];
    assertEquals(await digestHex(conditions, 555), KAT_COMBINED);
  });
});
