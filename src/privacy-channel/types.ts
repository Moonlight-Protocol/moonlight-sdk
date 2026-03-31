import type { ContractId, Ed25519PublicKey } from "@colibri/core";
import type { Buffer } from "node:buffer";
import type { xdr } from "@stellar/stellar-sdk";
import type { ChannelInvokeMethods, ChannelReadMethods } from "./constants.ts";

export type ChannelConstructorArgs = {
  admin: Ed25519PublicKey | ContractId;
  auth_contract: ContractId;
  asset: ContractId;
};
export type AssetOutput = ContractId;
export type AuthOutput = ContractId;

export type AdminOutput = Ed25519PublicKey | ContractId;

export type SupplyOutput = bigint;

export type UTXOBalanceInput = { utxo: Buffer };
export type UTXOBalanceOutput = bigint;

export type UTXOBalancesInput = { utxos: Array<Buffer> };
export type UTXOBalancesOutput = Array<bigint>;

/** The serialized channel operation (create/deposit/spend/withdraw) as built by MoonlightTransactionBuilder.buildXDR() */
export type TransactInput = { op: xdr.ScVal };
export type SetAdminInput = { new_admin: Ed25519PublicKey | ContractId };
export type UpgradeInput = { wasm_hash: string };
export type SetAuthInput = { new_auth: ContractId };

export type None = object;

export type ChannelRead = {
  [ChannelReadMethods.admin]: {
    input: None;
    output: AdminOutput;
  };
  [ChannelReadMethods.asset]: {
    input: None;
    output: AssetOutput;
  };
  [ChannelReadMethods.auth]: {
    input: None;
    output: AuthOutput;
  };
  [ChannelReadMethods.supply]: {
    input: None;
    output: SupplyOutput;
  };
  [ChannelReadMethods.utxo_balance]: {
    input: UTXOBalanceInput;
    output: UTXOBalanceOutput;
  };
  [ChannelReadMethods.utxo_balances]: {
    input: UTXOBalancesInput;
    output: UTXOBalancesOutput;
  };
};

export type ChannelInvoke = {
  [ChannelInvokeMethods.transact]: {
    input: TransactInput;
    output: None;
  };
  [ChannelInvokeMethods.set_admin]: {
    input: SetAdminInput;
    output: None;
  };
  [ChannelInvokeMethods.upgrade]: {
    input: UpgradeInput;
    output: None;
  };
  [ChannelInvokeMethods.set_auth]: {
    input: SetAuthInput;
    output: None;
  };
};
