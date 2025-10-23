import {
  type Asset,
  authorizeEntry,
  type Keypair,
  Operation,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

import { generateNonce } from "../utils/common/index.ts";

import { buildAuthPayloadHash } from "../utils/auth/build-auth-payload.ts";
import type {
  IUTXOKeypairBase,
  UTXOPublicKey,
} from "../core/utxo-keypair-base/types.ts";

import { buildSignaturesXDR } from "./signatures/index.ts";
import {
  buildBundleAuthEntry,
  buildDepositAuthEntry,
  buildOperationAuthEntryHash,
} from "./auth/index.ts";
import { orderSpendByUtxo } from "./utils/index.ts";
import {
  assertPositiveAmount,
  assertNoDuplicateCreate,
  assertNoDuplicateSpend,
  assertNoDuplicatePubKey,
  assertSpendExists,
} from "./validators/index.ts";
import {
  type ContractId,
  type Ed25519PublicKey,
  type TransactionSigner,
  isTransactionSigner,
} from "@colibri/core";
import type {
  CreateOperation,
  DepositOperation,
  SpendOperation,
  WithdrawOperation,
  MoonlightOperation,
} from "../operation/types.ts";

export class MoonlightTransactionBuilder {
  private _create: CreateOperation[] = [];
  private _spend: SpendOperation[] = [];
  private _deposit: DepositOperation[] = [];
  private _withdraw: WithdrawOperation[] = [];
  private _channelId: ContractId;
  private _authId: ContractId;
  private _asset: Asset;
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
    asset,
    network,
  }: {
    channelId: ContractId;
    authId: ContractId;
    asset: Asset;
    network: string;
  }) {
    this._channelId = channelId;
    this._authId = authId;
    this._asset = asset;
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
  private require(arg: "_asset"): Asset;
  private require(arg: "_network"): string;
  private require(
    arg: "_innerSignatures"
  ): Map<Uint8Array, { sig: Buffer; exp: number }>;
  private require(
    arg: "_providerInnerSignatures"
  ): Map<Ed25519PublicKey, { sig: Buffer; exp: number; nonce: string }>;
  private require(
    arg: "_extSignatures"
  ): Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry>;
  private require(
    arg:
      | "_create"
      | "_spend"
      | "_deposit"
      | "_withdraw"
      | "_channelId"
      | "_authId"
      | "_asset"
      | "_network"
      | "_innerSignatures"
      | "_providerInnerSignatures"
      | "_extSignatures"
  ):
    | CreateOperation[]
    | SpendOperation[]
    | DepositOperation[]
    | WithdrawOperation[]
    | ContractId
    | Asset
    | string
    | Map<Uint8Array, { sig: Buffer; exp: number }>
    | Map<Ed25519PublicKey, { sig: Buffer; exp: number; nonce: string }>
    | Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry> {
    if (this[arg] !== undefined) return this[arg];
    throw new Error(
      `Property ${arg} is not set in the Transaction Builder instance`
    );
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
   *  Returns the asset associated with the transaction.
   *
   *  @returns The asset
   *  @throws {Error} If the asset is not set
   */
  public getAsset(): Asset {
    return this.require("_asset");
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
    throw new Error("Unsupported operation type");
  }

  private addCreate(op: CreateOperation): MoonlightTransactionBuilder {
    assertNoDuplicateCreate(this.getCreateOperations(), op);
    assertPositiveAmount(op.getAmount(), "Create operation");

    this.setCreateOperations([...this.getCreateOperations(), op]);
    return this;
  }

  private addSpend(op: SpendOperation): MoonlightTransactionBuilder {
    assertNoDuplicateSpend(this.getSpendOperations(), op);

    this.setSpendOperations([...this.getSpendOperations(), op]);
    return this;
  }

  private addDeposit(op: DepositOperation): MoonlightTransactionBuilder {
    assertNoDuplicatePubKey(this.getDepositOperations(), op, "Deposit");
    assertPositiveAmount(op.getAmount(), "Deposit operation");

    this.setDepositOperations([...this.getDepositOperations(), op]);
    return this;
  }

  private addWithdraw(op: WithdrawOperation): MoonlightTransactionBuilder {
    assertNoDuplicatePubKey(this.getWithdrawOperations(), op, "Withdraw");
    assertPositiveAmount(op.getAmount(), "Withdraw operation");

    this.setWithdrawOperations([...this.getWithdrawOperations(), op]);
    return this;
  }

  public addInnerSignature(
    utxo: UTXOPublicKey,
    signature: Buffer,
    expirationLedger: number
  ): MoonlightTransactionBuilder {
    assertSpendExists(this.getSpendOperations(), utxo);

    this.innerSignatures.set(utxo, {
      sig: signature,
      exp: expirationLedger,
    });
    return this;
  }

  public addProviderInnerSignature(
    pubKey: Ed25519PublicKey,
    signature: Buffer,
    expirationLedger: number,
    nonce: string
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
    signedAuthEntry: xdr.SorobanAuthorizationEntry
  ): MoonlightTransactionBuilder {
    if (
      !this.getDepositOperations().find((d) => d.getPublicKey() === pubKey) &&
      !this.getWithdrawOperations().find((d) => d.getPublicKey() === pubKey)
    )
      throw new Error("No deposit or withdraw operation for this public key");

    this.extSignatures.set(pubKey, signedAuthEntry);
    return this;
  }

  public getDepositOperation(
    depositor: Ed25519PublicKey
  ): DepositOperation | undefined {
    return this.getDepositOperations().find(
      (d) => d.getPublicKey() === depositor
    );
  }

  public getExtAuthEntry(
    address: Ed25519PublicKey,
    nonce: string,
    signatureExpirationLedger: number
  ): xdr.SorobanAuthorizationEntry {
    const deposit = this.getDepositOperation(address);
    if (!deposit) throw new Error("No deposit operation for this address");

    return buildDepositAuthEntry({
      channelId: this.getChannelId(),
      assetId: this.getAsset().contractId(this.network),
      depositor: address,
      amount: deposit.getAmount(),
      conditions: [
        xdr.ScVal.scvVec(deposit.getConditions().map((c) => c.toScVal())),
      ],
      nonce,
      signatureExpirationLedger,
    });
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
        })
      );
    }

    return [xdr.ScVal.scvVec([xdr.ScVal.scvMap(signers)])];
  }

  public getOperationAuthEntry(
    nonce: string,
    signatureExpirationLedger: number,
    signed: boolean = false
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

    if (providerSigners.length === 0)
      throw new Error("No Provider signatures added");

    const { nonce, exp: signatureExpirationLedger } =
      this.providerInnerSignatures.get(providerSigners[0])!;

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
    signatureExpirationLedger: number
  ): Promise<Buffer> {
    const rootInvocation = this.getOperationAuthEntry(
      nonce,
      signatureExpirationLedger
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
    if (providerSigners.length === 0)
      throw new Error("No Provider signatures added");

    const spendSigs = Array.from(this.innerSignatures.entries()).map(
      ([utxo, { sig, exp }]) => ({ utxo, sig, exp })
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
    nonce?: string
  ) {
    if (!nonce) nonce = generateNonce();

    const authHash = await this.getOperationAuthEntryHash(
      nonce,
      signatureExpirationLedger
    );

    const signedHash = isTransactionSigner(providerKeys)
      ? // deno-lint-ignore no-explicit-any
        providerKeys.sign(authHash as any)
      : providerKeys.sign(authHash);

    this.addProviderInnerSignature(
      providerKeys.publicKey() as Ed25519PublicKey,
      signedHash as Buffer,
      signatureExpirationLedger,
      nonce
    );
  }

  public async signWithSpendUtxo(
    utxo: IUTXOKeypairBase,
    signatureExpirationLedger: number
  ) {
    const conditions = this.getSpendOperations()
      .find((s) => Buffer.from(s.getUtxo()).equals(Buffer.from(utxo.publicKey)))
      ?.getConditions();

    if (!conditions) throw new Error("No spend operation for this UTXO");

    const signedHash = await utxo.signPayload(
      await buildAuthPayloadHash({
        contractId: this.getChannelId(),
        conditions,
        liveUntilLedger: signatureExpirationLedger,
      })
    );

    this.addInnerSignature(
      utxo.publicKey,
      Buffer.from(signedHash),
      signatureExpirationLedger
    );
  }

  public async signExtWithEd25519(
    keys: TransactionSigner | Keypair,
    signatureExpirationLedger: number,
    nonce?: string
  ) {
    if (!nonce) nonce = generateNonce();

    const rawAuthEntry = this.getExtAuthEntry(
      keys.publicKey() as Ed25519PublicKey,
      nonce,
      signatureExpirationLedger
    );

    let signedAuthEntry: xdr.SorobanAuthorizationEntry;
    if (isTransactionSigner(keys)) {
      signedAuthEntry = await keys.signSorobanAuthEntry(
        rawAuthEntry,
        signatureExpirationLedger,
        this.network
      );
    } else {
      signedAuthEntry = await authorizeEntry(
        rawAuthEntry,
        keys,
        signatureExpirationLedger,
        this.network
      );
    }

    this.addExtSignedEntry(
      keys.publicKey() as Ed25519PublicKey,
      signedAuthEntry
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
          this.getCreateOperations().map((op) => op.toScVal())
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("deposit"),
        val: xdr.ScVal.scvVec(
          this.getDepositOperations().map((op) => op.toScVal())
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("spend"),
        val: xdr.ScVal.scvVec(
          this.getSpendOperations().map((op) => op.toScVal())
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("withdraw"),
        val: xdr.ScVal.scvVec(
          this.getWithdrawOperations().map((op) => op.toScVal())
        ),
      }),
    ]);
  }
}
