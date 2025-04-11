import * as asn1js from "asn1js";
import { encodeECPrivateKey } from "./encodeECPrivateKey.ts";

export function encodePKCS8(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  // First, encode the inner ECPrivateKey structure.
  const ecPrivateKeyDer = encodeECPrivateKey(privateKey, publicKey);

  // Build the AlgorithmIdentifier for EC keys.
  // For P-256, the OIDs are:
  //   id-ecPublicKey: 1.2.840.10045.2.1
  //   prime256v1:    1.2.840.10045.3.1.7
  const algorithmIdentifier = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: "1.2.840.10045.2.1" }),
      new asn1js.ObjectIdentifier({ value: "1.2.840.10045.3.1.7" }),
    ],
  });

  // PKCS#8 structure (PrivateKeyInfo) is:
  // PrivateKeyInfo ::= SEQUENCE {
  //   version                   INTEGER,  -- 0
  //   privateKeyAlgorithm       AlgorithmIdentifier,
  //   privateKey                OCTET STRING,
  //   attributes           [0]  IMPLICIT SET OF Attribute OPTIONAL
  // }
  const pkcs8Seq = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 0 }), // version = 0
      algorithmIdentifier,
      new asn1js.OctetString({
        valueHex: ecPrivateKeyDer.buffer as ArrayBuffer,
      }),
    ],
  });

  return new Uint8Array(pkcs8Seq.toBER(false));
}
