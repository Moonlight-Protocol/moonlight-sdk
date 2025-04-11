// deno-lint-ignore-file require-await
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.207.0/assert/mod.ts";
import { Buffer } from "buffer";
import { BundlePayloadAction, SimplePayloadAction } from "./types.ts";
import { StellarDerivator } from "../../derivation/index.ts";

// Import the StellarPlus first to use its network config
import { StellarPlus } from "stellar-plus";
// Import the actual class after importing StellarPlus
import { PoolEngine } from "./index.ts";

// Store the original ContractEngine for restoration after tests
const OriginalContractEngine = StellarPlus.Core.ContractEngine;

// Create a minimal mock that extends the actual ContractEngine
// This ensures type compatibility while allowing us to override behavior
class MockContractEngine extends OriginalContractEngine {
  constructor(args: any) {
    super(args);
    // Mock implementation details
    this.loadSpecFromWasm = async () => Promise.resolve();
    this.deploy = async () => Promise.resolve({} as any);
    this.readFromContract = async () => Promise.resolve({});
    this.invokeContract = async () => Promise.resolve({} as any);
  }
}

// Apply the mock
StellarPlus.Core.ContractEngine =
  MockContractEngine as typeof OriginalContractEngine;

// Mock the StellarDerivator
StellarDerivator.prototype.withNetworkAndContract = function () {
  return this;
};

/**
 * Test setup - common values used across tests
 */
// Load the actual privacy pool WASM file using a relative path
async function loadWasm() {
  // Use relative path from the project root
  const wasmPath = "test/contracts/privacy_pool.wasm";
  const wasmBytes = await Deno.readFile(wasmPath);
  return Buffer.from(wasmBytes);
}

// Use StellarPlus's built-in TestNet() function for network configuration
const testAssetContractId =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

Deno.test("PoolEngine", async (t) => {
  await t.step("constructor should initialize properly", async () => {
    const wasmBinary = await loadWasm();
    const poolEngine = new PoolEngine({
      networkConfig: StellarPlus.Network.TestNet(),
      wasm: wasmBinary,
      assetContractId: testAssetContractId,
    });

    assertExists(poolEngine);
    assertEquals(poolEngine.assetContractId, testAssetContractId);
    assertExists(poolEngine.derivator);
  });

  await t.step(
    "create() method should initialize and load WASM spec",
    async () => {
      const wasmBinary = await loadWasm();
      const poolEngine = await PoolEngine.create({
        networkConfig: StellarPlus.Network.TestNet(),
        wasm: wasmBinary,
        assetContractId: testAssetContractId,
      });

      assertExists(poolEngine);
      assertEquals(poolEngine.assetContractId, testAssetContractId);
      assertExists(poolEngine.derivator);
    }
  );

  await t.step(
    "buildBurnPayload() should create correctly formatted payload",
    async () => {
      const wasmBinary = await loadWasm();
      const poolEngine = new PoolEngine({
        networkConfig: StellarPlus.Network.TestNet(),
        wasm: wasmBinary,
        assetContractId: testAssetContractId,
      });

      const utxo = new Uint8Array(32).fill(5);
      const amount = BigInt(1000);

      const payload = poolEngine.buildBurnPayload({ utxo, amount });

      // Validate payload structure
      // First 4 bytes should be "BURN"
      const prefix = new TextEncoder().encode(SimplePayloadAction.BURN);
      assertEquals(payload.slice(0, 4).toString(), prefix.toString());

      // Next 32 bytes should be the UTXO
      for (let i = 0; i < 32; i++) {
        assertEquals(payload[i + 4], utxo[i]);
      }

      // Check total length (4 bytes prefix + 32 bytes UTXO + 16 bytes amount)
      assertEquals(payload.length, 4 + 32 + 16);
    }
  );

  await t.step(
    "buildWithdrawPayload() should create correctly formatted payload",
    async () => {
      const wasmBinary = await loadWasm();
      const poolEngine = new PoolEngine({
        networkConfig: StellarPlus.Network.TestNet(),
        wasm: wasmBinary,
        assetContractId: testAssetContractId,
      });

      const utxo = new Uint8Array(32).fill(6);
      const amount = BigInt(2000);

      const payload = poolEngine.buildWithdrawPayload({ utxo, amount });

      // Since buildWithdrawPayload delegates to buildBurnPayload, we expect the same format
      const burnPayload = poolEngine.buildBurnPayload({ utxo, amount });
      assertEquals(payload.toString(), burnPayload.toString());
    }
  );

  await t.step(
    "buildBundlePayload() should create correctly formatted payload for TRANSFER",
    async () => {
      const wasmBinary = await loadWasm();
      const poolEngine = new PoolEngine({
        networkConfig: StellarPlus.Network.TestNet(),
        wasm: wasmBinary,
        assetContractId: testAssetContractId,
      });

      // Create test data
      const spendUtxo1 = Buffer.alloc(65, 10);
      const spendUtxo2 = Buffer.alloc(65, 11);
      const createUtxo1 = Buffer.alloc(65, 12);
      const createUtxo2 = Buffer.alloc(65, 13);
      const amount1 = BigInt(3000);
      const amount2 = BigInt(4000);
      const signature1 = Buffer.alloc(65, 14);
      const signature2 = Buffer.alloc(65, 15);

      const bundle = {
        spend: [spendUtxo1, spendUtxo2],
        create: [
          [createUtxo1, amount1],
          [createUtxo2, amount2],
        ] as Array<readonly [Buffer, bigint]>,
        signatures: [signature1, signature2],
      };

      const payload = poolEngine.buildBundlePayload({
        bundle,
        action: BundlePayloadAction.TRANSFER,
      });

      // Verify payload structure
      // "BUNDLE" prefix (6 bytes) + action ("TRANSFER") (8 bytes) + spend UTXOs + create UTXOs with amounts
      const expectedLength = 6 + 8 + 2 * 65 + 2 * (65 + 16);
      assertEquals(payload.length, expectedLength);

      // Check prefix
      const prefix = new TextEncoder().encode("BUNDLE");
      for (let i = 0; i < prefix.length; i++) {
        assertEquals(payload[i], prefix[i]);
      }

      // Check action
      const action = new TextEncoder().encode(BundlePayloadAction.TRANSFER);
      for (let i = 0; i < action.length; i++) {
        assertEquals(payload[i + prefix.length], action[i]);
      }
    }
  );

  await t.step(
    "buildBundlePayload() should support custom actions",
    async () => {
      const wasmBinary = await loadWasm();
      const poolEngine = new PoolEngine({
        networkConfig: StellarPlus.Network.TestNet(),
        wasm: wasmBinary,
        assetContractId: testAssetContractId,
      });

      const bundle = {
        spend: [Buffer.alloc(65, 20)],
        create: [[Buffer.alloc(65, 21), BigInt(5000)]] as Array<
          readonly [Buffer, bigint]
        >,
        signatures: [Buffer.alloc(65, 22)],
      };

      const customAction = "CUSTOM_ACTION";
      const payload = poolEngine.buildBundlePayload({
        bundle,
        action: customAction,
      });

      // Verify custom action is encoded
      const prefixLength = new TextEncoder().encode("BUNDLE").length;
      const encodedAction = new TextEncoder().encode(customAction);
      for (let i = 0; i < encodedAction.length; i++) {
        assertEquals(payload[i + prefixLength], encodedAction[i]);
      }
    }
  );
});
