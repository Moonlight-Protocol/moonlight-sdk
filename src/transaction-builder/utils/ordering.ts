import { Buffer } from "buffer";
import { SpendOperation } from "../types.ts";

export const orderSpendByUtxo = (spend: SpendOperation[]): SpendOperation[] => {
  return [...spend].sort((a, b) =>
    Buffer.from(a.utxo).compare(Buffer.from(b.utxo))
  );
};


