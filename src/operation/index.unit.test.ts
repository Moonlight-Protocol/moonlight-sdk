import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import {
  type ContractId,
  type Ed25519PublicKey,
  LocalSigner,
} from "@colibri/core";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import { generateP256KeyPair } from "../utils/secp256r1/generateP256KeyPair.ts";
import { MoonlightOperation } from "./index.ts";
import { UTXOOperationType } from "./types.ts";
import type { CreateCondition } from "../conditions/types.ts";
import { Condition } from "../conditions/index.ts";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { UTXOKeypairBase } from "../core/utxo-keypair-base/index.ts";

describe("Operation", () => {
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

  describe(" ScValConversions", () => {
    it("should convert to and from ScVal correctly for Create operation", () => {
      const createOp = MoonlightOperation.create(validUtxo, 10n);

      const scVal = createOp.toScVal();
      const recreatedOp = MoonlightOperation.fromScVal(
        scVal,
        UTXOOperationType.CREATE,
      );

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOp.getAmount(), 10n);
      assertEquals(recreatedOp.getUtxo().toString(), validUtxo.toString());

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.DEPOSIT);
      });

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.WITHDRAW);
      });
      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.SPEND);
      });
    });

    it("should convert to and from ScVal correctly for Spend operation without conditions", () => {
      const spendOp = MoonlightOperation.spend(validUtxo);

      const scVal = spendOp.toScVal();
      const recreatedOp = MoonlightOperation.fromScVal(
        scVal,
        UTXOOperationType.SPEND,
      );

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.SPEND);
      assertEquals(recreatedOp.getUtxo().toString(), validUtxo.toString());
      assertEquals(recreatedOp.getConditions().length, 0);

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.CREATE);
      });

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.DEPOSIT);
      });

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.WITHDRAW);
      });
    });

    it("should convert to and from ScVal correctly for Spend operation with conditions", () => {
      const spendOp = MoonlightOperation.spend(validUtxo);
      spendOp.addCondition(
        MoonlightOperation.create(validUtxo, 500n).toCondition(),
      );
      spendOp.addCondition(
        MoonlightOperation.create(validUtxo, 300n).toCondition(),
      );
      const scVal = spendOp.toScVal();
      const recreatedOp = MoonlightOperation.fromScVal(
        scVal,
        UTXOOperationType.SPEND,
      );

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.SPEND);
      assertEquals(recreatedOp.getUtxo().toString(), validUtxo.toString());
      assertEquals(recreatedOp.getConditions().length, 2);
      assertEquals(recreatedOp.getConditions()[0].isCreate(), true);
      assertEquals(
        (recreatedOp.getConditions()[0] as CreateCondition).getUtxo(),
        validUtxo,
      );
      assertEquals(recreatedOp.getConditions()[0].getAmount(), 500n);
      assertEquals(recreatedOp.getConditions()[1].isCreate(), true);
      assertEquals(
        (recreatedOp.getConditions()[1] as CreateCondition).getUtxo(),
        validUtxo,
      );
      assertEquals(recreatedOp.getConditions()[1].getAmount(), 300n);

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.CREATE);
      });
      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.DEPOSIT);
      });
      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.WITHDRAW);
      });
    });

    it("should convert to and from ScVal correctly for Deposit operation", () => {
      const depositOp = MoonlightOperation.deposit(validPublicKey, 20n);
      const scVal = depositOp.toScVal();
      const recreatedOp = MoonlightOperation.fromScVal(
        scVal,
        UTXOOperationType.DEPOSIT,
      );

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(recreatedOp.getAmount(), 20n);
      assertEquals(
        recreatedOp.getPublicKey().toString(),
        validPublicKey.toString(),
      );
      assertEquals(recreatedOp.getConditions().length, 0);

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.CREATE);
      });

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.SPEND);
      });

      // Cannot enforce against withdraw as it shares the same ScVal structure as Deposit

      depositOp.addCondition(
        MoonlightOperation.create(validUtxo, 200n).toCondition(),
      );
      const scValWithCondition = depositOp.toScVal();
      const recreatedOpWithCondition = MoonlightOperation.fromScVal(
        scValWithCondition,
        UTXOOperationType.DEPOSIT,
      );

      assertEquals(
        recreatedOpWithCondition.getOperation(),
        UTXOOperationType.DEPOSIT,
      );
      assertEquals(recreatedOpWithCondition.getAmount(), 20n);
      assertEquals(
        recreatedOpWithCondition.getPublicKey().toString(),
        validPublicKey.toString(),
      );
      assertEquals(recreatedOpWithCondition.getConditions().length, 1);
      assertEquals(
        recreatedOpWithCondition.getConditions()[0].isCreate(),
        true,
      );
      assertEquals(
        (
          recreatedOpWithCondition.getConditions()[0] as CreateCondition
        ).getUtxo(),
        validUtxo,
      );
      assertEquals(
        recreatedOpWithCondition.getConditions()[0].getAmount(),
        200n,
      );
    });

    it("should convert to and from ScVal correctly for Withdraw operation ", () => {
      const withdrawOp = MoonlightOperation.withdraw(validPublicKey, 30n);
      const scVal = withdrawOp.toScVal();
      const recreatedOp = MoonlightOperation.fromScVal(
        scVal,
        UTXOOperationType.WITHDRAW,
      );

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.WITHDRAW);
      assertEquals(recreatedOp.getAmount(), 30n);
      assertEquals(
        recreatedOp.getPublicKey().toString(),
        validPublicKey.toString(),
      );
      assertEquals(recreatedOp.getConditions().length, 0);

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.CREATE);
      });

      assertThrows(() => {
        MoonlightOperation.fromScVal(scVal, UTXOOperationType.SPEND);
      });

      // Cannot enforce against deposit as it shares the same ScVal structure as Withdraw

      withdrawOp.addCondition(
        MoonlightOperation.create(validUtxo, 300n).toCondition(),
      );
      const scValWithCondition = withdrawOp.toScVal();
      const recreatedOpWithCondition = MoonlightOperation.fromScVal(
        scValWithCondition,
        UTXOOperationType.WITHDRAW,
      );

      assertEquals(
        recreatedOpWithCondition.getOperation(),
        UTXOOperationType.WITHDRAW,
      );
      assertEquals(recreatedOpWithCondition.getAmount(), 30n);
      assertEquals(
        recreatedOpWithCondition.getPublicKey().toString(),
        validPublicKey.toString(),
      );
      assertEquals(recreatedOpWithCondition.getConditions().length, 1);
      assertEquals(
        recreatedOpWithCondition.getConditions()[0].isCreate(),
        true,
      );
      assertEquals(
        (
          recreatedOpWithCondition.getConditions()[0] as CreateCondition
        ).getUtxo(),
        validUtxo,
      );
      assertEquals(
        recreatedOpWithCondition.getConditions()[0].getAmount(),
        300n,
      );
    });
  });

  describe("MLXDRConversions", () => {
    it("should convert to and from MLXDR correctly for Create operation", () => {
      const createOp = MoonlightOperation.create(validUtxo, 10n);

      const mlxdr = createOp.toMLXDR();
      const recreatedOp = MoonlightOperation.fromMLXDR(
        mlxdr,
      ) as MoonlightOperation;
      assertEquals(recreatedOp.getOperation(), UTXOOperationType.CREATE);
      assertEquals(recreatedOp.getAmount(), 10n);
      assertEquals(recreatedOp.getUtxo().toString(), validUtxo.toString());
    });

    it("should convert to and from MLXDR correctly for Deposit operation", () => {
      const depositOp = MoonlightOperation.deposit(validPublicKey, 20n);
      const mlxdr = depositOp.toMLXDR();
      const recreatedOp = MoonlightOperation.fromMLXDR(
        mlxdr,
      ) as MoonlightOperation;

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(recreatedOp.getAmount(), 20n);
      assertEquals(
        recreatedOp.getPublicKey().toString(),
        validPublicKey.toString(),
      );
    });

    it("should convert to and from MLXDR correctly for Withdraw operation ", () => {
      const withdrawOp = MoonlightOperation.withdraw(validPublicKey, 30n);
      const mlxdr = withdrawOp.toMLXDR();
      const recreatedOp = MoonlightOperation.fromMLXDR(
        mlxdr,
      ) as MoonlightOperation;

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.WITHDRAW);
      assertEquals(recreatedOp.getAmount(), 30n);
      assertEquals(
        recreatedOp.getPublicKey().toString(),
        validPublicKey.toString(),
      );
    });

    it("should convert to and from MLXDR correctly for Spend operation", () => {
      const spendOp = MoonlightOperation.spend(validUtxo);
      const mlxdr = spendOp.toMLXDR();
      const recreatedOp = MoonlightOperation.fromMLXDR(
        mlxdr,
      ) as MoonlightOperation;

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.SPEND);
      assertEquals(recreatedOp.getUtxo().toString(), validUtxo.toString());
    });

    it("should convert to and from MLXDR correctly for signed operations", async () => {
      const ed25519Signer = LocalSigner.generateRandom();
      const depositOp = MoonlightOperation.deposit(
        ed25519Signer.publicKey() as Ed25519PublicKey,
        50n,
      );

      depositOp.addCondition(Condition.create(validUtxo, 400n));

      await depositOp.signWithEd25519(
        ed25519Signer,
        100,
        channelId,
        assetId,
        network,
      );

      const mlxdr = depositOp.toMLXDR();

      const recreatedOp = MoonlightOperation.fromMLXDR(
        mlxdr,
      ) as MoonlightOperation;

      assertEquals(recreatedOp.getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(recreatedOp.getAmount(), 50n);
      assertEquals(
        recreatedOp.getPublicKey().toString(),
        ed25519Signer.publicKey().toString(),
      );
      assertEquals(recreatedOp.getConditions().length, 1);
      assertExists(recreatedOp.getEd25519Signature());
      assertEquals(
        recreatedOp.getEd25519Signature().toXDR(),
        depositOp.getEd25519Signature().toXDR(),
      );

      const utxoSigner = new UTXOKeypairBase(await generateP256KeyPair());
      const spendOp = MoonlightOperation.spend(utxoSigner.publicKey);
      spendOp.addCondition(Condition.create(validUtxo, 600n));

      await spendOp.signWithUTXO(utxoSigner, channelId, 100);

      const spendMlxdr = spendOp.toMLXDR();

      const recreatedSpendOp = MoonlightOperation.fromMLXDR(
        spendMlxdr,
      ) as MoonlightOperation;

      assertEquals(recreatedSpendOp.getOperation(), UTXOOperationType.SPEND);
      assertEquals(
        recreatedSpendOp.getUtxo().toString(),
        utxoSigner.publicKey.toString(),
      );
      assertEquals(recreatedSpendOp.getConditions().length, 1);
      assertExists(recreatedSpendOp.getUTXOSignature());
      assertEquals(
        recreatedSpendOp.getUTXOSignature().sig,
        spendOp.getUTXOSignature().sig,
      );
      assertEquals(
        recreatedSpendOp.getUTXOSignature().exp,
        spendOp.getUTXOSignature().exp,
      );
    });
  });
});
