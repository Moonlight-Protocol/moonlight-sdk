import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { LocalSigner } from "@colibri/core";
import { Asset, Networks } from "@stellar/stellar-sdk";
import type { Ed25519PublicKey, ContractId } from "@colibri/core";
import { MoonlightTransactionBuilder } from "./index.ts";
import { Condition } from "../conditions/index.ts";
import { MoonlightOperation as Operation } from "../operation/index.ts";

import { generateP256KeyPair } from "../utils/secp256r1/generateP256KeyPair.ts";
import { Buffer } from "buffer";
import { generateNonce } from "../utils/common/index.ts";
import { UTXOKeypairBase } from "../core/utxo-keypair-base/index.ts";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import * as OPR_ERR from "../operation/error.ts";
import * as TBU_ERR from "./error.ts";

describe("MoonlightTransactionBuilder", () => {
  let validPublicKey: Ed25519PublicKey;

  let validAmount: bigint;
  let channelId: ContractId;
  let authId: ContractId;
  let assetId: ContractId;
  let network: string;
  let builder: MoonlightTransactionBuilder;

  beforeAll(() => {
    validPublicKey =
      LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;

    validAmount = 1000n;
    channelId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;
    authId =
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" as ContractId;
    network = Networks.TESTNET;
    assetId = Asset.native().contractId(network) as ContractId;

    builder = new MoonlightTransactionBuilder({
      channelId,
      authId,
      assetId,
      network,
    });
  });

  describe("Construction", () => {
    it("should create a transaction builder with valid parameters", () => {
      const txBuilder = new MoonlightTransactionBuilder({
        channelId,
        authId,
        assetId,
        network,
      });

      assertExists(txBuilder);
      assertEquals(txBuilder.getChannelId(), channelId);
      assertEquals(txBuilder.getAuthId(), authId);
      assertEquals(txBuilder.getAssetId(), assetId);
    });

    it("should initialize with empty operation arrays", () => {
      const txBuilder = new MoonlightTransactionBuilder({
        channelId,
        authId,
        assetId,
        network,
      });

      assertEquals(txBuilder.getCreateOperations().length, 0);
      assertEquals(txBuilder.getSpendOperations().length, 0);
      assertEquals(txBuilder.getDepositOperations().length, 0);
      assertEquals(txBuilder.getWithdrawOperations().length, 0);
    });
  });

  describe("Features", () => {
    describe("Operation Management", () => {
      it("should add CREATE operations successfully", async () => {
        const utxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;
        const operation = Operation.create(utxo, validAmount);
        // Note: CREATE operations don't have conditions

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        testBuilder.addOperation(operation);

        const creates = testBuilder.getCreateOperations();
        assertEquals(creates.length, 1);
        assertEquals(creates[0].getAmount(), validAmount);
      });

      it("should return correct deposit operation by public key", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation = Operation.deposit(pubKey, validAmount);
        operation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation);

        const foundOperation = testBuilder.getDepositOperation(pubKey);
        assertExists(foundOperation);
        assertEquals(foundOperation.getPublicKey(), pubKey);
        assertEquals(foundOperation.getAmount(), validAmount);
      });

      it("should return undefined for non-existent deposit operation", () => {
        const nonExistentKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
        const foundOperation = builder.getDepositOperation(nonExistentKey);
        assertEquals(foundOperation, undefined);
      });
    });

    describe("Signature Management", () => {
      it("should add signed UTXO operations", async () => {
        const utxoKp = new UTXOKeypairBase(await generateP256KeyPair());
        const utxo = utxoKp.publicKey as UTXOPublicKey;
        const condition = Condition.create(utxo, validAmount);
        const spendOperation = Operation.spend(utxo);
        spendOperation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        const expirationLedger = 1000000;
        await spendOperation.signWithUTXO(utxoKp, channelId, expirationLedger);

        // Add spend operation first
        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addSpend(spendOperation);

        // deno-lint-ignore no-explicit-any
        const signatures = (testBuilder as any).innerSignatures;
        assertEquals(signatures.size, 1);
      });

      it("should add provider inner signatures", () => {
        const signature = Buffer.from("provider_signature");
        const expirationLedger = 1000000;
        const nonce = generateNonce();

        builder.addProviderInnerSignature(
          validPublicKey,
          signature,
          expirationLedger,
          nonce
        );

        // deno-lint-ignore no-explicit-any
        const providerSigs = (builder as any).providerInnerSignatures;
        assertEquals(providerSigs.size >= 1, true);
      });
      it("should sign with provider using keypair", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const signatureExpirationLedger = 1000000;
        const nonce = generateNonce();

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );

        // deno-lint-ignore no-explicit-any
        const providerSigs = (testBuilder as any).providerInnerSignatures;
        assertEquals(providerSigs.size, 1);
        assertEquals(
          providerSigs.has(providerKeys.publicKey() as Ed25519PublicKey),
          true
        );
      });

      it("should sign with provider and auto-generate nonce if not provided", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const signatureExpirationLedger = 1000000;

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger
        );

        // deno-lint-ignore no-explicit-any
        const providerSigs = (testBuilder as any).providerInnerSignatures;
        assertEquals(providerSigs.size, 1);

        // Verify nonce was auto-generated
        const sigData = providerSigs.get(
          providerKeys.publicKey() as Ed25519PublicKey
        );
        assertExists(sigData.nonce);
      });

      it("should sign with spend UTXO", async () => {
        const utxoKeys = new UTXOKeypairBase(await generateP256KeyPair());
        const utxo = utxoKeys.publicKey as UTXOPublicKey;
        const spendOperation = Operation.spend(utxo);

        spendOperation.addCondition(
          Condition.create(
            (await generateP256KeyPair()).publicKey as UTXOPublicKey,
            1n
          )
        );
        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addSpend(spendOperation);

        const signatureExpirationLedger = 1000000;

        await testBuilder.signWithSpendUtxo(
          utxoKeys,
          signatureExpirationLedger
        );

        // deno-lint-ignore no-explicit-any
        const innerSigs = (testBuilder as any).innerSignatures;
        assertEquals(innerSigs.size, 1);
      });

      it("should sign external entry with Ed25519 keys", async () => {
        const userKeys = LocalSigner.generateRandom();
        const pubKey = userKeys.publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation = Operation.deposit(pubKey, validAmount);
        operation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation);

        const nonce = generateNonce();
        const signatureExpirationLedger = 1000000;

        await testBuilder.signExtWithEd25519(
          userKeys,

          signatureExpirationLedger,
          nonce
        );

        // deno-lint-ignore no-explicit-any
        const extSigs = (testBuilder as any).extSignatures;
        assertEquals(extSigs.size, 1);
        assertEquals(extSigs.has(pubKey), true);
      });

      it("should add external signed entry", async () => {
        const depositorKeys = LocalSigner.generateRandom();
        const pubKey = depositorKeys.publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation = Operation.deposit(pubKey, validAmount);
        operation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        const nonce = generateNonce();
        const signatureExpirationLedger = 1000000;

        await operation.signWithEd25519(
          depositorKeys,
          signatureExpirationLedger,
          channelId,
          assetId,
          network,
          nonce
        );
        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation);

        // deno-lint-ignore no-explicit-any
        const extSigs = (testBuilder as any).extSignatures;
        assertEquals(extSigs.size, 1);
        assertEquals(extSigs.has(pubKey), true);
      });
    });

    describe("XDR Generation", () => {
      it("should build XDR with empty operations", () => {
        const xdr = builder.buildXDR();

        assertExists(xdr);
        assertEquals(xdr.switch().name, "scvMap");

        const mapEntries = xdr.map();
        if (mapEntries) {
          assertEquals(mapEntries.length, 4); // create, deposit, spend, withdraw
        }
      });

      it("should build XDR with operations", async () => {
        const utxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;
        const operation = Operation.create(utxo, validAmount);
        // Note: CREATE operations don't have conditions

        const builderWithOps = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        builderWithOps.addOperation(operation);
        const xdr = builderWithOps.buildXDR();

        assertExists(xdr);
        assertEquals(xdr.switch().name, "scvMap");
      });
    });

    describe("Auth Entry Generation", () => {
      it("should generate operation auth entry with valid parameters", () => {
        const nonce = generateNonce();
        const signatureExpirationLedger = 1000000;

        const authEntry = builder.getOperationAuthEntry(
          nonce,
          signatureExpirationLedger
        );

        assertExists(authEntry);
        assertEquals(typeof authEntry.toXDR, "function");
      });

      it("should generate operation auth entry hash", async () => {
        const nonce = generateNonce();
        const signatureExpirationLedger = 1000000;

        const hash = await builder.getOperationAuthEntryHash(
          nonce,
          signatureExpirationLedger
        );

        assertExists(hash);
        assertEquals(Buffer.isBuffer(hash), true);
        assertEquals(hash.length > 0, true);
      });

      it("should get auth requirement args for operation with spend operations", async () => {
        const utxoKeys = await generateP256KeyPair();
        const utxo = utxoKeys.publicKey as UTXOPublicKey;
        const condition = Condition.create(utxo, validAmount);
        const spendOperation = Operation.spend(utxo);
        spendOperation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addSpend(spendOperation);

        const args = testBuilder.getAuthRequirementArgs();

        assertExists(args);
        assertEquals(Array.isArray(args), true);
        assertEquals(args.length, 1);

        // Verify the structure: [scvVec([scvMap(signers)])]
        assertEquals(args[0].switch().name, "scvVec");
        const vec = args[0].vec();
        assertEquals(vec?.length, 1);
        assertEquals(vec?.[0].switch().name, "scvMap");
      });

      it("should return empty array when no spend operations exist", () => {
        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        const args = testBuilder.getAuthRequirementArgs();

        assertExists(args);
        assertEquals(Array.isArray(args), true);
        assertEquals(args.length, 0);
      });

      it("should get signed operation auth entry with provider signatures", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const signatureExpirationLedger = 1000000;

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger
        );

        const signedEntry = testBuilder.getSignedOperationAuthEntry();

        assertExists(signedEntry);
        assertEquals(typeof signedEntry.toXDR, "function");
      });

      it("should get signed auth entries including external signatures", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const userKeys = LocalSigner.generateRandom();
        const pubKey = userKeys.publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation = Operation.deposit(pubKey, validAmount);
        operation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation);

        const signatureExpirationLedger = 1000000;
        const nonce = generateNonce();

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );
        await testBuilder.signExtWithEd25519(
          userKeys,

          signatureExpirationLedger,
          nonce
        );

        const signedEntries = testBuilder.getSignedAuthEntries();

        assertExists(signedEntries);
        assertEquals(Array.isArray(signedEntries), true);
        assertEquals(signedEntries.length >= 2, true); // At least provider + external
      });
    });

    describe("Signatures XDR", () => {
      it("should generate signatures XDR when provider signatures exist", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
        const signature = Buffer.from("provider_signature");
        const expirationLedger = 1000000;
        const nonce = generateNonce();

        const builderWithSigs = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        builderWithSigs.addProviderInnerSignature(
          pubKey,
          signature,
          expirationLedger,
          nonce
        );

        const signaturesXdr = builderWithSigs.signaturesXDR();

        assertExists(signaturesXdr);
        assertEquals(typeof signaturesXdr, "string");
        assertEquals(signaturesXdr.length > 0, true);
      });
    });

    describe("Invoke Operation", () => {
      it("should get invoke operation with all components", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const userKeys = LocalSigner.generateRandom();
        const pubKey = userKeys.publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation = Operation.deposit(pubKey, validAmount);
        operation.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation);

        const signatureExpirationLedger = 1000000;
        const nonce = generateNonce();

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );
        await testBuilder.signExtWithEd25519(
          userKeys,

          signatureExpirationLedger,
          nonce
        );

        const invokeOp = testBuilder.getInvokeOperation();

        assertExists(invokeOp);
        assertEquals(typeof invokeOp.toXDR, "function");
      });

      it("should get invoke operation without external signatures", async () => {
        const providerKeys = LocalSigner.generateRandom();
        const signatureExpirationLedger = 1000000;

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await testBuilder.signWithProvider(
          providerKeys,
          signatureExpirationLedger
        );

        const invokeOp = testBuilder.getInvokeOperation();

        assertExists(invokeOp);
        assertEquals(typeof invokeOp.toXDR, "function");
      });
    });

    describe("Signatures XDR", () => {
      // ... existing signatures XDR tests ...
    });
  });

  describe("Errors", () => {
    describe("Operation Validation", () => {
      it("should throw error for duplicate CREATE operations", async () => {
        const utxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;
        const operation1 = Operation.create(utxo, validAmount);
        // Note: CREATE operations don't have conditions
        const operation2 = Operation.create(utxo, validAmount + 100n);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        testBuilder.addOperation(operation1);

        assertThrows(
          () => testBuilder.addOperation(operation2),
          TBU_ERR.DUPLICATE_CREATE_OP
        );
      });

      it("should throw error for duplicate DEPOSIT operations", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
        const condition = Condition.deposit(pubKey, validAmount);
        const operation1 = Operation.deposit(pubKey, validAmount);
        operation1.addCondition(condition);
        const operation2 = Operation.deposit(pubKey, validAmount + 100n);
        operation2.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addDeposit(operation1);

        assertThrows(
          // deno-lint-ignore no-explicit-any
          () => (testBuilder as any).addDeposit(operation2),
          TBU_ERR.DUPLICATE_DEPOSIT_OP
        );
      });

      it("should throw error for duplicate WITHDRAW operations", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
        const condition = Condition.withdraw(pubKey, validAmount);
        const operation1 = Operation.withdraw(pubKey, validAmount);
        operation1.addCondition(condition);
        const operation2 = Operation.withdraw(pubKey, validAmount + 100n);
        operation2.addCondition(condition);

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        // deno-lint-ignore no-explicit-any
        (testBuilder as any).addWithdraw(operation1);

        assertThrows(
          // deno-lint-ignore no-explicit-any
          () => (testBuilder as any).addWithdraw(operation2),
          TBU_ERR.DUPLICATE_WITHDRAW_OP
        );
      });

      it("should throw error for zero amount in CREATE operation", async () => {
        const utxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;

        assertRejects(
          async () => await Operation.create(utxo, 0n),
          OPR_ERR.AMOUNT_TOO_LOW
        );
      });

      it("should throw error for negative amount in DEPOSIT operation", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;

        assertThrows(
          () => Operation.deposit(pubKey, -100n),
          OPR_ERR.AMOUNT_TOO_LOW
        );
      });

      it("should throw error for negative amount in WITHDRAW operation", () => {
        const pubKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;

        assertThrows(
          () => Operation.withdraw(pubKey, -10n),
          OPR_ERR.AMOUNT_TOO_LOW
        );
      });
    });

    describe("Signature Validation", () => {
      it("should throw error when adding inner signature without spend operation", async () => {
        const expirationLedger = 1000000;
        const nonExistentUtxo = new UTXOKeypairBase(
          await generateP256KeyPair()
        );

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await assertRejects(
          () =>
            testBuilder.signWithSpendUtxo(nonExistentUtxo, expirationLedger),
          TBU_ERR.NO_SPEND_OPS
        );
      });

      it("should throw error when adding external signature without deposit/withdraw operation", () => {
        // deno-lint-ignore no-explicit-any
        const mockAuthEntry = {} as any;
        const nonExistentKey =
          LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        assertThrows(
          () => testBuilder.addExtSignedEntry(nonExistentKey, mockAuthEntry),
          TBU_ERR.NO_EXT_OPS
        );
      });

      it("should throw error when generating signatures XDR without provider signatures", () => {
        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        assertThrows(
          () => testBuilder.signaturesXDR(),
          TBU_ERR.MISSING_PROVIDER_SIGNATURE
        );
      });

      it("should throw error when getting signed operation auth entry without provider signatures", () => {
        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        assertThrows(
          () => testBuilder.getSignedOperationAuthEntry(),
          Error,
          "No Provider signatures added"
        );
      });
    });

    describe("External Auth Entry Validation", () => {
      it("should throw error when getting external auth entry for non-existent deposit", async () => {
        const nonExistentKey = LocalSigner.generateRandom();
        const nonce = generateNonce();
        const signatureExpirationLedger = 1000000;

        const testBuilder = new MoonlightTransactionBuilder({
          channelId,
          authId,
          assetId,
          network,
        });

        await assertRejects(
          async () =>
            await testBuilder.signExtWithEd25519(
              nonExistentKey,
              signatureExpirationLedger,
              nonce
            ),
          TBU_ERR.NO_DEPOSIT_OPS
        );
      });
    });

    describe("Property Access Validation", () => {
      it("should throw error when accessing unset properties", () => {
        const emptyBuilder = Object.create(
          MoonlightTransactionBuilder.prototype
        );

        assertThrows(
          // deno-lint-ignore no-explicit-any
          () => (emptyBuilder as any).require("_channelId"),
          TBU_ERR.PROPERTY_NOT_SET
        );
      });
    });
  });
});
