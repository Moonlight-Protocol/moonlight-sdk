import type { UTXOKeypair } from "../core/utxo-keypair/index.ts";
import { BaseDerivator } from "../derivation/base/index.ts";

/**
 * Result of UTXO selection for transfers
 */
export interface UTXOSelectionResult<Context extends string> {
  selectedUTXOs: UTXOKeypair<Context>[];
  totalAmount: bigint;
  changeAmount: bigint;
}

export type UTXOBasedAccountContructorArgs<
  Context extends string,
  Root extends string,
  Index extends `${number}`,
> = {
  derivator: BaseDerivator<Context, Root, Index>;
  root: Root;
  options?: {
    batchSize?: number;
    fetchBalances?: (publicKeys: Uint8Array[]) => Promise<bigint[]>;
    startIndex?: number;
    maxReservationAgeMs?: number;
  };
};
