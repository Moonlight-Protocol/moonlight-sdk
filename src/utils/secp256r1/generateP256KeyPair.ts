import type { UTXOPublicKey } from "../../core/utxo-keypair-base/types.ts";

export async function generateP256KeyPair(): Promise<{
  privateKey: Uint8Array;
  publicKey: UTXOPublicKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true, // Extractable
    ["sign", "verify"] // Key usages
  );

  // Export keys as raw and PKCS8 format
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );

  return {
    privateKey: new Uint8Array(privateKey),
    publicKey: new Uint8Array(publicKey),
  };
}
