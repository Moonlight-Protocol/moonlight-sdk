import * as asn1js from "asn1js";

// Helper: Encode ECPrivateKey (RFC 5915)
export function encodeECPrivateKey(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  // Build the ECPrivateKey structure:
  // ECPrivateKey ::= SEQUENCE {
  //   version        INTEGER { ecPrivkeyVer1(1) } (1),
  //   privateKey     OCTET STRING,
  //   parameters [0] EXPLICIT ECParameters OPTIONAL,
  //   publicKey  [1] EXPLICIT BIT STRING OPTIONAL
  // }
  const ecPrivateKeySeq = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 1 }), // version = 1
      new asn1js.OctetString({ valueHex: privateKey.buffer as ArrayBuffer }),
      // Optional: include the curve OID in an explicit [0] context-specific tag.
      new asn1js.Constructed({
        idBlock: { tagClass: 3, tagNumber: 0 },
        value: [new asn1js.ObjectIdentifier({ value: "1.2.840.10045.3.1.7" })],
      }),
      // Optional: include the public key as a BIT STRING in an explicit [1] tag.
      new asn1js.Constructed({
        idBlock: { tagClass: 3, tagNumber: 1 },
        value: [
          new asn1js.BitString({ valueHex: publicKey.buffer as ArrayBuffer }),
        ],
      }),
    ],
  });
  return new Uint8Array(ecPrivateKeySeq.toBER(false));
}
