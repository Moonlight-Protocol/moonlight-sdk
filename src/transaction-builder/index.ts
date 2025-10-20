import {
  type Asset,
  authorizeEntry,
  type Keypair,
  Operation,
  xdr,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type {
  CreateOperation,
  DepositOperation,
  SpendOperation,
  WithdrawOperation,
  UTXOPublicKey,
  Ed25519PublicKey,
} from "../transaction-builder/types.ts";
import type { StellarSmartContractId } from "../utils/types/stellar.types.ts";
import { generateNonce } from "../utils/common/index.ts";

import type { MoonlightOperation } from "../transaction-builder/types.ts";
import { buildAuthPayloadHash } from "../utils/auth/build-auth-payload.ts";
import type { IUTXOKeypairBase } from "../core/utxo-keypair-base/types.ts";
import {
  createOpToXDR,
  depositOpToXDR,
  withdrawOpToXDR,
  spendOpToXDR,
} from "./xdr/index.ts";
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
import type { Condition } from "../conditions/types.ts";
import { type TransactionSigner, isTransactionSigner } from "@colibri/core";

export class MoonlightTransactionBuilder {
  private create: CreateOperation[] = [];
  private spend: SpendOperation[] = [];
  private deposit: DepositOperation[] = [];
  private withdraw: WithdrawOperation[] = [];
  private channelId: StellarSmartContractId;
  private authId: StellarSmartContractId;
  private asset: Asset;
  private network: string;
  private innerSignatures: Map<Uint8Array, { sig: Buffer; exp: number }> =
    new Map();
  private providerInnerSignatures: Map<
    Ed25519PublicKey,
    { sig: Buffer; exp: number; nonce: string }
  > = new Map();
  private extSignatures: Map<Ed25519PublicKey, xdr.SorobanAuthorizationEntry> =
    new Map();

  constructor({
    channelId,
    authId,
    asset,
    network,
  }: {
    channelId: StellarSmartContractId;
    authId: StellarSmartContractId;
    asset: Asset;
    network: string;
  }) {
    this.channelId = channelId;
    this.authId = authId;
    this.asset = asset;
    this.network = network;
  }

  addCreate(utxo: UTXOPublicKey, amount: bigint) {
    assertNoDuplicateCreate(this.create, utxo);
    assertPositiveAmount(amount, "Create operation");

    this.create.push({ utxo, amount });
    return this;
  }

  addSpend(utxo: UTXOPublicKey, conditions: Condition[]) {
    assertNoDuplicateSpend(this.spend, utxo);

    this.spend.push({ utxo, conditions });
    return this;
  }

  addDeposit(
    pubKey: Ed25519PublicKey,
    amount: bigint,
    conditions: Condition[]
  ) {
    assertNoDuplicatePubKey(this.deposit, pubKey, "Deposit");
    assertPositiveAmount(amount, "Deposit operation");

    this.deposit.push({ pubKey, amount, conditions });
    return this;
  }

  addWithdraw(
    pubKey: Ed25519PublicKey,
    amount: bigint,
    conditions: Condition[]
  ) {
    assertNoDuplicatePubKey(this.withdraw, pubKey, "Withdraw");
    assertPositiveAmount(amount, "Withdraw operation");

    this.withdraw.push({ pubKey, amount, conditions });
    return this;
  }

  addInnerSignature(
    utxo: UTXOPublicKey,
    signature: Buffer,
    expirationLedger: number
  ) {
    assertSpendExists(this.spend, utxo);

    this.innerSignatures.set(utxo, { sig: signature, exp: expirationLedger });
    return this;
  }

  addProviderInnerSignature(
    pubKey: Ed25519PublicKey,
    signature: Buffer,
    expirationLedger: number,
    nonce: string
  ) {
    this.providerInnerSignatures.set(pubKey, {
      sig: signature,
      exp: expirationLedger,
      nonce,
    });
    return this;
  }

  addExtSignedEntry(
    pubKey: Ed25519PublicKey,
    signedAuthEntry: xdr.SorobanAuthorizationEntry
  ) {
    if (
      !this.deposit.find((d) => d.pubKey === pubKey) &&
      !this.withdraw.find((d) => d.pubKey === pubKey)
    )
      throw new Error("No deposit or withdraw operation for this public key");

    this.extSignatures.set(pubKey, signedAuthEntry);
    return this;
  }

  getOperation(): MoonlightOperation {
    return {
      create: this.create,
      spend: this.spend,
      deposit: this.deposit,
      withdraw: this.withdraw,
    };
  }

  getDepositOperation(
    depositor: Ed25519PublicKey
  ): DepositOperation | undefined {
    return this.deposit.find((d) => d.pubKey === depositor);
  }

  getExtAuthEntry(
    address: Ed25519PublicKey,
    nonce: string,
    signatureExpirationLedger: number
  ): xdr.SorobanAuthorizationEntry {
    const deposit = this.getDepositOperation(address);
    if (!deposit) throw new Error("No deposit operation for this address");

    return buildDepositAuthEntry({
      channelId: this.channelId,
      assetId: this.asset.contractId(this.network),
      depositor: address,
      amount: deposit.amount,
      conditions: [
        xdr.ScVal.scvVec(deposit.conditions.map((c) => c.toScVal())),
      ],
      nonce,
      signatureExpirationLedger,
    });
  }

  getAuthRequirementArgs(): xdr.ScVal[] {
    if (this.spend.length === 0) return [];

    const signers: xdr.ScMapEntry[] = [];

    const orderedSpend = orderSpendByUtxo(this.spend);

    for (const spend of orderedSpend) {
      signers.push(
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("P256"),
            xdr.ScVal.scvBytes(Buffer.from(spend.utxo as Uint8Array)),
          ]),
          val: xdr.ScVal.scvVec(spend.conditions.map((c) => c.toScVal())),
        })
      );
    }

    return [xdr.ScVal.scvVec([xdr.ScVal.scvMap(signers)])];
  }

  getOperationAuthEntry(
    nonce: string,
    signatureExpirationLedger: number,
    signed: boolean = false
  ): xdr.SorobanAuthorizationEntry {
    const reqArgs: xdr.ScVal[] = this.getAuthRequirementArgs();

    return buildBundleAuthEntry({
      channelId: this.channelId,
      authId: this.authId,
      args: reqArgs,
      nonce,
      signatureExpirationLedger,
      signaturesXdr: signed ? this.signaturesXDR() : undefined,
    });
  }

  getSignedOperationAuthEntry(): xdr.SorobanAuthorizationEntry {
    const providerSigners = Array.from(this.providerInnerSignatures.keys());

    if (providerSigners.length === 0)
      throw new Error("No Provider signatures added");

    const { nonce, exp: signatureExpirationLedger } =
      this.providerInnerSignatures.get(providerSigners[0])!;

    const reqArgs: xdr.ScVal[] = this.getAuthRequirementArgs();

    return buildBundleAuthEntry({
      channelId: this.channelId,
      authId: this.authId,
      args: reqArgs,
      nonce,
      signatureExpirationLedger,
      signaturesXdr: this.signaturesXDR(),
    });
  }

  async getOperationAuthEntryHash(
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

  signaturesXDR(): string {
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

  async signWithProvider(
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

  async signWithSpendUtxo(
    utxo: IUTXOKeypairBase,
    signatureExpirationLedger: number
  ) {
    const conditions = this.spend.find((s) =>
      Buffer.from(s.utxo).equals(Buffer.from(utxo.publicKey))
    )?.conditions;
    if (!conditions) throw new Error("No spend operation for this UTXO");

    const signedHash = await utxo.signPayload(
      await buildAuthPayloadHash({
        contractId: this.channelId,
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

  async signExtWithEd25519(
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

  getSignedAuthEntries(): xdr.SorobanAuthorizationEntry[] {
    const signedEntries = [
      ...Array.from(this.extSignatures.values()),
      this.getSignedOperationAuthEntry(),
    ];
    return signedEntries;
  }

  getInvokeOperation(): xdr.Operation {
    return Operation.invokeContractFunction({
      contract: this.channelId,

      function: "transact",

      args: [this.buildXDR()],
      auth: [...this.getSignedAuthEntries()],
    });
  }

  buildXDR(): xdr.ScVal {
    return xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("create"),
        val: xdr.ScVal.scvVec(this.create.map((op) => createOpToXDR(op))),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("deposit"),
        val: xdr.ScVal.scvVec(this.deposit.map((op) => depositOpToXDR(op))),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("spend"),
        val: xdr.ScVal.scvVec(this.spend.map((op) => spendOpToXDR(op))),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("withdraw"),
        val: xdr.ScVal.scvVec(this.withdraw.map((op) => withdrawOpToXDR(op))),
      }),
    ]);
  }
}
