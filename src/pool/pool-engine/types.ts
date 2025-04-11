import type { Buffer } from "buffer";
import type { i128 } from "stellar-plus/lib/stellar-plus/types";
import type { NetworkConfig } from "stellar-plus/lib/stellar-plus/network";
import { StellarSmartContractId } from "../../utils/types/stellar.types.ts";
export type PoolEngineConstructorArgs = {
  networkConfig: NetworkConfig;
  wasm: Buffer;
  assetContractId: string;
  poolContractId?: StellarSmartContractId;
};

export interface Bundle {
  create: Array<readonly [Buffer, bigint]>;
  signatures: Array<Buffer>;
  spend: Array<Buffer>;
}

export const enum ReadMethods {
  admin = "admin",
  supply = "supply",
  balance = "balance",
  balances = "balances",
  provider_balance = "provider_balance",
  is_provider = "is_provider",
}

export const enum WriteMethods {
  deposit = "deposit",
  withdraw = "withdraw",
  transfer = "transfer",
  delegated_transfer_utxo = "delegated_transfer_utxo",
  delegated_transfer_bal = "delegated_transfer_bal",
  provider_withdraw = "provider_withdraw",
  register_provider = "register_provider",
  deregister_provider = "deregister_provider",
}

export type ContractConstructorArgs = { admin: string; asset: string };
export type AdminOutput = string;

export type SupplyOutput = i128;

export type BalanceInput = { utxo: Buffer };
export type BalanceOutput = i128;

export type BalancesInput = { utxos: Array<Buffer> };
export type BalancesOutput = Array<i128>;

export type ProviderBalanceInput = { provider: string };
export type ProviderBalanceOutput = i128;
export type IsProviderInput = { provider: string };
export type IsProviderOutput = boolean;

export type DepositInput = { from: string; amount: i128; utxo: Buffer };
export type WithdrawInput = {
  to: string;
  amount: i128;
  utxo: Buffer;
  signature: Buffer;
};
export type TransferInput = { bundles: Array<Bundle> };

export type DelegatedTransferUtxoInput = {
  bundles: Array<Bundle>;
  provider: string;
  delegate_utxo: Buffer;
};

export type DelegatedTransferBalInput = {
  bundles: Array<Bundle>;
  provider: string;
};

export type ProviderWithdrawInput = { provider: string; amount: i128 };
export type RegisterProviderInput = { provider: string };
export type DeregisterProviderInput = { provider: string };

export interface ReadMapping {
  [ReadMethods.admin]: { input: object; output: AdminOutput };
  [ReadMethods.supply]: { input: object; output: SupplyOutput };
  [ReadMethods.balance]: { input: BalanceInput; output: BalanceOutput };
  [ReadMethods.balances]: { input: BalancesInput; output: BalancesOutput };
  [ReadMethods.provider_balance]: {
    input: ProviderBalanceInput;
    output: ProviderBalanceOutput;
  };
  [ReadMethods.is_provider]: {
    input: IsProviderInput;
    output: IsProviderOutput;
  };
}

export interface WriteMapping {
  [WriteMethods.deposit]: {
    input: DepositInput;
    output: object;
  };
  [WriteMethods.withdraw]: {
    input: WithdrawInput;
    output: object;
  };
  [WriteMethods.transfer]: {
    input: TransferInput;
    output: object;
  };
  [WriteMethods.delegated_transfer_utxo]: {
    input: DelegatedTransferUtxoInput;
    output: object;
  };
  [WriteMethods.delegated_transfer_bal]: {
    input: DelegatedTransferBalInput;
    output: object;
  };
  [WriteMethods.provider_withdraw]: {
    input: ProviderWithdrawInput;
    output: object;
  };
  [WriteMethods.register_provider]: {
    input: RegisterProviderInput;
    output: object;
  };
  [WriteMethods.deregister_provider]: {
    input: DeregisterProviderInput;
    output: object;
  };
}

export enum BundlePayloadAction {
  DELEGATED_TRANSFER = "DELEGATED_TRANSFER",
  TRANSFER = "TRANSFER",
}

export enum SimplePayloadAction {
  BURN = "BURN",
}
