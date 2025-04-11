export interface IUTXOKeypairBase {
  privateKey: Uint8Array;
  publicKey: Uint8Array;

  signPayload(payload: Uint8Array): Promise<Uint8Array>;
}
