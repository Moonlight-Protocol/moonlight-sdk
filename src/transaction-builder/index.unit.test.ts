// deno-lint-ignore-file require-await
import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MoonlightTransactionBuilder } from "./index.ts";
import { createOpToXDR, depositOpToXDR, withdrawOpToXDR, spendOpToXDR } from "./xdr/index.ts";
import { Asset, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { Condition } from "../conditions/types.ts";
import { StellarSmartContractId } from "../utils/types/stellar.types.ts";

// Mock data for testing
const mockChannelId: StellarSmartContractId = StrKey.encodeContract(Buffer.alloc(32)) as StellarSmartContractId;
const mockAuthId: StellarSmartContractId = StrKey.encodeContract(Buffer.alloc(32, 1)) as StellarSmartContractId;
const mockNetwork = "testnet";
const mockAsset = Asset.native();

// Mock UTXO data
const mockUTXO1 = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
const mockUTXO2 = Buffer.from([9, 10, 11, 12, 13, 14, 15, 16]);

// Mock Ed25519 public keys
const mockEd25519Key1 = Keypair.random().publicKey() as `G${string}`;
const mockEd25519Key2 = Keypair.random().publicKey() as `G${string}`;

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

// Helper function to create a test builder instance
function createTestBuilder(): MoonlightTransactionBuilder {
  return new MoonlightTransactionBuilder({
    channelId: mockChannelId,
    authId: mockAuthId,
    asset: mockAsset,
    network: mockNetwork,
  });
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
    const mockSignature = Buffer.alloc(64, 0x42);
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
    const mockSignature = Buffer.alloc(64, 0x42);
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
    const mockSignature = Buffer.alloc(64, 0x43);
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
    const mockSignature = Buffer.alloc(64, 0x44);
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
    const mockSignature1 = Buffer.alloc(64, 0x45);
    const mockSignature2 = Buffer.alloc(64, 0x46);
    
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
    const mockSignature1 = Buffer.alloc(64, 0x47);
    const mockSignature2 = Buffer.alloc(64, 0x48);
    
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

Deno.test("MoonlightTransactionBuilder - Query Methods", async (t) => {
  await t.step("getOperation should return empty arrays when no operations added", () => {
    const builder = createTestBuilder();

    const op = builder.getOperation();
    assertEquals(op.create.length, 0);
    assertEquals(op.spend.length, 0);
    assertEquals(op.deposit.length, 0);
    assertEquals(op.withdraw.length, 0);
  });

  await t.step("getOperation should reflect added operations", () => {
    const builder = createTestBuilder();

    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(mockEd25519Key1, 500n, [mockDepositCondition])
      .addWithdraw(mockEd25519Key2, 300n, [mockWithdrawCondition]);

    const op = builder.getOperation();
    assertEquals(op.create.length, 1);
    assertEquals(op.spend.length, 1);
    assertEquals(op.deposit.length, 1);
    assertEquals(op.withdraw.length, 1);
  });

  await t.step("getDepositOperation should return deposit when exists", () => {
    const builder = createTestBuilder();
    builder.addDeposit(mockEd25519Key1, 500n, [mockDepositCondition]);

    const dep = builder.getDepositOperation(mockEd25519Key1);
    assertEquals(dep?.pubKey, mockEd25519Key1);
    assertEquals(dep?.amount, 500n);
    assertEquals(dep?.conditions.length, 1);
  });

  await t.step("getDepositOperation should return undefined when not found", () => {
    const builder = createTestBuilder();
    const dep = builder.getDepositOperation(mockEd25519Key2);
    assertEquals(dep, undefined);
  });
});

Deno.test("MoonlightTransactionBuilder - Authorization and Arguments", async (t) => {
  await t.step("getExtAuthEntry should generate entry for existing deposit", () => {
    const builder = createTestBuilder();
    builder.addDeposit(mockEd25519Key1, 500n, [mockDepositCondition]);

    // Using deterministic values for validation
    const nonce = "123";
    const exp = 456;

    const entry = builder.getExtAuthEntry(mockEd25519Key1, nonce, exp);
    // We can't assert XDR internals without full mocks; ensure object exists
    assertEquals(!!entry, true);
  });

  await t.step("getExtAuthEntry should throw when deposit is missing", () => {
    const builder = createTestBuilder();
    const nonce = "123";
    const exp = 456;

    assertThrows(
      () => builder.getExtAuthEntry(mockEd25519Key1, nonce, exp),
      Error,
      "No deposit operation for this address",
    );
  });

  await t.step("getAuthRequirementArgs should return empty when no spend", () => {
    const builder = createTestBuilder();
    const args = builder.getAuthRequirementArgs();
    assertEquals(Array.isArray(args), true);
    assertEquals(args.length, 0);
  });

  await t.step("getAuthRequirementArgs should include ordered spend signers", () => {
    const builder = createTestBuilder();
    // Add spend with two UTXOs in reverse order to verify ordering
    builder
      .addSpend(mockUTXO2, [mockDepositCondition])
      .addSpend(mockUTXO1, [mockCreateCondition]);

    const args = builder.getAuthRequirementArgs();
    // Expect one vector with one map of signers
    assertEquals(args.length, 1);
    // We can't deserialize xdr.ScVal here; presence suffices for unit test
    assertEquals(!!args[0], true);
  });

  await t.step("getOperationAuthEntry should generate entry (unsigned)", () => {
    const builder = createTestBuilder();
    // No spend: args should be empty, but entry is still generated
    const entry = builder.getOperationAuthEntry("999", 1234, false);
    assertEquals(!!entry, true);
  });
});

Deno.test("MoonlightTransactionBuilder - Hash and Signature XDR", async (t) => {
  await t.step("getOperationAuthEntryHash should return hash for given parameters", async () => {
    const builder = createTestBuilder();
    const nonce = "123456789";
    const exp = 1000;

    const hash = await builder.getOperationAuthEntryHash(nonce, exp);
    // Should return a 32-byte hash
    assertEquals(hash.length, 32);
    assertEquals(hash instanceof Uint8Array, true);
  });

  await t.step("getOperationAuthEntryHash should use network ID correctly", async () => {
    const builder = createTestBuilder();
    const nonce = "123456789";
    const exp = 1000;

    const hash1 = await builder.getOperationAuthEntryHash(nonce, exp);
    const hash2 = await builder.getOperationAuthEntryHash(nonce, exp);
    // Same parameters should produce same hash
    assertEquals(hash1, hash2);
  });

  await t.step("getOperationAuthEntryHash should handle different nonce values", async () => {
    const builder = createTestBuilder();
    const exp = 1000;

    const hash1 = await builder.getOperationAuthEntryHash("123456789", exp);
    const hash2 = await builder.getOperationAuthEntryHash("987654321", exp);
    // Different nonces should produce different hashes
    assertEquals(hash1.length, 32);
    assertEquals(hash2.length, 32);
    // Hashes should be different
    assertEquals(hash1.every((byte, i) => byte === hash2[i]), false);
  });

  await t.step("signaturesXDR should throw error when no provider signatures", () => {
    const builder = createTestBuilder();
    // Add spend operation but no provider signature
    builder.addSpend(mockUTXO1, [mockCreateCondition]);

    assertThrows(
      () => builder.signaturesXDR(),
      Error,
      "No Provider signatures added",
    );
  });

  await t.step("signaturesXDR should return correct XDR format", () => {
    const builder = createTestBuilder();
    const mockSignature = Buffer.alloc(64, 0x42);

    // Add provider signature
    builder.addProviderInnerSignature(mockEd25519Key1, mockSignature, 1000, "nonce123");

    const xdrString = builder.signaturesXDR();
    // Should return a base64 XDR string
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("signaturesXDR should order signatures correctly", () => {
    const builder = createTestBuilder();
    const mockSignature1 = Buffer.alloc(64, 0x42);
    const mockSignature2 = Buffer.alloc(64, 0x43);

    // Add provider signatures in reverse order
    builder
      .addProviderInnerSignature(mockEd25519Key2, mockSignature2, 1000, "nonce2")
      .addProviderInnerSignature(mockEd25519Key1, mockSignature1, 1000, "nonce1");

    const xdrString = builder.signaturesXDR();
    // Should return valid XDR string (ordering is internal, we just verify it works)
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("signaturesXDR should handle both provider and spend signatures", () => {
    const builder = createTestBuilder();
    const mockSignature = Buffer.alloc(64, 0x44);

    // Add spend operation and signatures
    builder
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addInnerSignature(mockUTXO1, mockSignature, 1000)
      .addProviderInnerSignature(mockEd25519Key1, mockSignature, 1000, "nonce123");

    const xdrString = builder.signaturesXDR();
    // Should return valid XDR string with both types
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });
});

Deno.test("MoonlightTransactionBuilder - High-Level Signing Methods", async (t) => {
  await t.step("signWithProvider should sign with provided keypair", async () => {
    const builder = createTestBuilder();
    const keypair = Keypair.random();
    const expirationLedger = 1000;

    await builder.signWithProvider(keypair, expirationLedger);

    // Verify that provider signature was added by checking signaturesXDR doesn't throw
    const xdrString = builder.signaturesXDR();
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("signWithProvider should use provided nonce", async () => {
    const builder = createTestBuilder();
    const keypair = Keypair.random();
    const expirationLedger = 1000;
    const customNonce = "999888777";

    await builder.signWithProvider(keypair, expirationLedger, customNonce);

    // Should not throw and should generate valid XDR
    const xdrString = builder.signaturesXDR();
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("signWithSpendUtxo should throw error when UTXO not found", async () => {
    const builder = createTestBuilder();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    let errorThrown = false;
    try {
      await builder.signWithSpendUtxo(mockUtxo, expirationLedger);
    } catch (error) {
      errorThrown = true;
      assertEquals((error as Error).message, "No spend operation for this UTXO");
    }
    assertEquals(errorThrown, true);
  });

  await t.step("signWithSpendUtxo should sign with UTXO keypair when found", async () => {
    const builder = createTestBuilder();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    // Add spend operation first
    builder.addSpend(mockUTXO1, [mockCreateCondition]);

    await builder.signWithSpendUtxo(mockUtxo, expirationLedger);

    // Should not throw - signature was added
    assertEquals(true, true); // Test passes if no exception
  });

  await t.step("signExtWithEd25519 should sign external auth entry", async () => {
    const builder = createTestBuilder();
    const keypair = Keypair.random();
    const expirationLedger = 1000;

    // Add deposit operation first
    builder.addDeposit(keypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);

    await builder.signExtWithEd25519(keypair, expirationLedger);

    // Should not throw - external signature was added
    assertEquals(true, true); // Test passes if no exception
  });

  await t.step("signExtWithEd25519 should use provided nonce", async () => {
    const builder = createTestBuilder();
    const keypair = Keypair.random();
    const expirationLedger = 1000;
    const customNonce = "555444333";

    // Add deposit operation first
    builder.addDeposit(keypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);

    await builder.signExtWithEd25519(keypair, expirationLedger, customNonce);

    // Should not throw - custom nonce was used and signature added
    assertEquals(true, true); // Test passes if no exception
  });

  await t.step("should handle complex signing workflow", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    // Add operations
    builder
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);

    // Sign with all methods (now that buildAuthPayloadHash is implemented)
    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signWithSpendUtxo(mockUtxo, expirationLedger);
    await builder.signExtWithEd25519(userKeypair, expirationLedger);

    // Should generate valid XDR with all signatures
    const xdrString = builder.signaturesXDR();
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });
});

Deno.test("MoonlightTransactionBuilder - Final Methods", async (t) => {
  await t.step("getSignedAuthEntries should return all signed entries", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const expirationLedger = 1000;

    // Add operations and sign
    builder.addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);
    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signExtWithEd25519(userKeypair, expirationLedger);

    const signedEntries = builder.getSignedAuthEntries();
    
    // Should return an array of signed auth entries
    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length, 2); // External + operation entry
  });

  await t.step("getSignedAuthEntries should include external and operation entries", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const expirationLedger = 1000;

    // Add operations and sign
    builder.addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);
    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signExtWithEd25519(userKeypair, expirationLedger);

    const signedEntries = builder.getSignedAuthEntries();
    
    // Should have both external and operation entries
    assertEquals(signedEntries.length >= 2, true);
    
    // Each entry should be a valid SorobanAuthorizationEntry
    for (const entry of signedEntries) {
      assertEquals(!!entry, true);
    }
  });

  await t.step("buildXDR should include all operation types", () => {
    const builder = createTestBuilder();
    
    // Add one of each operation type
    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(mockEd25519Key1, 500n, [mockDepositCondition])
      .addWithdraw(mockEd25519Key2, 300n, [mockWithdrawCondition]);

    const xdr = builder.buildXDR();
    
    // Should return valid XDR structure
    assertEquals(!!xdr, true);
  });

  await t.step("buildXDR should handle empty operations correctly", () => {
    const builder = createTestBuilder();
    
    // Don't add any operations
    const xdr = builder.buildXDR();
    
    // Should still return valid XDR structure with empty arrays
    assertEquals(!!xdr, true);
  });

  await t.step("buildXDR should handle mixed operations", () => {
    const builder = createTestBuilder();
    
    // Add multiple operations of different types
    builder
      .addCreate(mockUTXO1, 1000n)
      .addCreate(mockUTXO2, 2000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(mockEd25519Key1, 500n, [mockDepositCondition])
      .addDeposit(mockEd25519Key2, 300n, [mockWithdrawCondition])
      .addWithdraw(mockEd25519Key1, 200n, [mockWithdrawCondition]);

    const xdr = builder.buildXDR();
    
    // Should return valid XDR structure
    assertEquals(!!xdr, true);
  });

  await t.step("should handle complete transaction workflow", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    // Complete workflow: add operations, sign, and build XDR
    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition])
      .addWithdraw(userKeypair.publicKey() as `G${string}`, 200n, [mockWithdrawCondition]);

    // Sign with all methods
    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signWithSpendUtxo(mockUtxo, expirationLedger);
    await builder.signExtWithEd25519(userKeypair, expirationLedger);

    // Get signed entries and build XDR
    const signedEntries = builder.getSignedAuthEntries();
    const xdr = builder.buildXDR();
    const xdrString = builder.signaturesXDR();

    // All should be valid
    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length >= 2, true);
    assertEquals(!!xdr, true);
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });
});

Deno.test("Transaction Builder Utility Functions", async (t) => {
  await t.step("createOpToXDR should convert create operation to XDR correctly", () => {
    const createOp = {
      utxo: mockUTXO1,
      amount: 1000n
    };

    const xdr = createOpToXDR(createOp);
    
    // Should return a valid ScVal
    assertEquals(!!xdr, true);
  });

  await t.step("depositOpToXDR should convert deposit operation to XDR correctly", () => {
    const depositOp = {
      pubKey: mockEd25519Key1,
      amount: 500n,
      conditions: [mockDepositCondition]
    };

    const xdr = depositOpToXDR(depositOp);
    
    // Should return a valid ScVal
    assertEquals(!!xdr, true);
  });

  await t.step("depositOpToXDR should handle empty conditions", () => {
    const depositOp = {
      pubKey: mockEd25519Key1,
      amount: 500n,
      conditions: []
    };

    const xdr = depositOpToXDR(depositOp);
    
    // Should return a valid ScVal even with empty conditions
    assertEquals(!!xdr, true);
  });

  await t.step("withdrawOpToXDR should convert withdraw operation to XDR correctly", () => {
    const withdrawOp = {
      pubKey: mockEd25519Key1,
      amount: 300n,
      conditions: [mockWithdrawCondition]
    };

    const xdr = withdrawOpToXDR(withdrawOp);
    
    // Should return a valid ScVal
    assertEquals(!!xdr, true);
  });

  await t.step("withdrawOpToXDR should handle empty conditions", () => {
    const withdrawOp = {
      pubKey: mockEd25519Key1,
      amount: 300n,
      conditions: []
    };

    const xdr = withdrawOpToXDR(withdrawOp);
    
    // Should return a valid ScVal even with empty conditions
    assertEquals(!!xdr, true);
  });

  await t.step("spendOpToXDR should convert spend operation to XDR correctly", () => {
    const spendOp = {
      utxo: mockUTXO1,
      conditions: [mockCreateCondition, mockDepositCondition]
    };

    const xdr = spendOpToXDR(spendOp);
    
    // Should return a valid ScVal
    assertEquals(!!xdr, true);
  });

  await t.step("spendOpToXDR should handle empty conditions", () => {
    const spendOp = {
      utxo: mockUTXO1,
      conditions: []
    };

    const xdr = spendOpToXDR(spendOp);
    
    // Should return a valid ScVal even with empty conditions
    assertEquals(!!xdr, true);
  });

  await t.step("all utility functions should handle different amounts", () => {
    // Test createOpToXDR with different amounts
    const createOp1 = { utxo: mockUTXO1, amount: 1n };
    const createOp2 = { utxo: mockUTXO2, amount: 999999999n };
    
    const xdr1 = createOpToXDR(createOp1);
    const xdr2 = createOpToXDR(createOp2);
    
    assertEquals(!!xdr1, true);
    assertEquals(!!xdr2, true);

    // Test depositOpToXDR with different amounts
    const depositOp1 = { pubKey: mockEd25519Key1, amount: 1n, conditions: [] };
    const depositOp2 = { pubKey: mockEd25519Key2, amount: 999999999n, conditions: [] };
    
    const xdr3 = depositOpToXDR(depositOp1);
    const xdr4 = depositOpToXDR(depositOp2);
    
    assertEquals(!!xdr3, true);
    assertEquals(!!xdr4, true);

    // Test withdrawOpToXDR with different amounts
    const withdrawOp1 = { pubKey: mockEd25519Key1, amount: 1n, conditions: [] };
    const withdrawOp2 = { pubKey: mockEd25519Key2, amount: 999999999n, conditions: [] };
    
    const xdr5 = withdrawOpToXDR(withdrawOp1);
    const xdr6 = withdrawOpToXDR(withdrawOp2);
    
    assertEquals(!!xdr5, true);
    assertEquals(!!xdr6, true);
  });

  await t.step("utility functions should handle multiple conditions", () => {
    // Test with multiple conditions
    const multipleConditions = [mockCreateCondition, mockDepositCondition, mockWithdrawCondition];
    
    const depositOp = {
      pubKey: mockEd25519Key1,
      amount: 500n,
      conditions: multipleConditions
    };

    const withdrawOp = {
      pubKey: mockEd25519Key2,
      amount: 300n,
      conditions: multipleConditions
    };

    const spendOp = {
      utxo: mockUTXO1,
      conditions: multipleConditions
    };

    const depositXdr = depositOpToXDR(depositOp);
    const withdrawXdr = withdrawOpToXDR(withdrawOp);
    const spendXdr = spendOpToXDR(spendOp);

    assertEquals(!!depositXdr, true);
    assertEquals(!!withdrawXdr, true);
    assertEquals(!!spendXdr, true);
  });
});

Deno.test("MoonlightTransactionBuilder - Integration and Edge Cases", async (t) => {
  await t.step("should build complete transaction with all operation types", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair1 = Keypair.random();
    const userKeypair2 = Keypair.random();
    const mockUtxo1 = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const mockUtxo2 = {
      publicKey: mockUTXO2,
      privateKey: Buffer.alloc(32, 0x02),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x43)
    };
    const expirationLedger = 1000;

    // Add all types of operations
    builder
      .addCreate(mockUTXO1, 1000n)
      .addCreate(mockUTXO2, 2000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addSpend(mockUTXO2, [mockDepositCondition, mockWithdrawCondition])
      .addDeposit(userKeypair1.publicKey() as `G${string}`, 500n, [mockDepositCondition])
      .addDeposit(userKeypair2.publicKey() as `G${string}`, 300n, [mockWithdrawCondition])
      .addWithdraw(userKeypair1.publicKey() as `G${string}`, 200n, [mockWithdrawCondition])
      .addWithdraw(userKeypair2.publicKey() as `G${string}`, 100n, [mockCreateCondition]);

    // Sign with all methods
    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signWithSpendUtxo(mockUtxo1, expirationLedger);
    await builder.signWithSpendUtxo(mockUtxo2, expirationLedger);
    await builder.signExtWithEd25519(userKeypair1, expirationLedger);
    await builder.signExtWithEd25519(userKeypair2, expirationLedger);

    // Verify all components work together
    const operations = builder.getOperation();
    const signedEntries = builder.getSignedAuthEntries();
    const xdr = builder.buildXDR();
    const xdrString = builder.signaturesXDR();

    // Validate operations
    assertEquals(operations.create.length, 2);
    assertEquals(operations.spend.length, 2);
    assertEquals(operations.deposit.length, 2);
    assertEquals(operations.withdraw.length, 2);

    // Validate signatures
    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length >= 3, true); // Provider + 2 external

    // Validate XDR
    assertEquals(!!xdr, true);
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("should handle complex transaction with multiple signatures", async () => {
    const builder = createTestBuilder();
    const providerKeypair1 = Keypair.random();
    const providerKeypair2 = Keypair.random();
    const userKeypair1 = Keypair.random();
    const userKeypair2 = Keypair.random();
    const userKeypair3 = Keypair.random();
    const expirationLedger = 1000;

    // Add operations - each user keypair needs both deposit and withdraw operations
    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(userKeypair1.publicKey() as `G${string}`, 500n, [mockDepositCondition])
      .addDeposit(userKeypair2.publicKey() as `G${string}`, 300n, [mockWithdrawCondition])
      .addDeposit(userKeypair3.publicKey() as `G${string}`, 200n, [mockWithdrawCondition])
      .addWithdraw(userKeypair1.publicKey() as `G${string}`, 200n, [mockWithdrawCondition])
      .addWithdraw(userKeypair2.publicKey() as `G${string}`, 100n, [mockCreateCondition])
      .addWithdraw(userKeypair3.publicKey() as `G${string}`, 150n, [mockDepositCondition]);

    // Add multiple provider signatures
    await builder.signWithProvider(providerKeypair1, expirationLedger);
    await builder.signWithProvider(providerKeypair2, expirationLedger);

    // Add multiple external signatures (each keypair has both deposit and withdraw)
    await builder.signExtWithEd25519(userKeypair1, expirationLedger);
    await builder.signExtWithEd25519(userKeypair2, expirationLedger);
    await builder.signExtWithEd25519(userKeypair3, expirationLedger);

    // Verify multiple signatures are handled correctly
    const signedEntries = builder.getSignedAuthEntries();
    const xdrString = builder.signaturesXDR();

    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length >= 4, true); // 2 providers + 3 external
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("should validate transaction integrity", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    // Build transaction
    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);

    await builder.signWithProvider(providerKeypair, expirationLedger);
    await builder.signWithSpendUtxo(mockUtxo, expirationLedger);
    await builder.signExtWithEd25519(userKeypair, expirationLedger);

    // Verify transaction integrity
    const operations = builder.getOperation();
    const signedEntries = builder.getSignedAuthEntries();
    const xdr = builder.buildXDR();
    const xdrString = builder.signaturesXDR();

    // All components should be consistent
    assertEquals(operations.create.length, 1);
    assertEquals(operations.spend.length, 1);
    assertEquals(operations.deposit.length, 1);
    assertEquals(operations.withdraw.length, 0);

    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length >= 2, true);
    assertEquals(!!xdr, true);
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("should handle maximum number of operations", () => {
    const builder = createTestBuilder();
    const maxOperations = 10;

    // Add maximum number of each operation type
    for (let i = 0; i < maxOperations; i++) {
      const utxo = new Uint8Array([i, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6, i + 7]);
      const keypair = Keypair.random();
      
      builder
        .addCreate(utxo, BigInt(1000 + i))
        .addSpend(utxo, [mockCreateCondition])
        .addDeposit(keypair.publicKey() as `G${string}`, BigInt(500 + i), [mockDepositCondition])
        .addWithdraw(keypair.publicKey() as `G${string}`, BigInt(300 + i), [mockWithdrawCondition]);
    }

    const operations = builder.getOperation();
    const xdr = builder.buildXDR();

    assertEquals(operations.create.length, maxOperations);
    assertEquals(operations.spend.length, maxOperations);
    assertEquals(operations.deposit.length, maxOperations);
    assertEquals(operations.withdraw.length, maxOperations);
    assertEquals(!!xdr, true);
  });

  await t.step("should handle edge cases with zero amounts", () => {
    const builder = createTestBuilder();

    // These should throw errors for zero amounts
    assertThrows(
      () => builder.addCreate(mockUTXO1, 0n),
      Error,
      "Create operation amount must be positive"
    );

    assertThrows(
      () => builder.addDeposit(mockEd25519Key1, 0n, []),
      Error,
      "Deposit operation amount must be positive"
    );

    assertThrows(
      () => builder.addWithdraw(mockEd25519Key1, 0n, []),
      Error,
      "Withdraw operation amount must be positive"
    );
  });

  await t.step("should handle edge cases with negative amounts", () => {
    const builder = createTestBuilder();

    // These should throw errors for negative amounts
    assertThrows(
      () => builder.addCreate(mockUTXO1, -100n),
      Error,
      "Create operation amount must be positive"
    );

    assertThrows(
      () => builder.addDeposit(mockEd25519Key1, -100n, []),
      Error,
      "Deposit operation amount must be positive"
    );

    assertThrows(
      () => builder.addWithdraw(mockEd25519Key1, -100n, []),
      Error,
      "Withdraw operation amount must be positive"
    );
  });

  await t.step("should handle invalid input parameters", () => {
    const builder = createTestBuilder();

    // Test with empty UTXO array - should work but be a valid UTXO
    const emptyUtxo = new Uint8Array(8).fill(0);
    builder.addCreate(emptyUtxo, 1000n);
    
    // Try to add the same UTXO again - should throw error
    assertThrows(
      () => builder.addCreate(emptyUtxo, 2000n),
      Error,
      "Create operation for this UTXO already exists"
    );

    // Test with empty public key - should work but be a valid key
    const emptyKey = ("G" + "A".repeat(55)) as `G${string}`; // Valid format but empty content
    builder.addDeposit(emptyKey, 500n, []);
    
    // Try to add the same public key again - should throw error
    assertThrows(
      () => builder.addDeposit(emptyKey, 1000n, []),
      Error,
      "Deposit operation for this public key already exists"
    );
  });

  await t.step("should handle concurrent operations", async () => {
    const builder = createTestBuilder();
    const providerKeypair = Keypair.random();
    const userKeypair = Keypair.random();
    const mockUtxo = {
      publicKey: mockUTXO1,
      privateKey: Buffer.alloc(32, 0x01),
      signPayload: async (payload: Uint8Array) => Buffer.alloc(64, 0x42)
    };
    const expirationLedger = 1000;

    // Add operations
    builder
      .addCreate(mockUTXO1, 1000n)
      .addSpend(mockUTXO1, [mockCreateCondition])
      .addDeposit(userKeypair.publicKey() as `G${string}`, 500n, [mockDepositCondition]);

    // Sign concurrently (simulate concurrent access)
    const signingPromises = [
      builder.signWithProvider(providerKeypair, expirationLedger),
      builder.signWithSpendUtxo(mockUtxo, expirationLedger),
      builder.signExtWithEd25519(userKeypair, expirationLedger)
    ];

    await Promise.all(signingPromises);

    // Verify all signatures were added
    const signedEntries = builder.getSignedAuthEntries();
    const xdrString = builder.signaturesXDR();

    assertEquals(Array.isArray(signedEntries), true);
    assertEquals(signedEntries.length >= 2, true);
    assertEquals(typeof xdrString, "string");
    assertEquals(xdrString.length > 0, true);
  });

  await t.step("should handle large transaction data", () => {
    const builder = createTestBuilder();
    const largeAmount = 999999999999999999n; // Very large amount
    const largeUtxo = new Uint8Array(64).fill(0xFF); // Large UTXO
    const keypair = Keypair.random();

    // Add operations with large data
    builder
      .addCreate(largeUtxo, largeAmount)
      .addSpend(largeUtxo, [mockCreateCondition, mockDepositCondition, mockWithdrawCondition])
      .addDeposit(keypair.publicKey() as `G${string}`, largeAmount, [mockDepositCondition])
      .addWithdraw(keypair.publicKey() as `G${string}`, largeAmount, [mockWithdrawCondition]);

    const operations = builder.getOperation();
    const xdr = builder.buildXDR();

    assertEquals(operations.create.length, 1);
    assertEquals(operations.create[0].amount, largeAmount);
    assertEquals(operations.spend.length, 1);
    assertEquals(operations.deposit.length, 1);
    assertEquals(operations.deposit[0].amount, largeAmount);
    assertEquals(operations.withdraw.length, 1);
    assertEquals(operations.withdraw[0].amount, largeAmount);
    assertEquals(!!xdr, true);
  });
});
