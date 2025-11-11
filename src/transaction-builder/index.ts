import { type Keypair, Operation, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

import { generateNonce } from "../utils/common/index.ts";

import type {
  IUTXOKeypairBase,
  UTXOPublicKey,
} from "../core/utxo-keypair-base/types.ts";

import { buildSignaturesXDR } from "./signatures/index.ts";
import {
  buildBundleAuthEntry,
  buildOperationAuthEntryHash,
} from "./auth/index.ts";
import { orderSpendByUtxo } from "./utils/index.ts";
import {
  assertNoDuplicateCreate,
  assertNoDuplicateDeposit,
  assertNoDuplicateSpend,
  assertNoDuplicateWithdraw,
  assertSpendExists,
} from "./validators/index.ts";
import {
  type ContractId,
  type Ed25519PublicKey,
  isTransactionSigner,
  type TransactionSigner,
} from "@colibri/core";
import type {
  BaseOperation,
  CreateOperation,
  DepositOperation,
  MoonlightOperation,
  OperationSignature,
  SpendOperation,
  WithdrawOperation,
} from "../operation/types.ts";
import * as E from "./error.ts";
import { assert } from "../utils/assert/assert.ts";
import { assertExtOpsExist } from "./validators/operations.ts";

export class MoonlightTransactionBuilder {
  private _create: CreateOperation[] = [];
  private _spend: SpendOperation[] = [];
  private _deposit: DepositOperation[] = [];
  private _withdraw: WithdrawOperation[] = [];
  private _channelId: ContractId;
  private _authId: ContractId;
  private _assetId: ContractId;
  private _network: string;
  private _innerSignatures: Map<Uint8Array, { sig: Buffer; exp: number }> =
    new Map();
  private _providerInnerSignatures: Map<
    Ed25519PublicKey,
    { sig: Buffer; exp: number; nonce: string }
  > = new Map();
  private _extSignatures: Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry> =
    new Map();

  constructor({
    channelId,
    authId,
    assetId,
    network,
  }: {
    channelId: ContractId;
    authId: ContractId;
    assetId: ContractId;
    network: string;
  }) {
    this._channelId = channelId;
    this._authId = authId;
    this._assetId = assetId;
    this._network = network;
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
  private require(arg: "_create"): CreateOperation[];
  private require(arg: "_spend"): SpendOperation[];
  private require(arg: "_deposit"): DepositOperation[];
  private require(arg: "_withdraw"): WithdrawOperation[];
  private require(arg: "_channelId"): ContractId;
  private require(arg: "_authId"): ContractId;
  private require(arg: "_assetId"): ContractId;
  private require(arg: "_network"): string;
  private require(
    arg: "_innerSignatures",
  ): Map<Uint8Array, { sig: Buffer; exp: number }>;
  private require(
    arg: "_providerInnerSignatures",
  ): Map<Ed25519PublicKey, { sig: Buffer; exp: number; nonce: string }>;
  private require(
    arg: "_extSignatures",
  ): Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry>;
  private require(
    arg:
      | "_create"
      | "_spend"
      | "_deposit"
      | "_withdraw"
      | "_channelId"
      | "_authId"
      | "_assetId"
      | "_network"
      | "_innerSignatures"
      | "_providerInnerSignatures"
      | "_extSignatures",
  ):
    | CreateOperation[]
    | SpendOperation[]
    | DepositOperation[]
    | WithdrawOperation[]
    | ContractId
    | string
    | Map<Uint8Array, { sig: Buffer; exp: number }>
    | Map<Ed25519PublicKey, { sig: Buffer; exp: number; nonce: string }>
    | Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry> {
    if (this[arg] !== undefined) return this[arg];
    throw new E.PROPERTY_NOT_SET(arg);
  }

  //==========================================
  // Getter / Setter Methods
  //==========================================

  /**
   * Returns the create operations in the transaction.
   *
   * @returns The create operations
   * @throws {Error} If the create operations are not set
   *
   * @example
   * ```typescript
   * const condition = Condition.create(utxo, 1000n);
   * console.log(condition.getOperation()); // "Create"
   * ```
   */
  public getCreateOperations(): CreateOperation[] {
    return this.require("_create");
  }

  private setCreateOperations(ops: CreateOperation[]) {
    this._create = [...ops];
  }

  /**
   * Returns the spend operations in the transaction.
   *
   * @returns The spend operations
   * @throws {Error} If the spend operations are not set
   *
   * @example
   * ```typescript
   * const condition = Condition.spend(utxo, [condition1, condition2]);
   * console.log(condition.getOperation()); // "Spend"
   * ```
   */
  public getSpendOperations(): SpendOperation[] {
    return this.require("_spend");
  }

  private setSpendOperations(ops: SpendOperation[]) {
    this._spend = [...ops];
  }

  /**
   * Returns the deposit operations in the transaction.
   *
   * @returns The deposit operations
   * @throws {Error} If the deposit operations are not set
   *
   * @example
   * ```typescript
   * const condition = Condition.deposit(pubKey, 1000n, [condition1]);
   * console.log(condition.getOperation()); // "Deposit"
   * ```
   */
  public getDepositOperations(): DepositOperation[] {
    return this.require("_deposit");
  }

  private setDepositOperations(ops: DepositOperation[]) {
    this._deposit = [...ops];
  }

  /**
   * Returns the withdraw operations in the transaction.
   *
   * @returns The withdraw operations
   * @throws {Error} If the withdraw operations are not set
   *
   * @example
   * ```typescript
   * const condition = Condition.withdraw(pubKey, 1000n, [condition1]);
   * console.log(condition.getOperation()); // "Withdraw"
   * ```
   */
  public getWithdrawOperations(): WithdrawOperation[] {
    return this.require("_withdraw");
  }

  private setWithdrawOperations(ops: WithdrawOperation[]) {
    this._withdraw = [...ops];
  }

  /**
   *  Returns the channel ID associated with the transaction.
   *
   *  @returns The channel ID
   *  @throws {Error} If the channel ID is not set
   */
  public getChannelId(): ContractId {
    return this.require("_channelId");
  }

  /**
   *  Returns the contract Id associated with the channel auth contract.
   *
   *  @returns The auth ID
   *  @throws {Error} If the auth ID is not set
   */
  public getAuthId(): ContractId {
    return this.require("_authId");
  }

  /**
   *  Returns the contract id of the asset associated with the transaction.
   *
   *  @returns The asset
   *  @throws {Error} If the asset is not set
   */
  public getAssetId(): ContractId {
    return this.require("_assetId");
  }

  /**
   *  Returns the network associated with the transaction.
   *
   *  @returns The network
   *  @throws {Error} If the network is not set
   */
  private get network(): string {
    return this.require("_network");
  }

  /**
   * Returns the inner signatures map.
   *
   * @returns The inner signatures map
   * @throws {Error} If the inner signatures map is not set
   */
  private get innerSignatures(): Map<Uint8Array, { sig: Buffer; exp: number }> {
    return this.require("_innerSignatures");
  }

  /**
   * Returns the provider inner signatures map.
   *
   * @returns The provider inner signatures map
   * @throws {Error} If the provider inner signatures map is not set
   */
  private get providerInnerSignatures(): Map<
    Ed25519PublicKey,
    { sig: Buffer; exp: number; nonce: string }
  > {
    return this.require("_providerInnerSignatures");
  }

  /**
   * Returns the external signatures map.
   *
   * @returns The external signatures map
   * @throws {Error} If the external signatures map is not set
   */
  private get extSignatures(): Map<
    Ed25519PublicKey,
    xdr.SorobanAuthorizationEntry
  > {
    return this.require("_extSignatures");
  }

  //==========================================
  // - Methods
  //==========================================

  addOperation(op: MoonlightOperation): MoonlightTransactionBuilder {
    if (op.isCreate()) return this.addCreate(op);
    if (op.isSpend()) return this.addSpend(op);
    if (op.isDeposit()) return this.addDeposit(op);
    if (op.isWithdraw()) return this.addWithdraw(op);

    throw new E.UNSUPPORTED_OP_TYPE((op as BaseOperation).getOperation());
  }

  private addCreate(op: CreateOperation): MoonlightTransactionBuilder {
    assertNoDuplicateCreate(this.getCreateOperations(), op);
    assert(op.getAmount() > 0n, new E.AMOUNT_TOO_LOW(op.getAmount()));

    this.setCreateOperations([...this.getCreateOperations(), op]);
    return this;
  }

  private addSpend(op: SpendOperation): MoonlightTransactionBuilder {
    assertNoDuplicateSpend(this.getSpendOperations(), op);

    this.setSpendOperations([...this.getSpendOperations(), op]);

    if (op.isSignedByUTXO()) {
      this.addInnerSignature(op.getUtxo(), op.getUTXOSignature());
    }

    return this;
  }

  private addDeposit(op: DepositOperation): MoonlightTransactionBuilder {
    assertNoDuplicateDeposit(this.getDepositOperations(), op);
    assert(op.getAmount() > 0n, new E.AMOUNT_TOO_LOW(op.getAmount()));

    this.setDepositOperations([...this.getDepositOperations(), op]);

    if (op.isSignedByEd25519()) {
      this.addExtSignedEntry(op.getPublicKey(), op.getEd25519Signature());
    }
    return this;
  }

  private addWithdraw(op: WithdrawOperation): MoonlightTransactionBuilder {
    assertNoDuplicateWithdraw(this.getWithdrawOperations(), op);
    assert(op.getAmount() > 0n, new E.AMOUNT_TOO_LOW(op.getAmount()));

    this.setWithdrawOperations([...this.getWithdrawOperations(), op]);
    return this;
  }

  private addInnerSignature(
    utxo: UTXOPublicKey,
    signature: OperationSignature,
  ): MoonlightTransactionBuilder {
    assertSpendExists(this.getSpendOperations(), utxo);

    this.innerSignatures.set(utxo, signature);
    return this;
  }

  public addProviderInnerSignature(
    pubKey: Ed25519PublicKey,
    signature: Buffer,
    expirationLedger: number,
    nonce: string,
  ): MoonlightTransactionBuilder {
    this.providerInnerSignatures.set(pubKey, {
      sig: signature,
      exp: expirationLedger,
      nonce,
    });
    return this;
  }

  public addExtSignedEntry(
    pubKey: Ed25519PublicKey,
    signedAuthEntry: xdr.SorobanAuthorizationEntry,
  ): MoonlightTransactionBuilder {
    assertExtOpsExist(
      this.getDepositOperations(),
      this.getWithdrawOperations(),
      pubKey,
    );

    this.extSignatures.set(pubKey, signedAuthEntry);
    return this;
  }

  public getDepositOperation(
    depositor: Ed25519PublicKey,
  ): DepositOperation | undefined {
    return this.getDepositOperations().find(
      (d) => d.getPublicKey() === depositor,
    );
  }

  public getSpendOperation(utxo: UTXOPublicKey): SpendOperation | undefined {
    return this.getSpendOperations().find((s) =>
      Buffer.from(s.getUtxo()).equals(Buffer.from(utxo))
    );
  }

  public getAuthRequirementArgs(): xdr.ScVal[] {
    if (this.getSpendOperations().length === 0) return [];

    const signers: xdr.ScMapEntry[] = [];

    const orderedSpend = orderSpendByUtxo(this.getSpendOperations());

    for (const spend of orderedSpend) {
      signers.push(
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("P256"),
            xdr.ScVal.scvBytes(Buffer.from(spend.getUtxo() as Uint8Array)),
          ]),
          val: xdr.ScVal.scvVec(spend.getConditions().map((c) => c.toScVal())),
        }),
      );
    }

    return [xdr.ScVal.scvVec([xdr.ScVal.scvMap(signers)])];
  }

  public getOperationAuthEntry(
    nonce: string,
    signatureExpirationLedger: number,
    signed: boolean = false,
  ): xdr.SorobanAuthorizationEntry {
    const reqArgs: xdr.ScVal[] = this.getAuthRequirementArgs();

    return buildBundleAuthEntry({
      channelId: this.getChannelId(),
      authId: this.getAuthId(),
      args: reqArgs,
      nonce,
      signatureExpirationLedger,
      signaturesXdr: signed ? this.signaturesXDR() : undefined,
    });
  }

  public getSignedOperationAuthEntry(): xdr.SorobanAuthorizationEntry {
    const providerSigners = Array.from(this.providerInnerSignatures.keys());

    if (providerSigners.length === 0) {
      throw new Error("No Provider signatures added");
    }

    const { nonce, exp: signatureExpirationLedger } = this
      .providerInnerSignatures.get(providerSigners[0])!;

    const reqArgs: xdr.ScVal[] = this.getAuthRequirementArgs();

    return buildBundleAuthEntry({
      channelId: this.getChannelId(),
      authId: this.getAuthId(),
      args: reqArgs,
      nonce,
      signatureExpirationLedger,
      signaturesXdr: this.signaturesXDR(),
    });
  }

  public async getOperationAuthEntryHash(
    nonce: string,
    signatureExpirationLedger: number,
  ): Promise<Buffer> {
    const rootInvocation = this.getOperationAuthEntry(
      nonce,
      signatureExpirationLedger,
    ).rootInvocation();
    return await buildOperationAuthEntryHash({
      network: this.network,
      rootInvocation,
      nonce,
      signatureExpirationLedger,
    });
  }

  public signaturesXDR(): string {
    const providerSigners = Array.from(this.providerInnerSignatures.keys());

    assert(providerSigners.length > 0, new E.MISSING_PROVIDER_SIGNATURE());

    const spendSigs = Array.from(this.innerSignatures.entries()).map(
      ([utxo, { sig, exp }]) => ({ utxo, sig, exp }),
    );
    const providerSigs = providerSigners.map((pk) => {
      const { sig, exp } = this.providerInnerSignatures.get(pk)!;
      return { pubKey: pk, sig, exp };
    });

    return buildSignaturesXDR(spendSigs, providerSigs);
  }

  public async signWithProvider(
    providerKeys: TransactionSigner | Keypair,
    signatureExpirationLedger: number,
    nonce?: string,
  ) {
    if (!nonce) nonce = generateNonce();

    const authHash = await this.getOperationAuthEntryHash(
      nonce,
      signatureExpirationLedger,
    );

    const signedHash = isTransactionSigner(providerKeys)
      // deno-lint-ignore no-explicit-any
      ? providerKeys.sign(authHash as any)
      : providerKeys.sign(authHash);

    this.addProviderInnerSignature(
      providerKeys.publicKey() as Ed25519PublicKey,
      signedHash as Buffer,
      signatureExpirationLedger,
      nonce,
    );
  }

  public async signWithSpendUtxo(
    utxoKp: IUTXOKeypairBase,
    signatureExpirationLedger: number,
  ) {
    const spendOp = this.getSpendOperation(utxoKp.publicKey);

    assert(spendOp, new E.NO_SPEND_OPS(utxoKp.publicKey));

    await spendOp.signWithUTXO(
      utxoKp,
      this.getChannelId(),
      signatureExpirationLedger,
    );

    this.addInnerSignature(utxoKp.publicKey, spendOp.getUTXOSignature());
  }

  public async signExtWithEd25519(
    keys: TransactionSigner | Keypair,
    signatureExpirationLedger: number,
    nonce?: string,
  ) {
    const depositOp = this.getDepositOperation(
      keys.publicKey() as Ed25519PublicKey,
    );

    assert(
      depositOp,
      new E.NO_DEPOSIT_OPS(keys.publicKey() as Ed25519PublicKey),
    );

    await depositOp.signWithEd25519(
      keys,
      signatureExpirationLedger,
      this.getChannelId(),
      this.getAssetId(),
      this.network,
      nonce,
    );

    this.addExtSignedEntry(
      keys.publicKey() as Ed25519PublicKey,
      depositOp.getEd25519Signature(),
    );
  }

  public getSignedAuthEntries(): xdr.SorobanAuthorizationEntry[] {
    const signedEntries = [
      ...Array.from(this.extSignatures.values()),
      this.getSignedOperationAuthEntry(),
    ];
    return signedEntries;
  }

  public getInvokeOperation(): xdr.Operation {
    return Operation.invokeContractFunction({
      contract: this.getChannelId(),

      function: "transact",

      args: [this.buildXDR()],
      auth: [...this.getSignedAuthEntries()],
    });
  }

  public buildXDR(): xdr.ScVal {
    return xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("create"),
        val: xdr.ScVal.scvVec(
          this.getCreateOperations().map((op) => op.toScVal()),
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("deposit"),
        val: xdr.ScVal.scvVec(
          this.getDepositOperations().map((op) => op.toScVal()),
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("spend"),
        val: xdr.ScVal.scvVec(
          this.getSpendOperations().map((op) => op.toScVal()),
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("withdraw"),
        val: xdr.ScVal.scvVec(
          this.getWithdrawOperations().map((op) => op.toScVal()),
        ),
      }),
    ]);
  }
}
