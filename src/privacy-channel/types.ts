import type {
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from "@colibri/core";
import type { Buffer } from "node:buffer";
import type { ChannelInvokeMethods, ChannelReadMethods } from "./constants.ts";
import type { UTXOBasedAccountContructorArgs } from "../utxo-based-account/types.ts";

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

//TODO: Define 'op' type properly
export type TransactInput = { op: unknown };
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

export type GetUTXOAccountHandlerArgs =
  & Pick<
    UTXOBasedAccountContructorArgs<string, Ed25519SecretKey, `${number}`>,
    "root"
  >
  & {
    options?: Omit<
      UTXOBasedAccountContructorArgs<
        string,
        Ed25519SecretKey,
        `${number}`
      >["options"],
      "fetchBalances"
    >;
  };
