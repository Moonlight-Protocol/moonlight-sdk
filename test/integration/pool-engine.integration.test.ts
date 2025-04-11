// filepath: /Users/fifo/Documents/moonlight/moonlight-sdk/test/integration/pool-engine.integration.test.ts
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { StellarPlus } from "stellar-plus";
import {
  PoolEngine,
  ReadMethods,
  WriteMethods,
  assembleNetworkContext,
  StellarDerivator,
  type StellarNetworkId,
  type StellarSmartContractId,
  UTXOKeypairBase,
} from "../../mod.ts";
import { loadContractWasm } from "../helpers/load-wasm.ts";
import type { TransactionInvocation } from "stellar-plus/lib/stellar-plus/types";
import { Buffer } from "buffer";
import type { SorobanTransactionPipelineOutputVerbose } from "stellar-plus/lib/stellar-plus/core/pipelines/soroban-transaction/types";

const { DefaultAccountHandler } = StellarPlus.Account;

const contractFileName = "privacy_pool";

const XLM_CONTRACT_ID_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

Deno.test("PoolEngine Integration - Deposit and Withdraw", async (t) => {
  // Test environment setup
  const networkConfig = StellarPlus.Network.TestNet();

  const admin = new DefaultAccountHandler({
    networkConfig: networkConfig,
  });

  const txInvocation: TransactionInvocation = {
    header: {
      source: admin.getPublicKey(),
      fee: "10000000", // 1 XLM  base fee
      timeout: 30,
    },
    signers: [admin],
  };

  const wasmBinary = await loadContractWasm(contractFileName);

  let poolEngine: PoolEngine;
  let utxo: Uint8Array;
  let utxoKeypair: UTXOKeypairBase;
  const depositAmount = 1000000n; // 0.1 XLM

  let derivator: StellarDerivator;

  // Setup  before all tests
  await t.step(
    "setup: initialize test environment prerequisites and pool instance",
    async () => {
      await admin.initializeWithFriendbot();

      poolEngine = await PoolEngine.create({
        networkConfig,
        wasm: wasmBinary,
        assetContractId: XLM_CONTRACT_ID_TESTNET,
      });

      assertExists(poolEngine, "Pool engine should be initialized");
    }
  );

  // upload wasm
  await t.step("setup: upload wasm", async () => {
    await poolEngine.uploadWasm(txInvocation);

    //vassert getWasmHash returns the wasmhash and doesnt throw
    const wasmHash = poolEngine.getWasmHash();
    assertExists(wasmHash, "Wasm hash should be generated");
  });

  // deploy new instance of contract
  await t.step("setup: deploy contract", async () => {
    await poolEngine.deploy({
      ...txInvocation,
      contractArgs: { admin: admin.getPublicKey() },
    });

    //assert contract id existis and is of type string with C prefix
    const contractId = poolEngine.getContractId();
    assertExists(contractId, "Contract ID should be generated");
    assertEquals(
      contractId.startsWith("C"),
      true,
      "Contract ID should start with C"
    );
  });

  //post setup, admin should be the admin provided during construction
  await t.step("setup: check admin", async () => {
    const adminResult = await poolEngine.read({
      ...txInvocation,
      method: ReadMethods.admin,
      methodArgs: {},
    });

    assertEquals(
      adminResult,
      admin.getPublicKey(),
      "Admin should match the provided admin"
    );
  });

  await t.step("read: supply should be 0 at initialization", async () => {
    const supplyResult = await poolEngine.read({
      ...txInvocation,
      method: ReadMethods.supply,
      methodArgs: {},
    });

    assertExists(supplyResult, "Supply result should exist");
    assertEquals(supplyResult, 0n, "Supply should be 0 at initialization");
  });

  // testcase: pool should return its derivator
  await t.step("pool should return its derivator", async () => {
    // A PoolEngine instance should have a derivator property that helps
    // with deriving UTXOs and related cryptographic material
    derivator = poolEngine.derivator;

    assertExists(derivator, "Pool engine should have a derivator");
    assertEquals(
      derivator instanceof StellarDerivator,
      true,
      "Derivator should be an instance of StellarDerivator"
    );

    // Verify the derivator has been initialized with the correct network and contract
    assertEquals(
      derivator.getContext(),
      assembleNetworkContext(
        networkConfig.networkPassphrase as StellarNetworkId,
        poolEngine.getContractId() as StellarSmartContractId
      ),
      "Derivator should be initialized with the correct network"
    );
  });

  await t.step(
    "setup: attach root to derivator and generate plain seed correctly",
    async () => {
      derivator.withRoot("S-MOCKED_SECRET_ROOT");
      const seed = derivator.assembleSeed("1");
      assertExists(seed, "Derivation seed should be generated");
      assertEquals(
        seed.includes("S-MOCKED_SECRET_ROOT"),
        true,
        "Seed should contain the secret root"
      );
      assertEquals(seed.includes("1"), true, "Seed should contain the index");
      assertEquals(
        seed.includes(poolEngine.derivator.getContext()),
        true,
        "Seed should contain the context"
      );
    }
  );

  // testcase, setup and generate the UTXO using the derivator, any test root as seed and the utxobase keypair
  await t.step("generate UTXO using the derivator with test seed", async () => {
    // Generate a keypair using the derivator with the established root
    utxoKeypair = new UTXOKeypairBase(await derivator.deriveKeypair("1"));

    assertExists(utxoKeypair, "UTXO keypair should be generated");
    assertExists(utxoKeypair.publicKey, "Public key should be generated");
    assertExists(utxoKeypair.privateKey, "Private key should be generated");

    utxo = utxoKeypair.publicKey;

    assertEquals(utxo.byteLength, 65, "Public key should be 65 bytes");

    // Verify the keypair can sign data
    const testData = new Uint8Array(32);
    crypto.getRandomValues(testData);

    const signature = await utxoKeypair.signPayload(testData);
    assertExists(signature, "Should be able to generate a signature");
  });

  await t.step(
    "read: should correctly return the balance of the utxo before creating it",
    async () => {
      // Verify the balance of the UTXO after deposit
      const balanceResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.balance,
        methodArgs: {
          utxo: Buffer.from(utxo),
        },
      });

      assertEquals(
        balanceResult,
        -1n,
        "UTXO balance should be -1 before creating it"
      );
    }
  );

  // Perform a deposit to the pool
  await t.step(
    "deposit: should successfully deposit tokens into the pool",
    async () => {
      const depositInvocation = {
        method: WriteMethods.deposit,
        methodArgs: {
          from: admin.getPublicKey(),
          amount: depositAmount,
          utxo: Buffer.from(utxo),
        },
      };

      // Execute the deposit transaction
      const depositResult = (await poolEngine.write({
        ...depositInvocation,
        ...txInvocation,
        options: { verboseOutput: true, includeHashOutput: true },
      })) as SorobanTransactionPipelineOutputVerbose;

      // Verify transaction was successful
      assertExists(
        depositResult.sorobanTransactionOutput,
        "Deposit transaction result should exist"
      );
      assertExists(
        depositResult.hash,
        "Deposit transaction should be successful"
      );
    }
  );

  await t.step(
    "read: should correctly return the balance of the utxo after creating it",
    async () => {
      // Verify the balance of the UTXO after deposit
      const balanceResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.balance,
        methodArgs: {
          utxo: Buffer.from(utxo),
        },
      });

      assertEquals(
        balanceResult,
        depositAmount,
        "UTXO balance should match the deposited amount"
      );
    }
  );

  await t.step(
    "read: should correctly return the total supply after depositing",
    async () => {
      const supplyResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.supply,
        methodArgs: {},
      });

      assertExists(supplyResult, "Supply result should exist");
      assertEquals(
        supplyResult,
        depositAmount,
        "Total supply should increase by the deposited amount"
      );
    }
  );

  // Withdraw from the pool
  await t.step(
    "withdraw: should successfully withdraw tokens from the pool",
    async () => {
      // Generate a withdraw payload using the pool engine's helper
      const withdrawPayload = poolEngine.buildWithdrawPayload({
        utxo: utxo,
        amount: depositAmount,
      });

      // Sign the withdraw payload using the UTXO keypair
      const signature = await utxoKeypair.signPayload(withdrawPayload);
      assertExists(signature, "Should generate a valid signature");

      const withdrawInvocation = {
        method: WriteMethods.withdraw,
        methodArgs: {
          to: admin.getPublicKey(),
          amount: depositAmount,
          utxo: Buffer.from(utxo),
          signature: Buffer.from(signature),
        },
      };

      try {
        // Execute the withdrawal transaction
        const withdrawResult = (await poolEngine.write({
          ...withdrawInvocation,
          ...txInvocation,
          options: { verboseOutput: true, includeHashOutput: true },
        })) as SorobanTransactionPipelineOutputVerbose;

        assertExists(
          withdrawResult.sorobanTransactionOutput,
          "Withdraw transaction result should exist"
        );
        assertExists(
          withdrawResult.hash,
          "Withdraw transaction should be successful"
        );

        // Verify the balance of the UTXO after withdrawal
        const balanceResult = await poolEngine.read({
          ...txInvocation,
          method: ReadMethods.balance,
          methodArgs: {
            utxo: Buffer.from(utxo),
          },
        });

        assertEquals(
          balanceResult,
          0n,
          "UTXO balance should be zero after withdrawal"
        );
      } catch (error) {
        console.log("Error during withdrawal:", error);
        throw error; // Re-throw to fail the test if withdrawal fails
      }
    }
  );

  await t.step(
    "read: should correctly return the balance of the utxo after spending",
    async () => {
      // Verify the balance of the UTXO after deposit
      const balanceResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.balance,
        methodArgs: {
          utxo: Buffer.from(utxo),
        },
      });

      assertEquals(
        balanceResult,
        0n,
        "UTXO balance should be 0 after spending it"
      );
    }
  );

  await t.step(
    "read: should correctly return the total supply after withdrawing",
    async () => {
      const supplyResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.supply,
        methodArgs: {},
      });

      assertExists(supplyResult, "Supply result should exist");
      assertEquals(
        supplyResult,
        0n,
        "Total supply should decrease by the withdrawn amount"
      );
    }
  );
});
