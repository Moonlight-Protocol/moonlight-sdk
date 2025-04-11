import { signPayload } from "../../utils/secp256r1/signPayload.ts";
import type { IUTXOKeypairBase } from "./types.ts";

export class UTXOKeypairBase implements IUTXOKeypairBase {
  privateKey: Uint8Array;
  publicKey: Uint8Array;

  constructor(args: { privateKey: Uint8Array; publicKey: Uint8Array }) {
    this.privateKey = args.privateKey;
    this.publicKey = args.publicKey;
  }

  async signPayload(payload: Uint8Array): Promise<Uint8Array> {
    return await signPayload(payload, this.privateKey);
  }
}
