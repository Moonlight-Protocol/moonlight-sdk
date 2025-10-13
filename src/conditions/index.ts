import { Condition } from "./types.ts";
import { nativeToScVal, xdr } from "stellar-sdk";
import { Buffer } from "buffer";
import { CreateCondition, DepositCondition, WithdrawCondition } from "./types.ts";

const actionToSymbolStr = (action: Condition["action"]): string => {
  if (action === "CREATE") return "Create";
  if (action === "DEPOSIT") return "Deposit";
  if (action === "WITHDRAW") return "Withdraw";
  throw new Error("Invalid action");
};

export const conditionToXDR = (cond: Condition): xdr.ScVal => {
  const actionXDR = xdr.ScVal.scvSymbol(actionToSymbolStr(cond.action));
  const addressXDR =
    cond.action === "CREATE"
      ? xdr.ScVal.scvBytes(Buffer.from(cond.utxo))
      : nativeToScVal(cond.publicKey, { type: "address" });
  const amountXDR = nativeToScVal(cond.amount, { type: "i128" });

  const cXDR = xdr.ScVal.scvVec([actionXDR, addressXDR, amountXDR]);

  return cXDR;
};

export const createCondition = (
  utxo: Uint8Array,
  amount: bigint
): CreateCondition => ({
  action: "CREATE",
  utxo,
  amount,
});

export const depositCondition = (
  publicKey: string,
  amount: bigint
): DepositCondition => ({
  action: "DEPOSIT",
  publicKey,
  amount,
});

export const withdrawCondition = (
  publicKey: string,
  amount: bigint
): WithdrawCondition => ({
  action: "WITHDRAW",
  publicKey,
  amount,
});
  