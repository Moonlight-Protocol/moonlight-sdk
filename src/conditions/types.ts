import type { Ed25519PublicKey } from "@colibri/core";

import type { xdr } from "@stellar/stellar-sdk";
import type { UTXOOperationType } from "../operation/types.ts";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";

export interface BaseCondition {
  getOperation(): UTXOOperationType;
  getAmount(): bigint;
  isCreate(): this is CreateCondition;
  isDeposit(): this is DepositCondition;
  isWithdraw(): this is WithdrawCondition;
  toXDR(): string;
  // fromXDR(xdrString: string): this;
  toScVal(): xdr.ScVal;
  // fromScVal(scVal: xdr.ScVal): this;
  // fromMLXDR(mlxdrString: string): this;
  toMLXDR(): string;
}

export type CreateCondition = BaseCondition & {
  getOperation(): UTXOOperationType.CREATE;
  getUtxo(): UTXOPublicKey;
};

export type DepositCondition = BaseCondition & {
  getOperation(): UTXOOperationType.DEPOSIT;
  getPublicKey(): Ed25519PublicKey;
};

export type WithdrawCondition = BaseCondition & {
  getOperation(): UTXOOperationType.WITHDRAW;
  getPublicKey(): Ed25519PublicKey;
};

export type Condition = CreateCondition | DepositCondition | WithdrawCondition;
