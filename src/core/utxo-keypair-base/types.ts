export interface IUTXOKeypairBase {
  privateKey: Uint8Array;
  publicKey: UTXOPublicKey;

  signPayload(payload: Uint8Array): Promise<Uint8Array>;
}

export type UTXOPublicKey = Uint8Array;
