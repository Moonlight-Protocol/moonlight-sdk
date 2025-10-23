import type { xdr } from "@stellar/stellar-sdk";
import { generateBundleAuthEntry } from "../../utils/auth/bundle-auth-entry.ts";

export const buildBundleAuthEntry = (args: {
  channelId: string;
  authId: string;
  args: xdr.ScVal[];
  nonce: string;
  signatureExpirationLedger: number;
  signaturesXdr?: string;
}): xdr.SorobanAuthorizationEntry => {
  return generateBundleAuthEntry(args);
};
