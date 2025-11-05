import { signPayload } from "../../utils/secp256r1/signPayload.ts";
import { UTXOKeypairBase } from "../utxo-keypair-base/index.ts";
import type { BaseDerivator } from "../../derivation/base/index.ts";
import {
  type BalanceFetcher,
  type IUTXOKeypair,
  type UTXOKeypairOptions,
  UTXOStatus,
} from "./types.ts";

/**
 * Enhanced UTXOKeypair with state management capabilities
 * Represents a keypair that can be used for UTXOs in privacy-preserving protocols
 */
export class UTXOKeypair<
    Context extends string = string,
    Index extends string = string
  >
  extends UTXOKeypairBase
  implements IUTXOKeypair<Context, Index>
{
  // Derivation information - immutable after creation
  readonly context: Context;
  readonly index: Index;

  // State information - mutable
  private _status: UTXOStatus = UTXOStatus.UNLOADED;
  private _balance: bigint = 0n;
  private _lastUpdated: number = 0;
  readonly decimals: number;

  // Optional balance fetcher for loading state
  private balanceFetcher?: BalanceFetcher;

  /**
   * Creates a new UTXOKeypair from a derivator
   *
   * @param derivator - The derivator to derive the keypair from
   * @param index - The index to use for derivation
   * @param options - Optional configuration for the UTXOKeypair
   * @returns A new UTXOKeypair instance
   * @throws Error if the derivator is not properly configured
   */
  static async fromDerivator<
    DContext extends string = string,
    DRoot extends string = string,
    DIndex extends string = string
  >(
    derivator: BaseDerivator<DContext, DRoot, DIndex>,
    index: DIndex,
    options: UTXOKeypairOptions = {}
  ): Promise<UTXOKeypair<DContext, DIndex>> {
    if (!derivator.isConfigured()) {
      throw new Error("Derivator is not properly configured");
    }

    const context = derivator.getContext();
    const keypair = await derivator.deriveKeypair(index);

    return new UTXOKeypair<DContext, DIndex>(
      {
        context,
        index,
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
      },
      options
    );
  }

  /**
   * Derives a sequence of UTXOKeypairs from a derivator
   *
   * @param derivator - The derivator to derive the keypairs from
   * @param startIdx - The starting index (inclusive)
   * @param count - The number of UTXOKeypairs to derive
   * @param options - Optional configuration for the UTXOKeypairs
   * @returns An array of UTXOKeypair instances
   * @throws Error if the derivator is not properly configured
   */
  static async deriveSequence<DContext extends string = string>(
    derivator: BaseDerivator<DContext, string, `${number}`>,
    startIdx: number,
    count: number,
    options: UTXOKeypairOptions = {}
  ): Promise<UTXOKeypair<DContext, `${number}`>[]> {
    if (!derivator.isConfigured()) {
      throw new Error("Derivator is not properly configured");
    }

    const utxos: UTXOKeypair<DContext, `${number}`>[] = [];

    for (let i = 0; i < count; i++) {
      const index = `${startIdx + i}` as `${number}`;
      const utxo = await UTXOKeypair.fromDerivator(derivator, index, options);
      utxos.push(utxo);
    }

    return utxos;
  }

  /**
   * Creates a new UTXOKeypair
   *
   * @param args - Constructor arguments including keypair data and derivation information
   * @param options - Optional configuration
   */
  constructor(
    args: {
      context: Context;
      index: Index;
      privateKey: Uint8Array;
      publicKey: Uint8Array;
    },
    options: UTXOKeypairOptions = {}
  ) {
    super({ privateKey: args.privateKey, publicKey: args.publicKey });

    this.context = args.context;
    this.index = args.index;
    this.decimals = options.decimals ?? 7;

    // Initialize the balance fetcher if provided
    if (options.balanceFetcher) {
      this.balanceFetcher = options.balanceFetcher;
    }

    // Auto-load if requested and balance fetcher is available
    if (options.autoLoad && this.balanceFetcher) {
      this.load();
    }
  }

  /**
   * Sets the balance fetcher for this UTXO
   * @param fetcher - The balance fetcher to use
   */
  setBalanceFetcher(fetcher: BalanceFetcher): void {
    this.balanceFetcher = fetcher;
  }

  /**
   * Gets the current status of the UTXO
   */
  get status(): UTXOStatus {
    return this._status;
  }

  /**
   * Sets the status of the UTXO
   */
  set status(value: UTXOStatus) {
    this._status = value;
  }

  /**
   * Gets the current balance of the UTXO
   */
  get balance(): bigint {
    return this._balance;
  }

  /**
   * Sets the balance of the UTXO
   */
  set balance(value: bigint) {
    this._balance = value;
  }

  /**
   * Gets the timestamp of the last update
   */
  get lastUpdated(): number {
    return this._lastUpdated;
  }

  /**
   * Sets the timestamp of the last update
   */
  set lastUpdated(value: number) {
    this._lastUpdated = value;
  }

  /**
   * Loads the current state of the UTXO from the network
   * @throws Error if no balance fetcher is set
   */
  async load(): Promise<void> {
    if (!this.balanceFetcher) {
      throw new Error(
        "Cannot load UTXO state: No balance fetcher set. Use setBalanceFetcher() first."
      );
    }

    try {
      const balance = await this.balanceFetcher.fetchBalance(this.publicKey);
      this.updateState(balance);
    } catch (error) {
      console.error("Failed to load UTXO state:", error);
      throw error;
    }
  }

  /**
   * Updates the state of the UTXO with new balance information
   * @param balance - The new balance value
   */
  updateState(balance: bigint): void {
    this._balance = balance;
    this._lastUpdated = Date.now();

    // Update the status based on the balance
    if (balance === 0n) {
      this._status = UTXOStatus.FREE;
    } else if (balance > 0n) {
      this._status = UTXOStatus.UNSPENT;
    } else {
      this._status = UTXOStatus.SPENT;
    }
  }

  /**
   * Signs a payload using the private key
   * @param payload - The data to sign
   * @returns The signature as a Buffer
   */
  async sign(payload: Uint8Array): Promise<Uint8Array> {
    return await signPayload(this.privateKey, payload);
  }

  /**
   * Checks if the UTXO is in the UNSPENT status
   */
  isUnspent(): boolean {
    return this._status === UTXOStatus.UNSPENT;
  }

  /**
   * Checks if the UTXO is in the SPENT status
   */
  isSpent(): boolean {
    return this._status === UTXOStatus.SPENT;
  }

  /**
   * Checks if the UTXO is in the FREE status
   */
  isFree(): boolean {
    return this._status === UTXOStatus.FREE;
  }

  /**
   * Checks if the UTXO is in the UNLOADED status
   */
  isUnloaded(): boolean {
    return this._status === UTXOStatus.UNLOADED;
  }
}
