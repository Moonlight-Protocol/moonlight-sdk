import { Buffer } from "buffer";
import type { SpendOperation } from "../../operation/types.ts";

export const orderSpendByUtxo = (spend: SpendOperation[]): SpendOperation[] => {
  return [...spend].sort((a, b) =>
    Buffer.from(a.getUtxo()).compare(Buffer.from(b.getUtxo()))
  );
};
