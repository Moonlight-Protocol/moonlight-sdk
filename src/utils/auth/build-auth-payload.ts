import { Buffer } from "node:buffer";
import { xdr } from "@stellar/stellar-sdk";
import type { Condition } from "../../conditions/types.ts";
import { bigintToLE } from "../conversion/bigintToLE.ts";

/**
 * Builds the signed-payload preimage that the on-chain `hash_payload`
 * (soroban-core `moonlight-primitives`) hashes with SHA-256 to produce the
 * digest the UTXO signature is verified against.
 *
 * The preimage is the concatenation, in this fixed order, of:
 *  1. the contract id strkey bytes (as passed in),
 *  2. the canonical XDR encoding of the ordered `Vec<Condition>` (`ScVal::Vec`
 *     of each condition's `ScVal`, i.e. Soroban's `ToXdr`),
 *  3. the `liveUntilLedger` as a 4-byte little-endian `u32`.
 *
 * The condition list is serialized with XDR — the same self-delimiting on-wire
 * representation the contract uses. XDR length-prefixes vectors and tags every
 * enum variant, so the encoding is injective: an `ExtDeposit(X, a)` and an
 * `ExtWithdraw(X, a)` over the same address and amount hash differently, and
 * reordering the conditions changes the digest. Order is therefore preserved
 * exactly as given — conditions are never sorted or bucketed.
 *
 * NOTE: this returns the preimage, not its SHA-256. The P256 signer
 * (`crypto.subtle.sign` with `hash: SHA-256`) hashes the preimage internally,
 * mirroring the contract's `hash_payload` SHA-256 step.
 */
export const buildAuthPayloadHash = ({
  contractId,
  conditions,
  liveUntilLedger,
}: {
  contractId: string;
  conditions: Condition[];
  liveUntilLedger: number;
}): Uint8Array => {
  const encoder = new TextEncoder();

  // 1. Contract id strkey bytes, matching hash_payload's leading `contract: &Bytes`.
  const encodedContractId = encoder.encode(contractId);

  // 2. Canonical, order-sensitive XDR of the condition list — byte-for-byte the
  //    `ToXdr(Vec<Condition>)` the contract appends. Order is preserved as-is.
  const conditionsScVal = xdr.ScVal.scvVec(
    conditions.map((condition) => condition.toScVal()),
  );
  const encodedConditions = conditionsScVal.toXDR();

  // 3. live_until_ledger as a 4-byte little-endian u32.
  const encodedLiveUntil = bigintToLE(BigInt(liveUntilLedger), 4);

  return Buffer.concat([
    encodedContractId,
    encodedConditions,
    encodedLiveUntil,
  ]);
};
