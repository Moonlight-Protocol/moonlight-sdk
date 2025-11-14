import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import {
  type ContractId,
  type Ed25519PublicKey,
  LocalSigner,
} from "@colibri/core";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import { generateP256KeyPair } from "../utils/secp256r1/generateP256KeyPair.ts";

import type { CreateCondition } from "../conditions/types.ts";
import { Asset, Networks } from "@stellar/stellar-sdk";

import {
  type CreateOperation,
  type DepositOperation,
  type SpendOperation,
  UTXOOperationType,
  type WithdrawOperation,
} from "../operation/types.ts";
import { MoonlightOperation } from "../operation/index.ts";
import { UTXOKeypairBase } from "../core/utxo-keypair-base/index.ts";
import { MLXDR } from "./index.ts";
import { assert } from "node:console";

describe("MLXDR", () => {
  let validPublicKey: Ed25519PublicKey;
  let validUtxo: UTXOPublicKey;

  let channelId: ContractId;

  let assetId: ContractId;
  let network: string;

  beforeAll(async () => {
    validPublicKey = LocalSigner.generateRandom()
      .publicKey() as Ed25519PublicKey;
    validUtxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;

    channelId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;

    network = Networks.TESTNET;
    assetId = Asset.native().contractId(network) as ContractId;
  });

  describe("OperationsBundle MLXDR", () => {
    it("should verify if the Operations Bundle is a valid MLXDR", () => {
      const createOp = MoonlightOperation.create(validUtxo, 10n);

      const opBundleMLXDR = MLXDR.fromOperationsBundle([createOp]);

      assertEquals(MLXDR.isOperationsBundle(opBundleMLXDR), true);
    });
    it("should convert to and from one operation", () => {
      const createOp = MoonlightOperation.create(validUtxo, 10n);

      const opBundleMLXDR = MLXDR.fromOperationsBundle([createOp]);

      const recreatedOps = MLXDR.toOperationsBundle(opBundleMLXDR);

      assertEquals(recreatedOps.length, 1);
      assertEquals(recreatedOps[0].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[0].getAmount(), 10n);
      assert(recreatedOps[0].isCreate());

      assertEquals(
        (recreatedOps[0] as CreateOperation).getUtxo().toString(),
        validUtxo.toString(),
      );
    });

    it("should convert to and from multiple Operations", () => {
      const createOpA = MoonlightOperation.create(validUtxo, 10n);
      const createOpB = MoonlightOperation.create(validUtxo, 20n);
      const createOpC = MoonlightOperation.create(validUtxo, 30n);

      const opBundleMLXDR = MLXDR.fromOperationsBundle([
        createOpA,
        createOpB,
        createOpC,
      ]);

      const recreatedOps = MLXDR.toOperationsBundle(opBundleMLXDR);

      assertEquals(recreatedOps.length, 3);

      assertEquals(recreatedOps[0].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[0].getAmount(), 10n);
      assert(recreatedOps[0].isCreate());
      assertEquals(
        (recreatedOps[0] as CreateOperation).getUtxo().toString(),
        validUtxo.toString(),
      );

      assertEquals(recreatedOps[1].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[1].getAmount(), 20n);
      assert(recreatedOps[1].isCreate());
      assertEquals(
        (recreatedOps[1] as CreateOperation).getUtxo().toString(),
        validUtxo.toString(),
      );

      assertEquals(recreatedOps[2].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[2].getAmount(), 30n);
      assert(recreatedOps[2].isCreate());
      assertEquals(
        (recreatedOps[2] as CreateOperation).getUtxo().toString(),
        validUtxo.toString(),
      );
    });

    it("should convert to and from multiple mixed operations", () => {
      const createOp = MoonlightOperation.create(validUtxo, 10n);
      const depositOp = MoonlightOperation.deposit(validPublicKey, 20n);
      const withdrawOp = MoonlightOperation.withdraw(validPublicKey, 30n);
      const spendOp = MoonlightOperation.spend(validUtxo);

      const opBundleMLXDR = MLXDR.fromOperationsBundle([
        createOp,
        depositOp,
        withdrawOp,
        spendOp,
      ]);

      const recreatedOps = MLXDR.toOperationsBundle(opBundleMLXDR);

      assertEquals(recreatedOps.length, 4);

      assertEquals(recreatedOps[0].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[0].getAmount(), 10n);
      assert(recreatedOps[0].isCreate());
      assertEquals(
        (recreatedOps[0] as CreateOperation).getUtxo().toString(),
        validUtxo.toString(),
      );

      assertEquals(recreatedOps[1].getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(recreatedOps[1].getAmount(), 20n);
      assert(recreatedOps[1].isDeposit());
      assertEquals(
        (recreatedOps[1] as DepositOperation).getPublicKey().toString(),
        validPublicKey.toString(),
      );

      assertEquals(recreatedOps[2].getOperation(), UTXOOperationType.WITHDRAW);
      assertEquals(recreatedOps[2].getAmount(), 30n);
      assert(recreatedOps[2].isWithdraw());
      assertEquals(
        (recreatedOps[2] as WithdrawOperation).getPublicKey().toString(),
        validPublicKey.toString(),
      );

      assertEquals(recreatedOps[3].getOperation(), UTXOOperationType.SPEND);
      assert(recreatedOps[3].isSpend());
      assertEquals(
        (recreatedOps[3] as SpendOperation).getUtxo().toString(),
        validUtxo.toString(),
      );
    });

    it("should handle signed operations in an Operation Bundle", async () => {
      const userSigner = LocalSigner.generateRandom();
      const spender = new UTXOKeypairBase(await generateP256KeyPair());
      const createOp = MoonlightOperation.create(validUtxo, 1000n);

      const depositOp = await MoonlightOperation.deposit(
        userSigner.publicKey() as Ed25519PublicKey,
        1000n,
      ).addCondition(createOp.toCondition()).signWithEd25519(
        userSigner,
        100000,
        channelId,
        assetId,
        network,
      );

      const spendOp = await MoonlightOperation.spend(
        spender.publicKey,
      ).addCondition(createOp.toCondition()).signWithUTXO(
        spender,
        channelId,
        1000,
      );

      const withdrawOp = await MoonlightOperation.withdraw(
        userSigner.publicKey() as Ed25519PublicKey,
        500n,
      ).addCondition(createOp.toCondition());

      const opBundleMLXDR = MLXDR.fromOperationsBundle([
        createOp,
        depositOp,
        withdrawOp,
        spendOp,
      ]);

      const recreatedOps = MLXDR.toOperationsBundle(opBundleMLXDR);

      assertEquals(recreatedOps.length, 4);

      // Validate create Operation Signature
      assertEquals(recreatedOps[0].getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOps[0].getAmount(), 1000n);
      assert(recreatedOps[0].isCreate());
      assertEquals(
        (recreatedOps[0] as CreateCondition).getUtxo().toString(),
        validUtxo.toString(),
      );

      // Validate deposit Operation Signature
      assertEquals(recreatedOps[1].getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(recreatedOps[1].getAmount(), 1000n);
      assert(recreatedOps[1].isDeposit());
      assertEquals(
        (recreatedOps[1] as DepositOperation).getPublicKey().toString(),
        userSigner.publicKey().toString(),
      );
      assertEquals(
        (recreatedOps[1] as DepositOperation).isSignedByEd25519(),
        true,
      );
      assertExists(
        (recreatedOps[1] as DepositOperation).getEd25519Signature(),
      );
      assertEquals(
        (recreatedOps[1] as DepositOperation).getConditions(),
        depositOp.getConditions(),
      );
      // Validate withdraw Operation Signature
      assertEquals(recreatedOps[2].getOperation(), UTXOOperationType.WITHDRAW);
      assertEquals(recreatedOps[2].getAmount(), 500n);
      assert(recreatedOps[2].isWithdraw());
      assertEquals(
        (recreatedOps[2] as WithdrawOperation).getPublicKey().toString(),
        userSigner.publicKey().toString(),
      );

      assertEquals(
        (recreatedOps[2] as WithdrawOperation).getConditions(),
        withdrawOp.getConditions(),
      );
      // Validate spend Operation Signature
      assertEquals(recreatedOps[3].getOperation(), UTXOOperationType.SPEND);
      assert(recreatedOps[3].isSpend());
      assertEquals(
        (recreatedOps[3] as SpendOperation).getUtxo().toString(),
        spender.publicKey.toString(),
      );
      assertEquals(
        (recreatedOps[3] as SpendOperation).isSignedByUTXO(),
        true,
      );
      assertExists(
        (recreatedOps[3] as SpendOperation).getUTXOSignature(),
      );
      assertEquals(
        (recreatedOps[3] as SpendOperation).getConditions(),
        spendOp.getConditions(),
      );
    });
  });
});
