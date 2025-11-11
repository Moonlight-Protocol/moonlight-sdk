/**
 *
 * Module for converting conditions to custom Moonlight XDR format.
 *
 * All custom XDR encoded for Moonlight are a BASE64 string prefixed by 'ML' to distinguish them from standard Stellar XDR.
 *
 * The first byte after the prefix indicates the object type:
 *  E.g: Given a Create Condition, the first byte after 'ML' would be 0x01.
 *
 *
 * Example ML XDR encoding for a Spend Operation:
 * - Decoded Bytes:
 *   - 0x30 0xb0: 'ML' Prefix
 *   - 0x05: Type Byte for Spend Operation
 *   - 0x...: Actual XDR Data
 */

import { Buffer } from "buffer";
import { MLXDRPrefix, MLXDRTypeByte } from "./types.ts";
import type { Condition as ConditionType } from "../conditions/types.ts";
import { nativeToScVal, scValToBigInt, xdr } from "@stellar/stellar-sdk";
import { Condition } from "../conditions/index.ts";
import {
  type MoonlightOperation as MoonlightOperationType,
  type OperationSignature,
  UTXOOperationType,
} from "../operation/types.ts";
import { MoonlightOperation } from "../operation/index.ts";

const MLXDRConditionBytes = [
  MLXDRTypeByte.CreateCondition,
  MLXDRTypeByte.DepositCondition,
  MLXDRTypeByte.WithdrawCondition,
];

const MLXDROperationBytes = [
  MLXDRTypeByte.CreateOperation,
  MLXDRTypeByte.SpendOperation,
  MLXDRTypeByte.DepositOperation,
  MLXDRTypeByte.WithdrawOperation,
];

const MLXDRTransactionBundleBytes = [MLXDRTypeByte.TransactionBundle];

const isMLXDR = (data: string): boolean => {
  const buffer = Buffer.from(data, "base64");

  if (buffer.length < 2) {
    return false;
  }
  const prefix = buffer.slice(0, 2);
  return prefix.equals(MLXDRPrefix);
};

const getMLXDRTypePrefix = (data: string): Buffer => {
  if (!isMLXDR(data)) {
    throw new Error(`Data is not valid MLXDR format: ${data}`);
  }

  const buffer = Buffer.from(data, "base64");

  if (buffer.length < 3) {
    throw new Error("Data is too short to contain MLXDR type prefix");
  }

  return buffer.slice(2, 3);
};

const appendMLXDRPrefixToRawXDR = (
  data: string,
  typeByte: MLXDRTypeByte
): string => {
  const rawBuffer = Buffer.from(data, "base64");

  const prefix = Buffer.from([...MLXDRPrefix, typeByte]);

  const mlxdrBuffer = Buffer.alloc(rawBuffer.length + prefix.length);

  prefix.copy(mlxdrBuffer, 0);
  rawBuffer.copy(mlxdrBuffer, prefix.length);
  return mlxdrBuffer.toString("base64");
};

const isCondition = (data: string): boolean => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  return MLXDRConditionBytes.includes(prefixByte);
};

const isOperation = (data: string): boolean => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  return MLXDROperationBytes.includes(prefixByte);
};

const isTransactionBundle = (data: string): boolean => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  return MLXDRTransactionBundleBytes.includes(prefixByte);
};

const getXDRType = (data: string): MLXDRTypeByte | null => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  if (typePrefix.length === 0) {
    return null;
  }
  if (prefixByte >= 0x01 && prefixByte <= 0x0f) {
    return prefixByte as MLXDRTypeByte;
  }
  return null;
};

const conditionToMLXDR = (condition: ConditionType): string => {
  const rawScValXDR = condition.toXDR();

  let typeByte: MLXDRTypeByte;
  if (condition.isCreate()) typeByte = MLXDRTypeByte.CreateCondition;
  else if (condition.isDeposit()) typeByte = MLXDRTypeByte.DepositCondition;
  else if (condition.isWithdraw()) typeByte = MLXDRTypeByte.WithdrawCondition;
  else throw new Error("Unknown condition type for MLXDR conversion");

  return appendMLXDRPrefixToRawXDR(rawScValXDR, typeByte);
};

const MLXDRtoCondition = (data: string): ConditionType => {
  if (!isCondition(data)) {
    throw new Error("Data is not a valid MLXDR Condition");
  }

  const buffer = Buffer.from(data, "base64");
  const rawXDRBuffer = buffer.slice(3);
  const rawXDRString = rawXDRBuffer.toString("base64");

  const scVal = xdr.ScVal.fromXDR(rawXDRString, "base64");
  return Condition.fromScVal(scVal);
};

const operationSignatureToXDR = (args: {
  ed25519Signature?: xdr.SorobanAuthorizationEntry;
  utxoSignature?: OperationSignature;
}) => {
  const { ed25519Signature, utxoSignature } = args;

  if (ed25519Signature !== undefined) {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvBytes(ed25519Signature.toXDR("raw")),
    ]).toXDR("base64");
  } else if (utxoSignature !== undefined) {
    return xdr.ScVal.scvVec([
      nativeToScVal(utxoSignature.exp, { type: "i128" }),
      xdr.ScVal.scvBytes(utxoSignature.sig),
    ]).toXDR("base64");
  } else {
    return xdr.ScVal.scvVec([]).toXDR("base64");
  }
};

const operationSignatureFromXDR = (
  data: string
): xdr.SorobanAuthorizationEntry | OperationSignature | undefined => {
  const scVal = xdr.ScVal.fromXDR(data, "base64");
  if (scVal.switch().name !== xdr.ScValType.scvVec().name) {
    throw new Error("Invalid ScVal type for Signature");
  }

  const vec = scVal.vec();

  if (vec === null) {
    throw new Error("Invalid ScVal vector for Signature");
  }

  if (vec.length === 0) {
    return undefined;
  }

  // ed25519 signature
  if (vec.length === 1) {
    const sigXDR = vec[0];
    if (sigXDR.switch().name !== xdr.ScValType.scvBytes().name) {
      throw new Error("Invalid ScVal type for Ed25519 Signature");
    }

    return xdr.SorobanAuthorizationEntry.fromXDR(sigXDR.bytes(), "raw");
  }

  // UTXO signature
  if (vec.length === 2) {
    const expScVal = vec[0];
    const sigScVal = vec[1];

    if (expScVal.switch().name !== xdr.ScValType.scvI128().name) {
      throw new Error("Invalid ScVal type for UTXO Signature Expiration");
    }
    if (sigScVal.switch().name !== xdr.ScValType.scvBytes().name) {
      throw new Error("Invalid ScVal type for UTXO Signature");
    }

    const exp = Number(scValToBigInt(expScVal));
    const sig = sigScVal.bytes();

    return { exp, sig };
  }
};

const operationToMLXDR = (operation: MoonlightOperationType): string => {
  const rawScValXDR = operation.toXDR();

  let typeByte: MLXDRTypeByte;
  let signatureXDR = operationSignatureToXDR({});
  if (operation.isCreate()) {
    typeByte = MLXDRTypeByte.CreateOperation;
  } else if (operation.isWithdraw()) {
    typeByte = MLXDRTypeByte.WithdrawOperation;
  } else if (operation.isDeposit()) {
    typeByte = MLXDRTypeByte.DepositOperation;

    if (operation.isSignedByEd25519()) {
      signatureXDR = operationSignatureToXDR({
        ed25519Signature: operation.getEd25519Signature(),
      });
    }
  } else if (operation.isSpend()) {
    typeByte = MLXDRTypeByte.SpendOperation;
    if (operation.isSignedByUTXO()) {
      signatureXDR = operationSignatureToXDR({
        utxoSignature: operation.getUTXOSignature(),
      });
    }
  } else {
    throw new Error("Unknown operation type for MLXDR conversion");
  }

  const operationXDRWithSignature = xdr.ScVal.scvVec([
    xdr.ScVal.fromXDR(rawScValXDR, "base64"),
    xdr.ScVal.fromXDR(signatureXDR, "base64"),
  ]).toXDR("base64");

  return appendMLXDRPrefixToRawXDR(operationXDRWithSignature, typeByte);
};

const MLXDRtoOperation = (data: string): MoonlightOperationType => {
  if (!isOperation(data)) {
    throw new Error("Data is not a valid MLXDR Operation");
  }

  const buffer = Buffer.from(data, "base64");
  const rawXDRBuffer = buffer.slice(3);
  const rawXDRString = rawXDRBuffer.toString("base64");

  const type = getXDRType(data);
  if (type === null) {
    throw new Error("Unable to determine MLXDR type for Operation");
  }
  const scVal = xdr.ScVal.fromXDR(rawXDRString, "base64");

  const vec = scVal.vec();

  if (vec === null || vec.length < 1 || vec.length > 2) {
    throw new Error("Invalid ScVal vector for operation");
  }

  const operationXDRScVal = vec[0];
  const signatureXDRScVal = vec.length === 2 ? vec[1] : undefined;

  if (type === MLXDRTypeByte.CreateOperation) {
    return MoonlightOperation.fromScVal(
      operationXDRScVal,
      UTXOOperationType.CREATE
    );
  } else if (type === MLXDRTypeByte.DepositOperation) {
    if (signatureXDRScVal !== undefined) {
      return MoonlightOperation.fromScVal(
        operationXDRScVal,
        UTXOOperationType.DEPOSIT
      ).appendEd25519Signature(
        operationSignatureFromXDR(
          signatureXDRScVal.toXDR("base64")
        ) as xdr.SorobanAuthorizationEntry
      );
    }
    return MoonlightOperation.fromScVal(
      operationXDRScVal,
      UTXOOperationType.DEPOSIT
    );
  } else if (type === MLXDRTypeByte.WithdrawOperation) {
    return MoonlightOperation.fromScVal(
      operationXDRScVal,
      UTXOOperationType.WITHDRAW
    );
  } else if (type === MLXDRTypeByte.SpendOperation) {
    if (signatureXDRScVal !== undefined) {
      return MoonlightOperation.fromScVal(
        operationXDRScVal,
        UTXOOperationType.SPEND
      ).appendUTXOSignature(
        operationSignatureFromXDR(
          signatureXDRScVal.toXDR("base64")
        ) as OperationSignature
      );
    }
    return MoonlightOperation.fromScVal(
      operationXDRScVal,
      UTXOOperationType.SPEND
    );
  } else {
    throw new Error("Unknown MLXDR type for Operation");
  }
};

/**
 * * MLXDR Module
 *
 * This module provides functions to work with Moonlight's custom XDR format (MLXDR).
 * It includes utilities to check if data is in MLXDR format, identify the type of MLXDR data,
 * and convert between standard Condition/Operation objects and their MLXDR representations.
 *
 * All MLXDR data is encoded as a BASE64 string prefixed with 'ML' to distinguish it from standard Stellar XDR.
 * The first byte after the prefix indicates the object type (e.g., Create Condition, Deposit Operation, etc.).
 *
 * Example MLXDR encoding for a Spend Operation:
 * - Decoded Bytes:
 *   - 0x30 0xb0: 'ML' Prefix
 *   - 0x05: Type Byte for Spend Operation
 *   - 0x...: Actual XDR Data
 *
 */
export const MLXDR = {
  is: isMLXDR,
  isCondition,
  isOperation,
  isTransactionBundle,
  getXDRType,
  fromCondition: conditionToMLXDR,
  toCondition: MLXDRtoCondition,
  fromOperation: operationToMLXDR,
  toOperation: MLXDRtoOperation,
};
