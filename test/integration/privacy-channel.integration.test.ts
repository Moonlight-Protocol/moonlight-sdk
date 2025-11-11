import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import {
  LocalSigner,
  NativeAccount,
  TestNet,
  initializeWithFriendbot,
  Contract,
  P_SimulateTransactionErrors,
} from "@colibri/core";

import type {
  Ed25519PublicKey,
  TransactionConfig,
  ContractId,
  TestNetConfig,
  Ed25519SecretKey,
} from "@colibri/core";
import {
  AuthInvokeMethods,
  AuthSpec,
} from "../../src/channel-auth/constants.ts";
import type { Buffer } from "node:buffer";
import { loadContractWasm } from "../helpers/load-wasm.ts";
import {
  ChannelSpec,
  type ChannelTypes,
  PrivacyChannel,
  ChannelReadMethods,
  generateP256KeyPair,
  MoonlightTransactionBuilder,
  MoonlightOperation as op,
  generateNonce,
  ChannelInvokeMethods,
} from "../../mod.ts";

import { Asset, Keypair } from "@stellar/stellar-sdk";

import { disableSanitizeConfig } from "../utils/disable-sanitize-config.ts";
import { Server } from "@stellar/stellar-sdk/rpc";

describe(
  "[Testnet - Integration] PrivacyChannel",
  disableSanitizeConfig,
  () => {
    const networkConfig: TestNetConfig = TestNet();

    const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    const providerKeys = Keypair.random();
    const johnKeys = Keypair.random();

    const providerA = NativeAccount.fromMasterSigner(
      LocalSigner.fromSecret(providerKeys.secret() as Ed25519SecretKey)
    );

    const john = NativeAccount.fromMasterSigner(
      LocalSigner.fromSecret(johnKeys.secret() as Ed25519SecretKey)
    );

    const txConfig: TransactionConfig = {
      fee: "1000000",
      timeout: 60,
      source: admin.address(),
      signers: [admin.signer()],
    };

    const assetId = Asset.native().contractId(
      networkConfig.networkPassphrase
    ) as ContractId;

    let rpc: Server;

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

      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        john.address() as Ed25519PublicKey
      );

      rpc = new Server(networkConfig.rpcUrl as string);

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
        } as ChannelTypes.ChannelConstructorArgs,
      });

      authId = authContract.getContractId();

      await authContract.invoke({
        method: AuthInvokeMethods.add_provider,
        methodArgs: {
          provider: providerA.address() as Ed25519PublicKey,
        },
        config: { ...txConfig, signers: [admin.signer(), providerA.signer()] },
      });
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
          } as ChannelTypes.ChannelConstructorArgs,
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

      it("should invoke the contract", async () => {
        const channelClient = new PrivacyChannel(
          networkConfig,
          channelId,
          authId,
          assetId
        );

        const utxoAKeypair = await generateP256KeyPair();
        const utxoBKeypair = await generateP256KeyPair();

        const depositTx = new MoonlightTransactionBuilder({
          network: networkConfig.networkPassphrase,
          channelId: channelId,
          authId: authId,
          assetId: Asset.native().contractId(
            networkConfig.networkPassphrase
          ) as ContractId,
        });

        const createOpA = op.create(utxoAKeypair.publicKey, 250n);
        const createOpB = op.create(utxoBKeypair.publicKey, 250n);

        depositTx.addOperation(createOpA);
        depositTx.addOperation(createOpB);
        depositTx.addOperation(
          op
            .deposit(john.address() as Ed25519PublicKey, 500n)
            .addConditions([createOpA.toCondition(), createOpB.toCondition()])
        );

        const latestLedger = await rpc.getLatestLedger();

        const signatureExpirationLedger = latestLedger.sequence + 100;

        const nonce = generateNonce();

        await depositTx.signExtWithEd25519(
          johnKeys,
          signatureExpirationLedger,
          nonce
        );

        await depositTx.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );

        await channelClient
          .invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [depositTx.buildXDR()],
              auth: [...depositTx.getSignedAuthEntries()],
            },
            config: txConfig,
          })
          .catch((e) => {
            if (e instanceof P_SimulateTransactionErrors.SIMULATION_FAILED) {
              console.error("Error invoking contract:", e);
              console.error(
                "Transaction XDR:",
                e.meta.data.input.transaction.toXDR()
              );
            }
            throw e;
          });

        const utxoABal = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: { utxo: utxoAKeypair.publicKey as Buffer },
        });

        const utxoBBal = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: { utxo: utxoBKeypair.publicKey as Buffer },
        });

        assertExists(utxoABal);
        assertEquals(utxoABal, 250n);
        assertExists(utxoBBal);
        assertEquals(utxoBBal, 250n);
      });
    });
  }
);
