import { Buffer } from "buffer";

export async function signPayload(
  payload: Uint8Array,
  privateKeyBytes: Uint8Array
): Promise<Uint8Array> {
  // Import the private key from the raw PKCS8 format
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", // Format of the private key
    privateKeyBytes, // Raw private key bytes
    { name: "ECDSA", namedCurve: "P-256" }, // Algorithm details
    false, // Non-extractable
    ["sign"] // Usage
  );

  // Sign the payload
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } }, // Algorithm and hash
    privateKey, // Private key to sign with
    payload // Data to sign
  );

  // Convert signature to Uint8Array
  const signatureBytes = new Uint8Array(signature);

  // Log the entire signature for debugging

  // **Assumption:** The signature is in raw R||S format (64 bytes)
  if (signatureBytes.length !== 64) {
    throw new Error(
      `Unexpected signature format: expected 64 bytes, got ${signatureBytes.length}`
    );
  }

  // Extract r and s
  const r = signatureBytes.slice(0, 32);
  const s = signatureBytes.slice(32, 64);

  // Curve order Q for secp256r1 (P-256)
  const curveOrder = BigInt(
    "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
  );

  // Convert s to BigInt
  const sHex = Buffer.from(s).toString("hex");

  if (!sHex || sHex.length === 0) {
    throw new Error("Invalid s value: empty or malformed");
  }

  let sValue = BigInt(`0x${sHex}`);
  const halfOrder = curveOrder / BigInt(2);

  // Normalize s to be in the low-S range
  if (sValue > halfOrder) {
    sValue = curveOrder - sValue;
  }

  // Convert sValue back to a 32-byte buffer
  const sLowSHex = sValue.toString(16).padStart(64, "0");
  const sLowS = Buffer.from(sLowSHex, "hex");

  // Ensure r is exactly 32 bytes (it should be)
  if (r.length !== 32) {
    throw new Error(`Invalid r length: expected 32 bytes, got ${r.length}`);
  }

  // Ensure sLowS is exactly 32 bytes
  if (sLowS.length !== 32) {
    throw new Error(
      `Invalid normalized s length: expected 32 bytes, got ${sLowS.length}`
    );
  }

  // Concatenate r and sLowS
  const concatSignature = Buffer.concat([r, sLowS]);

  // Return as Uint8Array
  return new Uint8Array(concatSignature);
}
