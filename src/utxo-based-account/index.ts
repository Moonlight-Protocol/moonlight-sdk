import { UTXOKeypair } from "../core/utxo-keypair/index.ts";
import { UTXOStatus } from "../core/utxo-keypair/types.ts";
import type { BaseDerivator } from "../derivation/base/index.ts";
import { UTXOSelectionStrategy } from "./selection-strategy.ts";
import type {
  UTXOBasedAccountConstructorArgs,
  UTXOSelectionResult,
} from "./types.ts";
import * as E from "./error.ts";
import { assert } from "../utils/assert/assert.ts";
import { type MoonlightTracer, withTrace, withTraceSync } from "../tracing/index.ts";
/**
 * Manages UTXO-based accounts with advanced features for privacy-focused blockchain operations
 */
export class UtxoBasedAccount<
  Context extends string,
  Root extends string,
  Index extends `${number}`,
> {
  private derivator: BaseDerivator<Context, Root, Index>;
  private readonly root: Root;
  private batchSize: number;
  private fetchBalances?: (publicKeys: Uint8Array[]) => Promise<bigint[]>;
  private readonly maxReservationAgeMs: number;
  private tracer?: MoonlightTracer;

  // Primary storage: index -> UTXO
  private utxos: Map<number, UTXOKeypair<Context, Index>> = new Map();

  // Derived index: status -> Set of indices
  private statusIndex: Map<UTXOStatus, Set<number>> = new Map(
    Object.values(UTXOStatus).map((status) => [status, new Set()]),
  );

  // Track reserved UTXOs with timestamps (index -> timestamp)
  private reservations: Map<number, number> = new Map();

  // Track the next index to derive
  private nextIndex: number = 1;

  /**
   * Gets the total balance of all unspent UTXOs
   *
   * @returns The sum of all unspent UTXO balances
   */
  getTotalBalance(): bigint {
    const unspentUtxos = this.getUTXOsByState(UTXOStatus.UNSPENT);
    return unspentUtxos.reduce((sum, utxo) => sum + utxo.balance, 0n);
  }

  /**
   * Creates a new UtxoBasedAccount instance
   */
  constructor(args: UTXOBasedAccountConstructorArgs<Context, Root, Index>) {
    this.root = args.root;
    this.derivator = args.derivator;
    this.derivator.withRoot(this.root);
    this.batchSize = args.options?.batchSize ?? 50;
    this.fetchBalances = args.options?.fetchBalances;
    this.nextIndex = args.options?.startIndex ?? 1;
    this.maxReservationAgeMs = args.options?.maxReservationAgeMs ?? 300000; // Default 5 minutes
    this.tracer = args.options?.tracer;
  }

  private createProxy(
    utxo: UTXOKeypair<Context, Index>,
  ): UTXOKeypair<Context, Index> {
    return new Proxy(utxo, {
      set: (
        target: UTXOKeypair<Context, Index>,
        prop: keyof UTXOKeypair<Context, Index>,
        value: unknown,
      ) => {
        const oldStatus = prop === "status" ? target[prop] : null;
        // @ts-ignore - we know the type is compatible
        target[prop] = value;

        // Update status index if status changed
        if (prop === "status" && oldStatus !== value) {
          const index = Number(target.index);
          if (oldStatus) {
            this.statusIndex.get(oldStatus)?.delete(index);
          }
          this.statusIndex.get(value as UTXOStatus)?.add(index);
        }

        return true;
      },
    });
  }

  /**
   * Derives UTXOs starting from a given index or the next available index.
   * When count is provided, derives exactly that many UTXOs.
   * When count is omitted, derives one batch of UTXOs (this.batchSize).
   */
  async deriveBatch({
    startIndex = this.nextIndex,
    count = this.batchSize,
  }: {
    startIndex?: number;
    count?: number;
  }): Promise<number[]> {
    return withTrace(this.tracer, "UtxoBasedAccount.deriveBatch", async (span) => {
      assert(startIndex >= 0, new E.NEGATIVE_INDEX(startIndex));
      assert(count > 0, new E.UTXO_TO_DERIVE_TOO_LOW(count));

      span.addEvent("deriving_utxos", {
        "derive.startIndex": startIndex,
        "derive.count": count,
      });

      const derivedIndices: number[] = [];

      for (let i = 0; i < count; i++) {
        const utxoIndex = startIndex + i;
        const keypair = await UTXOKeypair.fromDerivator(
          this.derivator,
          `${utxoIndex}` as Index,
        );

        const proxiedKeypair = this.createProxy(keypair);
        this.utxos.set(utxoIndex, proxiedKeypair);
        proxiedKeypair.balance = -1n;
        proxiedKeypair.status = UTXOStatus.FREE;
        derivedIndices.push(utxoIndex);
      }

      this.nextIndex = Math.max(this.nextIndex, startIndex + count);

      span.addEvent("derivation_complete", { "derived.count": derivedIndices.length });
      return derivedIndices;
    });
  }

  /**
   * Loads balances for UTXOs in batch, updating their states based on balance information
   *
   * @param states Optional array of states to filter UTXOs for loading (defaults to all states)
   * @param indices Optional array of specific indices to load
   */
  async batchLoad(states?: UTXOStatus[], indices?: number[]): Promise<void> {
    return withTrace(this.tracer, "UtxoBasedAccount.batchLoad", async (span) => {
      assert(this.fetchBalances, new E.MISSING_BATCH_FETCH_FN());

      const utxosToCheck = Array.from(this.utxos.entries()).filter(
        ([index, utxo]) =>
          (!states || states.includes(utxo.status)) &&
          (!indices || indices.includes(index)),
      );

      span.addEvent("loading_balances", { "utxos.count": utxosToCheck.length });

      for (let i = 0; i < utxosToCheck.length; i += this.batchSize) {
        const batchEntries = utxosToCheck.slice(i, i + this.batchSize);
        const publicKeys = batchEntries.map(([, utxo]) => utxo.publicKey);
        const balances = await this.fetchBalances(publicKeys);

        batchEntries.forEach(([index, utxo], idx) => {
          const balance = balances[idx];
          utxo.balance = balance;

          if (balance > 0n) {
            utxo.status = UTXOStatus.UNSPENT;
          } else if (balance === 0n) {
            utxo.status = UTXOStatus.SPENT;
          } else {
            utxo.status = UTXOStatus.FREE;
          }

          if (balance > 0n && this.isReserved(index)) {
            this.unreserve(index);
          }
        });
      }

      span.addEvent("balances_loaded");
    });
  }

  /**
   * Reserves a specified number of free UTXOs for a transaction
   *
   * @param count Number of UTXOs to reserve
   * @returns The reserved UTXOs or null if not enough free UTXOs are available
   */
  reserveUTXOs(count: number): UTXOKeypair<Context, Index>[] | null {
    // Find truly free UTXOs that aren't already reserved
    const freeUtxos = this.getFreeUTXOs();

    if (freeUtxos.length < count) {
      return null;
    }

    // Get the first N free UTXOs
    const toReserve = freeUtxos.slice(0, count);

    // Mark them as reserved with a timestamp
    const now = Date.now();
    toReserve.forEach((utxo) => {
      this.reservations.set(Number(utxo.index), now);
    });

    return toReserve;
  }

  /**
   * Gets UTXOs that have FREE status and are not currently reserved
   */
  private getFreeUTXOs(): UTXOKeypair<Context, Index>[] {
    return this.getUTXOsByState(UTXOStatus.FREE).filter(
      (utxo) => !this.isReserved(Number(utxo.index)),
    );
  }

  /**
   * Checks if a UTXO is currently reserved
   */
  private isReserved(index: number): boolean {
    return this.reservations.has(index);
  }

  /**
   * Removes the reservation for a UTXO
   */
  private unreserve(index: number): void {
    this.reservations.delete(index);
  }

  /**
   * Selects unspent UTXOs that total at least the requested amount
   *
   * @param amount Amount needed
   * @param strategy Selection strategy (sequential or random)
   * @returns Selected UTXOs, total amount, and change amount or null if not enough funds
   */
  selectUTXOsForTransfer(
    amount: bigint,
    strategy: UTXOSelectionStrategy = UTXOSelectionStrategy.SEQUENTIAL,
  ): UTXOSelectionResult<Context> | null {
    return withTraceSync(this.tracer, "UtxoBasedAccount.selectUTXOsForTransfer", (span) => {
      const unspentUtxos = this.getUTXOsByState(UTXOStatus.UNSPENT);

      span.addEvent("unspent_utxos_found", { "utxos.count": unspentUtxos.length });

      if (strategy === UTXOSelectionStrategy.RANDOM) {
        // Fisher-Yates shuffle for random selection
        for (let i = unspentUtxos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unspentUtxos[i], unspentUtxos[j]] = [unspentUtxos[j], unspentUtxos[i]];
        }
      }

      let totalAmount = 0n;
      const selectedUTXOs: UTXOKeypair<Context, Index>[] = [];

      for (const utxo of unspentUtxos) {
        selectedUTXOs.push(utxo);
        totalAmount += utxo.balance;

        if (totalAmount >= amount) {
          break;
        }
      }

      // If we couldn't accumulate enough funds, return null
      if (totalAmount < amount) {
        span.addEvent("insufficient_funds", {
          "total.available": totalAmount.toString(),
          "amount.requested": amount.toString(),
        });
        return null;
      }

      // Calculate change amount
      const changeAmount = totalAmount - amount;

      span.addEvent("selection_complete", {
        "selected.count": selectedUTXOs.length,
        "total.amount": totalAmount.toString(),
        "change.amount": changeAmount.toString(),
      });

      return {
        selectedUTXOs,
        totalAmount,
        changeAmount,
      };
    }, {
      "select.amount": amount.toString(),
      "select.strategy": strategy,
    });
  }

  /**
   * Gets all UTXOs with a specific state
   *
   * @param state The state to filter UTXOs by
   * @returns Array of UTXOs with the specified state
   */
  getUTXOsByState(state: UTXOStatus): UTXOKeypair<Context, Index>[] {
    const indices = this.statusIndex.get(state) ?? new Set();
    return Array.from(indices).map((index) => this.utxos.get(index)!);
  }

  /**
   * Updates the state of a UTXO by its index
   *
   * @param index The index of the UTXO to update
   * @param newState The new state for the UTXO
   * @param balance Optional new balance for the UTXO
   */
  updateUTXOState(index: number, newState: UTXOStatus, balance?: bigint): void {
    const utxo = this.utxos.get(index);

    assert(utxo, new E.MISSING_UTXO_FOR_INDEX(index));

    if (balance !== undefined) {
      utxo.balance = balance;
    }

    // Status update will automatically update the status index via proxy
    utxo.status = newState;

    // Handle reservations
    if (newState === UTXOStatus.UNSPENT && this.isReserved(index)) {
      this.unreserve(index);
    }
  }

  /**
   * Gets the UTXO at the specified index
   *
   * @param index The index of the UTXO to retrieve
   * @returns The UTXO if it exists, undefined otherwise
   */
  getUTXO(index: number): UTXOKeypair<Context> | undefined {
    return this.utxos.get(index);
  }

  /**
   * Gets all UTXOs managed by this account
   *
   * @returns Array of all UTXOs
   */
  getAllUTXOs(): UTXOKeypair<Context>[] {
    return Array.from(this.utxos.values());
  }

  /**
   * Gets all reserved UTXOs
   *
   * @returns Array of reserved UTXOs
   */
  getReservedUTXOs(): UTXOKeypair<Context>[] {
    return Array.from(this.reservations.keys())
      .map((index) => this.getUTXO(index))
      .filter(
        (utxo): utxo is UTXOKeypair<Context, Index> => utxo !== undefined,
      );
  }

  /**
   * Gets the next index that will be used for derivation
   *
   * @returns The next index
   */
  getNextIndex(): number {
    return this.nextIndex;
  }

  /**
   * Releases all reservations older than the specified age in milliseconds
   *
   * @param maxAgeMs Maximum age in milliseconds for reservations to be kept
   * @returns Number of reservations released
   */
  releaseStaleReservations(
    maxAgeMs: number = this.maxReservationAgeMs,
  ): number {
    const now = Date.now();
    let released = 0;

    for (const [index, timestamp] of this.reservations.entries()) {
      // When maxAgeMs is 0, release all reservations
      // Otherwise, only release if they're older than maxAgeMs
      if (maxAgeMs === 0 || (timestamp && now - timestamp > maxAgeMs)) {
        this.unreserve(index);
        released++;
      }
    }

    return released;
  }
}
