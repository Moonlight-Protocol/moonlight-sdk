import type {
  IUTXOKeypairBase,
  UTXOPublicKey,
} from "../utxo-keypair-base/types.ts";

/**
 * Interface for fetching balance information for UTXOs
 * Abstracts the network-specific logic for retrieving balances
 */
export interface BalanceFetcher {
  /**
   * Fetches the balance for a given public key
   * @param publicKey - The public key to fetch balance for
   * @returns Promise resolving to the balance as a bigint
   */
  fetchBalance(publicKey: UTXOPublicKey): Promise<bigint>;
}

export interface IUTXOKeypair<
  Context extends string = string,
  Index extends string = string
> extends IUTXOKeypairBase {
  readonly context: Context;
  readonly index: Index;

  status: UTXOStatus;
  balance: bigint;
  decimals: number;
  lastUpdated: number;

  /**
   * Sets the balance fetcher for later use
   * @param fetcher - Balance fetcher to use for load operations
   */
  setBalanceFetcher(fetcher: BalanceFetcher): void;

  /**
   * Loads the current state of the UTXO from the network
   * @throws Error if no balance fetcher is set
   * @returns Promise that resolves when loading is complete
   */
  load(): Promise<void>;

  /**
   * Updates the state of the UTXO with new balance information
   * @param balance - The new balance value
   */
  updateState(balance: bigint): void;

  /**
   * Checks if the UTXO is in the UNSPENT status
   * @returns true if the UTXO is unspent
   */
  isUnspent(): boolean;

  /**
   * Checks if the UTXO is in the SPENT status
   * @returns true if the UTXO is spent
   */
  isSpent(): boolean;

  /**
   * Checks if the UTXO is in the FREE status
   * @returns true if the UTXO is free
   */
  isFree(): boolean;

  /**
   * Checks if the UTXO is in the UNLOADED status
   * @returns true if the UTXO is unloaded
   */
  isUnloaded(): boolean;
}

export enum UTXOStatus {
  UNLOADED = "unloaded",
  SPENT = "spent",
  UNSPENT = "unspent",
  FREE = "free",
}

/**
 * Options for creating a new UTXOKeypair
 */
export interface UTXOKeypairOptions {
  /**
   * The decimal precision for the UTXO's asset
   * @default 7 (for Stellar's standard precision)
   */
  decimals?: number;

  /**
   * Optional balance fetcher for loading UTXO state
   */
  balanceFetcher?: BalanceFetcher;

  /**
   * Whether to automatically load the UTXO's state on creation
   * Requires balanceFetcher to be provided
   */
  autoLoad?: boolean;
}
