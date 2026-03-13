// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { PrivacyChannel } from "./index.ts";
import { ChannelReadMethods } from "./constants.ts";
import type { MoonlightSpan, MoonlightTracer } from "../tracing/index.ts";
import type { ContractId, NetworkConfig } from "@colibri/core";

function createSpyTracer() {
  const events: {
    name: string;
    attributes?: Record<string, string | number | boolean>;
  }[] = [];
  let ended = false;

  const span: MoonlightSpan = {
    addEvent(name, attributes) {
      events.push({ name, attributes });
    },
    setError() {},
    end() {
      ended = true;
    },
  };

  const tracer: MoonlightTracer = {
    startSpan(_name, _attributes) {
      return span;
    },
  };

  return { tracer, events, isEnded: () => ended };
}

const TEST_CHANNEL_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;
const TEST_AUTH_ID =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" as ContractId;
const TEST_ASSET_ID =
  "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" as ContractId;

const MOCK_NETWORK_CONFIG = {
  rpcUrl: "https://mock.rpc",
  networkPassphrase: "Test SDF Network ; September 2015",
} as NetworkConfig;

function createChannelWithMockClient(tracer?: MoonlightTracer) {
  const channel = new PrivacyChannel(
    MOCK_NETWORK_CONFIG,
    TEST_CHANNEL_ID,
    TEST_AUTH_ID,
    TEST_ASSET_ID,
    tracer ? { tracer } : undefined,
  );

  // Stub the internal client to avoid network calls
  const mockClient = {
    read: () => Promise.resolve([100n]),
    invoke: () => Promise.resolve({ result: "ok" }),
    invokeRaw: () => Promise.resolve({ result: "raw" }),
    getContractId: () => TEST_CHANNEL_ID,
  };
  (channel as any)._client = mockClient;

  return { channel, mockClient };
}

describe("PrivacyChannel", () => {
  describe("Tracing", () => {
    it("should return tracer via getTracer when provided", () => {
      const spy = createSpyTracer();
      const { channel } = createChannelWithMockClient(spy.tracer);
      assertExists(channel.getTracer());
    });

    it("should return undefined from getTracer when not provided", () => {
      const { channel } = createChannelWithMockClient();
      assertEquals(channel.getTracer(), undefined);
    });

    it("should emit tracing events on read", async () => {
      const spy = createSpyTracer();
      const { channel } = createChannelWithMockClient(spy.tracer);

      await channel.read({
        method: ChannelReadMethods.utxo_balances,
        methodArgs: { utxos: [] },
      });

      const eventNames = spy.events.map((e) => e.name);
      assertEquals(eventNames.includes("enter"), true);
      assertEquals(eventNames.includes("calling_contract_read"), true);
      assertEquals(eventNames.includes("read_complete"), true);
      assertEquals(eventNames.includes("exit"), true);
      assertEquals(spy.isEnded(), true);
    });

    it("should emit tracing events on invoke", async () => {
      const spy = createSpyTracer();
      const { channel } = createChannelWithMockClient(spy.tracer);

      await channel.invoke({
        method: "transact" as any,
        methodArgs: {} as any,
        config: {} as any,
      });

      const eventNames = spy.events.map((e) => e.name);
      assertEquals(eventNames.includes("enter"), true);
      assertEquals(eventNames.includes("calling_contract_invoke"), true);
      assertEquals(eventNames.includes("invoke_complete"), true);
      assertEquals(eventNames.includes("exit"), true);
      assertEquals(spy.isEnded(), true);
    });

    it("should emit tracing events on invokeRaw", async () => {
      const spy = createSpyTracer();
      const { channel } = createChannelWithMockClient(spy.tracer);

      await channel.invokeRaw({
        operationArgs: {
          function: "test_fn",
          args: [],
        },
        config: {} as any,
      });

      const eventNames = spy.events.map((e) => e.name);
      assertEquals(eventNames.includes("enter"), true);
      assertEquals(eventNames.includes("calling_contract_invoke_raw"), true);
      assertEquals(eventNames.includes("invoke_raw_complete"), true);
      assertEquals(eventNames.includes("exit"), true);
      assertEquals(spy.isEnded(), true);
    });

    it("should work without tracer (no tracing overhead)", async () => {
      const { channel } = createChannelWithMockClient();

      const result = await channel.read({
        method: ChannelReadMethods.utxo_balances,
        methodArgs: { utxos: [] },
      });

      assertExists(result);
    });
  });
});
