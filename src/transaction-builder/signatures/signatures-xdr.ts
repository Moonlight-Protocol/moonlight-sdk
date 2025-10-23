import { xdr, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export type SpendInnerSignature = { utxo: Uint8Array; sig: Buffer; exp: number };
export type ProviderInnerSignature = {
  pubKey: string;
  sig: Buffer;
  exp: number;
};

export const buildSignaturesXDR = (
  spendSignatures: SpendInnerSignature[],
  providerSignatures: ProviderInnerSignature[],
): string => {
  const orderedSpendSigners = [...spendSignatures].sort((a, b) =>
    Buffer.from(a.utxo).compare(Buffer.from(b.utxo))
  );
  const orderedProviderSigners = [...providerSignatures].sort((a, b) =>
    a.pubKey.localeCompare(b.pubKey)
  );

  const entries: xdr.ScMapEntry[] = [];

  for (const { utxo, sig, exp } of orderedSpendSigners) {
    entries.push(
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("P256"),
          xdr.ScVal.scvBytes(Buffer.from(utxo)),
        ]),
        val: xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("P256"),
            xdr.ScVal.scvBytes(sig),
          ]),
          xdr.ScVal.scvU32(exp),
        ]),
      }),
    );
  }

  for (const { pubKey, sig, exp } of orderedProviderSigners) {
    entries.push(
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("Provider"),
          xdr.ScVal.scvBytes(StrKey.decodeEd25519PublicKey(pubKey)),
        ]),
        val: xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("Ed25519"),
            xdr.ScVal.scvBytes(sig),
          ]),
          xdr.ScVal.scvU32(exp),
        ]),
      }),
    );
  }

  const signatures = xdr.ScVal.scvVec([xdr.ScVal.scvMap(entries)]);
  return signatures.toXDR("base64");
};


