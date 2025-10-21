// import { xdr, nativeToScVal } from "@stellar/stellar-sdk";
// import { Buffer } from "buffer";
// import type {
//   CreateOperation,
//   DepositOperation,
//   WithdrawOperation,
//   SpendOperation,
// } from "../types.ts";

// export const createOpToXDR = (op: CreateOperation): xdr.ScVal => {
//   return xdr.ScVal.scvVec([
//     xdr.ScVal.scvBytes(Buffer.from(op.utxo as Uint8Array)),
//     nativeToScVal(op.amount, { type: "i128" }),
//   ]);
// };

// export const depositOpToXDR = (op: DepositOperation): xdr.ScVal => {
//   return xdr.ScVal.scvVec([
//     nativeToScVal(op.pubKey, { type: "address" }),
//     nativeToScVal(op.amount, { type: "i128" }),
//     op.conditions.length === 0
//       ? xdr.ScVal.scvVec(null)
//       : xdr.ScVal.scvVec(op.conditions.map((c) => c.toScVal())),
//   ]);
// };

// export const withdrawOpToXDR = (op: WithdrawOperation): xdr.ScVal => {
//   return xdr.ScVal.scvVec([
//     nativeToScVal(op.pubKey, { type: "address" }),
//     nativeToScVal(op.amount, { type: "i128" }),
//     op.conditions.length === 0
//       ? xdr.ScVal.scvVec(null)
//       : xdr.ScVal.scvVec(op.conditions.map((c) => c.toScVal())),
//   ]);
// };

// export const spendOpToXDR = (op: SpendOperation): xdr.ScVal => {
//   return xdr.ScVal.scvVec([
//     xdr.ScVal.scvBytes(Buffer.from(op.utxo as Uint8Array)),
//     op.conditions.length === 0
//       ? xdr.ScVal.scvVec(null)
//       : xdr.ScVal.scvVec(op.conditions.map((c) => c.toScVal())),
//   ]);
// };
