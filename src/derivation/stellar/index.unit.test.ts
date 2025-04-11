import {
  StellarDerivator,
  assembleNetworkContext,
  createForAccount,
} from "./index.ts";
import { StellarNetworkId } from "./stellar-network-id.ts";
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";

// Constants for testing
const TEST_SECRET_KEY =
  "SBQPDFUGLMWJYEYXFRM5TQX3AX2BR47WKI4FDS7EJQUSEUUVY72MZPJF";
const TEST_CONTRACT_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const TEST_NETWORK = StellarNetworkId.Testnet;

Deno.test("StellarDerivator", async (t) => {
  await t.step("withNetworkAndContract should set context", () => {
    const derivator = new StellarDerivator()
      .withNetworkAndContract(TEST_NETWORK, TEST_CONTRACT_ID)
      .withSecretKey(TEST_SECRET_KEY);

    const expectedContext = assembleNetworkContext(
      TEST_NETWORK,
      TEST_CONTRACT_ID
    );
    const result = derivator.assembleSeed("0");

    assertEquals(result.startsWith(expectedContext), true);
  });

  await t.step("withSecretKey should set root", () => {
    const derivator = new StellarDerivator()
      .withNetworkAndContract(TEST_NETWORK, TEST_CONTRACT_ID)
      .withSecretKey(TEST_SECRET_KEY);

    const result = derivator.assembleSeed("0");
    assertEquals(result.includes(TEST_SECRET_KEY), true);
  });

  await t.step("deriveKeypair should work with string index", async () => {
    const derivator = new StellarDerivator()
      .withNetworkAndContract(TEST_NETWORK, TEST_CONTRACT_ID)
      .withSecretKey(TEST_SECRET_KEY);

    const keypair = await derivator.deriveKeypair("1");

    assertExists(keypair.publicKey);
    assertExists(keypair.privateKey);
  });

  await t.step("should ensure deterministic key derivation", async () => {
    const derivator = createForAccount(
      TEST_NETWORK,
      TEST_CONTRACT_ID,
      TEST_SECRET_KEY
    );

    const keypair1 = await derivator.deriveKeypair("42");
    const keypair2 = await derivator.deriveKeypair("42");

    assertEquals(keypair1.publicKey, keypair2.publicKey);
    assertEquals(keypair1.privateKey, keypair2.privateKey);
  });
});

Deno.test("createForAccount", async (t) => {
  await t.step("should return configured derivator", () => {
    const derivator = createForAccount(
      TEST_NETWORK,
      TEST_CONTRACT_ID,
      TEST_SECRET_KEY
    );

    const expectedContext = assembleNetworkContext(
      TEST_NETWORK,
      TEST_CONTRACT_ID
    );
    const result = derivator.assembleSeed("0");

    assertEquals(result.startsWith(expectedContext), true);
    assertEquals(result.includes(TEST_SECRET_KEY), true);
  });

  await t.step("should produce same result as manual builder", async () => {
    // Using the convenience factory
    const accountDerivator = createForAccount(
      TEST_NETWORK,
      TEST_CONTRACT_ID,
      TEST_SECRET_KEY
    );

    // Manual configuration
    const manualDerivator = new StellarDerivator()
      .withNetworkAndContract(TEST_NETWORK, TEST_CONTRACT_ID)
      .withSecretKey(TEST_SECRET_KEY);

    const keypair1 = await accountDerivator.deriveKeypair("5");
    const keypair2 = await manualDerivator.deriveKeypair("5");

    assertEquals(keypair1.publicKey, keypair2.publicKey);
    assertEquals(keypair1.privateKey, keypair2.privateKey);
  });
});

Deno.test("assembleNetworkContext", async (t) => {
  await t.step("should combine components properly", () => {
    const result = assembleNetworkContext(TEST_NETWORK, TEST_CONTRACT_ID);
    assertEquals(result, `${TEST_NETWORK}${TEST_CONTRACT_ID}`);
  });
});
