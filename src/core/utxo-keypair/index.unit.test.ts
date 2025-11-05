import {
  assertEquals,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BaseDerivator } from "../../derivation/base/index.ts";
import { UTXOKeypair } from "./index.ts";
import { type BalanceFetcher, UTXOStatus } from "./types.ts";
import * as UKP_ERR from "./error.ts";

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

describe("UTXOKeypair", () => {
  describe("constructor", () => {
    it("initializes with correct default values", () => {
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

    it("allows setting custom decimals", () => {
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
  });

  describe("updateState", () => {
    it("updates balance and status correctly for positive balance", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      assertEquals(utxo.status, UTXOStatus.UNLOADED);

      utxo.updateState(100n);
      assertEquals(utxo.balance, 100n);
      assertEquals(utxo.status, UTXOStatus.UNSPENT);
      assertNotEquals(utxo.lastUpdated, 0);
    });

    it("updates status to FREE when balance is zero", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.updateState(0n);
      assertEquals(utxo.balance, 0n);
      assertEquals(utxo.status, UTXOStatus.FREE);
    });

    it("updates status to SPENT when balance is negative", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.updateState(-1n);
      assertEquals(utxo.balance, -1n);
      assertEquals(utxo.status, UTXOStatus.SPENT);
    });
  });

  describe("load", () => {
    it("updates state using balance fetcher", async () => {
      const balanceFetcher = new MockBalanceFetcher();
      balanceFetcher.setBalance(mockPublicKey, 200n);

      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.setBalanceFetcher(balanceFetcher);
      await utxo.load();

      assertEquals(utxo.balance, 200n);
      assertEquals(utxo.status, UTXOStatus.UNSPENT);
      assertEquals(balanceFetcher.fetchCount, 1);
    });
  });

  describe("status helper methods", () => {
    it("correctly identifies UNLOADED status", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      assertEquals(utxo.isUnloaded(), true);
      assertEquals(utxo.isUnspent(), false);
      assertEquals(utxo.isSpent(), false);
      assertEquals(utxo.isFree(), false);
    });

    it("correctly identifies UNSPENT status", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.updateState(100n);

      assertEquals(utxo.isUnloaded(), false);
      assertEquals(utxo.isUnspent(), true);
      assertEquals(utxo.isSpent(), false);
      assertEquals(utxo.isFree(), false);
    });

    it("correctly identifies FREE status", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.updateState(0n);

      assertEquals(utxo.isUnloaded(), false);
      assertEquals(utxo.isUnspent(), false);
      assertEquals(utxo.isSpent(), false);
      assertEquals(utxo.isFree(), true);
    });

    it("correctly identifies SPENT status", () => {
      const utxo = new UTXOKeypair({
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
        context: "test-context",
        index: "0",
      });

      utxo.updateState(-1n);

      assertEquals(utxo.isUnloaded(), false);
      assertEquals(utxo.isUnspent(), false);
      assertEquals(utxo.isSpent(), true);
      assertEquals(utxo.isFree(), false);
    });
  });

  describe("fromDerivator", () => {
    it("creates keypair from configured derivator", async () => {
      const derivator = new TestDerivator("test-context", "secret-root");

      const utxo = await UTXOKeypair.fromDerivator(derivator, "0");

      assertEquals(utxo instanceof UTXOKeypair, true);
      assertEquals(utxo.privateKey, mockPrivateKey);
      assertEquals(utxo.publicKey, mockPublicKey);
      assertEquals(utxo.context, "test-context");
      assertEquals(utxo.index, "0");

      // The root should not be stored in the UTXOKeypair
      // deno-lint-ignore no-explicit-any
      assertEquals((utxo as any).root, undefined);
    });

    it("throws PROPERTY_NOT_SET when derivator not configured", async () => {
      const derivator = new BaseDerivator<string, string, string>();

      await assertRejects(
        async () => await UTXOKeypair.fromDerivator(derivator, "0"),
        UKP_ERR.DERIVATOR_NOT_CONFIGURED
      );
    });
  });

  describe("deriveSequence", () => {
    it("creates multiple UTXOKeypairs with sequential indices", async () => {
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
        // deno-lint-ignore no-explicit-any
        assertEquals((utxo as any).root, undefined);
      }
    });
  });
});
