import { Buffer } from "buffer";
import type { UTXOPublicKey } from "../../core/utxo-keypair-base/types.ts";
import type { Ed25519PublicKey } from "@colibri/core";

export const assertPositiveAmount = (amount: bigint, context: string) => {
  if (amount <= 0n) throw new Error(`${context} amount must be positive`);
};

export const assertNoDuplicateCreate = (
  existing: { getUtxo(): UTXOPublicKey }[],
  op: { getUtxo(): UTXOPublicKey }
) => {
  if (
    existing.find((c) =>
      Buffer.from(c.getUtxo()).equals(Buffer.from(op.getUtxo()))
    )
  )
    throw new Error("Create operation for this UTXO already exists");
};

export const assertNoDuplicateSpend = (
  existing: { getUtxo(): UTXOPublicKey }[],
  op: { getUtxo(): UTXOPublicKey }
) => {
  if (
    existing.find((s) =>
      Buffer.from(s.getUtxo()).equals(Buffer.from(op.getUtxo()))
    )
  )
    throw new Error("Spend operation for this UTXO already exists");
};

export const assertNoDuplicatePubKey = (
  existing: { getPublicKey(): Ed25519PublicKey }[],
  op: { getPublicKey(): Ed25519PublicKey },
  context: string
) => {
  if (existing.find((d) => d.getPublicKey() === op.getPublicKey()))
    throw new Error(`${context} operation for this public key already exists`);
};

export const assertSpendExists = (
  existing: { getUtxo(): UTXOPublicKey }[],
  utxo: UTXOPublicKey
) => {
  if (!existing.find((s) => Buffer.from(s.getUtxo()).equals(Buffer.from(utxo))))
    throw new Error("No spend operation for this UTXO");
};
