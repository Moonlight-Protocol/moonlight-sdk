import { xdr } from "@stellar/stellar-sdk";
import { type InvocationParams, paramsToAuthEntry } from "./auth-entries.ts";

export const generateBundleAuthEntry = ({
  channelId,
  authId,
  args,
  nonce,
  signatureExpirationLedger,
  signaturesXdr,
}: {
  channelId: string;
  authId: string;
  args: xdr.ScVal[];
  nonce: string;
  signatureExpirationLedger: number;
  signaturesXdr?: string;
}): xdr.SorobanAuthorizationEntry => {
  const rootInvocationParams = {
    function: {
      contractAddress: channelId,
      functionName: "transact",
      args,
    },
    subInvocations: [],
  } as InvocationParams;

  const entry = paramsToAuthEntry({
    credentials: {
      address: authId,
      nonce,
      signatureExpirationLedger,
      signature: signaturesXdr,
    },
    rootInvocation: rootInvocationParams,
  });

  return entry;
};
