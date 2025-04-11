// converts a byte array to a big integer in big-endian order
export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (const byte of bytes) {
    result = (result << BigInt(8)) + BigInt(byte);
  }
  return result;
}
