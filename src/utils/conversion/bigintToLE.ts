//conver bigint to little endian
export function bigintToLE(amount: bigint, byteLength: number): Uint8Array {
  const result = new Uint8Array(byteLength);
  let temp = amount;
  for (let i = 0; i < byteLength; i++) {
    result[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  return result;
}
