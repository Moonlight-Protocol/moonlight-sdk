// converts a number to a big-endian byte array
export function numberToBytesBE(num: bigint, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[byteLength - 1 - i] = Number(
      (num >> (BigInt(8) * BigInt(i))) & BigInt(0xff)
    );
  }
  return bytes;
}
