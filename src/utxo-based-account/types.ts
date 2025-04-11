import { UTXOKeypair } from "../core/utxo-keypair/index.ts";

/**
 * Result of UTXO selection for transfers
 */
export interface UTXOSelectionResult<Context extends string> {
  selectedUTXOs: UTXOKeypair<Context>[];
  totalAmount: bigint;
  changeAmount: bigint;
}
