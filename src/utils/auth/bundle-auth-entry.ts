import type { xdr } from "@stellar/stellar-sdk";
import { xdr as xdrHelper, type InvocationParams } from "@colibri/core";

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

  const entry = xdrHelper.paramsToAuthEntry({
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
