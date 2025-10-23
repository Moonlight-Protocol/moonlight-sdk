import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { LocalSigner } from "@colibri/core";
import type { Ed25519PublicKey } from "@colibri/core";
import { Condition } from "./index.ts";
import { generateP256KeyPair } from "../utils/secp256r1/generateP256KeyPair.ts";
import { UTXOOperationType } from "../operation/types.ts";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";

describe("Condition", () => {
  let validPublicKey: Ed25519PublicKey;
  let validUtxo: UTXOPublicKey;
  let validAmount: bigint;

  beforeAll(async () => {
    validPublicKey =
      LocalSigner.generateRandom().publicKey() as Ed25519PublicKey;
    validUtxo = (await generateP256KeyPair()).publicKey as UTXOPublicKey;
    validAmount = 1000n;
  });

  describe("Construction", () => {
    it("should create a CREATE condition with valid inputs", () => {
      const condition = Condition.create(validUtxo, validAmount);

      assertExists(condition);
      assertEquals(condition.getOperation(), UTXOOperationType.CREATE);
      assertEquals(condition.getAmount(), validAmount);
      assertEquals(condition.getUtxo(), validUtxo);
      assertEquals(condition.isCreate(), true);
      assertEquals(condition.isDeposit(), false);
      assertEquals(condition.isWithdraw(), false);
    });

    it("should create a DEPOSIT condition with valid inputs", () => {
      const condition = Condition.deposit(validPublicKey, validAmount);

      assertExists(condition);
      assertEquals(condition.getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(condition.getAmount(), validAmount);
      assertEquals(condition.getPublicKey(), validPublicKey);
      assertEquals(condition.isCreate(), false);
      assertEquals(condition.isDeposit(), true);
      assertEquals(condition.isWithdraw(), false);
    });

    it("should create a WITHDRAW condition with valid inputs", () => {
      const condition = Condition.withdraw(validPublicKey, validAmount);

      assertExists(condition);
      assertEquals(condition.getOperation(), UTXOOperationType.WITHDRAW);
      assertEquals(condition.getAmount(), validAmount);
      assertEquals(condition.getPublicKey(), validPublicKey);
      assertEquals(condition.isCreate(), false);
      assertEquals(condition.isDeposit(), false);
      assertEquals(condition.isWithdraw(), true);
    });
  });

  describe("Features", () => {
    it("should return correct operation for each condition type", () => {
      const createCondition = Condition.create(validUtxo, validAmount);
      const depositCondition = Condition.deposit(validPublicKey, validAmount);
      const withdrawCondition = Condition.withdraw(validPublicKey, validAmount);

      assertEquals(createCondition.getOperation(), UTXOOperationType.CREATE);
      assertEquals(depositCondition.getOperation(), UTXOOperationType.DEPOSIT);
      assertEquals(
        withdrawCondition.getOperation(),
        UTXOOperationType.WITHDRAW
      );
    });

    it("should return correct amount for all condition types", () => {
      const createCondition = Condition.create(validUtxo, validAmount);
      const depositCondition = Condition.deposit(validPublicKey, validAmount);
      const withdrawCondition = Condition.withdraw(validPublicKey, validAmount);

      assertEquals(createCondition.getAmount(), validAmount);
      assertEquals(depositCondition.getAmount(), validAmount);
      assertEquals(withdrawCondition.getAmount(), validAmount);
    });

    it("should return UTXO for CREATE conditions", () => {
      const condition = Condition.create(validUtxo, validAmount);
      assertEquals(condition.getUtxo(), validUtxo);
    });

    it("should return public key for DEPOSIT conditions", () => {
      const condition = Condition.deposit(validPublicKey, validAmount);
      assertEquals(condition.getPublicKey(), validPublicKey);
    });

    it("should return public key for WITHDRAW conditions", () => {
      const condition = Condition.withdraw(validPublicKey, validAmount);
      assertEquals(condition.getPublicKey(), validPublicKey);
    });

    it("should correctly identify condition types with type guards", () => {
      const createCondition = Condition.create(validUtxo, validAmount);
      const depositCondition = Condition.deposit(validPublicKey, validAmount);
      const withdrawCondition = Condition.withdraw(validPublicKey, validAmount);

      assertEquals(createCondition.isCreate(), true);
      assertEquals(createCondition.isDeposit(), false);
      assertEquals(createCondition.isWithdraw(), false);

      assertEquals(depositCondition.isCreate(), false);
      assertEquals(depositCondition.isDeposit(), true);
      assertEquals(depositCondition.isWithdraw(), false);

      assertEquals(withdrawCondition.isCreate(), false);
      assertEquals(withdrawCondition.isDeposit(), false);
      assertEquals(withdrawCondition.isWithdraw(), true);
    });

    it("should convert CREATE condition to XDR", () => {
      const condition = Condition.create(validUtxo, validAmount);
      const xdr = condition.toXDR();

      assertExists(xdr);
      assertEquals(typeof xdr, "string");
      assertEquals(xdr.length > 0, true);
    });

    it("should convert DEPOSIT condition to XDR", () => {
      const condition = Condition.deposit(validPublicKey, validAmount);
      const xdr = condition.toXDR();

      assertExists(xdr);
      assertEquals(typeof xdr, "string");
      assertEquals(xdr.length > 0, true);
    });

    it("should convert WITHDRAW condition to XDR", () => {
      const condition = Condition.withdraw(validPublicKey, validAmount);
      const xdr = condition.toXDR();

      assertExists(xdr);
      assertEquals(typeof xdr, "string");
      assertEquals(xdr.length > 0, true);
    });

    it("should convert CREATE condition to ScVal", () => {
      const condition = Condition.create(validUtxo, validAmount);
      const scVal = condition.toScVal();

      assertExists(scVal);
      assertEquals(scVal.switch().name, "scvVec");
    });

    it("should convert DEPOSIT condition to ScVal", () => {
      const condition = Condition.deposit(validPublicKey, validAmount);
      const scVal = condition.toScVal();

      assertExists(scVal);
      assertEquals(scVal.switch().name, "scvVec");
    });

    it("should convert WITHDRAW condition to ScVal", () => {
      const condition = Condition.withdraw(validPublicKey, validAmount);
      const scVal = condition.toScVal();

      assertExists(scVal);
      assertEquals(scVal.switch().name, "scvVec");
    });
  });

  describe("Errors", () => {
    it("should throw Error for zero amount", () => {
      assertThrows(
        () => Condition.create(validUtxo, 0n),
        Error,
        "Amount must be greater than zero"
      );
    });

    it("should throw Error for negative amount", () => {
      assertThrows(
        () => Condition.create(validUtxo, -100n),
        Error,
        "Amount must be greater than zero"
      );
    });

    it("should throw Error for invalid public key format in DEPOSIT", () => {
      const invalidPublicKey = "invalid_key" as Ed25519PublicKey;

      assertThrows(
        () => Condition.deposit(invalidPublicKey, validAmount),
        Error,
        "Invalid Ed25519 public key"
      );
    });

    it("should throw Error for invalid public key format in WITHDRAW", () => {
      const invalidPublicKey = "invalid_key" as Ed25519PublicKey;

      assertThrows(
        () => Condition.withdraw(invalidPublicKey, validAmount),
        Error,
        "Invalid Ed25519 public key"
      );
    });

    it("should throw Error when accessing public key on CREATE condition", () => {
      const condition = Condition.create(
        validUtxo,
        validAmount
      ) as unknown as Condition;
      assertThrows(
        () => condition.getPublicKey(),
        Error,
        "Property _publicKey is not set in the Condition instance"
      );
    });

    it("should throw Error when accessing UTXO on DEPOSIT condition", () => {
      const condition = Condition.deposit(
        validPublicKey,
        validAmount
      ) as unknown as Condition;

      assertThrows(
        () => condition.getUtxo(),
        Error,
        "Property _utxo is not set in the Condition instance"
      );
    });

    it("should throw Error when accessing UTXO on WITHDRAW condition", () => {
      const condition = Condition.withdraw(
        validPublicKey,
        validAmount
      ) as unknown as Condition;

      assertThrows(
        () => condition.getUtxo(),
        Error,
        "Property _utxo is not set in the Condition instance"
      );
    });
  });
});
