import { Condition } from "../conditions/types.ts";

export type MoonlightOperation = {
  create: CreateOperation[];
  spend: SpendOperation[];
  deposit: DepositOperation[];
  withdraw: WithdrawOperation[];
};

export type SpendOperation = { utxo: UTXOPublicKey; conditions: Condition[] };

export type DepositOperation = {
  pubKey: Ed25519PublicKey;
  amount: bigint;
  conditions: Condition[];
};

export type WithdrawOperation = {
  pubKey: Ed25519PublicKey;
  amount: bigint;
  conditions: Condition[];
};

export type CreateOperation = { utxo: UTXOPublicKey; amount: bigint };

export type UTXOPublicKey = Uint8Array;

export type Ed25519PublicKey = `G${string}`;