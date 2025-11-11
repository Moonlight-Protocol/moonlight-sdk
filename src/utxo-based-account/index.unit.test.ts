// deno-lint-ignore-file no-explicit-any require-await
/**
 * Unit tests for the UtxoBasedAccount class.
 */
import {
  assertEquals,
  assertThrows,
  assertRejects,
  assertExists,
} from "@std/assert";
import { UtxoBasedAccount } from "./index.ts";
import { UTXOStatus } from "../core/utxo-keypair/types.ts";
import { StellarDerivator } from "../derivation/stellar/index.ts";
import { StellarNetworkId } from "../derivation/stellar/stellar-network-id.ts";
import * as UBA_ERR from "./error.ts";

// Test secret key and contract ID for Stellar Testnet
const TEST_SECRET_KEY =
  "SBTXNZADFYXB4IRBZNTWT7GJ5UFP3KVYXCHFRO5IVGOHGHYLTWRMZFDH";
const TEST_CONTRACT_ID =
  "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

Deno.test("UtxoBasedAccount", async (t) => {
  const getBaseDerivator = () =>
    new StellarDerivator().withNetworkAndContract(
      StellarNetworkId.Testnet,
      TEST_CONTRACT_ID
    );

  await t.step("constructor should initialize with required parameters", () => {
    const root = TEST_SECRET_KEY;
    const derivator = getBaseDerivator();

    const account = new UtxoBasedAccount({
      derivator,
      root,
    });

    assertExists(account);
    assertEquals((account as any).batchSize, 50);
    assertEquals((account as any).root, root);
  });

  await t.step("constructor should use provided options", () => {
    const root = TEST_SECRET_KEY;
    const derivator = getBaseDerivator();
    const mockFetchBalances = () => Promise.resolve([10n]);

    const account = new UtxoBasedAccount({
      derivator,
      root,
      options: {
        batchSize: 100,
        fetchBalances: mockFetchBalances,
      },
    });

    assertEquals((account as any).batchSize, 100);
    assertEquals((account as any).fetchBalances, mockFetchBalances);
  });

  await t.step(
    "deriveBatch should derive UTXOs and set initial state",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      await account.deriveBatch({ count: 3 });

      const utxos = account.getUTXOsByState(UTXOStatus.FREE);
      assertEquals(utxos.length, 3);
      assertEquals(
        utxos.map((utxo) => Number(utxo.index)),
        [1, 2, 3]
      );
    }
  );

  await t.step(
    "batchLoad should throw error if fetchBalances is not provided",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      await assertRejects(
        async () => await account.batchLoad(),
        UBA_ERR.MISSING_BATCH_FETCH_FN
      );
    }
  );

  await t.step(
    "batchLoad should update UTXO states based on balances",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();
      const mockFetchBalances = async () => [10n, 0n, 5n];

      const account = new UtxoBasedAccount({
        derivator,
        root,
        options: { fetchBalances: mockFetchBalances },
      });

      await account.deriveBatch({ count: 3 });
      await account.batchLoad();

      // Verify the final state counts
      assertEquals(account.getUTXOsByState(UTXOStatus.UNSPENT).length, 2);
      assertEquals(account.getUTXOsByState(UTXOStatus.SPENT).length, 1);
      assertEquals(account.getUTXOsByState(UTXOStatus.FREE).length, 0);
    }
  );

  await t.step(
    "updateUTXOState should throw error for non-existent UTXOs",
    () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      assertThrows(
        () => account.updateUTXOState(999, UTXOStatus.UNSPENT),
        UBA_ERR.MISSING_UTXO_FOR_INDEX
      );
    }
  );

  await t.step(
    "should maintain correct UTXO states after updates",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      await account.deriveBatch({ count: 3 });

      // Initially all should be FREE
      assertEquals(account.getUTXOsByState(UTXOStatus.FREE).length, 3);

      // Update states and verify counts
      account.updateUTXOState(1, UTXOStatus.UNSPENT);
      account.updateUTXOState(2, UTXOStatus.SPENT);

      assertEquals(account.getUTXOsByState(UTXOStatus.FREE).length, 1);
      assertEquals(account.getUTXOsByState(UTXOStatus.UNSPENT).length, 1);
      assertEquals(account.getUTXOsByState(UTXOStatus.SPENT).length, 1);
    }
  );

  await t.step(
    "should handle UTXO selection with sufficient funds",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
        options: {
          fetchBalances: async () => [100n, 200n, 300n],
        },
      });

      await account.deriveBatch({ count: 3 });
      await account.batchLoad();

      const selection = account.selectUTXOsForTransfer(250n);

      assertExists(selection);
      assertEquals(selection.totalAmount, 300n);
      assertEquals(selection.changeAmount, 50n);
      assertEquals(selection.selectedUTXOs.length, 2);
    }
  );

  await t.step(
    "should handle UTXO selection with insufficient funds",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
        options: {
          fetchBalances: async () => [100n, 200n, 300n],
        },
      });

      await account.deriveBatch({ count: 3 });
      await account.batchLoad();

      const selection = account.selectUTXOsForTransfer(1000n);
      assertEquals(selection, null);
    }
  );

  await t.step(
    "getTotalBalance should return 0n for account with no UTXOs",
    () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      assertEquals(account.getTotalBalance(), 0n);
    }
  );

  await t.step(
    "getTotalBalance should sum only unspent UTXO balances",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();
      const mockFetchBalances = async () => [100n, 0n, 200n, 300n];

      const account = new UtxoBasedAccount({
        derivator,
        root,
        options: { fetchBalances: mockFetchBalances },
      });

      await account.deriveBatch({ count: 4 });
      await account.batchLoad();

      // After batchLoad:
      // - First UTXO: 100n (UNSPENT)
      // - Second UTXO: 0n (SPENT)
      // - Third UTXO: 200n (UNSPENT)
      // - Fourth UTXO: 300n (UNSPENT)
      assertEquals(account.getTotalBalance(), 600n);
    }
  );

  await t.step(
    "getTotalBalance should handle state changes correctly",
    async () => {
      const root = TEST_SECRET_KEY;
      const derivator = getBaseDerivator();

      const account = new UtxoBasedAccount({
        derivator,
        root,
      });

      await account.deriveBatch({ count: 3 });

      // Set up initial states manually
      account.updateUTXOState(1, UTXOStatus.UNSPENT, 100n);
      account.updateUTXOState(2, UTXOStatus.UNSPENT, 200n);
      account.updateUTXOState(3, UTXOStatus.UNSPENT, 300n);

      assertEquals(account.getTotalBalance(), 600n);

      // Change one UTXO to SPENT state
      account.updateUTXOState(2, UTXOStatus.SPENT, 0n);
      assertEquals(account.getTotalBalance(), 400n);
    }
  );
});
