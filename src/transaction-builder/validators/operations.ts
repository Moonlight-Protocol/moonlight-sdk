import { Buffer } from "buffer";
import { Condition } from "../../conditions/types.ts";
import { UTXOPublicKey, Ed25519PublicKey } from "../types.ts";

export const assertPositiveAmount = (amount: bigint, context: string) => {
  if (amount <= 0n) throw new Error(`${context} amount must be positive`);
};

export const assertNoDuplicateCreate = (
  existing: { utxo: UTXOPublicKey }[],
  utxo: UTXOPublicKey,
) => {
  if (existing.find((c) => Buffer.from(c.utxo).equals(Buffer.from(utxo))))
    throw new Error("Create operation for this UTXO already exists");
};

export const assertNoDuplicateSpend = (
  existing: { utxo: UTXOPublicKey }[],
  utxo: UTXOPublicKey,
) => {
  if (existing.find((s) => Buffer.from(s.utxo).equals(Buffer.from(utxo))))
    throw new Error("Spend operation for this UTXO already exists");
};

export const assertNoDuplicatePubKey = (
  existing: { pubKey: Ed25519PublicKey }[],
  pubKey: Ed25519PublicKey,
  context: string,
) => {
  if (existing.find((d) => d.pubKey === pubKey))
    throw new Error(`${context} operation for this public key already exists`);
};

export const assertSpendExists = (
  existing: { utxo: UTXOPublicKey; conditions: Condition[] }[],
  utxo: UTXOPublicKey,
) => {
  if (!existing.find((s) => Buffer.from(s.utxo).equals(Buffer.from(utxo))))
    throw new Error("No spend operation for this UTXO");
};


