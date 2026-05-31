import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import {
  Contract,
  initializeWithFriendbot,
  KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
} from "@colibri/core";

import type {
  ContractId,
  Ed25519PublicKey,
  TransactionConfig,
} from "@colibri/core";

import type { Buffer } from "node:buffer";
import { loadContractWasm } from "../helpers/load-wasm.ts";

import {
  AuthInvokeMethods,
  AuthReadMethods,
  AuthSpec,
} from "../../src/channel-auth/constants.ts";
import { ChannelAuth } from "../../src/channel-auth/index.ts";
import { MoonlightContractError } from "../../src/error/contract-errors.ts";
import { disableSanitizeConfig } from "../utils/disable-sanitize-config.ts";
import type { ChannelTypes } from "@moonlight/moonlight-sdk";

describe("[Testnet - Integration] ChannelAuth", disableSanitizeConfig, () => {
  const networkConfig = NetworkConfig.TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const newAdmin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const providerA = NativeAccount.fromMasterSigner(
    LocalSigner.generateRandom(),
  );

  const adminTxConfig: TransactionConfig = {
    fee: "1000000",
    timeout: 30,
    source: admin.address(),
    signers: [admin.signer()],
  };

  const newAdminTxConfig: TransactionConfig = {
    fee: "1000000",
    timeout: 30,
    source: newAdmin.address(),
    signers: [newAdmin.signer()],
  };

  let authWasm: Buffer;

  beforeAll(async () => {
    await initializeWithFriendbot(
      networkConfig.friendbotUrl,
      admin.address() as Ed25519PublicKey,
    );

    await initializeWithFriendbot(
      networkConfig.friendbotUrl,
      newAdmin.address() as Ed25519PublicKey,
    );

    await initializeWithFriendbot(
      networkConfig.friendbotUrl,
      providerA.address() as Ed25519PublicKey,
    );

    authWasm = loadContractWasm("channel_auth_contract");
  });

  describe("Basic tests", () => {
    let authId: ContractId;

    beforeAll(async () => {
      const authContract = new Contract({
        networkConfig,
        contractConfig: {
          spec: AuthSpec,
          // deno-lint-ignore no-explicit-any
          wasm: authWasm as any,
        },
      });

      await authContract.uploadWasm({
        ...adminTxConfig,
      });

      await authContract.deploy({
        config: adminTxConfig,
        constructorArgs: {
          admin: admin.address() as Ed25519PublicKey,
        } as ChannelTypes.ChannelConstructorArgs,
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
        config: adminTxConfig,
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
        config: adminTxConfig,
      });

      isProvider = await authClient.read({
        method: AuthReadMethods.is_provider,
        methodArgs: { provider: providerA.address() as Ed25519PublicKey },
      });

      assertExists(isProvider);
      assertEquals(isProvider, false);
    });

    it("should transfer admin through the two-step accept flow", async () => {
      const authClient = new ChannelAuth(networkConfig, authId);

      const initialAdmin = await authClient.read({
        method: AuthReadMethods.admin,
        methodArgs: {},
      });

      assertEquals(initialAdmin, admin.address() as Ed25519PublicKey);

      await authClient.invoke({
        method: AuthInvokeMethods.set_admin,
        methodArgs: { new_admin: newAdmin.address() as Ed25519PublicKey },
        config: adminTxConfig,
      });

      const adminBeforeAccept = await authClient.read({
        method: AuthReadMethods.admin,
        methodArgs: {},
      });

      assertEquals(adminBeforeAccept, admin.address() as Ed25519PublicKey);

      await authClient.invoke({
        method: AuthInvokeMethods.accept_admin,
        methodArgs: {},
        config: newAdminTxConfig,
      });

      const adminAfterAccept = await authClient.read({
        method: AuthReadMethods.admin,
        methodArgs: {},
      });

      assertEquals(adminAfterAccept, newAdmin.address() as Ed25519PublicKey);
    });

    it("should surface a known contract error when removing a provider that is not registered", async () => {
      const authContract = new Contract({
        networkConfig,
        contractConfig: {
          spec: AuthSpec,
          // deno-lint-ignore no-explicit-any
          wasm: authWasm as any,
        },
      });

      await authContract.uploadWasm({
        ...adminTxConfig,
      });

      await authContract.deploy({
        config: adminTxConfig,
        constructorArgs: {
          admin: admin.address() as Ed25519PublicKey,
        } as ChannelTypes.ChannelConstructorArgs,
      });

      const authClient = new ChannelAuth(
        networkConfig,
        authContract.getContractId(),
      );
      let providerNotRegisteredError: unknown;

      try {
        await authClient.invoke({
          method: AuthInvokeMethods.remove_provider,
          methodArgs: { provider: providerA.address() as Ed25519PublicKey },
          config: adminTxConfig,
        });
      } catch (error) {
        providerNotRegisteredError = error;
      }

      assertInstanceOf(
        providerNotRegisteredError,
        KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      );
      assertEquals(
        providerNotRegisteredError.message,
        "Contract error: ProviderNotRegistered",
      );
      assertEquals(providerNotRegisteredError.meta.data.match.code, 1013);
      assertEquals(
        providerNotRegisteredError.meta.data.match.message,
        MoonlightContractError[1013].message,
      );
      assertEquals(
        providerNotRegisteredError.meta.data.match.details,
        MoonlightContractError[1013].details,
      );
      assertEquals(
        providerNotRegisteredError.diagnostic?.rootCause,
        MoonlightContractError[1013].details,
      );
    });
  });
});
