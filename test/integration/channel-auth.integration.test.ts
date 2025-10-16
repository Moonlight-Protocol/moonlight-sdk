import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import {
  LocalSigner,
  NativeAccount,
  TestNet,
  initializeWithFriendbot,
  Contract,
} from "@colibri/core";

import type {
  Ed25519PublicKey,
  TransactionConfig,
  ContractId,
} from "@colibri/core";
import {
  AuthInvokeMethods,
  AuthReadMethods,
  AuthSpec,
} from "../../src/channel-auth/constants.ts";
import type { Buffer } from "node:buffer";
import { loadContractWasm } from "../helpers/load-wasm.ts";
import { ChannelAuth } from "../../src/channel-auth/index.ts";
import type { ChannelAuthConstructorArgs } from "../../src/channel-auth/types.ts";

describe("[Testnet - Integration] ChannelAuth", () => {
  const networkConfig = TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const providerA = NativeAccount.fromMasterSigner(
    LocalSigner.generateRandom()
  );

  const txConfig: TransactionConfig = {
    fee: "1000000",
    timeout: 30,
    source: admin.address(),
    signers: [admin.signer()],
  };

  let authWasm: Buffer;

  beforeAll(async () => {
    await initializeWithFriendbot(
      networkConfig.friendbotUrl,
      admin.address() as Ed25519PublicKey
    );

    await initializeWithFriendbot(
      networkConfig.friendbotUrl,
      providerA.address() as Ed25519PublicKey
    );

    authWasm = loadContractWasm("channel_auth_contract");
  });

  describe("Basic tests", () => {
    let authId: ContractId;

    beforeAll(async () => {
      const authContract = Contract.create({
        networkConfig,
        contractConfig: {
          spec: AuthSpec,
          wasm: authWasm,
        },
      });

      await authContract.uploadWasm({
        ...txConfig,
      });

      await authContract.deploy({
        config: txConfig,
        constructorArgs: {
          admin: admin.address() as Ed25519PublicKey,
        } as ChannelAuthConstructorArgs,
      });

      authId = authContract.getContractId();
    });

    it("should initialize a client", () => {
      const authClient = new ChannelAuth(networkConfig, authId);

      assertExists(authClient);
      assertExists(authClient.getAuthId());
      assertEquals(authClient.getAuthId(), authId);
      assertExists(authClient.getNetworkConfig());
      assertEquals(authClient.getNetworkConfig(), networkConfig);
    });

    it("should read from the contract and return the output", async () => {
      const authClient = new ChannelAuth(networkConfig, authId);

      const adminAddress = await authClient.read({
        method: AuthReadMethods.admin,
        methodArgs: {},
      });

      const isProvider = await authClient.read({
        method: AuthReadMethods.is_provider,
        methodArgs: { provider: admin.address() as Ed25519PublicKey },
      });

      assertExists(adminAddress);
      assertEquals(adminAddress, admin.address() as Ed25519PublicKey);
      assertExists(isProvider);
      assertEquals(isProvider, false);
    });

    it("should invoke the contract", async () => {
      const authClient = new ChannelAuth(networkConfig, authId);

      let isProvider = await authClient.read({
        method: AuthReadMethods.is_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
      });

      assertExists(isProvider);
      assertEquals(isProvider, false);

      await authClient.invoke({
        method: AuthInvokeMethods.add_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
        config: txConfig,
      });

      isProvider = await authClient.read({
        method: AuthReadMethods.is_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
      });

      assertExists(isProvider);
      assertEquals(isProvider, true);

      await authClient.invoke({
        method: AuthInvokeMethods.remove_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
        config: txConfig,
      });

      isProvider = await authClient.read({
        method: AuthReadMethods.is_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
      });

      assertExists(isProvider);
      assertEquals(isProvider, false);
    });
  });
});
