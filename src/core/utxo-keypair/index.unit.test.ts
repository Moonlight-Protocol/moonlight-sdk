// deno-lint-ignore-file require-await
import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { BaseDerivator } from "../../derivation/base/index.ts";
import { UTXOKeypair } from "./index.ts";
import { type BalanceFetcher, UTXOStatus } from "./types.ts";

// Mock key data for testing
const mockPrivateKey = new Uint8Array([1, 2, 3, 4, 5]);
const mockPublicKey = new Uint8Array([6, 7, 8, 9, 10]);

// Mock balance fetcher for testing
class MockBalanceFetcher implements BalanceFetcher {
  private balances = new Map<string, bigint>();
  public fetchCount = 0;

  constructor(initialBalances?: [Uint8Array, bigint][]) {
    if (initialBalances) {
      for (const [key, value] of initialBalances) {
        this.setBalance(key, value);
      }
    }
  }

  setBalance(publicKey: Uint8Array, balance: bigint): void {
    this.balances.set(Array.from(publicKey).toString(), balance);
  }

  async fetchBalance(publicKey: Uint8Array): Promise<bigint> {
    this.fetchCount++;
    const key = Array.from(publicKey).toString();
    if (this.balances.has(key)) {
      return this.balances.get(key)!;
    }
    return 0n;
  }
}

// Mock Base Derivator for testing
class TestDerivator extends BaseDerivator<string, string, string> {
  constructor(context: string, root: string) {
    super();
    this.withContext(context);
    this.withRoot(root);
  }

  // Override deriveKeypair to return predictable values for testing
  override async deriveKeypair(
    _index: string
  ): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    return {
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
    };
  }
}

Deno.test("UTXOKeypair", async (t) => {
  await t.step("constructor should initialize correctly", () => {
    const utxo = new UTXOKeypair({
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      context: "test-context",
      index: "0",
    });

    assertEquals(utxo.privateKey, mockPrivateKey);
    assertEquals(utxo.publicKey, mockPublicKey);
    assertEquals(utxo.context, "test-context");
    assertEquals(utxo.index, "0");
    assertEquals(utxo.status, UTXOStatus.UNLOADED);
    assertEquals(utxo.balance, 0n);
    assertEquals(utxo.decimals, 7); // Default value
  });

  await t.step("constructor should allow setting custom decimals", () => {
    const utxo = new UTXOKeypair(
      {
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      },
      { decimals: 18 }
    );

    assertEquals(utxo.decimals, 18);
  });

  await t.step("updateState should update balance and status correctly", () => {
    const utxo = new UTXOKeypair({
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      context: "test-context",
      index: "0",
    });

    // Initially unloaded
    assertEquals(utxo.status, UTXOStatus.UNLOADED);

    // Update to an unspent status with positive balance
    utxo.updateState(100n);
    assertEquals(utxo.balance, 100n);
    assertEquals(utxo.status, UTXOStatus.UNSPENT);

    // Update to a free status with zero balance
    utxo.updateState(0n);
    assertEquals(utxo.balance, 0n);
    assertEquals(utxo.status, UTXOStatus.FREE);

    // Update to a spent status with negative balance
    utxo.updateState(-1n);
    assertEquals(utxo.balance, -1n);
    assertEquals(utxo.status, UTXOStatus.SPENT);

    // lastUpdated should be set
    assertNotEquals(utxo.lastUpdated, 0);
  });

  await t.step("load should update state using fetcher", async () => {
    const balanceFetcher = new MockBalanceFetcher();
    balanceFetcher.setBalance(mockPublicKey, 200n);

    const utxo = new UTXOKeypair({
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      context: "test-context",
      index: "0",
    });

    // Set the balance fetcher first, then load
    utxo.setBalanceFetcher(balanceFetcher);
    await utxo.load();

    assertEquals(utxo.balance, 200n);
    assertEquals(utxo.status, UTXOStatus.UNSPENT);
    assertEquals(balanceFetcher.fetchCount, 1);
  });

  await t.step("helper methods should correctly identify status", () => {
    const utxo = new UTXOKeypair({
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      context: "test-context",
      index: "0",
    });

    // Initially unloaded
    assertEquals(utxo.isUnloaded(), true);
    assertEquals(utxo.isUnspent(), false);
    assertEquals(utxo.isSpent(), false);
    assertEquals(utxo.isFree(), false);

    // Update to unspent with positive balance
    utxo.updateState(100n);
    assertEquals(utxo.isUnloaded(), false);
    assertEquals(utxo.isUnspent(), true);
    assertEquals(utxo.isSpent(), false);
    assertEquals(utxo.isFree(), false);

    // Update to free with zero balance
    utxo.updateState(0n);
    assertEquals(utxo.isUnloaded(), false);
    assertEquals(utxo.isUnspent(), false);
    assertEquals(utxo.isSpent(), false);
    assertEquals(utxo.isFree(), true);

    // Update to spent with negative balance
    utxo.updateState(-1n);
    assertEquals(utxo.isUnloaded(), false);
    assertEquals(utxo.isUnspent(), false);
    assertEquals(utxo.isSpent(), true);
    assertEquals(utxo.isFree(), false);
  });

  await t.step(
    "fromDerivator should create keypair from derivator",
    async () => {
      const derivator = new TestDerivator("test-context", "secret-root");

      const utxo = await UTXOKeypair.fromDerivator(derivator, "0");

      assertEquals(utxo instanceof UTXOKeypair, true);
      assertEquals(utxo.privateKey, mockPrivateKey);
      assertEquals(utxo.publicKey, mockPublicKey);
      assertEquals(utxo.context, "test-context");
      assertEquals(utxo.index, "0");

      // The root should not be stored in the UTXOKeypair
      assertEquals((utxo as any).root, undefined);
    }
  );

  await t.step(
    "fromDerivator should throw if derivator not configured",
    async () => {
      const derivator = new BaseDerivator<string, string, string>();

      await assertRejects(
        () => UTXOKeypair.fromDerivator(derivator, "0"),
        Error,
        "Derivator is not properly configured"
      );
    }
  );

  await t.step(
    "deriveSequence should create multiple UTXOKeypairs",
    async () => {
      const derivator = new TestDerivator("test-context", "secret-root");

      const utxos = await UTXOKeypair.deriveSequence(
        derivator as BaseDerivator<string, string, `${number}`>,
        0,
        3
      );

      assertEquals(utxos.length, 3);
      assertEquals(utxos[0].index, "0");
      assertEquals(utxos[1].index, "1");
      assertEquals(utxos[2].index, "2");

      // All should have the same context
      for (const utxo of utxos) {
        assertEquals(utxo.context, "test-context");

        // The root should not be stored in any of the UTXOKeypairs
        assertEquals((utxo as any).root, undefined);
      }
    }
  );
});
