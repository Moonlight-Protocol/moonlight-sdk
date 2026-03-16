/**
 * Minimal tracing interface for opt-in instrumentation.
 *
 * Consumers can implement this with @opentelemetry/api, a custom logger,
 * or any other tracing backend. The SDK never imports @opentelemetry
 * directly — it only calls these methods when a tracer is provided.
 *
 * @example Using with @opentelemetry/api:
 * ```typescript
 * import { trace, context, SpanStatusCode } from "@opentelemetry/api";
 *
 * const otelTracer = trace.getTracer("my-app");
 * const sdkTracer: MoonlightTracer = {
 *   startSpan(name, attributes) {
 *     const span = otelTracer.startSpan(name, { attributes });
 *     return {
 *       addEvent(event, attrs) { span.addEvent(event, attrs); },
 *       setError(error) {
 *         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
 *         span.recordException(error);
 *       },
 *       end() { span.end(); },
 *     };
 *   },
 *   // Enable distributed tracing (traceparent propagation on fetch):
 *   withActiveSpan(name, fn, attributes) {
 *     return otelTracer.startActiveSpan(name, { attributes }, (otelSpan) => {
 *       const span = { ... }; // same as startSpan wrapper
 *       return fn(span);
 *     });
 *   },
 * };
 *
 * const channel = new PrivacyChannel(networkConfig, channelId, authId, assetId, {
 *   tracer: sdkTracer,
 * });
 * ```
 */
export interface MoonlightTracer {
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): MoonlightSpan;

  /**
   * Optional: wraps a function with an active span in the trace context.
   * When implemented, enables distributed tracing — any fetch() calls
   * inside the callback will inherit the span's trace context and
   * propagate W3C traceparent headers automatically.
   *
   * If not implemented, withTrace falls back to startSpan (spans are
   * created but not set as active context, so no trace propagation).
   */
  withActiveSpan?<T>(
    name: string,
    fn: (span: MoonlightSpan) => T,
    attributes?: Record<string, string | number | boolean>,
  ): T;
}

export interface MoonlightSpan {
  addEvent(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  setError(error: Error): void;
  end(): void;
}

/** No-op span returned when tracing is disabled */
const NOOP_SPAN: MoonlightSpan = {
  addEvent() {},
  setError() {},
  end() {},
};

/** No-op tracer used when no tracer is provided */
export const NOOP_TRACER: MoonlightTracer = {
  startSpan() {
    return NOOP_SPAN;
  },
};

/**
 * Wraps an async function with a span. If no tracer is provided, runs
 * the function without overhead.
 *
 * When the tracer implements `withActiveSpan`, the span is set as the
 * active context — enabling W3C traceparent propagation on fetch() calls.
 */
export async function withTrace<T>(
  tracer: MoonlightTracer | undefined,
  name: string,
  fn: (span: MoonlightSpan) => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const t = tracer ?? NOOP_TRACER;

  if (t.withActiveSpan) {
    return t.withActiveSpan(name, (span) => {
      span.addEvent("enter");
      const maybePromise = fn(span);
      const promise = maybePromise instanceof Promise ? maybePromise : Promise.resolve(maybePromise);
      return promise.then(
        (result) => { span.addEvent("exit"); return result; },
        (error) => {
          span.setError(error instanceof Error ? error : new Error(String(error)));
          span.addEvent("exit_with_error");
          throw error;
        },
      ).finally(() => span.end()) as Promise<T>;
    }, attributes) as Promise<T>;
  }

  const span = t.startSpan(name, attributes);
  span.addEvent("enter");
  try {
    const result = await fn(span);
    span.addEvent("exit");
    return result;
  } catch (error) {
    span.setError(error instanceof Error ? error : new Error(String(error)));
    span.addEvent("exit_with_error");
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Synchronous variant of withTrace. Wraps a synchronous function with
 * a span. If no tracer is provided, runs the function without overhead.
 *
 * When the tracer implements `withActiveSpan`, the span is set as the
 * active context — enabling W3C traceparent propagation on fetch() calls.
 */
export function withTraceSync<T>(
  tracer: MoonlightTracer | undefined,
  name: string,
  fn: (span: MoonlightSpan) => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  const t = tracer ?? NOOP_TRACER;

  if (t.withActiveSpan) {
    return t.withActiveSpan(name, (span) => {
      span.addEvent("enter");
      try {
        const result = fn(span);
        span.addEvent("exit");
        return result;
      } catch (error) {
        span.setError(error instanceof Error ? error : new Error(String(error)));
        span.addEvent("exit_with_error");
        throw error;
      } finally {
        span.end();
      }
    }, attributes);
  }

  const span = t.startSpan(name, attributes);
  span.addEvent("enter");
  try {
    const result = fn(span);
    span.addEvent("exit");
    return result;
  } catch (error) {
    span.setError(error instanceof Error ? error : new Error(String(error)));
    span.addEvent("exit_with_error");
    throw error;
  } finally {
    span.end();
  }
}
