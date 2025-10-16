import type { ContractId, Ed25519PublicKey } from "@colibri/core";
import type { Buffer } from "node:buffer";
import type { AuthInvokeMethods, AuthReadMethods } from "./constants.ts";

export type ContractConstructorArgs = {
  admin: Ed25519PublicKey | ContractId;
};

export type AdminOutput = Ed25519PublicKey | ContractId;
export type IsProviderInput = { provider: Ed25519PublicKey | ContractId };
export type IsProviderOutput = boolean;

export type SetAdminInput = { new_admin: Ed25519PublicKey | ContractId };
export type UpgradeInput = { wasm_hash: string };
export type AddProviderInput = { provider: Ed25519PublicKey | ContractId };
export type RemoveProviderInput = { provider: Ed25519PublicKey | ContractId };

export type None = object;

export type AuthRead = {
  [AuthReadMethods.admin]: {
    input: None;
    output: AdminOutput;
  };
  [AuthReadMethods.is_provider]: {
    input: IsProviderInput;
    output: IsProviderOutput;
  };
};

export type AuthInvoke = {
  [AuthInvokeMethods.set_admin]: {
    input: SetAdminInput;
    output: None;
  };
  [AuthInvokeMethods.upgrade]: {
    input: UpgradeInput;
    output: None;
  };
  [AuthInvokeMethods.add_provider]: {
    input: AddProviderInput;
    output: None;
  };
  [AuthInvokeMethods.remove_provider]: {
    input: RemoveProviderInput;
    output: None;
  };
};
