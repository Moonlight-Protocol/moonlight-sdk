import { xdr } from "@stellar/stellar-sdk";
import { FnArg, InvocationParams, paramsToAuthEntry } from "./auth-entries.ts";

export const generateDepositAuthEntry = ({
  channelId,
  assetId,
  depositor,
  amount,
  conditions,
  nonce,
  signatureExpirationLedger,
}: {
  channelId: string;
  assetId: string;
  depositor: string;
  amount: bigint;
  conditions: xdr.ScVal[];
  nonce: string;
  signatureExpirationLedger: number;
}): xdr.SorobanAuthorizationEntry => {
  const rootInvocationParams = {
    function: {
      contractAddress: channelId,
      functionName: "transact",
      args: conditions,
    },
    subInvocations: [
      {
        function: {
          contractAddress: assetId,
          functionName: "transfer",
          args: [
            { value: depositor, type: "address" },
            { value: channelId, type: "address" },
            { value: amount, type: "i128" },
          ] as FnArg[],
        },
        subInvocations: [],
      } as InvocationParams,
    ],
  } as InvocationParams;

  const entry = paramsToAuthEntry({
    credentials: {
      address: depositor,
      nonce,
      signatureExpirationLedger,
    },
    rootInvocation: rootInvocationParams,
  });

  return entry;
};
