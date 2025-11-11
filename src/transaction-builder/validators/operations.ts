import { Buffer } from "buffer";
import type { UTXOPublicKey } from "../../core/utxo-keypair-base/types.ts";
import type { Ed25519PublicKey } from "@colibri/core";
import * as E from "../error.ts";

export const assertNoDuplicateCreate = (
  existing: { getUtxo(): UTXOPublicKey }[],
  op: { getUtxo(): UTXOPublicKey }
) => {
  if (
    existing.find((c) =>
      Buffer.from(c.getUtxo()).equals(Buffer.from(op.getUtxo()))
    )
  )
    throw new E.DUPLICATE_CREATE_OP(op.getUtxo());
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
    throw new E.DUPLICATE_SPEND_OP(op.getUtxo());
};

export const assertNoDuplicateDeposit = (
  existing: { getPublicKey(): Ed25519PublicKey }[],
  op: { getPublicKey(): Ed25519PublicKey }
) => {
  if (existing.find((d) => d.getPublicKey() === op.getPublicKey()))
    throw new E.DUPLICATE_DEPOSIT_OP(op.getPublicKey());
};

export const assertNoDuplicateWithdraw = (
  existing: { getPublicKey(): Ed25519PublicKey }[],
  op: { getPublicKey(): Ed25519PublicKey }
) => {
  if (existing.find((d) => d.getPublicKey() === op.getPublicKey()))
    throw new E.DUPLICATE_WITHDRAW_OP(op.getPublicKey());
};

export const assertSpendExists = (
  existing: { getUtxo(): UTXOPublicKey }[],
  utxo: UTXOPublicKey
) => {
  if (!existing.find((s) => Buffer.from(s.getUtxo()).equals(Buffer.from(utxo))))
    throw new E.NO_SPEND_OPS(utxo);
};

export const assertExtOpsExist = (
  existingDeposit: { getPublicKey(): Ed25519PublicKey }[],
  existingWithdraw: { getPublicKey(): Ed25519PublicKey }[],
  pubKey: Ed25519PublicKey
) => {
  if (
    !existingDeposit.find((d) => d.getPublicKey() === pubKey) &&
    !existingWithdraw.find((w) => w.getPublicKey() === pubKey)
  )
    throw new E.NO_EXT_OPS(pubKey);
};

export const assertDepositExists = (
  existing: { getPublicKey(): Ed25519PublicKey }[],
  pubKey: Ed25519PublicKey
) => {
  if (!existing.find((d) => d.getPublicKey() === pubKey))
    throw new E.NO_DEPOSIT_OPS(pubKey);
};

export const assertWithdrawExists = (
  existing: { getPublicKey(): Ed25519PublicKey }[],
  pubKey: Ed25519PublicKey
) => {
  if (!existing.find((d) => d.getPublicKey() === pubKey))
    throw new E.NO_WITHDRAW_OPS(pubKey);
};
