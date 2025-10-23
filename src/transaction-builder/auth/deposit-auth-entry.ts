import type { xdr } from "@stellar/stellar-sdk";
import { generateDepositAuthEntry } from "../../utils/auth/deposit-auth-entry.ts";

export const buildDepositAuthEntry = (args: {
  channelId: string;
  assetId: string;
  depositor: string;
  amount: bigint;
  conditions: xdr.ScVal[];
  nonce: string;
  signatureExpirationLedger: number;
}): xdr.SorobanAuthorizationEntry => {
  return generateDepositAuthEntry(args);
};
