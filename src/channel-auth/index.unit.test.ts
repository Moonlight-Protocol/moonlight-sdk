import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  CONTRACT_ERROR_MATCHER_PLUGIN_ID,
  type ContractId,
  type NetworkConfig,
} from "@colibri/core";
import { ChannelAuth } from "./index.ts";

const TEST_AUTH_ID =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" as ContractId;

const MOCK_NETWORK_CONFIG = {
  rpcUrl: "https://mock.rpc",
  networkPassphrase: "Test SDF Network ; September 2015",
} as NetworkConfig;

type PipelinePluginIdentity = {
  id: string;
  target: string;
};

type ContractWithPluginPipelines = {
  invokePipe: { plugins: readonly PipelinePluginIdentity[] };
  readPipe: { plugins: readonly PipelinePluginIdentity[] };
};

describe("ChannelAuth", () => {
  describe("Contract errors", () => {
    it("should attach Moonlight contract error matching to invoke calls", () => {
      const auth = new ChannelAuth(MOCK_NETWORK_CONFIG, TEST_AUTH_ID);
      const client =
        (auth as unknown as { _client: ContractWithPluginPipelines })
          ._client;

      const plugin = client.invokePipe.plugins.find((candidate) =>
        candidate.id === CONTRACT_ERROR_MATCHER_PLUGIN_ID
      );

      assertExists(plugin);
      assertEquals(plugin.target, "simulate-transaction");
    });

    it("should attach Moonlight contract error matching to read calls", () => {
      const auth = new ChannelAuth(MOCK_NETWORK_CONFIG, TEST_AUTH_ID);
      const client =
        (auth as unknown as { _client: ContractWithPluginPipelines })
          ._client;

      const plugin = client.readPipe.plugins.find((candidate) =>
        candidate.id === CONTRACT_ERROR_MATCHER_PLUGIN_ID
      );

      assertExists(plugin);
      assertEquals(plugin.target, "simulate-transaction");
    });
  });
});
