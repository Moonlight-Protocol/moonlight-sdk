import { UtxoBasedAccount } from "../index.ts";
import type {
  StellarDerivationContext,
  StellarDerivationIndex,
  StellarDerivationRoot,
} from "../../derivation/stellar/types.ts";
import type { PrivacyChannel } from "../../privacy-channel/index.ts";
import type { UTXOBasedAccountConstructorArgs } from "../types.ts";

export class UtxoBasedStellarAccount extends UtxoBasedAccount<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
> {
  /**
   * Create a UTXO-based Stellar account handler from a PrivacyChannel instance.
   *
   * @param args - The arguments for creating the UTXO-based Stellar account handler.
   * @param args.channelClient - The PrivacyChannel instance to use.
   * @param args.root - The root derivation key for the Stellar account.
   * @param args.options - Additional options for the UTXO-based account handler.
   * @returns {UtxoBasedStellarAccount} A UTXO-based Stellar account handler.
   */
  static fromPrivacyChannel(args: {
    channelClient: PrivacyChannel;
    root: StellarDerivationRoot;
    options?: Omit<
      UTXOBasedAccountConstructorArgs<
        StellarDerivationContext,
        StellarDerivationRoot,
        StellarDerivationIndex
      >["options"],
      "fetchBalances"
    >;
  }): UtxoBasedStellarAccount {
    const { channelClient, root } = args;
    return new UtxoBasedStellarAccount({
      derivator: channelClient.getDerivator(),
      root,
      options: {
        ...(args.options ?? {}),
        fetchBalances: channelClient.getBalancesFetcher(),
      },
    });
  }
}
