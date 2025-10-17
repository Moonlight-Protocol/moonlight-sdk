// export type CreateCondition = {
//     action: "CREATE";
//     utxo: Uint8Array;
//     amount: bigint;
//   };

import type { Ed25519PublicKey } from "@colibri/core";
import type { UTXOPublicKey } from "../transaction-builder/types.ts";
import type { xdr } from "@stellar/stellar-sdk";

//   export type DepositCondition = {
//     action: "DEPOSIT";
//     publicKey: string;
//     amount: bigint;
//   };

//   export type WithdrawCondition = {
//     action: "WITHDRAW";
//     publicKey: string;
//     amount: bigint;
//   };

// export type Condition = CreateCondition | DepositCondition | WithdrawCondition;

export enum UTXOOperation {
  CREATE = "Create",
  DEPOSIT = "Deposit",
  WITHDRAW = "Withdraw",
}

export type BaseCondition = {
  getOperation(): UTXOOperation;
  getAmount(): bigint;
  isCreate(): this is CreateCondition;
  isDeposit(): this is DepositCondition;
  isWithdraw(): this is WithdrawCondition;
  toXDR(): string;
  toScVal(): xdr.ScVal;
};

export type CreateCondition = BaseCondition & {
  getOperation(): UTXOOperation.CREATE;
  getUtxo(): UTXOPublicKey;
};

export type DepositCondition = BaseCondition & {
  getOperation(): UTXOOperation.DEPOSIT;
  getPublicKey(): Ed25519PublicKey;
};

export type WithdrawCondition = BaseCondition & {
  getOperation(): UTXOOperation.WITHDRAW;
  getPublicKey(): Ed25519PublicKey;
};

export type Condition = CreateCondition | DepositCondition | WithdrawCondition;
