/**
 * Generates a random nonce as a string representation of an int64.
 *
 * @returns A string representing a random int64 value between 0 and 2^63-1
 */
export function generateNonce(): string {
  // Generate random bytes and convert to bigint
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // Convert bytes to bigint, ensuring it's positive
  let randomBigInt = 0n;
  for (let i = 0; i < 8; i++) {
    randomBigInt = (randomBigInt << 8n) + BigInt(randomBytes[i]);
  }

  // Ensure it's within int64 range (remove sign bit)
  randomBigInt = randomBigInt & 0x7fffffffffffffffn;

  return randomBigInt.toString();
}
