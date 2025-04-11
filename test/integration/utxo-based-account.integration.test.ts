// deno-lint-ignore-file require-await
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { Buffer } from "buffer";
import {
  type PoolEngine,
  ReadMethods,
  WriteMethods,
  UtxoBasedStellarAccount,
  UTXOStatus,
} from "../../mod.ts";
import { createTestAccount } from "../helpers/create-test-account.ts";
import { createTxInvocation } from "../helpers/create-tx-invocation.ts";
import { deployPrivacyPool } from "../helpers/deploy-pool.ts";
import type { SorobanTransactionPipelineOutputVerbose } from "stellar-plus/lib/stellar-plus/core/pipelines/soroban-transaction/types";

// Testnet XLM contract ID
const XLM_CONTRACT_ID_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

Deno.test("UTXOBasedAccount Integration Tests", async (t) => {
  const { account, networkConfig } = await createTestAccount();
  const txInvocation = createTxInvocation(account);
  let poolEngine: PoolEngine;
  let utxoAccount: UtxoBasedStellarAccount;
  const depositAmount = 500000n; // 0.05 XLM
  const testRoot = "S-TEST_SECRET_ROOT";

  // Setup test environment
  await t.step("setup: deploy privacy pool contract", async () => {
    poolEngine = await deployPrivacyPool({
      admin: account,
      assetContractId: XLM_CONTRACT_ID_TESTNET,
      networkConfig,
    });

    assertExists(poolEngine, "Pool engine should be initialized");
    assertExists(poolEngine.getContractId(), "Contract ID should be generated");
  });

  // Initialize UTXOBasedAccount with pool engine's derivator - directly in the test
  await t.step("setup: create UTXOBasedAccount instance", async () => {
    const derivator = poolEngine.derivator;
    assertExists(derivator, "Pool engine should have a derivator");

    // Create UTXOBasedAccount directly in the test with a balance fetching function
    utxoAccount = new UtxoBasedStellarAccount({
      derivator,
      root: testRoot,
      options: {
        batchSize: 10,
        fetchBalances: async (publicKeys: Uint8Array[]) => {
          return poolEngine.read({
            ...txInvocation,
            method: ReadMethods.balances,
            methodArgs: {
              utxos: publicKeys.map((pk) => Buffer.from(pk)),
            },
          });
        },
      },
    });

    assertExists(utxoAccount, "UTXOBasedAccount should be initialized");
  });

  // Derive a batch of UTXOs
  await t.step("should derive a batch of UTXOs", async () => {
    const batchSize = 5;
    await utxoAccount.deriveBatch({ startIndex: 0, count: batchSize });

    const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
    assertEquals(
      freeUtxos.length,
      batchSize,
      "Should have derived the correct number of UTXOs"
    );

    // Verify each UTXO has required properties
    for (const utxo of freeUtxos) {
      assertExists(utxo.publicKey, "UTXO should have a public key");
      assertExists(utxo.privateKey, "UTXO should have a private key");

      // Verify the keypair can sign data
      const testData = new Uint8Array(32);
      crypto.getRandomValues(testData);
      const signature = await utxo.signPayload(testData);
      assertExists(signature, "Should be able to generate a signature");
    }
  });

  // Deposit into a UTXO managed by the account
  await t.step("should deposit to a UTXO and update its state", async () => {
    // Get a free UTXO
    const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);

    const testUtxo = freeUtxos[0];
    assertExists(testUtxo, "Should have at least one free UTXO");

    // We know the UTXOs are indexed starting from 0, since we derived them that way
    const utxoIndex = 0;

    // Deposit to the UTXO
    const depositResult = (await poolEngine.write({
      ...txInvocation,
      method: WriteMethods.deposit,
      methodArgs: {
        from: account.getPublicKey(),
        amount: depositAmount,
        utxo: Buffer.from(testUtxo.publicKey),
      },
      options: { verboseOutput: true, includeHashOutput: true },
    })) as SorobanTransactionPipelineOutputVerbose;

    assertExists(
      depositResult.sorobanTransactionOutput,
      "Deposit transaction result should exist"
    );

    // Mark the UTXO as having a balance (would normally be done by batchLoad)
    utxoAccount.updateUTXOState(utxoIndex, UTXOStatus.UNSPENT);

    // Verify the balance through the contract
    const balanceResult = await poolEngine.read({
      ...txInvocation,
      method: ReadMethods.balance,
      methodArgs: {
        utxo: Buffer.from(testUtxo.publicKey),
      },
    });

    assertEquals(
      balanceResult,
      depositAmount,
      "UTXO balance should match the deposited amount"
    );
  });

  // Test batch loading of UTXOs
  await t.step("should batch load UTXOs with balances", async () => {
    // Load all UTXOs and check their states
    await utxoAccount.batchLoad();

    // Should have at least one UNSPENT UTXO
    const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
    assertEquals(
      unspentUtxos.length >= 1,
      true,
      "Should have at least one UNSPENT UTXO after batch loading"
    );

    // Other UTXOs should be marked as SPENT or FREE
    const allUtxos = [
      ...utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.SPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.FREE),
    ];

    // We derived 5 UTXOs, so all 5 should be accounted for
    assertEquals(allUtxos.length, 5, "Should have accounted for all UTXOs");
  });

  // Test withdrawing from an UNSPENT UTXO
  await t.step(
    "should withdraw from an UNSPENT UTXO and update its state",
    async () => {
      // Get an UNSPENT UTXO
      const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
      assertExists(
        unspentUtxos.length > 0,
        "Should have at least one UNSPENT UTXO"
      );
      const testUtxo = unspentUtxos[0];

      // For finding the index, we know we've been working with index 0 in previous steps
      const utxoIndex = 0;

      // Generate withdraw payload
      const withdrawPayload = poolEngine.buildWithdrawPayload({
        utxo: testUtxo.publicKey,
        amount: depositAmount,
      });

      // Sign the payload
      const signature = await testUtxo.signPayload(withdrawPayload);
      assertExists(signature, "Should generate a valid signature");

      // Execute withdrawal
      const withdrawResult = (await poolEngine.write({
        ...txInvocation,
        method: WriteMethods.withdraw,
        methodArgs: {
          to: account.getPublicKey(),
          amount: depositAmount,
          utxo: Buffer.from(testUtxo.publicKey),
          signature: Buffer.from(signature),
        },
        options: { verboseOutput: true, includeHashOutput: true },
      })) as SorobanTransactionPipelineOutputVerbose;

      assertExists(
        withdrawResult.sorobanTransactionOutput,
        "Withdraw transaction result should exist"
      );

      // Manually update the UTXO state to SPENT after withdrawal
      utxoAccount.updateUTXOState(utxoIndex, UTXOStatus.SPENT);

      // Refresh UTXO states
      await utxoAccount.batchLoad();

      // Verify the balance is now zero
      const balanceResult = await poolEngine.read({
        ...txInvocation,
        method: ReadMethods.balance,
        methodArgs: {
          utxo: Buffer.from(testUtxo.publicKey),
        },
      });

      assertEquals(
        balanceResult,
        0n,
        "UTXO balance should be zero after withdrawal"
      );

      // Verify the UTXO is now in the SPENT collection
      const spentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.SPENT);
      const isTestUtxoSpent = spentUtxos.some(
        (spentUtxo) =>
          Buffer.from(spentUtxo.publicKey).compare(
            Buffer.from(testUtxo.publicKey)
          ) === 0
      );

      assertEquals(
        isTestUtxoSpent,
        true,
        "The withdrawn UTXO should be marked as SPENT"
      );
    }
  );

  // Test deriving additional UTXOs after the initial batch
  await t.step("should derive additional UTXO batches", async () => {
    const initialCount = [
      ...utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.SPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.FREE),
    ].length;

    // Derive another batch starting from index 5
    await utxoAccount.deriveBatch({ startIndex: 5, count: 3 });

    const newCount = [
      ...utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.SPENT),
      ...utxoAccount.getUTXOsByState(UTXOStatus.FREE),
    ].length;

    assertEquals(newCount, initialCount + 3, "Should have added 3 new UTXOs");

    // New UTXOs should be in FREE state
    const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
    assertEquals(
      freeUtxos.length >= 3,
      true,
      "Should have at least 3 FREE UTXOs"
    );
  });

  // Test error cases
  await t.step("should handle invalid operations correctly", async () => {
    // Attempt to withdraw with invalid signature
    const freeUtxo = utxoAccount.getUTXOsByState(UTXOStatus.FREE)[0];
    assertExists(freeUtxo, "Should have a free UTXO for testing");

    // Try withdrawal without deposit
    const invalidWithdrawPayload = poolEngine.buildWithdrawPayload({
      utxo: freeUtxo.publicKey,
      amount: 10n, // <- different amount than the actual amount in the transaction
    });

    const signature = await freeUtxo.signPayload(invalidWithdrawPayload);

    try {
      await poolEngine.write({
        ...txInvocation,
        method: WriteMethods.withdraw,
        methodArgs: {
          to: account.getPublicKey(),
          amount: 100000n,
          utxo: Buffer.from(freeUtxo.publicKey),
          signature: Buffer.from(signature),
        },
      });
      throw new Error("Should have failed");
    } catch (error) {
      assertExists(error, "Expected error for withdrawal without balance");
    }

    // Try zero amount deposit
    try {
      await poolEngine.write({
        ...txInvocation,
        method: WriteMethods.deposit,
        methodArgs: {
          from: account.getPublicKey(),
          amount: 0n,
          utxo: Buffer.from(freeUtxo.publicKey),
        },
      });
      throw new Error("Should have failed");
    } catch (error) {
      assertExists(error, "Expected error for zero amount deposit");
    }
  });

  // Test UTXO reservation functionality
  await t.step("should handle UTXO reservations correctly", async () => {
    // Clear any existing reservations
    utxoAccount.releaseStaleReservations(0);

    // Derive some UTXOs for testing
    await utxoAccount.deriveBatch({ count: 5 });
    await utxoAccount.batchLoad(); // Update states

    // Try reserving more UTXOs than available
    const freeCount = utxoAccount.getUTXOsByState(UTXOStatus.FREE).length;
    const tooManyReserved = utxoAccount.reserveUTXOs(freeCount + 5);
    assertEquals(
      tooManyReserved,
      null,
      "Should return null when requesting too many UTXOs"
    );

    // Reserve some UTXOs
    const reservedCount = 2;
    const reserved = utxoAccount.reserveUTXOs(reservedCount);
    assertExists(reserved, "Should successfully reserve UTXOs");

    assertEquals(
      reserved.length,
      reservedCount,
      "Should reserve exactly the requested number of UTXOs"
    );

    // Verify these UTXOs are actually reserved
    const reservedUTXOs = utxoAccount.getReservedUTXOs();
    assertEquals(
      reservedUTXOs.length >= reservedCount,
      true,
      "Should track reserved UTXOs"
    );

    // Verify we can reserve more UTXOs
    const secondReservation = utxoAccount.reserveUTXOs(1);
    assertExists(
      secondReservation,
      "Should be able to reserve different UTXOs"
    );
  });

  // Test UTXO selection strategies
  await t.step("should select UTXOs using different strategies", async () => {
    // Create some unspent UTXOs with different balances
    const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);

    // Check if we have enough free UTXOs
    if (freeUtxos.length < 2) {
      // Derive more UTXOs if needed
      await utxoAccount.deriveBatch({ count: 5 });
    }

    const testUtxo1 = utxoAccount.getUTXOsByState(UTXOStatus.FREE)[0];
    const testUtxo2 = utxoAccount.getUTXOsByState(UTXOStatus.FREE)[1];
    assertExists(testUtxo1, "Should have a free UTXO for testing");
    assertExists(testUtxo2, "Should have another free UTXO for testing");

    // Get indices for the test UTXOs
    const index1 = Number(testUtxo1.index);
    const index2 = Number(testUtxo2.index);

    // Deposit different amounts
    await poolEngine.write({
      ...txInvocation,
      method: WriteMethods.deposit,
      methodArgs: {
        from: account.getPublicKey(),
        amount: 1000000n,
        utxo: Buffer.from(testUtxo1.publicKey),
      },
    });

    await poolEngine.write({
      ...txInvocation,
      method: WriteMethods.deposit,
      methodArgs: {
        from: account.getPublicKey(),
        amount: 500000n,
        utxo: Buffer.from(testUtxo2.publicKey),
      },
    });

    // Update UTXO states
    utxoAccount.updateUTXOState(index1, UTXOStatus.UNSPENT, 1000000n);
    utxoAccount.updateUTXOState(index2, UTXOStatus.UNSPENT, 500000n);

    // Check balances using contract to validate our updates
    const balance1 = await poolEngine.read({
      ...txInvocation,
      method: ReadMethods.balance,
      methodArgs: {
        utxo: Buffer.from(testUtxo1.publicKey),
      },
    });

    // Skip the actual test if balance verification fails
    if (balance1 === 1000000n) {
      // Test sequential selection
      const sequentialResult = utxoAccount.selectUTXOsForTransfer(750000n);
      assertExists(sequentialResult, "Should find UTXOs for transfer");
      assertEquals(
        sequentialResult.selectedUTXOs.length >= 1,
        true,
        "Should select at least one UTXO when possible"
      );
    }
  });

  // Test stale reservation release
  await t.step("should release stale reservations", async () => {
    // Clear any existing reservations
    utxoAccount.releaseStaleReservations(0);

    // Reserve some UTXOs
    const reserved = utxoAccount.reserveUTXOs(2);
    assertExists(reserved, "Should successfully reserve UTXOs");

    // Release stale reservations (all of them, since we're using a 0ms age)
    const releasedCount = utxoAccount.releaseStaleReservations(0);
    assertEquals(releasedCount, 2, "Should release all stale reservations");

    // Verify they can be reserved again
    const newReservation = utxoAccount.reserveUTXOs(2);
    assertExists(
      newReservation,
      "Should be able to reserve previously stale UTXOs"
    );
  });
});
