/**
 *
 * Module for converting conditions to custom Moonlight XDR format.
 *
 * All custom XDR encoded for Moonlight are prefixed by 'ML' to distinguish them from standard Stellar XDR.
 *
 * The first byte indicates the object type:
 * - 0x01: Condition
 * - 0x02: Operation
 * - 0x03: TransactionBundle
 * - 0x30 to 0xb0: Reserved for future use
 */

import { Buffer } from "buffer";

export enum MLXDRTypeByte {
  Condition = 0x01,
  Operation = 0x02,
  TransactionBundle = 0x03,
}

export const MLXDRPrefix = Buffer.from([0x30, 0xb0]);
