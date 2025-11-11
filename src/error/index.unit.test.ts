import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertStrictEquals,
} from "@std/assert";
import { MoonlightError, GeneralErrorCode } from "./index.ts";
import type { BaseMeta, Diagnostic, MoonlightErrorShape } from "./types.ts";

Deno.test("MoonlightError", async (t) => {
  await t.step("constructor should set all fields correctly", () => {
    const diagnostic: Diagnostic = {
      rootCause: "bad format",
      suggestion: "use a valid G... public key",
    };
    const meta: BaseMeta = { data: { accountId: "GABC" } };
    const shape: MoonlightErrorShape<"DER_001", BaseMeta> = {
      domain: "derivation",
      source: "@moonlight/sdk",
      code: "DER_001",
      message: "Invalid derivation key",
      details: "malformed key",
      diagnostic,
      meta,
    };

    const e = new MoonlightError(shape);

    assert(e instanceof Error);
    assert(e instanceof MoonlightError);
    assertStrictEquals(e.name, "MoonlightError DER_001");
    assertStrictEquals(e.domain, "derivation");
    assertStrictEquals(e.source, "@moonlight/sdk");
    assertStrictEquals(e.code, "DER_001");
    assertStrictEquals(e.message, "Invalid derivation key");
    assertStrictEquals(e.details, "malformed key");
    assertObjectMatch(e.diagnostic!, diagnostic);
    assertObjectMatch(e.meta!, meta);
  });

  await t.step("toJSON should return plain snapshot of all fields", () => {
    const e = new MoonlightError({
      domain: "general",
      source: "@Moonlight",
      code: GeneralErrorCode.UNEXPECTED_ERROR,
      message: "Unexpected error",
      details: "boom",
      meta: { data: { x: 1 } },
      diagnostic: {
        rootCause: "root",
        suggestion: "fix",
      },
    });

    const j = e.toJSON();
    assertEquals(j.name, "MoonlightError GEN_000");
    assertEquals(j.domain, "general");
    assertEquals(j.code, GeneralErrorCode.UNEXPECTED_ERROR);
    assertEquals(j.message, "Unexpected error");
    assertEquals(j.source, "@Moonlight");
    assertEquals(j.details, "boom");
    assertObjectMatch(j.meta!, { data: { x: 1 } });
    assertObjectMatch(j.diagnostic!, {
      rootCause: "root",
      suggestion: "fix",
    });
  });

  await t.step("is should detect MoonlightError instances correctly", () => {
    const e = new MoonlightError({
      domain: "general",
      source: "moonlight",
      code: GeneralErrorCode.UNEXPECTED_ERROR,
      message: "test message",
    });
    assert(MoonlightError.is(e));
    assert(!MoonlightError.is(new Error("x")));
    assert(!MoonlightError.is({}));
    assert(!MoonlightError.is(null));
    assert(!MoonlightError.is(undefined));
  });

  await t.step(
    "unexpected should build general error and preserve cause",
    () => {
      const cause = new Error("disk not found");
      const e = MoonlightError.unexpected({
        message: "fail",
        details: "ctx",
        source: "@moonlight/test",
        meta: { data: { id: 7 } },
        cause,
      });

      assert(e instanceof MoonlightError);
      assertEquals(e.domain, "general");
      assertEquals(e.source, "@moonlight/test");
      assertEquals(e.code, GeneralErrorCode.UNEXPECTED_ERROR);
      assertEquals(e.message, "fail");
      assertEquals(e.details, "ctx");
      assertStrictEquals(e.meta?.cause, cause);
      assertObjectMatch(e.meta!.data as Record<string, unknown>, { id: 7 });
    }
  );

  await t.step(
    "unexpected should return error with defaults when no args provided",
    () => {
      const out = MoonlightError.unexpected();
      assert(out instanceof MoonlightError);
      assertEquals(out.domain, "general");
      assertEquals(out.source, "@Moonlight");
      assertEquals(out.code, GeneralErrorCode.UNEXPECTED_ERROR);
      assertEquals(out.message, "Unexpected error");
      assertStrictEquals(out.details, "An unexpected error occurred");
    }
  );

  await t.step(
    "fromUnknown should return same instance for MoonlightError",
    () => {
      const original = new MoonlightError({
        domain: "derivation",
        source: "@moonlight/sdk",
        code: "DER_001",
        message: "derivation failed",
      });
      const out = MoonlightError.fromUnknown(original);
      assertStrictEquals(out, original);
    }
  );

  await t.step(
    "fromUnknown should wrap native Error with stack in details",
    () => {
      const error = new Error("mock error");

      const out = MoonlightError.fromUnknown(error);
      assert(out instanceof MoonlightError);
      assertEquals(out.domain, "general");
      assertEquals(out.source, "@Moonlight");
      assertEquals(out.code, GeneralErrorCode.UNKNOWN_ERROR);
      assertEquals(out.message, "mock error");
      assertStrictEquals(out.details, error.stack);
      assert(typeof out.details === "string");
      assertStrictEquals(out.meta?.cause, error);
    }
  );

  await t.step(
    "fromUnknown should wrap native Error with custom context",
    () => {
      const native = new Error("boom");
      const wrapped = MoonlightError.fromUnknown(native, {
        domain: "derivation",
        source: "@moonlight/sdk",
        code: "DER_999",
      });

      assert(wrapped instanceof MoonlightError);
      assertEquals(wrapped.domain, "derivation");
      assertEquals(wrapped.source, "@moonlight/sdk");
      assertEquals(wrapped.code, "DER_999");
      assertEquals(wrapped.message, "boom");
      assert(typeof wrapped.details === "string");
      assertStrictEquals(wrapped.meta?.cause, native);
    }
  );

  await t.step("fromUnknown should use unexpected for non-error values", () => {
    const wrapped = MoonlightError.fromUnknown(42, {
      domain: "general",
      source: "@moonlight/sdk",
      message: "bad input",
    });

    assert(wrapped instanceof MoonlightError);
    assertEquals(wrapped.domain, "general");
    assertEquals(wrapped.source, "@moonlight/sdk");
    assertEquals(wrapped.code, GeneralErrorCode.UNEXPECTED_ERROR);
    assertEquals(wrapped.message, "bad input");
    assertStrictEquals(wrapped.meta?.cause, 42);
  });
});
