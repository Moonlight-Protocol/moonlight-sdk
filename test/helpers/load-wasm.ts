import { Buffer } from "node:buffer";

export function loadContractWasm(filename: string): Buffer {
  const wasm = Deno.readFileSync(`./test/contracts/${filename}.wasm`);

  return Buffer.from(wasm);
}
