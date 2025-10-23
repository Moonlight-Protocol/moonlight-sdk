import { xdr, hash } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { sha256Buffer } from "../../utils/hash/sha256Buffer.ts";

export const buildOperationAuthEntryHash = async (params: {
  network: string;
  rootInvocation: xdr.SorobanAuthorizedInvocation;
  nonce: string;
  signatureExpirationLedger: number;
}): Promise<Buffer> => {
  const networkId = hash(Buffer.from(params.network));

  const preImageInner = new xdr.HashIdPreimageSorobanAuthorization({
    networkId,
    nonce: xdr.Int64.fromString(params.nonce),
    signatureExpirationLedger: params.signatureExpirationLedger,
    invocation: params.rootInvocation,
  });

  const preImage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    preImageInner,
  );

  const payload = preImage.toXDR();
  return Buffer.from(await sha256Buffer(payload));
};


