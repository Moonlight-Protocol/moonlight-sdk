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
import { AuthSpec } from "../../src/channel-auth/constants.ts";
import type { Buffer } from "node:buffer";
import { loadContractWasm } from "../helpers/load-wasm.ts";
import type { ChannelAuthConstructorArgs } from "../../src/channel-auth/types.ts";
import type { ChannelConstructorArgs } from "../../src/privacy-channel/types.ts";
import {
  ChannelReadMethods,
  ChannelSpec,
} from "../../src/privacy-channel/constants.ts";
import { Asset } from "@stellar/stellar-sdk";
import { PrivacyChannel } from "../../src/privacy-channel/index.ts";
import { disableSanitizeConfig } from "../utils/disable-sanitize-config.ts";
import { generateP256KeyPair } from "../../src/utils/secp256r1/generateP256KeyPair.ts";

describe(
  "[Testnet - Integration] PrivacyChannel",
  disableSanitizeConfig,
  () => {
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

    const assetId = Asset.native().contractId(
      networkConfig.networkPassphrase
    ) as ContractId;

    let authWasm: Buffer;
    let channelWasm: Buffer;
    let authId: ContractId;
    let channelId: ContractId;

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
      channelWasm = loadContractWasm("privacy_channel");

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

    describe("Basic tests", () => {
      beforeAll(async () => {
        const channelContract = Contract.create({
          networkConfig,
          contractConfig: {
            spec: ChannelSpec,
            wasm: channelWasm,
          },
        });

        await channelContract.uploadWasm({
          ...txConfig,
        });

        await channelContract.deploy({
          config: txConfig,
          constructorArgs: {
            admin: admin.address() as Ed25519PublicKey,
            auth_contract: authId,
            asset: assetId,
          } as ChannelConstructorArgs,
        });

        channelId = channelContract.getContractId();
      });

      it("should initialize a client", () => {
        const channelClient = new PrivacyChannel(
          networkConfig,
          channelId,
          authId,
          assetId
        );

        assertExists(channelClient);
        assertExists(channelClient.getAuthId());
        assertEquals(channelClient.getAuthId(), authId);
        assertExists(channelClient.getNetworkConfig());
        assertEquals(channelClient.getNetworkConfig(), networkConfig);
        assertExists(channelClient.getAssetId());
        assertEquals(channelClient.getAssetId(), assetId);
        assertExists(channelClient.getChannelId());
        assertEquals(channelClient.getChannelId(), channelId);
        assertExists(channelClient.getDerivator());
      });

      it("should read from the contract and return the output", async () => {
        const channelClient = new PrivacyChannel(
          networkConfig,
          channelId,
          authId,
          assetId
        );

        const utxoKeypair = generateP256KeyPair();

        const adminAddress = await channelClient.read({
          method: ChannelReadMethods.admin,
          methodArgs: {},
        });

        const asset = await channelClient.read({
          method: ChannelReadMethods.asset,
          methodArgs: {},
        });

        const auth = await channelClient.read({
          method: ChannelReadMethods.auth,
          methodArgs: {},
        });

        const supply = await channelClient.read({
          method: ChannelReadMethods.supply,
          methodArgs: {},
        });

        const utxoBal = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: { utxo: (await utxoKeypair).publicKey as Buffer },
        });

        assertExists(adminAddress);
        assertEquals(adminAddress, admin.address() as Ed25519PublicKey);
        assertExists(asset);
        assertEquals(asset, assetId);
        assertExists(auth);
        assertEquals(auth, authId);
        assertExists(supply);
        assertEquals(supply, 0n);
        assertExists(utxoBal);
        assertEquals(utxoBal, -1n); // UTXO is in Unused state
      });

      //TODO: Complete this test once we have the tx builder
      it.skip("should invoke the contract", async () => {
        // const channelClient = new PrivacyChannel(
        //   networkConfig,
        //   channelId,
        //   authId,
        //   assetId
        // );
      });
    });
  }
);
