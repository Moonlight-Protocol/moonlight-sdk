import { sha256Buffer } from "./sha256Buffer.ts";

export async function sha256Hash(data: Uint8Array): Promise<string> {
  // Compute the SHA-256 digest (returns an ArrayBuffer)
  const hashBuffer = await sha256Buffer(data);
  // Convert the ArrayBuffer to a Uint8Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convert each byte to a hex string and join them
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}
