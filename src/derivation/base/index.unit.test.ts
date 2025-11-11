import { BaseDerivator, generatePlainTextSeed, hashSeed } from "./index.ts";
import { assertEquals, assertExists, assertThrows } from "@std/assert";
import * as E from "../error.ts";

Deno.test("BaseDerivator", async (t) => {
  await t.step("assembleSeed should work with complete components", () => {
    const derivator = new BaseDerivator<string, string, string>()
      .withContext("test-context")
      .withRoot("test-root");

    const result = derivator.assembleSeed("test-index");
    assertEquals(result, "test-contexttest-roottest-index");
  });

  await t.step("assembleSeed should throw on missing context", () => {
    const derivator = new BaseDerivator<string, string, string>().withRoot(
      "test-root",
    );

    assertThrows(
      () => derivator.assembleSeed("test-index"),
      E.PROPERTY_NOT_SET,
    );
  });

  await t.step("assembleSeed should throw on missing root", () => {
    const derivator = new BaseDerivator<string, string, string>().withContext(
      "test-context",
    );

    assertThrows(
      () => derivator.assembleSeed("test-index"),
      E.PROPERTY_NOT_SET,
    );
  });

  await t.step("hashSeed should produce correct hash", async () => {
    const derivator = new BaseDerivator<string, string, string>()
      .withContext("test-context")
      .withRoot("test-root");

    const plainText = "test-contexttest-roottest-index";
    const expectedHash = await hashSeed(plainText);
    const result = await derivator.hashSeed("test-index");

    assertEquals(result, expectedHash);
  });

  await t.step("deriveKeypair should produce valid keypair", async () => {
    const derivator = new BaseDerivator<string, string, string>()
      .withContext("test-context")
      .withRoot("test-root");

    const keypair = await derivator.deriveKeypair("test-index");

    assertExists(keypair.publicKey);
    assertExists(keypair.privateKey);
    assertEquals(keypair.publicKey.constructor, Uint8Array);
    assertEquals(keypair.privateKey.constructor, Uint8Array);
  });

  await t.step("withContext should throw when setting context twice", () => {
    const derivator = new BaseDerivator<string, string, string>().withContext(
      "test-context",
    );

    assertThrows(
      () => derivator.withContext("another-context"),
      E.PROPERTY_ALREADY_SET,
    );
  });

  await t.step("withRoot should throw when setting root twice", () => {
    const derivator = new BaseDerivator<string, string, string>().withRoot(
      "test-root",
    );

    assertThrows(
      () => derivator.withRoot("another-root"),
      E.PROPERTY_ALREADY_SET,
    );
  });
});

Deno.test("generatePlainTextSeed", async (t) => {
  await t.step("should combine components correctly", () => {
    const result = generatePlainTextSeed("context", "root", "index");
    assertEquals(result, "contextrootindex");
  });
});
