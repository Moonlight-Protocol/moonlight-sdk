// deno-lint-ignore-file require-await
import {
  assertEquals,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { MoonlightTransactionBuilder, createOpToXDR, depositOpToXDR, withdrawOpToXDR, spendOpToXDR } from "./index.ts";
import { Asset, Keypair, xdr } from "@stellar/stellar-sdk";
import { IUTXOKeypairBase } from "../core/utxo-keypair-base/types.ts";
import { Condition } from "../conditions/types.ts";
import { StellarSmartContractId } from "../utils/types/stellar.types.ts";

// Mock data for testing
const mockChannelId: StellarSmartContractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const mockAuthId: StellarSmartContractId = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const mockNetwork = "testnet";
const mockAsset = Asset.native();

// Mock UTXO data
const mockUTXO1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const mockUTXO2 = new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]);

// Mock Ed25519 public keys
const mockEd25519Key1 = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const mockEd25519Key2 = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

// Mock conditions
const mockCreateCondition: Condition = {
  action: "CREATE",
  utxo: mockUTXO1,
  amount: 1000n,
};

const mockDepositCondition: Condition = {
  action: "DEPOSIT",
  publicKey: mockEd25519Key1,
  amount: 500n,
};

const mockWithdrawCondition: Condition = {
  action: "WITHDRAW",
  publicKey: mockEd25519Key2,
  amount: 300n,
};

// Mock IUTXOKeypairBase
class MockUTXOKeypair implements IUTXOKeypairBase {
  publicKey: Uint8Array;
  privateKey: Uint8Array;

  constructor(publicKey: Uint8Array, privateKey: Uint8Array) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  async signPayload(payload: Uint8Array): Promise<Uint8Array> {
    // Mock signature - return a fixed 64-byte signature
    return new Uint8Array(64).fill(0x42);
  }
}

// Mock functions
const mockSha256Buffer = async (data: Uint8Array): Promise<ArrayBuffer> => {
  // Return a mock hash
  return new ArrayBuffer(32);
};

const mockGenerateNonce = (): string => {
  return "1234567890123456789";
};

const mockBuildAuthPayloadHash = async (params: {
  contractId: string;
  conditions: Condition[];
  liveUntilLedger: number;
}): Promise<Uint8Array> => {
  // Return a mock payload hash
  return new Uint8Array(32).fill(0xAA);
};

const mockGenerateDepositAuthEntry = (params: any): xdr.SorobanAuthorizationEntry => {
  // Return a mock auth entry - simplified to avoid complex XDR construction
  return {} as xdr.SorobanAuthorizationEntry;
};

const mockGenerateBundleAuthEntry = (params: any): xdr.SorobanAuthorizationEntry => {
  // Return a mock auth entry - simplified to avoid complex XDR construction
  return {} as xdr.SorobanAuthorizationEntry;
};

// Helper function to create a test builder instance
function createTestBuilder(): MoonlightTransactionBuilder {
  return new MoonlightTransactionBuilder({
    channelId: mockChannelId,
    authId: mockAuthId,
    asset: mockAsset,
    network: mockNetwork,
  });
}

// Helper function to create a test Keypair
function createTestKeypair(): Keypair {
  return Keypair.random();
}

Deno.test("MoonlightTransactionBuilder - Basic Operations (Add Methods)", async (t) => {
  await t.step("addCreate should add create operation with valid parameters", () => {
    const builder = createTestBuilder();
    
    const result = builder.addCreate(mockUTXO1, 1000n);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Should have added the create operation
    const operations = builder.getOperation();
    assertEquals(operations.create.length, 1);
    assertEquals(operations.create[0].utxo, mockUTXO1);
    assertEquals(operations.create[0].amount, 1000n);
  });

  await t.step("addCreate should throw error when UTXO already exists", () => {
    const builder = createTestBuilder();
    
    builder.addCreate(mockUTXO1, 1000n);
    
    // Should throw error when adding same UTXO again
    assertThrows(
      () => builder.addCreate(mockUTXO1, 2000n),
      Error,
      "Create operation for this UTXO already exists"
    );
  });

  await t.step("addCreate should throw error when amount is zero or negative", () => {
    const builder = createTestBuilder();
    
    // Should throw error for zero amount
    assertThrows(
      () => builder.addCreate(mockUTXO1, 0n),
      Error,
      "Create operation amount must be positive"
    );
    
    // Should throw error for negative amount
    assertThrows(
      () => builder.addCreate(mockUTXO2, -100n),
      Error,
      "Create operation amount must be positive"
    );
  });

  await t.step("addSpend should add spend operation with valid parameters", () => {
    const builder = createTestBuilder();
    const conditions = [mockCreateCondition, mockDepositCondition];
    
    const result = builder.addSpend(mockUTXO1, conditions);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Should have added the spend operation
    const operations = builder.getOperation();
    assertEquals(operations.spend.length, 1);
    assertEquals(operations.spend[0].utxo, mockUTXO1);
    assertEquals(operations.spend[0].conditions.length, 2);
    assertEquals(operations.spend[0].conditions[0], mockCreateCondition);
    assertEquals(operations.spend[0].conditions[1], mockDepositCondition);
  });

  await t.step("addSpend should throw error when UTXO already exists", () => {
    const builder = createTestBuilder();
    const conditions = [mockCreateCondition];
    
    builder.addSpend(mockUTXO1, conditions);
    
    // Should throw error when adding same UTXO again
    assertThrows(
      () => builder.addSpend(mockUTXO1, [mockWithdrawCondition]),
      Error,
      "Spend operation for this UTXO already exists"
    );
  });

  await t.step("addSpend should handle empty conditions array", () => {
    const builder = createTestBuilder();
    
    const result = builder.addSpend(mockUTXO1, []);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Should have added the spend operation with empty conditions
    const operations = builder.getOperation();
    assertEquals(operations.spend.length, 1);
    assertEquals(operations.spend[0].utxo, mockUTXO1);
    assertEquals(operations.spend[0].conditions.length, 0);
  });

  await t.step("addDeposit should add deposit operation with valid parameters", () => {
    const builder = createTestBuilder();
    const conditions = [mockDepositCondition];
    
    const result = builder.addDeposit(mockEd25519Key1, 500n, conditions);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Should have added the deposit operation
    const operations = builder.getOperation();
    assertEquals(operations.deposit.length, 1);
    assertEquals(operations.deposit[0].pubKey, mockEd25519Key1);
    assertEquals(operations.deposit[0].amount, 500n);
    assertEquals(operations.deposit[0].conditions.length, 1);
    assertEquals(operations.deposit[0].conditions[0], mockDepositCondition);
  });

  await t.step("addDeposit should throw error when public key already exists", () => {
    const builder = createTestBuilder();
    const conditions = [mockDepositCondition];
    
    builder.addDeposit(mockEd25519Key1, 500n, conditions);
    
    // Should throw error when adding same public key again
    assertThrows(
      () => builder.addDeposit(mockEd25519Key1, 1000n, []),
      Error,
      "Deposit operation for this public key already exists"
    );
  });

  await t.step("addDeposit should throw error when amount is zero or negative", () => {
    const builder = createTestBuilder();
    const conditions = [mockDepositCondition];
    
    // Should throw error for zero amount
    assertThrows(
      () => builder.addDeposit(mockEd25519Key1, 0n, conditions),
      Error,
      "Deposit operation amount must be positive"
    );
    
    // Should throw error for negative amount
    assertThrows(
      () => builder.addDeposit(mockEd25519Key2, -100n, conditions),
      Error,
      "Deposit operation amount must be positive"
    );
  });

  await t.step("addWithdraw should add withdraw operation with valid parameters", () => {
    const builder = createTestBuilder();
    const conditions = [mockWithdrawCondition];
    
    const result = builder.addWithdraw(mockEd25519Key1, 300n, conditions);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Should have added the withdraw operation
    const operations = builder.getOperation();
    assertEquals(operations.withdraw.length, 1);
    assertEquals(operations.withdraw[0].pubKey, mockEd25519Key1);
    assertEquals(operations.withdraw[0].amount, 300n);
    assertEquals(operations.withdraw[0].conditions.length, 1);
    assertEquals(operations.withdraw[0].conditions[0], mockWithdrawCondition);
  });

  await t.step("addWithdraw should throw error when public key already exists", () => {
    const builder = createTestBuilder();
    const conditions = [mockWithdrawCondition];
    
    builder.addWithdraw(mockEd25519Key1, 300n, conditions);
    
    // Should throw error when adding same public key again
    assertThrows(
      () => builder.addWithdraw(mockEd25519Key1, 500n, []),
      Error,
      "Withdraw operation for this public key already exists"
    );
  });

  await t.step("addWithdraw should throw error when amount is zero or negative", () => {
    const builder = createTestBuilder();
    const conditions = [mockWithdrawCondition];
    
    // Should throw error for zero amount
    assertThrows(
      () => builder.addWithdraw(mockEd25519Key1, 0n, conditions),
      Error,
      "Withdraw operation amount must be positive"
    );
    
    // Should throw error for negative amount
    assertThrows(
      () => builder.addWithdraw(mockEd25519Key2, -100n, conditions),
      Error,
      "Withdraw operation amount must be positive"
    );
  });

  await t.step("should allow chaining multiple operations", () => {
    const builder = createTestBuilder();
    
    const result = builder
      .addCreate(mockUTXO1, 1000n)
      .addCreate(mockUTXO2, 2000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(mockEd25519Key1, 500n, [mockDepositCondition])
      .addWithdraw(mockEd25519Key2, 300n, [mockWithdrawCondition]);
    
    // Should return builder instance
    assertEquals(result, builder);
    
    // Should have all operations
    const operations = builder.getOperation();
    assertEquals(operations.create.length, 2);
    assertEquals(operations.spend.length, 1);
    assertEquals(operations.deposit.length, 1);
    assertEquals(operations.withdraw.length, 1);
  });
});

Deno.test("MoonlightTransactionBuilder - Internal Signatures", async (t) => {
  await t.step("addInnerSignature should add signature for existing spend operation", () => {
    const builder = createTestBuilder();
    const mockSignature = new Uint8Array(64).fill(0x42);
    const expirationLedger = 1000;
    
    // First add a spend operation
    builder.addSpend(mockUTXO1, [mockCreateCondition]);
    
    const result = builder.addInnerSignature(mockUTXO1, mockSignature, expirationLedger);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Verify signature was added (we can't directly access private properties,
    // but we can test that the method doesn't throw and returns the builder)
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("addInnerSignature should throw error when UTXO not found in spend operations", () => {
    const builder = createTestBuilder();
    const mockSignature = new Uint8Array(64).fill(0x42);
    const expirationLedger = 1000;
    
    // Don't add any spend operations
    
    // Should throw error when trying to add signature for non-existent UTXO
    assertThrows(
      () => builder.addInnerSignature(mockUTXO1, mockSignature, expirationLedger),
      Error,
      "No spend operation for this UTXO"
    );
  });

  await t.step("addProviderInnerSignature should add provider signature", () => {
    const builder = createTestBuilder();
    const mockSignature = new Uint8Array(64).fill(0x43);
    const expirationLedger = 1000;
    const nonce = "123456789";
    
    const result = builder.addProviderInnerSignature(
      mockEd25519Key1,
      mockSignature,
      expirationLedger,
      nonce
    );
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("addExtSignedEntry should add external signature for existing deposit", () => {
    const builder = createTestBuilder();
    const mockAuthEntry = {} as xdr.SorobanAuthorizationEntry;
    
    // First add a deposit operation
    builder.addDeposit(mockEd25519Key1, 500n, [mockDepositCondition]);
    
    const result = builder.addExtSignedEntry(mockEd25519Key1, mockAuthEntry);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("addExtSignedEntry should add external signature for existing withdraw", () => {
    const builder = createTestBuilder();
    const mockAuthEntry = {} as xdr.SorobanAuthorizationEntry;
    
    // First add a withdraw operation
    builder.addWithdraw(mockEd25519Key1, 300n, [mockWithdrawCondition]);
    
    const result = builder.addExtSignedEntry(mockEd25519Key1, mockAuthEntry);
    
    // Should return builder instance for chaining
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("addExtSignedEntry should throw error when public key not found", () => {
    const builder = createTestBuilder();
    const mockAuthEntry = {} as xdr.SorobanAuthorizationEntry;
    
    // Don't add any deposit or withdraw operations
    
    // Should throw error when trying to add signature for non-existent public key
    assertThrows(
      () => builder.addExtSignedEntry(mockEd25519Key1, mockAuthEntry),
      Error,
      "No deposit or withdraw operation for this public key"
    );
  });

  await t.step("should allow chaining signature operations", () => {
    const builder = createTestBuilder();
    const mockSignature = new Uint8Array(64).fill(0x44);
    const mockAuthEntry = {} as xdr.SorobanAuthorizationEntry;
    
    // Add operations first
    builder.addSpend(mockUTXO1, [mockCreateCondition]);
    builder.addDeposit(mockEd25519Key1, 500n, [mockDepositCondition]);
    
    const result = builder
      .addInnerSignature(mockUTXO1, mockSignature, 1000)
      .addProviderInnerSignature(mockEd25519Key1, mockSignature, 1000, "nonce123")
      .addExtSignedEntry(mockEd25519Key1, mockAuthEntry);
    
    // Should return builder instance
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("should handle multiple provider signatures", () => {
    const builder = createTestBuilder();
    const mockSignature1 = new Uint8Array(64).fill(0x45);
    const mockSignature2 = new Uint8Array(64).fill(0x46);
    
    const result = builder
      .addProviderInnerSignature(mockEd25519Key1, mockSignature1, 1000, "nonce1")
      .addProviderInnerSignature(mockEd25519Key2, mockSignature2, 1000, "nonce2");
    
    // Should return builder instance
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });

  await t.step("should handle multiple inner signatures for different UTXOs", () => {
    const builder = createTestBuilder();
    const mockSignature1 = new Uint8Array(64).fill(0x47);
    const mockSignature2 = new Uint8Array(64).fill(0x48);
    
    // Add spend operations for different UTXOs
    builder.addSpend(mockUTXO1, [mockCreateCondition]);
    builder.addSpend(mockUTXO2, [mockDepositCondition]);
    
    const result = builder
      .addInnerSignature(mockUTXO1, mockSignature1, 1000)
      .addInnerSignature(mockUTXO2, mockSignature2, 1000);
    
    // Should return builder instance
    assertEquals(result, builder);
    
    // Verify the method doesn't throw and returns the builder
    assertEquals(result instanceof MoonlightTransactionBuilder, true);
  });
});
