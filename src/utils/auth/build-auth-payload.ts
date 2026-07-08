import { Buffer } from "node:buffer";
import { xdr } from "@stellar/stellar-sdk";
import type { Condition } from "../../conditions/types.ts";

/**
 * Builds the pre-image the P256 signer signs over for a bundle of conditions.
 *
 * This MUST stay byte-identical to soroban-core's `hash_payload`
 * (`modules/primitives/src/lib.rs`). The contract builds, in this fixed order:
 *
 *   1. the caller contract address as its strkey string bytes
 *      (`caller_contract.to_string().to_bytes()`),
 *   2. the canonical XDR encoding of the ordered `Vec<Condition>`
 *      (`conditions.to_xdr(e)`),
 *   3. the `live_until_ledger` as a 4-byte little-endian `u32`,
 *
 * then hashes the result with SHA-256 for signature verification. The signer
 * (`crypto.subtle.sign` with ECDSA/SHA-256) applies the SHA-256 itself, so this
 * function returns the un-hashed pre-image.
 *
 * The condition list is serialized with XDR — the same self-delimiting on-wire
 * representation the contract compares against. Because XDR length-prefixes
 * vectors and tags every enum variant, the encoding is injective: distinct or
 * re-ordered condition lists can never produce the same bytes (an
 * `ExtDeposit(X, a)` and an `ExtWithdraw(X, a)` over the same address and amount
 * hash differently). Order is preserved exactly as given — conditions are never
 * sorted, bucketed, or canonicalized.
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

  // 1. Contract address bytes: the strkey string as UTF-8 bytes, matching the
  //    contract's `caller_contract.to_string().to_bytes()`.
  const encodedContractId = encoder.encode(contractId);

  // 2. Canonical, order-sensitive XDR of the condition list. Each Condition
  //    serializes to the same ScVal vector `[symbol, address, i128]` the
  //    contract's enum produces; the list is wrapped in an outer ScVal vector,
  //    mirroring `Vec<Condition>::to_xdr`. Order is preserved as-is.
  const conditionsScVal = xdr.ScVal.scvVec(
    conditions.map((condition) => condition.toScVal()),
  );
  const encodedConditions = new Uint8Array(conditionsScVal.toXDR());

  // 3. live_until_ledger as a 4-byte little-endian u32.
  const encodedLiveUntil = bigintToLE(BigInt(liveUntilLedger), 4);

  // Concatenate the three parts into the signing pre-image.
  return Buffer.concat([
    encodedContractId,
    encodedConditions,
    encodedLiveUntil,
  ]);
};

// Convert bigint to little endian
export function bigintToLE(amount: bigint, byteLength: number): Uint8Array {
  const result = new Uint8Array(byteLength);
  let temp = amount;
  for (let i = 0; i < byteLength; i++) {
    result[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return result;
}
