import type { DefaultAccountHandler } from "stellar-plus/lib/stellar-plus/account";
import type { TransactionInvocation } from "stellar-plus/lib/stellar-plus/types";

/**
 * Creates a default transaction invocation object
 * @param account The account handler to use as the transaction source
 * @param options Optional configuration for the transaction
 * @returns A transaction invocation object
 */
export function createTxInvocation(
  account: typeof DefaultAccountHandler.prototype,
  options?: {
    fee?: string;
    timeout?: number;
  },
): TransactionInvocation {
  return {
    header: {
      source: account.getPublicKey(),
      fee: options?.fee ?? "10000000", // 1 XLM base fee
      timeout: options?.timeout ?? 30,
    },
    signers: [account],
  };
}
