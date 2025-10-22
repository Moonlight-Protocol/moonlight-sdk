import type { Ed25519PublicKey } from "@colibri/core";

import type { xdr } from "@stellar/stellar-sdk";
import type {
  CreateCondition,
  DepositCondition,
  WithdrawCondition,
} from "../conditions/types.ts";
import type { Condition } from "../conditions/types.ts";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";

export enum UTXOOperationType {
  CREATE = "Create",
  DEPOSIT = "ExtDeposit",
  WITHDRAW = "ExtWithdraw",
  SPEND = "Spend",
}

export interface BaseOperation {
  getOperation(): UTXOOperationType;
  getAmount(): bigint;
  isCreate(): this is CreateOperation;
  isDeposit(): this is DepositOperation;
  isWithdraw(): this is WithdrawOperation;
  isSpend(): this is SpendOperation;
  hasConditions(): boolean;
  getConditions(): Condition[];
  addCondition(condition: Condition): this;
  addConditions(condition: Condition[]): this;
  clearConditions(): this;
  toXDR(): string;
  toScVal(): xdr.ScVal;
}

export interface CreateOperation extends BaseOperation {
  getOperation(): UTXOOperationType.CREATE;
  getUtxo(): UTXOPublicKey;
  toCondition(): CreateCondition;
}

export interface DepositOperation extends BaseOperation {
  getOperation(): UTXOOperationType.DEPOSIT;
  getPublicKey(): Ed25519PublicKey;
  toCondition(): DepositCondition;
}

export interface WithdrawOperation extends BaseOperation {
  getOperation(): UTXOOperationType.WITHDRAW;
  getPublicKey(): Ed25519PublicKey;
  toCondition(): WithdrawCondition;
}

export interface SpendOperation extends BaseOperation {
  getOperation(): UTXOOperationType.SPEND;
  getUtxo(): UTXOPublicKey;
}

export type MoonlightOperation =
  | CreateOperation
  | DepositOperation
  | WithdrawOperation
  | SpendOperation;
