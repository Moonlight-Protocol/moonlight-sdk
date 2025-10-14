import {
  Asset,
  authorizeEntry,
  hash,
  Keypair,
  StrKey,
  xdr,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { CreateOperation, DepositOperation, SpendOperation, WithdrawOperation, UTXOPublicKey, Ed25519PublicKey } from "../transaction-builder/types.ts";
import { StellarSmartContractId } from "../utils/types/stellar.types.ts";
import { Condition } from "../conditions/types.ts";
import { sha256Buffer } from "../utils/hash/sha256Buffer.ts";
import { generateNonce } from "../utils/common/index.ts";
import { generateDepositAuthEntry } from "../utils/auth/deposit-auth-entry.ts";
import { generateBundleAuthEntry } from "../utils/auth/bundle-auth-entry.ts";
import { conditionToXDR } from "../conditions/index.ts";
import { MoonlightOperation } from "../transaction-builder/types.ts";
import { buildAuthPayloadHash } from "../utils/auth/build-auth-payload.ts";
import { IUTXOKeypairBase } from "../core/utxo-keypair-base/types.ts";

export const createOpToXDR = (op: CreateOperation): xdr.ScVal => {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvBytes(Buffer.from(op.utxo as Uint8Array)),
    nativeToScVal(op.amount, { type: "i128" }),
  ]);
};

export const depositOpToXDR = (op: DepositOperation): xdr.ScVal => {
  return xdr.ScVal.scvVec([
    nativeToScVal(op.pubKey, { type: "address" }),
    nativeToScVal(op.amount, { type: "i128" }),
    op.conditions.length === 0
      ? xdr.ScVal.scvVec(null)
      : xdr.ScVal.scvVec(op.conditions.map((c) => conditionToXDR(c))),
  ]);
};

export const withdrawOpToXDR = (op: WithdrawOperation): xdr.ScVal => {
  return xdr.ScVal.scvVec([
    nativeToScVal(op.pubKey, { type: "address" }),
    nativeToScVal(op.amount, { type: "i128" }),
    op.conditions.length === 0
      ? xdr.ScVal.scvVec(null)
      : xdr.ScVal.scvVec(op.conditions.map((c) => conditionToXDR(c))),
  ]);
};

export const spendOpToXDR = (op: SpendOperation): xdr.ScVal => {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvBytes(Buffer.from(op.utxo as Uint8Array)),
    op.conditions.length === 0
      ? xdr.ScVal.scvVec(null)
      : xdr.ScVal.scvVec(op.conditions.map((c) => conditionToXDR(c))),
  ]);
};

export class MoonlightTransactionBuilder {
  private create: CreateOperation[] = [];
  private spend: SpendOperation[] = [];
  private deposit: DepositOperation[] = [];
  private withdraw: WithdrawOperation[] = [];
  private channelId: StellarSmartContractId;
  private authId: StellarSmartContractId;
  private asset: Asset;
  private network: string;
  private innerSignatures: Map<
    Uint8Array,
    { sig: Buffer<ArrayBufferLike>; exp: number }
  > = new Map();
  private providerInnerSignatures: Map<
    Ed25519PublicKey,
    { sig: Buffer<ArrayBufferLike>; exp: number; nonce: string }
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
    if (this.create.find((c) => Buffer.from(c.utxo).equals(Buffer.from(utxo))))
      throw new Error("Create operation for this UTXO already exists");

    if (amount <= 0n)
      throw new Error("Create operation amount must be positive");

    this.create.push({ utxo, amount });
    return this;
  }

  addSpend(utxo: UTXOPublicKey, conditions: Condition[]) {
    if (this.spend.find((s) => Buffer.from(s.utxo).equals(Buffer.from(utxo))))
      throw new Error("Spend operation for this UTXO already exists");

    this.spend.push({ utxo, conditions });
    return this;
  }

  addDeposit(
    pubKey: Ed25519PublicKey,
    amount: bigint,
    conditions: Condition[]
  ) {
    if (this.deposit.find((d) => d.pubKey === pubKey))
      throw new Error("Deposit operation for this public key already exists");

    if (amount <= 0n)
      throw new Error("Deposit operation amount must be positive");

    this.deposit.push({ pubKey, amount, conditions });
    return this;
  }

  addWithdraw(
    pubKey: Ed25519PublicKey,
    amount: bigint,
    conditions: Condition[]
  ) {
    if (this.withdraw.find((d) => d.pubKey === pubKey))
      throw new Error("Withdraw operation for this public key already exists");

    if (amount <= 0n)
      throw new Error("Withdraw operation amount must be positive");

    this.withdraw.push({ pubKey, amount, conditions });
    return this;
  }

  addInnerSignature(
    utxo: UTXOPublicKey,
    signature: Buffer<ArrayBufferLike>,
    expirationLedger: number
  ) {
    if (!this.spend.find((s) => Buffer.from(s.utxo).equals(Buffer.from(utxo))))
      throw new Error("No spend operation for this UTXO");

    this.innerSignatures.set(utxo, { sig: signature, exp: expirationLedger });
    return this;
  }

  addProviderInnerSignature(
    pubKey: Ed25519PublicKey,
    signature: Buffer<ArrayBufferLike>,
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

    return generateDepositAuthEntry({
      channelId: this.channelId,
      assetId: this.asset.contractId(this.network),
      depositor: address,
      amount: deposit.amount,
      conditions: [xdr.ScVal.scvVec(deposit.conditions.map(conditionToXDR))],
      nonce,
      signatureExpirationLedger,
    });
  }

  getAuthRequirementArgs(): xdr.ScVal[] {
    if (this.spend.length === 0) return [];

    const signers: xdr.ScMapEntry[] = [];

    const orderedSpend = this.spend.sort((a, b) =>
      Buffer.from(a.utxo).compare(Buffer.from(b.utxo))
    );

    for (const spend of orderedSpend) {
      signers.push(
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("P256"),
            xdr.ScVal.scvBytes(Buffer.from(spend.utxo as Uint8Array)),
          ]),
          val: xdr.ScVal.scvVec(spend.conditions.map(conditionToXDR)),
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

    return generateBundleAuthEntry({
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

    return generateBundleAuthEntry({
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
    const networkId = hash(Buffer.from(this.network));

    const rootInvocation = this.getOperationAuthEntry(
      nonce,
      signatureExpirationLedger
    ).rootInvocation();

    const bundleHashPreImageInner = new xdr.HashIdPreimageSorobanAuthorization({
      networkId: networkId,
      nonce: xdr.Int64.fromString(nonce),
      signatureExpirationLedger,
      invocation: rootInvocation,
    });

    const bundleHashPreImage =
      xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        bundleHashPreImageInner
      );

    const xdrPayload = bundleHashPreImage.toXDR();

    // Get the XDR buffer and hash it
    return Buffer.from(await sha256Buffer(xdrPayload));
  }

  signaturesXDR(): string {
    const providerSigners = Array.from(this.providerInnerSignatures.keys());
    const spendSigners = Array.from(this.innerSignatures.keys());

    const ortderedProviderSigners = providerSigners.sort((a, b) =>
      a.localeCompare(b)
    );
    const orderedSpendSigners = spendSigners.sort((a, b) =>
      Buffer.from(a).compare(Buffer.from(b))
    );

    if (ortderedProviderSigners.length === 0) {
      throw new Error("No Provider signatures added");
    }

    // MAPs must always be ordered by key so here it is providers -> P256 and each one ordered by pk
    const signatures = xdr.ScVal.scvVec([
      xdr.ScVal.scvMap([
        ...orderedSpendSigners.map((utxo) => {
          const { sig, exp } = this.innerSignatures.get(utxo)!;

          return new xdr.ScMapEntry({
            key: xdr.ScVal.scvVec([
              xdr.ScVal.scvSymbol("P256"),
              xdr.ScVal.scvBytes(Buffer.from(utxo)),
            ]),
            val: xdr.ScVal.scvVec([
              xdr.ScVal.scvVec([
                xdr.ScVal.scvSymbol("P256"),
                xdr.ScVal.scvBytes(sig),
              ]),

              xdr.ScVal.scvU32(exp),
            ]),
          });
        }),
        ...ortderedProviderSigners.map((pk) => {
          const { sig, exp } = this.providerInnerSignatures.get(pk)!;

          return new xdr.ScMapEntry({
            key: xdr.ScVal.scvVec([
              xdr.ScVal.scvSymbol("Provider"),
              xdr.ScVal.scvBytes(StrKey.decodeEd25519PublicKey(pk)),
            ]),
            val: xdr.ScVal.scvVec([
              xdr.ScVal.scvVec([
                xdr.ScVal.scvSymbol("Ed25519"),
                xdr.ScVal.scvBytes(sig),
              ]),

              xdr.ScVal.scvU32(exp),
            ]),
          });
        }),
      ]),
    ]);

    return signatures.toXDR("base64");
  }

  async signWithProvider(
    providerKeys: Keypair,
    signatureExpirationLedger: number,
    nonce?: string
  ) {
    if (!nonce) nonce = generateNonce();

    const signedHash = providerKeys.sign(
      await this.getOperationAuthEntryHash(nonce, signatureExpirationLedger)
    );

    this.addProviderInnerSignature(
      providerKeys.publicKey() as Ed25519PublicKey,
      signedHash,
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
    keys: Keypair,
    signatureExpirationLedger: number,
    nonce?: string
  ) {
    if (!nonce) nonce = generateNonce();

    const rawAuthEntry = this.getExtAuthEntry(
      keys.publicKey() as Ed25519PublicKey,
      nonce,
      signatureExpirationLedger
    );

    const signedAuthEntry = await authorizeEntry(
      rawAuthEntry,
      keys,
      signatureExpirationLedger,
      this.network
    );

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