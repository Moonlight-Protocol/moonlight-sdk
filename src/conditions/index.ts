import { StrKey, type Ed25519PublicKey } from "@colibri/core";
import {
  nativeToScVal,
  scValToBigInt,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

import { Buffer } from "node:buffer";
import type {
  BaseCondition,
  CreateCondition,
  DepositCondition,
  WithdrawCondition,
} from "./types.ts";
import { UTXOOperationType } from "../operation/types.ts";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import { MLXDR } from "../custom-xdr/index.ts";

/**
 * Represents a condition for UTXO operations in the Moonlight privacy protocol.
 * Conditions define the rules for creating, depositing, and withdrawing funds
 * in a privacy-preserving manner on the Stellar blockchain.
 *
 * This class uses a factory pattern with static methods to create specific
 * condition types while maintaining type safety through TypeScript discriminated unions.
 *
 * @example
 * ```typescript
 * // Create a new UTXO
 * const createCondition = Condition.create(utxoPublicKey, 1000n);
 *
 * // Deposit funds to a public key
 * const depositCondition = Condition.deposit(recipientPublicKey, 500n);
 *
 * // Withdraw funds to a public key
 * const withdrawCondition = Condition.withdraw(recipientPublicKey, 300n);
 * ```
 */
export class Condition implements BaseCondition {
  private _op: UTXOOperationType;
  private _amount: bigint;
  private _publicKey?: Ed25519PublicKey;
  private _utxo?: UTXOPublicKey;

  /**
   * Private constructor to enforce factory pattern usage.
   * Use static methods `create()`, `deposit()`, or `withdraw()` instead.
   *
   * @param params - Configuration object for the condition
   * @param params.op - The UTXO operation type
   * @param params.amount - The amount in stroops (must be greater than zero)
   * @param params.publicKey - Optional Ed25519 public key for deposit/withdraw operations
   * @param params.utxo - Optional UTXO public key for create operations
   * @throws {Error} If amount is zero or negative
   */
  private constructor({
    op,
    amount,
    publicKey,
    utxo,
  }: {
    op: UTXOOperationType;
    amount: bigint;
    publicKey?: Ed25519PublicKey;
    utxo?: UTXOPublicKey;
  }) {
    if (amount <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    this._op = op;
    this._amount = amount;
    this._publicKey = publicKey;
    this._utxo = utxo;
  }

  /**
   * Creates a CREATE condition for generating a new UTXO.
   * This operation creates a new unspent transaction output in the privacy protocol.
   *
   * @param utxo - The UTXO public key that will own the created output
   * @param amount - The amount to assign to the UTXO in stroops (must be > 0)
   * @returns A CreateCondition instance
   * @throws {Error} If amount is zero or negative
   *
   * @example
   * ```typescript
   * const utxoKey = new Uint8Array(32); // Your UTXO public key
   * const condition = Condition.create(utxoKey, 1000n);
   * console.log(condition.getOperation()); // "Create"
   * console.log(condition.getAmount()); // 1000n
   * ```
   */
  static create(utxo: UTXOPublicKey, amount: bigint): CreateCondition {
    return new Condition({
      op: UTXOOperationType.CREATE,
      utxo,
      amount,
    }) as CreateCondition;
  }

  /**
   * Creates a DEPOSIT condition for adding funds to a recipient's account.
   * This operation transfers funds from the privacy pool to a public Stellar account.
   *
   * @param publicKey - The Ed25519 public key of the recipient (Stellar address format)
   * @param amount - The amount to deposit in stroops (must be > 0)
   * @returns A DepositCondition instance
   * @throws {Error} If the public key format is invalid
   * @throws {Error} If amount is zero or negative
   *
   * @example
   * ```typescript
   * const recipientKey = "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
   * const condition = Condition.deposit(recipientKey, 500n);
   * console.log(condition.getOperation()); // "Deposit"
   * console.log(condition.getPublicKey()); // "GBXXXXXX..."
   * ```
   */
  static deposit(
    publicKey: Ed25519PublicKey,
    amount: bigint
  ): DepositCondition {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new Error("Invalid Ed25519 public key");
    }

    return new Condition({
      op: UTXOOperationType.DEPOSIT,
      publicKey,
      amount,
    }) as DepositCondition;
  }

  /**
   * Creates a WITHDRAW condition for removing funds to a recipient's account.
   * This operation transfers funds from the privacy pool to a public Stellar account,
   * similar to deposit but with different semantic meaning in the protocol.
   *
   * @param publicKey - The Ed25519 public key of the recipient (Stellar address format)
   * @param amount - The amount to withdraw in stroops (must be > 0)
   * @returns A WithdrawCondition instance
   * @throws {Error} If the public key format is invalid
   * @throws {Error} If amount is zero or negative
   *
   * @example
   * ```typescript
   * const recipientKey = "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
   * const condition = Condition.withdraw(recipientKey, 300n);
   * console.log(condition.getOperation()); // "Withdraw"
   * console.log(condition.isWithdraw()); // true
   * ```
   */
  static withdraw(
    publicKey: Ed25519PublicKey,
    amount: bigint
  ): WithdrawCondition {
    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      throw new Error("Invalid Ed25519 public key.");
    }
    return new Condition({
      op: UTXOOperationType.WITHDRAW,
      publicKey,
      amount,
    }) as WithdrawCondition;
  }

  /**
   *   Creates a Condition instance from a base64-encoded XDR string.
   *
   * @param xdrString  - The base64-encoded XDR representation of the condition
   * @returns A Condition instance (CreateCondition, DepositCondition, or WithdrawCondition)
   */
  public static fromXDR(
    xdrString: string
  ): CreateCondition | DepositCondition | WithdrawCondition {
    const scVal = xdr.ScVal.fromXDR(xdrString, "base64");
    return Condition.fromScVal(scVal);
  }

  /**
   *  Creates a Condition instance from a Moonlight XDR string.
   *
   * @param mlxdrString  - The Moonlight XDR representation of the condition
   * @returns A Condition instance (CreateCondition, DepositCondition, or WithdrawCondition)
   */
  public static fromMLXDR(
    mlxdrString: string
  ): CreateCondition | DepositCondition | WithdrawCondition {
    return MLXDR.toCondition(mlxdrString);
  }

  /**
   *
   * Creates a Condition instance from a Stellar ScVal representation.
   * @param scVal - The Stellar ScVal representation of the condition.
   * @returns A Condition instance (CreateCondition, DepositCondition, or WithdrawCondition)
   */
  public static fromScVal(
    scVal: xdr.ScVal
  ): CreateCondition | DepositCondition | WithdrawCondition {
    if (scVal.switch().name !== xdr.ScValType.scvVec().name) {
      throw new Error("Invalid ScVal type for Condition");
    }

    const vec = scVal.vec();

    if (vec === null || vec.length !== 3) {
      throw new Error("Invalid ScVal vector length for Condition");
    }

    const opScVal = vec[0];
    const addressScVal = vec[1];
    const amountScVal = vec[2];
    const amount = scValToBigInt(amountScVal);

    const opType = opScVal.sym().toString() as UTXOOperationType;

    if (opType === UTXOOperationType.CREATE) {
      const utxo: UTXOPublicKey = Uint8Array.from(addressScVal.bytes());
      return Condition.create(utxo, amount);
    }

    if (opType === UTXOOperationType.DEPOSIT) {
      const address = scValToNative(addressScVal) as Ed25519PublicKey;
      return Condition.deposit(address, amount);
    }

    if (opType === UTXOOperationType.WITHDRAW) {
      const address = scValToNative(addressScVal) as Ed25519PublicKey;

      return Condition.withdraw(address, amount);
    }

    throw new Error(
      `Unsupported operation type for Condition.fromScVal: ${opType}`
    );
  }

  //==========================================
  // Meta Requirement Methods
  //==========================================

  /**
   * Internal helper method to safely retrieve required properties.
   * Uses method overloading to provide type-safe access to private fields.
   *
   * @param arg - The name of the property to retrieve
   * @returns The value of the requested property
   * @throws {Error} If the requested property is not set
   * @private
   */
  private require(arg: "_op"): UTXOOperationType;
  private require(arg: "_amount"): bigint;
  private require(arg: "_publicKey"): Ed25519PublicKey;
  private require(arg: "_utxo"): UTXOPublicKey;
  private require(
    arg: "_op" | "_amount" | "_publicKey" | "_utxo"
  ): UTXOOperationType | bigint | Ed25519PublicKey | UTXOPublicKey {
    if (this[arg]) return this[arg];
    throw new Error(`Property ${arg} is not set in the Condition instance`);
  }

  //==========================================
  // Getter Methods
  //==========================================

  /**
   * Returns the UTXO operation type of this condition.
   *
   * @returns The operation type (Create, Deposit, or Withdraw)
   * @throws {Error} If the operation is not set (should never happen with factory methods)
   *
   * @example
   * ```typescript
   * const condition = Condition.create(utxo, 1000n);
   * console.log(condition.getOperation()); // "Create"
   * ```
   */
  public getOperation(): UTXOOperationType {
    return this.require("_op");
  }

  /**
   * Returns the amount associated with this condition.
   *
   * @returns The amount in stroops as a bigint
   * @throws {Error} If the amount is not set (should never happen with factory methods)
   *
   * @example
   * ```typescript
   * const condition = Condition.deposit(publicKey, 500n);
   * console.log(condition.getAmount()); // 500n
   * ```
   */
  public getAmount(): bigint {
    return this.require("_amount");
  }

  /**
   * Returns the Ed25519 public key for deposit or withdraw conditions.
   * Only valid for DEPOSIT and WITHDRAW operations.
   *
   * @returns The Ed25519 public key in Stellar address format
   * @throws {Error} If called on a CREATE condition or if public key is not set
   *
   * @example
   * ```typescript
   * const condition = Condition.deposit(publicKey, 500n);
   * console.log(condition.getPublicKey()); // "GBXXXXXX..."
   * ```
   */
  public getPublicKey(): Ed25519PublicKey {
    return this.require("_publicKey");
  }

  /**
   * Returns the UTXO public key for create conditions.
   * Only valid for CREATE operations.
   *
   * @returns The UTXO public key as a Uint8Array
   * @throws {Error} If called on a DEPOSIT or WITHDRAW condition or if UTXO is not set
   *
   * @example
   * ```typescript
   * const condition = Condition.create(utxo, 1000n);
   * console.log(condition.getUtxo()); // Uint8Array(32) [...]
   * ```
   */
  public getUtxo(): UTXOPublicKey {
    return this.require("_utxo");
  }

  //==========================================
  // Conversion Methods
  //==========================================

  /**
   * Converts this condition to Stellar's ScVal format for smart contract interaction.
   * The ScVal format is used by Soroban smart contracts on the Stellar network.
   *
   * The resulting ScVal is a vector containing:
   * - Operation symbol (Create/Deposit/Withdraw)
   * - Address (UTXO bytes for CREATE, Stellar address for DEPOSIT/WITHDRAW)
   * - Amount as i128
   *
   * @returns The condition as a Stellar ScVal
   *
   * @example
   * ```typescript
   * const condition = Condition.deposit(publicKey, 500n);
   * const scVal = condition.toScVal();
   * // Can now be used in Soroban contract invocations
   * ```
   */
  public toScVal(): xdr.ScVal {
    const actionScVal = xdr.ScVal.scvSymbol(this.getOperation());
    const addressScVal =
      this.getOperation() === UTXOOperationType.CREATE
        ? xdr.ScVal.scvBytes(Buffer.from(this.getUtxo()))
        : nativeToScVal(this.getPublicKey(), { type: "address" });
    const amountScVal = nativeToScVal(this.getAmount(), { type: "i128" });

    const conditionScVal = xdr.ScVal.scvVec([
      actionScVal,
      addressScVal,
      amountScVal,
    ]);

    return conditionScVal;
  }

  /**
   * Converts this condition to XDR (External Data Representation) format.
   * XDR is the serialization format used by the Stellar network for all data structures.
   *
   * @returns The condition as a base64-encoded XDR string
   *
   * @example
   * ```typescript
   * const condition = Condition.create(utxo, 1000n);
   * const xdr = condition.toXDR();
   * console.log(xdr); // "AAAABgAAAA..." (base64 string)
   * // Can be transmitted over network or stored
   * ```
   */
  public toXDR(): string {
    return this.toScVal().toXDR("base64");
  }

  /**
   *
   * Converts this condition to Moonlight's custom MLXDR format.
   * @returns The condition as a Moonlight XDR string
   */
  public toMLXDR(): string {
    return MLXDR.fromCondition(
      this as CreateCondition | DepositCondition | WithdrawCondition
    );
  }

  //==========================================
  // Type Guard Methods
  //==========================================

  /**
   * Type guard to check if this condition is a CREATE operation.
   * Narrows the TypeScript type to CreateCondition when true.
   *
   * @returns True if this is a CREATE condition
   *
   * @example
   * ```typescript
   * const condition: Condition = getCondition();
   * if (condition.isCreate()) {
   *   // TypeScript knows this is CreateCondition
   *   const utxo = condition.getUtxo(); // Safe to call
   * }
   * ```
   */
  public isCreate(): this is CreateCondition {
    return this.getOperation() === UTXOOperationType.CREATE;
  }

  /**
   * Type guard to check if this condition is a DEPOSIT operation.
   * Narrows the TypeScript type to DepositCondition when true.
   *
   * @returns True if this is a DEPOSIT condition
   *
   * @example
   * ```typescript
   * const condition: Condition = getCondition();
   * if (condition.isDeposit()) {
   *   // TypeScript knows this is DepositCondition
   *   const key = condition.getPublicKey(); // Safe to call
   * }
   * ```
   */
  public isDeposit(): this is DepositCondition {
    return this.getOperation() === UTXOOperationType.DEPOSIT;
  }

  /**
   * Type guard to check if this condition is a WITHDRAW operation.
   * Narrows the TypeScript type to WithdrawCondition when true.
   *
   * @returns True if this is a WITHDRAW condition
   *
   * @example
   * ```typescript
   * const condition: Condition = getCondition();
   * if (condition.isWithdraw()) {
   *   // TypeScript knows this is WithdrawCondition
   *   const key = condition.getPublicKey(); // Safe to call
   * }
   * ```
   */
  public isWithdraw(): this is WithdrawCondition {
    return this.getOperation() === UTXOOperationType.WITHDRAW;
  }
}
