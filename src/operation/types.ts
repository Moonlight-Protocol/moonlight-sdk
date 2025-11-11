import type {
  ContractId,
  Ed25519PublicKey,
  TransactionSigner,
} from "@colibri/core";

import type { Keypair, xdr } from "@stellar/stellar-sdk";
import type {
  CreateCondition,
  DepositCondition,
  WithdrawCondition,
} from "../conditions/types.ts";
import type { Condition } from "../conditions/types.ts";
import type {
  IUTXOKeypairBase,
  UTXOPublicKey,
} from "../core/utxo-keypair-base/types.ts";
import type { Buffer } from "buffer";

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
  signWithEd25519(
    depositorKeys: TransactionSigner | Keypair,
    signatureExpirationLedger: number,
    channelId: ContractId,
    assetId: ContractId,
    networkPassphrase: string,
    nonce?: string
  ): Promise<this>;
  getEd25519Signature(): xdr.SorobanAuthorizationEntry;
  isSignedByEd25519(): boolean;
}

export interface WithdrawOperation extends BaseOperation {
  getOperation(): UTXOOperationType.WITHDRAW;
  getPublicKey(): Ed25519PublicKey;
  toCondition(): WithdrawCondition;
}

export interface SpendOperation extends BaseOperation {
  getOperation(): UTXOOperationType.SPEND;
  getUtxo(): UTXOPublicKey;
  isSignedByUTXO(): boolean;
  getUTXOSignature(): OperationSignature;
  signWithUTXO(
    utxo: IUTXOKeypairBase,
    channelId: ContractId,
    signatureExpirationLedger: number
  ): Promise<this>;
}

export type MoonlightOperation =
  | CreateOperation
  | DepositOperation
  | WithdrawOperation
  | SpendOperation;

export type OperationSignature = { sig: Buffer; exp: number };
