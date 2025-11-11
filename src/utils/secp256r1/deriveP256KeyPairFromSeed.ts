import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";
import { mapHashToField } from "@noble/curves/abstract/modular";

import { bytesToBigIntBE } from "../conversion/bytesToBigIntBE.ts";
import { numberToBytesBE } from "../conversion/numberToBytesBE.ts";
import { encodePKCS8 } from "./encodePKCS8.ts";

/**
 * Deterministically derive a P-256 key pair from a given 32-byte seed.
 *
 * @param seed A Uint8Array (expected length 32) containing a SHA-256 hash.
 * @returns An object with publicKey and privateKey as Uint8Array.
 */
export async function deriveP256KeyPairFromSeed(
  seed: Uint8Array,
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  // Expand the seed to 48 bytes to eliminate bias (per FIPS 186-5 / RFC 9380)
  const info = "application"; // adjust as needed
  const expanded = hkdf(sha256, seed, undefined, info, 48);

  // Use mapHashToField instead of the deprecated hashToPrivateScalar.
  // mapHashToField returns a Uint8Array; then convert it to a bigint.
  const privateScalarBytes = mapHashToField(expanded, p256.CURVE.n);
  const privateScalar = bytesToBigIntBE(privateScalarBytes);

  // Convert the bigint into a 32-byte Uint8Array (big-endian)
  const rawPrivateKey = numberToBytesBE(privateScalar, 32);

  // Derive the public key; false means uncompressed (65 bytes: 0x04 || X || Y).
  const publicKey = p256.getPublicKey(rawPrivateKey, false);

  // Encode the raw private key into a PKCS#8 structure.
  const pkcs8PrivateKey = encodePKCS8(rawPrivateKey, publicKey);

  // Return keypair components directly instead of creating a UTXOKeypair instance
  return await { privateKey: pkcs8PrivateKey, publicKey };
}
