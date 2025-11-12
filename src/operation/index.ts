import {
  type ContractId,
  type Ed25519PublicKey,
  isTransactionSigner,
  StrKey,
  type TransactionSigner,
} from "@colibri/core";
import type { Condition as ConditionType } from "../conditions/types.ts";
import { UTXOOperationType } from "./types.ts";
import type {
  BaseOperation,
  CreateOperation,
  DepositOperation,
  OperationSignature,
  SpendOperation,
  WithdrawOperation,
} from "./types.ts";

import { Condition } from "../conditions/index.ts";
import {
  authorizeEntry,
  type Keypair,
  nativeToScVal,
  scValToBigInt,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "node:buffer";
import type {
  IUTXOKeypairBase,
  UTXOPublicKey,
} from "../core/utxo-keypair-base/types.ts";
import * as E from "./error.ts";
import { assert } from "../utils/assert/assert.ts";
import { buildAuthPayloadHash } from "../utils/auth/build-auth-payload.ts";
import { generateNonce } from "../utils/common/index.ts";
import { buildDepositAuthEntry } from "../utils/auth/deposit-auth-entry.ts";
import { MLXDR } from "../custom-xdr/index.ts";

export class MoonlightOperation implements BaseOperation {
  private _op: UTXOOperationType;
  private _amount?: bigint;
  private _publicKey?: Ed25519PublicKey;
  private _utxo?: UTXOPublicKey;
  private _conditions?: ConditionType[];

  private _utxoSignature?: OperationSignature;
  private _ed25519Signature?: xdr.SorobanAuthorizationEntry;

  private constructor({
    op,
    amount,
    publicKey,
    utxo,
  }: {
    op: UTXOOperationType;
    amount?: bigint;
    publicKey?: Ed25519PublicKey;
    utxo?: UTXOPublicKey;
  }) {
    // Business rule: CREATE operations cannot have conditions.
    // This is because conditions are only applicable to DEPOSIT, SPEND, and WITHDRAW operations.
    // Attempting to add conditions to CREATE would violate the intended operation semantics.
    if (op !== UTXOOperationType.CREATE) this.setConditions([]);

    this._op = op;
    this._amount = amount;
    this._publicKey = publicKey;
    this._utxo = utxo;
  }

  static create(utxo: UTXOPublicKey, amount: bigint): CreateOperation {
    assert(amount > 0n, new E.AMOUNT_TOO_LOW(amount));

    return new MoonlightOperation({
      op: UTXOOperationType.CREATE,
      utxo,
      amount,
    }) as CreateOperation;
  }

  static deposit(
    publicKey: Ed25519PublicKey,
    amount: bigint,
  ): DepositOperation {
    assert(amount > 0n, new E.AMOUNT_TOO_LOW(amount));

    assert(
      StrKey.isValidEd25519PublicKey(publicKey),
      new E.INVALID_ED25519_PK(publicKey),
    );

    return new MoonlightOperation({
      op: UTXOOperationType.DEPOSIT,
      publicKey,
      amount,
    }) as DepositOperation;
  }

  static withdraw(
    publicKey: Ed25519PublicKey,
    amount: bigint,
  ): WithdrawOperation {
    assert(amount > 0n, new E.AMOUNT_TOO_LOW(amount));

    assert(
      StrKey.isValidEd25519PublicKey(publicKey),
      new E.INVALID_ED25519_PK(publicKey),
    );

    return new MoonlightOperation({
      op: UTXOOperationType.WITHDRAW,
      publicKey,
      amount,
    }) as WithdrawOperation;
  }

  static spend(utxo: UTXOPublicKey): SpendOperation {
    return new MoonlightOperation({
      op: UTXOOperationType.SPEND,
      utxo,
    }) as SpendOperation;
  }

  static fromXDR(
    xdrString: string,
    type: UTXOOperationType,
  ): CreateOperation | DepositOperation | WithdrawOperation | SpendOperation {
    const scVal = xdr.ScVal.fromXDR(xdrString, "base64");

    if (type === UTXOOperationType.SPEND) {
      return this.fromScVal(scVal, UTXOOperationType.SPEND);
    }
    if (type === UTXOOperationType.DEPOSIT) {
      return this.fromScVal(scVal, UTXOOperationType.DEPOSIT);
    }
    if (type === UTXOOperationType.WITHDRAW) {
      return this.fromScVal(scVal, UTXOOperationType.WITHDRAW);
    }
    if (type === UTXOOperationType.CREATE) {
      return this.fromScVal(scVal, UTXOOperationType.CREATE);
    }

    throw new E.UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION(type);
  }

  static fromScVal(
    scVal: xdr.ScVal,
    type: UTXOOperationType.CREATE,
  ): CreateOperation;
  static fromScVal(
    scVal: xdr.ScVal,
    type: UTXOOperationType.DEPOSIT,
  ): DepositOperation;
  static fromScVal(
    scVal: xdr.ScVal,
    type: UTXOOperationType.WITHDRAW,
  ): WithdrawOperation;
  static fromScVal(
    scVal: xdr.ScVal,
    type: UTXOOperationType.SPEND,
  ): SpendOperation;
  public static fromScVal(
    scVal: xdr.ScVal,
    type: UTXOOperationType,
  ): CreateOperation | DepositOperation | WithdrawOperation | SpendOperation {
    assert(
      scVal.switch().name === xdr.ScValType.scvVec().name,
      new E.INVALID_SCVAL_TYPE_FOR_OPERATION(
        xdr.ScValType.scvVec().name,
        scVal.switch().name,
      ),
    );

    const vec = scVal.vec();

    assert(vec !== null, new E.INVALID_SCVAL_VEC_FOR_OPERATION());

    if (type === UTXOOperationType.CREATE) {
      assert(
        vec.length === 2,
        new E.INVALID_SCVAL_VEC_LENGTH_FOR_OPERATION(type, 2, vec.length),
      );
      const utxo: UTXOPublicKey = Uint8Array.from(vec[0].bytes());
      const amount = scValToBigInt(vec[1]);
      return this.create(utxo, amount);
    }
    if (type === UTXOOperationType.SPEND) {
      assert(
        vec.length === 2,
        new E.INVALID_SCVAL_VEC_LENGTH_FOR_OPERATION(type, 2, vec.length),
      );
      const utxo: UTXOPublicKey = Uint8Array.from(vec[0].bytes());
      const conditionsScVal = vec[1].vec();

      assert(
        conditionsScVal !== null,
        new E.INVALID_SCVAL_VEC_FOR_CONDITIONS(utxo),
      );

      const conditions: ConditionType[] = conditionsScVal.map((cScVal) => {
        assert(
          cScVal.switch().name === xdr.ScValType.scvVec().name,
          new E.INVALID_SCVAL_VEC_FOR_CONDITION(utxo, cScVal.switch().name),
        );

        return Condition.fromScVal(cScVal);
      });
      return this.spend(utxo).addConditions(conditions);
    }
    if (type === UTXOOperationType.DEPOSIT) {
      assert(
        vec.length === 3,
        new E.INVALID_SCVAL_VEC_LENGTH_FOR_OPERATION(type, 3, vec.length),
      );
      const publicKey = scValToNative(vec[0]) as Ed25519PublicKey;
      const amount = scValToBigInt(vec[1]);
      const conditionsScVal = vec[2].vec();

      assert(
        conditionsScVal !== null,
        new E.INVALID_SCVAL_VEC_FOR_CONDITIONS(publicKey),
      );

      const conditions: ConditionType[] = conditionsScVal.map((cScVal) => {
        assert(
          cScVal.switch().name === xdr.ScValType.scvVec().name,
          new E.INVALID_SCVAL_VEC_FOR_CONDITION(
            publicKey,
            cScVal.switch().name,
          ),
        );
        return Condition.fromScVal(cScVal);
      });
      return this.deposit(publicKey, amount).addConditions(conditions);
    }
    if (type === UTXOOperationType.WITHDRAW) {
      assert(
        vec.length === 3,
        new E.INVALID_SCVAL_VEC_LENGTH_FOR_OPERATION(type, 3, vec.length),
      );
      const publicKey = scValToNative(vec[0]) as Ed25519PublicKey;
      const amount = scValToBigInt(vec[1]);
      const conditionsScVal = vec[2].vec();

      assert(
        conditionsScVal !== null,
        new E.INVALID_SCVAL_VEC_FOR_CONDITIONS(publicKey),
      );

      const conditions: ConditionType[] = conditionsScVal.map((cScVal) => {
        assert(
          cScVal.switch().name === xdr.ScValType.scvVec().name,
          new E.INVALID_SCVAL_VEC_FOR_CONDITION(
            publicKey,
            cScVal.switch().name,
          ),
        );
        return Condition.fromScVal(cScVal);
      });
      return this.withdraw(publicKey, amount).addConditions(conditions);
    }

    throw new E.UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION(type);
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
  private require(arg: "_conditions"): ConditionType[];
  private require(arg: "_utxoSignature"): OperationSignature;
  private require(arg: "_ed25519Signature"): xdr.SorobanAuthorizationEntry;

  private require(
    arg:
      | "_op"
      | "_amount"
      | "_publicKey"
      | "_utxo"
      | "_conditions"
      | "_utxoSignature"
      | "_ed25519Signature",
  ):
    | UTXOOperationType
    | bigint
    | Ed25519PublicKey
    | UTXOPublicKey
    | ConditionType[]
    | OperationSignature
    | xdr.SorobanAuthorizationEntry {
    if (this[arg] !== undefined) return this[arg];
    throw new E.PROPERTY_NOT_SET(arg);
  }

  //==========================================
  // Getter / Setter Methods
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
   * Returns the conditions associated with this operation.
   *
   * @returns An array of Condition objects
   * @throws {Error} If the conditions are not set
   *
   * @example
   * ```typescript
   * const operation = Operation.spend(utxo);
   * const conditions = operation.getConditions();
   * console.log(conditions); // [Condition, Condition, ...]
   * ```
   */
  public getConditions(): ConditionType[] {
    return [...this.require("_conditions")];
  }

  /**
   * Sets the conditions associated with this operation.
   * @param conditions - An array of Condition objects to set
   * @throws {Error} If the conditions are not set
   */
  private setConditions(conditions: ConditionType[]) {
    this._conditions = [...conditions];
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

  /**
   * Returns the UTXO signature for this operation.
   * @returns The UTXO signature as an OperationSignature object
   * @throws {Error} If the signature is not set
   */
  public getUTXOSignature(): OperationSignature {
    return this.require("_utxoSignature");
  }

  /**
   * Sets the UTXO signature for this operation.
   * @param signature - The OperationSignature to set
   */
  private setUTXOSignature(signature: OperationSignature) {
    this._utxoSignature = signature;
  }

  public appendUTXOSignature(signature: OperationSignature): this {
    assert(this.isSignedByUTXO() === false, new E.OP_ALREADY_SIGNED("UTXO"));
    this.setUTXOSignature(signature);
    return this;
  }

  /**
   *  Returns the Ed25519 signature for this operation.
   * @returns The Ed25519 signature as a SorobanAuthorizationEntry
   * @throws {Error} If the signature is not set
   */
  public getEd25519Signature(): xdr.SorobanAuthorizationEntry {
    return this.require("_ed25519Signature");
  }

  /**
   *  Sets the Ed25519 signature for this operation.
   * @param signature
   */
  private setEd25519Signature(signature: xdr.SorobanAuthorizationEntry) {
    this._ed25519Signature = signature;
  }

  public appendEd25519Signature(
    signature: xdr.SorobanAuthorizationEntry,
  ): this {
    assert(
      this.isSignedByEd25519() === false,
      new E.OP_ALREADY_SIGNED("Ed25519"),
    );
    this.setEd25519Signature(signature);
    return this;
  }

  //==========================================
  // Meta Management Methods
  //==========================================

  public addCondition(condition: ConditionType): this {
    const existingConditions = this.getConditions();
    this.setConditions([...existingConditions, condition]);

    return this;
  }

  public addConditions(conditions: ConditionType[]): this {
    const existingConditions = this.getConditions();
    this.setConditions([...existingConditions, ...conditions]);

    return this;
  }

  public clearConditions(): this {
    this.setConditions([]);
    return this;
  }

  /**
   * Signs the operation with a UTXO keypair.
   * @param utxo The UTXO keypair to use for signing
   * @param channelId The channel ID to include in the signature
   * @param signatureExpirationLedger The ledger sequence number at which the signature expires
   * @returns The signed operation
   */
  public async signWithUTXO(
    utxo: IUTXOKeypairBase,
    channelId: ContractId,
    signatureExpirationLedger: number,
  ): Promise<this> {
    assert(this.isSignedByUTXO() === false, new E.OP_ALREADY_SIGNED("UTXO"));

    assert(
      this.getOperation() === UTXOOperationType.SPEND,
      new E.OP_IS_NOT_SIGNABLE(this.getOperation(), "UTXO"),
    );

    const conditions = this.getConditions();

    assert(conditions.length > 0, new E.OP_HAS_NO_CONDITIONS(this.getUtxo()));

    const signedHash = await utxo.signPayload(
      await buildAuthPayloadHash({
        contractId: channelId,
        conditions,
        liveUntilLedger: signatureExpirationLedger,
      }),
    );

    this.appendUTXOSignature({
      sig: Buffer.from(signedHash),
      exp: signatureExpirationLedger,
    });

    return this;
  }

  public async signWithEd25519(
    depositorKeys: TransactionSigner | Keypair,
    signatureExpirationLedger: number,
    channelId: ContractId,
    assetId: ContractId,
    networkPassphrase: string,
    nonce?: string,
  ): Promise<this> {
    assert(
      this.isSignedByEd25519() === false,
      new E.OP_ALREADY_SIGNED("Ed25519"),
    );

    assert(
      this.getOperation() === UTXOOperationType.DEPOSIT,
      new E.OP_IS_NOT_SIGNABLE(this.getOperation(), "Ed25519"),
    );

    assert(
      depositorKeys.publicKey() === this.getPublicKey(),
      new E.SIGNER_IS_NOT_DEPOSITOR(
        depositorKeys.publicKey(),
        this.getPublicKey(),
      ),
    );

    if (!nonce) nonce = generateNonce();

    const rawAuthEntry = await buildDepositAuthEntry({
      channelId,
      assetId,
      depositor: depositorKeys.publicKey() as Ed25519PublicKey,
      amount: this.getAmount(),
      conditions: [
        xdr.ScVal.scvVec(this.getConditions().map((c) => c.toScVal())),
      ],
      signatureExpirationLedger,
      nonce,
    });

    let signedAuthEntry: xdr.SorobanAuthorizationEntry;

    if (isTransactionSigner(depositorKeys)) {
      signedAuthEntry = await depositorKeys.signSorobanAuthEntry(
        rawAuthEntry,
        signatureExpirationLedger,
        networkPassphrase,
      );
    } else {
      signedAuthEntry = await authorizeEntry(
        rawAuthEntry,
        depositorKeys,
        signatureExpirationLedger,
        networkPassphrase,
      );
    }

    this.appendEd25519Signature(signedAuthEntry);

    return this;
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
  public isCreate(): this is CreateOperation {
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
  public isDeposit(): this is DepositOperation {
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
  public isWithdraw(): this is WithdrawOperation {
    return this.getOperation() === UTXOOperationType.WITHDRAW;
  }

  /**
   * Type guard to check if this condition is a SPEND operation.
   * Narrows the TypeScript type to SpendCondition when true.
   *
   * @returns True if this is a SPEND condition
   *
   * @example
   * ```typescript
   * const condition: Condition = getCondition();
   * if (condition.isSpend()) {
   *   // TypeScript knows this is SpendCondition
   *   const utxo = condition.getUtxo(); // Safe to call
   * }
   * ```
   */
  public isSpend(): this is SpendOperation {
    return this.getOperation() === UTXOOperationType.SPEND;
  }

  public hasConditions(): boolean {
    return this._conditions !== undefined &&
        "length" in this._conditions &&
        this._conditions.length > 0
      ? true
      : false;
  }

  public isSignedByUTXO(): boolean {
    return this._utxoSignature !== undefined;
  }

  public isSignedByEd25519(): boolean {
    return this._ed25519Signature !== undefined;
  }

  //==========================================
  // Conversion Methods
  //==========================================

  public toCondition(): ConditionType {
    if (this.isCreate()) {
      return Condition.create(this.getUtxo(), this.getAmount());
    }

    if (this.isDeposit()) {
      return Condition.deposit(this.getPublicKey(), this.getAmount());
    }

    if (this.isWithdraw()) {
      return Condition.withdraw(this.getPublicKey(), this.getAmount());
    }

    throw new E.CANNOT_CONVERT_SPEND_OP(this.getUtxo());
  }

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
    if (this.isCreate()) {
      return this.createToScVal();
    }

    if (this.isDeposit()) {
      return this.depositToScVal();
    }

    if (this.isWithdraw()) {
      return this.withdrawToScVal();
    }

    if (this.isSpend()) {
      return this.spendToScVal();
    }

    throw new E.UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION(this.getOperation());
  }

  private conditionsToScVal(): xdr.ScVal {
    return this.hasConditions()
      ? xdr.ScVal.scvVec(this.getConditions().map((c) => c.toScVal()))
      : xdr.ScVal.scvVec([]);
  }

  private createToScVal(): xdr.ScVal {
    assert(this.isCreate(), new E.OP_IS_NOT_CREATE(this.getOperation()));

    return xdr.ScVal.scvVec([
      xdr.ScVal.scvBytes(Buffer.from(this.getUtxo())),
      nativeToScVal(this.getAmount(), { type: "i128" }),
    ]);
  }

  private spendToScVal(): xdr.ScVal {
    assert(this.isSpend(), new E.OP_IS_NOT_SPEND(this.getOperation()));
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvBytes(Buffer.from(this.getUtxo())),
      this.conditionsToScVal(),
    ]);
  }

  private depositToScVal(): xdr.ScVal {
    assert(this.isDeposit(), new E.OP_IS_NOT_DEPOSIT(this.getOperation()));

    return xdr.ScVal.scvVec([
      nativeToScVal(this.getPublicKey(), { type: "address" }),
      nativeToScVal(this.getAmount(), { type: "i128" }),
      this.conditionsToScVal(),
    ]);
  }

  private withdrawToScVal(): xdr.ScVal {
    assert(this.isWithdraw(), new E.OP_IS_NOT_WITHDRAW(this.getOperation()));

    return xdr.ScVal.scvVec([
      nativeToScVal(this.getPublicKey(), { type: "address" }),
      nativeToScVal(this.getAmount(), { type: "i128" }),
      this.conditionsToScVal(),
    ]);
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

  public toMLXDR(): string {
    return MLXDR.fromOperation(
      this as
        | CreateOperation
        | DepositOperation
        | WithdrawOperation
        | SpendOperation,
    );
  }

  static fromMLXDR(
    mlxdrString: string,
  ): CreateOperation | DepositOperation | WithdrawOperation | SpendOperation {
    return MLXDR.toOperation(mlxdrString);
  }
}
