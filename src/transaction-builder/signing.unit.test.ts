import { assertExists } from "@std/assert/exists";
import { assertEquals } from "@std/assert/equals";
import { MoonlightTransactionBuilder } from "./index.ts";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { type ContractId, LocalSigner } from "@colibri/core";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { Condition } from "../conditions/index.ts";
import { MoonlightOperation } from "../operation/index.ts";

describe("MoonlightTransactionBuilder", () => {
  let validAmount: bigint;
  let channelId: ContractId;
  let authId: ContractId;
  let assetId: ContractId;
  let network: string;

  beforeAll(() => {
    validAmount = 1000n;
    channelId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;
    authId =
      "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" as ContractId;
    network = Networks.TESTNET;
    assetId = Asset.native().contractId(network) as ContractId;
  });

  describe("Signing", () => {
    it("should create the same signature for individual operations and bundle", async () => {
      const userSigner = LocalSigner.generateRandom();

      const condition = Condition.deposit(userSigner.publicKey(), validAmount);
      const rawOperation = MoonlightOperation.deposit(
        userSigner.publicKey(),
        validAmount,
      )
        .addCondition(condition);
      const signedOperation = await MoonlightOperation.deposit(
        userSigner.publicKey(),
        validAmount,
      )
        .addCondition(condition).signWithEd25519(
          userSigner,
          100000,
          channelId,
          assetId,
          network,
        );
      const testBuilder = new MoonlightTransactionBuilder({
        channelId,
        authId,
        assetId,
        network,
      });

      testBuilder.addOperation(rawOperation);

      await testBuilder.signExtWithEd25519(
        userSigner,
        100000,
      );

      const signedOpFromBundle = testBuilder.getDepositOperations()[0];

      assertExists(signedOpFromBundle);
      assertEquals(
        signedOpFromBundle.getEd25519Signature().toString(),
        signedOperation.getEd25519Signature().toString(),
      );
    });
  });
});
