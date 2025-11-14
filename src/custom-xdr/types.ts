import { Buffer } from "buffer";

export enum MLXDRTypeByte {
  CreateCondition = 0x01,
  DepositCondition = 0x02,
  WithdrawCondition = 0x03,
  CreateOperation = 0x04,
  SpendOperation = 0x05,
  DepositOperation = 0x06,
  WithdrawOperation = 0x07,
  OperationsBundle = 0x08,
  TransactionBundle = 0x09,
}

export const MLXDRPrefix: Buffer = Buffer.from([0x30, 0xb0]);

export const MLXDRConditionBytes = [
  MLXDRTypeByte.CreateCondition,
  MLXDRTypeByte.DepositCondition,
  MLXDRTypeByte.WithdrawCondition,
];
