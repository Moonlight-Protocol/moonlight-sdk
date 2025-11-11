/**
 *
 * Module for converting conditions to custom Moonlight XDR format.
 *
 * All custom XDR encoded for Moonlight are a BASE64 string prefixed by 'ML' to distinguish them from standard Stellar XDR.
 *
 * The first byte after the prefix indicates the object type:
 * - 0x01: Condition
 * - 0x02: Operation
 * - 0x03: TransactionBundle
 * - 0x04 to 0x0F: Reserved for future use
 *
 * Example ML XDR encoding for a Condition:
 * - Base64 Encoded String: "MLBwxkYXRh..."
 * - Decoded Bytes:
 *   - 0x30 0xb0: 'ML' Prefix
 *   - 0x01: Condition Type Indicator
 *   - 0x...: Actual XDR Data
 */

import { Buffer } from "buffer";
import { MLXDRPrefix, MLXDRTypeByte } from "./types.ts";
import type { Condition as ConditionType } from "../conditions/types.ts";
import { xdr } from "@stellar/stellar-sdk";
import { Condition } from "../conditions/index.ts";

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
  return prefixByte === MLXDRTypeByte.Condition;
};

const isOperation = (data: string): boolean => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  return prefixByte === MLXDRTypeByte.Operation;
};

const isTransactionBundle = (data: string): boolean => {
  const typePrefix = getMLXDRTypePrefix(data);

  const prefixByte = typePrefix[0];
  return prefixByte === MLXDRTypeByte.TransactionBundle;
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
  return appendMLXDRPrefixToRawXDR(rawScValXDR, MLXDRTypeByte.Condition);
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

export const MLXDR = {
  is: isMLXDR,
  isCondition,
  isOperation,
  isTransactionBundle,
  getXDRType,
  fromCondition: conditionToMLXDR,
  toCondition: MLXDRtoCondition,
};
