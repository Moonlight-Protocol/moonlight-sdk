// deno-lint-ignore-file require-await
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type MoonlightSpan,
  type MoonlightTracer,
  NOOP_TRACER,
  withTrace,
  withTraceSync,
} from "./index.ts";

function createMockTracer() {
  const events: { name: string; attributes?: Record<string, string | number | boolean> }[] = [];
  const errors: Error[] = [];
  let ended = false;

  const span: MoonlightSpan = {
    addEvent(name, attributes) {
      events.push({ name, attributes });
    },
    setError(error) {
      errors.push(error);
    },
    end() {
      ended = true;
    },
  };

  const tracer: MoonlightTracer = {
    startSpan(_name, _attributes) {
      return span;
    },
  };

  return { tracer, span, events, errors, isEnded: () => ended };
}

function createMockTracerWithActiveSpan() {
  const events: { name: string; attributes?: Record<string, string | number | boolean> }[] = [];
  const errors: Error[] = [];
  let ended = false;

  const span: MoonlightSpan = {
    addEvent(name, attributes) {
      events.push({ name, attributes });
    },
    setError(error) {
      errors.push(error);
    },
    end() {
      ended = true;
    },
  };

  const tracer: MoonlightTracer = {
    startSpan(_name, _attributes) {
      return span;
    },
    withActiveSpan(_name, fn, _attributes) {
      return fn(span);
    },
  };

  return { tracer, span, events, errors, isEnded: () => ended };
}

describe("tracing", () => {
  describe("NOOP_TRACER", () => {
    it("should return a span with no-op methods", () => {
      const span = NOOP_TRACER.startSpan("test");
      // These should not throw
      span.addEvent("event");
      span.setError(new Error("test"));
      span.end();
    });
  });

  describe("withTrace", () => {
    it("should run fn without tracer", async () => {
      const result = await withTrace(undefined, "op", async () => 42);
      assertEquals(result, 42);
    });

    it("should run fn with tracer (startSpan path)", async () => {
      const mock = createMockTracer();
      const result = await withTrace(mock.tracer, "op", async () => "ok");
      assertEquals(result, "ok");
      assertEquals(mock.events[0].name, "enter");
      assertEquals(mock.events[1].name, "exit");
      assertEquals(mock.isEnded(), true);
    });

    it("should capture errors with tracer (startSpan path)", async () => {
      const mock = createMockTracer();
      await assertRejects(
        () =>
          withTrace(mock.tracer, "op", async () => {
            throw new Error("boom");
          }),
        Error,
        "boom",
      );
      assertEquals(mock.errors.length, 1);
      assertEquals(mock.errors[0].message, "boom");
      assertEquals(mock.events.some((e) => e.name === "exit_with_error"), true);
      assertEquals(mock.isEnded(), true);
    });

    it("should capture non-Error throws with tracer (startSpan path)", async () => {
      const mock = createMockTracer();
      await assertRejects(() =>
        withTrace(mock.tracer, "op", async () => {
          throw "string error";
        })
      );
      assertEquals(mock.errors[0].message, "string error");
    });

    it("should use withActiveSpan when available", async () => {
      const mock = createMockTracerWithActiveSpan();
      const result = await withTrace(mock.tracer, "op", async () => "active");
      assertEquals(result, "active");
      assertEquals(mock.events[0].name, "enter");
      assertEquals(mock.events[1].name, "exit");
      assertEquals(mock.isEnded(), true);
    });

    it("should capture errors via withActiveSpan path", async () => {
      const mock = createMockTracerWithActiveSpan();
      await assertRejects(
        () =>
          withTrace(mock.tracer, "op", async () => {
            throw new Error("active boom");
          }),
        Error,
        "active boom",
      );
      assertEquals(mock.errors[0].message, "active boom");
      assertEquals(mock.events.some((e) => e.name === "exit_with_error"), true);
      assertEquals(mock.isEnded(), true);
    });

    it("should capture non-Error throws via withActiveSpan path", async () => {
      const mock = createMockTracerWithActiveSpan();
      await assertRejects(() =>
        withTrace(mock.tracer, "op", async () => {
          throw "string error";
        })
      );
      assertEquals(mock.errors[0].message, "string error");
    });

    it("should handle synchronous fn in withActiveSpan path", async () => {
      const mock = createMockTracerWithActiveSpan();
      const result = await withTrace(mock.tracer, "op", () => "sync-value");
      assertEquals(result, "sync-value");
      assertEquals(mock.isEnded(), true);
    });

    it("should pass attributes to startSpan", async () => {
      let receivedAttrs: Record<string, string | number | boolean> | undefined;
      const tracer: MoonlightTracer = {
        startSpan(_name, attributes) {
          receivedAttrs = attributes;
          return { addEvent() {}, setError() {}, end() {} };
        },
      };
      await withTrace(tracer, "op", async () => "ok", { key: "value" });
      assertEquals(receivedAttrs, { key: "value" });
    });
  });

  describe("withTraceSync", () => {
    it("should run fn without tracer", () => {
      const result = withTraceSync(undefined, "op", () => 42);
      assertEquals(result, 42);
    });

    it("should run fn with tracer (startSpan path)", () => {
      const mock = createMockTracer();
      const result = withTraceSync(mock.tracer, "op", () => "ok");
      assertEquals(result, "ok");
      assertEquals(mock.events[0].name, "enter");
      assertEquals(mock.events[1].name, "exit");
      assertEquals(mock.isEnded(), true);
    });

    it("should capture errors with tracer (startSpan path)", () => {
      const mock = createMockTracer();
      assertThrows(
        () =>
          withTraceSync(mock.tracer, "op", () => {
            throw new Error("boom");
          }),
        Error,
        "boom",
      );
      assertEquals(mock.errors[0].message, "boom");
      assertEquals(mock.events.some((e) => e.name === "exit_with_error"), true);
      assertEquals(mock.isEnded(), true);
    });

    it("should capture non-Error throws (startSpan path)", () => {
      const mock = createMockTracer();
      assertThrows(() =>
        withTraceSync(mock.tracer, "op", () => {
          throw "string error";
        })
      );
      assertEquals(mock.errors[0].message, "string error");
    });

    it("should use withActiveSpan when available", () => {
      const mock = createMockTracerWithActiveSpan();
      const result = withTraceSync(mock.tracer, "op", () => "active");
      assertEquals(result, "active");
      assertEquals(mock.events[0].name, "enter");
      assertEquals(mock.events[1].name, "exit");
      assertEquals(mock.isEnded(), true);
    });

    it("should capture errors via withActiveSpan path", () => {
      const mock = createMockTracerWithActiveSpan();
      assertThrows(
        () =>
          withTraceSync(mock.tracer, "op", () => {
            throw new Error("active boom");
          }),
        Error,
        "active boom",
      );
      assertEquals(mock.errors[0].message, "active boom");
      assertEquals(mock.events.some((e) => e.name === "exit_with_error"), true);
      assertEquals(mock.isEnded(), true);
    });

    it("should capture non-Error throws via withActiveSpan path", () => {
      const mock = createMockTracerWithActiveSpan();
      assertThrows(() =>
        withTraceSync(mock.tracer, "op", () => {
          throw "string error";
        })
      );
      assertEquals(mock.errors[0].message, "string error");
    });

    it("should pass attributes to startSpan", () => {
      let receivedAttrs: Record<string, string | number | boolean> | undefined;
      const tracer: MoonlightTracer = {
        startSpan(_name, attributes) {
          receivedAttrs = attributes;
          return { addEvent() {}, setError() {}, end() {} };
        },
      };
      withTraceSync(tracer, "op", () => "ok", { key: "value" });
      assertEquals(receivedAttrs, { key: "value" });
    });
  });
});
