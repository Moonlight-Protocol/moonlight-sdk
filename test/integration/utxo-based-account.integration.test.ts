// deno-lint-ignore-file require-await
import { assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import {
  LocalSigner,
  NativeAccount,
  TestNet,
  initializeWithFriendbot,
  Contract,
  P_SimulateTransactionErrors,
  type Ed25519PublicKey,
  type TransactionConfig,
  type ContractId,
  type TestNetConfig,
  type Ed25519SecretKey,
} from "@colibri/core";
import {
  AuthInvokeMethods,
  AuthSpec,
} from "../../src/channel-auth/constants.ts";
import { Buffer } from "node:buffer";
import { loadContractWasm } from "../helpers/load-wasm.ts";
import type { ChannelAuthConstructorArgs } from "../../src/channel-auth/types.ts";
import type { ChannelConstructorArgs } from "../../src/privacy-channel/types.ts";
import {
  ChannelInvokeMethods,
  ChannelReadMethods,
  ChannelSpec,
} from "../../src/privacy-channel/constants.ts";
import { Asset, Keypair } from "@stellar/stellar-sdk";
import { PrivacyChannel } from "../../src/privacy-channel/index.ts";
import { UtxoBasedStellarAccount } from "../../src/utxo-based-account/utxo-based-stellar-account/index.ts";
import { UTXOStatus } from "../../src/core/utxo-keypair/types.ts";
import { StellarDerivator } from "../../src/derivation/stellar/index.ts";
import { MoonlightTransactionBuilder } from "../../src/transaction-builder/index.ts";
import { MoonlightOperation as op } from "../../src/operation/index.ts";
import { generateNonce } from "../../src/utils/common/index.ts";
import { Server } from "@stellar/stellar-sdk/rpc";
import { disableSanitizeConfig } from "../utils/disable-sanitize-config.ts";
import { StellarNetworkId } from "../../src/derivation/stellar/stellar-network-id.ts";

describe(
  "[Testnet - Integration] UtxoBasedAccount",
  disableSanitizeConfig,
  () => {
    const networkConfig: TestNetConfig = TestNet() as TestNetConfig;

    const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
    const providerKeys = Keypair.random();
    const userKeys = Keypair.random();

    const provider = NativeAccount.fromMasterSigner(
      LocalSigner.fromSecret(providerKeys.secret() as Ed25519SecretKey)
    );

    const user = NativeAccount.fromMasterSigner(
      LocalSigner.fromSecret(userKeys.secret() as Ed25519SecretKey)
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

    let authWasm: Buffer;
    let channelWasm: Buffer;
    let authId: ContractId;
    let channelId: ContractId;
    let channelClient: PrivacyChannel;
    let rpc: Server;

    beforeAll(async () => {
      // Initialize accounts with friendbot
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        admin.address() as Ed25519PublicKey
      );

      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        provider.address() as Ed25519PublicKey
      );

      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        user.address() as Ed25519PublicKey
      );

      // Load contract WASMs
      authWasm = loadContractWasm("channel_auth_contract");
      channelWasm = loadContractWasm("privacy_channel");

      // Deploy ChannelAuth contract
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

      // Add provider to auth contract
      await authContract.invoke({
        method: AuthInvokeMethods.add_provider,
        methodArgs: {
          provider: provider.address() as Ed25519PublicKey,
        },
        config: { ...txConfig, signers: [admin.signer(), provider.signer()] },
      });
    });

    describe("Core Functionality", () => {
      beforeAll(async () => {
        // Initialize RPC server
        rpc = new Server(networkConfig.rpcUrl as string);

        // Deploy PrivacyChannel contract
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

        // Create PrivacyChannel client
        channelClient = new PrivacyChannel(
          networkConfig,
          channelId,
          authId,
          assetId
        );
      });

      it("should initialize PrivacyChannel client", () => {
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

      it("should initialize UtxoBasedStellarAccount", () => {
        const testRoot = "S-TEST_SECRET_ROOT";

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: channelClient.getDerivator(),
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        assertExists(utxoAccount);
        assertEquals(utxoAccount.getNextIndex(), 1);
      });

      it("should derive a batch of UTXO keypairs", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_2";

        // Create a fresh derivator for this test
        const stellarDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: stellarDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        const batchSize = 5;
        await utxoAccount.deriveBatch({ startIndex: 0, count: batchSize });

        const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(
          freeUtxos.length,
          batchSize,
          "Should have derived the correct number of UTXOs"
        );

        // Verify each UTXO has required properties
        for (const utxo of freeUtxos) {
          assertExists(utxo.publicKey, "UTXO should have a public key");
          assertExists(utxo.privateKey, "UTXO should have a private key");

          // Verify the keypair can sign data
          const testData = new Uint8Array(32);
          crypto.getRandomValues(testData);
          const signature = await utxo.signPayload(testData);
          assertExists(signature, "Should be able to generate a signature");
        }
      });

      it("should deposit to UTXO and verify state transition to UNSPENT", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_3";
        const depositAmount = 500000n; // 0.05 XLM

        // Create a fresh derivator for this test
        const freshDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: freshDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        // Derive UTXOs
        await utxoAccount.deriveBatch({ startIndex: 0, count: 1 });
        const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(freeUtxos.length, 1, "Should have one FREE UTXO");

        const testUtxo = freeUtxos[0];
        assertExists(testUtxo, "Should have a test UTXO");

        // Build deposit transaction
        const depositTx = new MoonlightTransactionBuilder({
          network: networkConfig.networkPassphrase,
          channelId: channelId,
          authId: authId,
          asset: Asset.native(),
        });

        const createOp = op.create(testUtxo.publicKey, depositAmount);
        depositTx.addOperation(createOp);
        depositTx.addOperation(
          op
            .deposit(user.address() as Ed25519PublicKey, depositAmount)
            .addConditions([createOp.toCondition()])
        );

        // Get latest ledger for signature expiration
        const latestLedger = await rpc.getLatestLedger();
        const signatureExpirationLedger = latestLedger.sequence + 100;
        const nonce = generateNonce();

        // Sign the transaction
        await depositTx.signExtWithEd25519(
          userKeys,
          signatureExpirationLedger,
          nonce
        );

        await depositTx.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );

        // Execute the deposit transaction
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

        // Update UTXO state manually (simulating what batchLoad would do)
        utxoAccount.updateUTXOState(0, UTXOStatus.UNSPENT, depositAmount);

        // Verify the balance through the contract
        const balanceResult = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: {
            utxo: Buffer.from(testUtxo.publicKey),
          },
        });

        assertEquals(
          balanceResult,
          depositAmount,
          "UTXO balance should match the deposited amount"
        );

        // Verify the UTXO state changed to UNSPENT
        const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
        assertEquals(unspentUtxos.length, 1, "Should have one UNSPENT UTXO");

        const unspentUtxo = unspentUtxos[0];
        assertEquals(
          unspentUtxo.balance,
          depositAmount,
          "UTXO should have correct balance"
        );
      });

      it("should calculate total balance across UNSPENT UTXOs", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_4";

        // Create a fresh derivator for this test
        const stellarDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: stellarDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        // Derive 3 UTXOs
        await utxoAccount.deriveBatch({ startIndex: 0, count: 3 });
        const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(freeUtxos.length, 3, "Should have 3 FREE UTXOs");

        const amounts = [100000n, 200000n, 300000n]; // 0.01, 0.02, 0.03 XLM
        const expectedTotal = 600000n;

        // Deposit different amounts to each UTXO
        for (let i = 0; i < 3; i++) {
          const testUtxo = freeUtxos[i];
          const amount = amounts[i];

          const depositTx = new MoonlightTransactionBuilder({
            network: networkConfig.networkPassphrase,
            channelId: channelId,
            authId: authId,
            asset: Asset.native(),
          });

          const createOp = op.create(testUtxo.publicKey, amount);
          depositTx.addOperation(createOp);
          depositTx.addOperation(
            op
              .deposit(user.address() as Ed25519PublicKey, amount)
              .addConditions([createOp.toCondition()])
          );

          const latestLedger = await rpc.getLatestLedger();
          const signatureExpirationLedger = latestLedger.sequence + 100;
          const nonce = generateNonce();

          await depositTx.signExtWithEd25519(
            userKeys,
            signatureExpirationLedger,
            nonce
          );

          await depositTx.signWithProvider(
            providerKeys,
            signatureExpirationLedger,
            nonce
          );

          await channelClient.invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [depositTx.buildXDR()],
              auth: [...depositTx.getSignedAuthEntries()],
            },
            config: txConfig,
          });

          // Update UTXO state to UNSPENT
          utxoAccount.updateUTXOState(i, UTXOStatus.UNSPENT, amount);
        }

        // Verify all UTXOs are UNSPENT
        const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
        assertEquals(unspentUtxos.length, 3, "Should have 3 UNSPENT UTXOs");

        // Verify individual balances
        for (let i = 0; i < 3; i++) {
          assertEquals(
            unspentUtxos[i].balance,
            amounts[i],
            `UTXO ${i} should have correct balance`
          );
        }

        // Calculate and verify total balance
        const totalBalance = utxoAccount.getTotalBalance();
        assertEquals(
          totalBalance,
          expectedTotal,
          "Total balance should be sum of all UNSPENT UTXOs"
        );
      });

      it("should withdraw from UNSPENT UTXO and verify state to SPENT", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_5";
        const depositAmount = 500000n; // 0.05 XLM

        // Create a fresh derivator for this test
        const stellarDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: stellarDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        // Derive UTXOs
        await utxoAccount.deriveBatch({ startIndex: 0, count: 1 });
        const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(freeUtxos.length, 1, "Should have one FREE UTXO");

        const testUtxo = freeUtxos[0];

        // First deposit to the UTXO
        const depositTx = new MoonlightTransactionBuilder({
          network: networkConfig.networkPassphrase,
          channelId: channelId,
          authId: authId,
          asset: Asset.native(),
        });

        const createOp = op.create(testUtxo.publicKey, depositAmount);
        depositTx.addOperation(createOp);
        depositTx.addOperation(
          op
            .deposit(user.address() as Ed25519PublicKey, depositAmount)
            .addConditions([createOp.toCondition()])
        );

        const latestLedger = await rpc.getLatestLedger();
        const signatureExpirationLedger = latestLedger.sequence + 100;
        const nonce = generateNonce();

        await depositTx.signExtWithEd25519(
          userKeys,
          signatureExpirationLedger,
          nonce
        );

        await depositTx.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );

        await channelClient.invokeRaw({
          operationArgs: {
            function: ChannelInvokeMethods.transact,
            args: [depositTx.buildXDR()],
            auth: [...depositTx.getSignedAuthEntries()],
          },
          config: txConfig,
        });

        // Update UTXO state to UNSPENT
        utxoAccount.updateUTXOState(0, UTXOStatus.UNSPENT, depositAmount);

        // Verify deposit worked
        const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
        assertEquals(unspentUtxos.length, 1, "Should have one UNSPENT UTXO");

        // Verify UTXO has balance before withdraw
        const balanceBeforeWithdraw = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: {
            utxo: Buffer.from(testUtxo.publicKey),
          },
        });
        assertEquals(
          balanceBeforeWithdraw,
          depositAmount,
          "UTXO should have balance before withdraw"
        );

        // Now withdraw from the UTXO
        const withdrawTx = new MoonlightTransactionBuilder({
          network: networkConfig.networkPassphrase,
          channelId: channelId,
          authId: authId,
          asset: Asset.native(),
        });

        const withdrawOp = op.withdraw(user.address(), depositAmount);

        const spendOp = op.spend(testUtxo.publicKey);
        spendOp.addCondition(withdrawOp.toCondition());

        withdrawTx.addOperation(spendOp).addOperation(withdrawOp);

        // Sign with the UTXO keypair
        await withdrawTx.signWithSpendUtxo(testUtxo, signatureExpirationLedger);

        await withdrawTx.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          generateNonce()
        );

        // Execute the withdraw transaction
        await channelClient
          .invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [withdrawTx.buildXDR()],
              auth: [...withdrawTx.getSignedAuthEntries()],
            },
            config: txConfig,
          })
          .catch((e) => {
            if (e instanceof P_SimulateTransactionErrors.SIMULATION_FAILED) {
              console.error("Error invoking withdraw contract:", e);
              console.error(
                "Transaction XDR:",
                e.meta.data.input.transaction.toXDR()
              );
            }
            throw e;
          });

        // Update UTXO state to SPENT
        utxoAccount.updateUTXOState(0, UTXOStatus.SPENT, 0n);

        // Verify the balance through the contract is 0
        const balanceResult = await channelClient.read({
          method: ChannelReadMethods.utxo_balance,
          methodArgs: {
            utxo: Buffer.from(testUtxo.publicKey),
          },
        });

        assertEquals(
          balanceResult,
          0n,
          "UTXO balance should be 0 after withdrawal"
        );

        // Verify the UTXO state changed to SPENT
        const spentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.SPENT);
        assertEquals(spentUtxos.length, 1, "Should have one SPENT UTXO");

        const spentUtxo = spentUtxos[0];
        assertEquals(spentUtxo.balance, 0n, "SPENT UTXO should have 0 balance");
      });

      it("should batch load UTXO balances from contract", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_6";

        // Create a fresh derivator for this test
        const stellarDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: stellarDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        // Derive 5 UTXOs
        await utxoAccount.deriveBatch({ startIndex: 0, count: 5 });
        const freeUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(freeUtxos.length, 5, "Should have 5 FREE UTXOs");

        const amounts = [100000n, 200000n]; // Deposit to 2 UTXOs only

        // Deposit to first 2 UTXOs
        for (let i = 0; i < 2; i++) {
          const testUtxo = freeUtxos[i];
          const amount = amounts[i];

          const depositTx = new MoonlightTransactionBuilder({
            network: networkConfig.networkPassphrase,
            channelId: channelId,
            authId: authId,
            asset: Asset.native(),
          });

          const createOp = op.create(testUtxo.publicKey, amount);
          depositTx.addOperation(createOp);
          depositTx.addOperation(
            op
              .deposit(user.address() as Ed25519PublicKey, amount)
              .addConditions([createOp.toCondition()])
          );

          const latestLedger = await rpc.getLatestLedger();
          const signatureExpirationLedger = latestLedger.sequence + 100;
          const nonce = generateNonce();

          await depositTx.signExtWithEd25519(
            userKeys,
            signatureExpirationLedger,
            nonce
          );

          await depositTx.signWithProvider(
            providerKeys,
            signatureExpirationLedger,
            nonce
          );

          await channelClient.invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [depositTx.buildXDR()],
              auth: [...depositTx.getSignedAuthEntries()],
            },
            config: txConfig,
          });
        }

        // Now call batchLoad to update states from contract
        await utxoAccount.batchLoad();

        // Verify that 2 UTXOs are UNSPENT (have balances)
        const unspentUtxos = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
        assertEquals(
          unspentUtxos.length,
          2,
          "Should have 2 UNSPENT UTXOs after batchLoad"
        );

        // Verify that 3 UTXOs are still FREE (no balances)
        const freeUtxosAfterLoad = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(
          freeUtxosAfterLoad.length,
          3,
          "Should have 3 FREE UTXOs after batchLoad"
        );

        // Verify the balances are correct
        for (let i = 0; i < 2; i++) {
          assertEquals(
            unspentUtxos[i].balance,
            amounts[i],
            `UTXO ${i} should have correct balance after batchLoad`
          );
        }

        // Verify total balance
        const totalBalance = utxoAccount.getTotalBalance();
        const expectedTotal = amounts[0] + amounts[1];
        assertEquals(
          totalBalance,
          expectedTotal,
          "Total balance should be sum of UNSPENT UTXOs"
        );
      });
    });

    describe("Advanced Features", () => {
      it("should handle multiple deposits and withdrawals across different UTXOs", async () => {
        const testRoot = "S-TEST_SECRET_ROOT_7";

        // Create a fresh derivator for this test
        const stellarDerivator = new StellarDerivator().withNetworkAndContract(
          StellarNetworkId.Testnet,
          channelId
        );

        const utxoAccount = new UtxoBasedStellarAccount({
          derivator: stellarDerivator,
          root: testRoot,
          options: {
            batchSize: 10,
            fetchBalances: async (publicKeys: Uint8Array[]) => {
              return channelClient.read({
                method: ChannelReadMethods.utxo_balances,
                methodArgs: {
                  utxos: publicKeys.map((pk) => Buffer.from(pk)),
                },
              });
            },
          },
        });

        // Step 1: Derive 5 UTXOs
        await utxoAccount.deriveBatch({ startIndex: 0, count: 5 });
        const allUtxos = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(allUtxos.length, 5, "Should have 5 FREE UTXOs");

        const depositAmounts = [100000n, 200000n, 300000n]; // 0.01, 0.02, 0.03 XLM

        // Step 2: Deposit to first 3 UTXOs
        for (let i = 0; i < 3; i++) {
          const testUtxo = allUtxos[i];
          const amount = depositAmounts[i];

          const depositTx = new MoonlightTransactionBuilder({
            network: networkConfig.networkPassphrase,
            channelId: channelId,
            authId: authId,
            asset: Asset.native(),
          });

          const createOp = op.create(testUtxo.publicKey, amount);
          depositTx.addOperation(createOp);
          depositTx.addOperation(
            op
              .deposit(user.address() as Ed25519PublicKey, amount)
              .addConditions([createOp.toCondition()])
          );

          const latestLedger = await rpc.getLatestLedger();
          const signatureExpirationLedger = latestLedger.sequence + 100;
          const nonce = generateNonce();

          await depositTx.signExtWithEd25519(
            userKeys,
            signatureExpirationLedger,
            nonce
          );

          await depositTx.signWithProvider(
            providerKeys,
            signatureExpirationLedger,
            nonce
          );

          await channelClient.invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [depositTx.buildXDR()],
              auth: [...depositTx.getSignedAuthEntries()],
            },
            config: txConfig,
          });

          utxoAccount.updateUTXOState(i, UTXOStatus.UNSPENT, amount);
        }

        // Step 3: Verify states after deposits (3 UNSPENT, 2 FREE)
        const unspentAfterDeposits = utxoAccount.getUTXOsByState(
          UTXOStatus.UNSPENT
        );
        const freeAfterDeposits = utxoAccount.getUTXOsByState(UTXOStatus.FREE);
        assertEquals(
          unspentAfterDeposits.length,
          3,
          "Should have 3 UNSPENT UTXOs after deposits"
        );
        assertEquals(
          freeAfterDeposits.length,
          2,
          "Should have 2 FREE UTXOs after deposits"
        );

        const totalAfterDeposits = utxoAccount.getTotalBalance();
        assertEquals(
          totalAfterDeposits,
          600000n,
          "Total balance should be 600000 after deposits"
        );

        // Step 4: Withdraw from first 2 UTXOs
        for (let i = 0; i < 2; i++) {
          const testUtxo = allUtxos[i];
          const amount = depositAmounts[i];

          const withdrawTx = new MoonlightTransactionBuilder({
            network: networkConfig.networkPassphrase,
            channelId: channelId,
            authId: authId,
            asset: Asset.native(),
          });

          const withdrawOp = op.withdraw(user.address(), amount);
          const spendOp = op.spend(testUtxo.publicKey);
          spendOp.addCondition(withdrawOp.toCondition());

          withdrawTx.addOperation(spendOp).addOperation(withdrawOp);

          const latestLedger = await rpc.getLatestLedger();
          const signatureExpirationLedger = latestLedger.sequence + 100;

          await withdrawTx.signWithSpendUtxo(
            testUtxo,
            signatureExpirationLedger
          );

          await withdrawTx.signWithProvider(
            providerKeys,
            signatureExpirationLedger,
            generateNonce()
          );

          await channelClient.invokeRaw({
            operationArgs: {
              function: ChannelInvokeMethods.transact,
              args: [withdrawTx.buildXDR()],
              auth: [...withdrawTx.getSignedAuthEntries()],
            },
            config: txConfig,
          });

          utxoAccount.updateUTXOState(i, UTXOStatus.SPENT, 0n);
        }

        // Step 5: Verify states after withdraws (1 UNSPENT, 2 SPENT, 2 FREE)
        const unspentAfterWithdraws = utxoAccount.getUTXOsByState(
          UTXOStatus.UNSPENT
        );
        const spentAfterWithdraws = utxoAccount.getUTXOsByState(
          UTXOStatus.SPENT
        );
        const freeAfterWithdraws = utxoAccount.getUTXOsByState(UTXOStatus.FREE);

        assertEquals(
          unspentAfterWithdraws.length,
          1,
          "Should have 1 UNSPENT UTXO after withdraws"
        );
        assertEquals(
          spentAfterWithdraws.length,
          2,
          "Should have 2 SPENT UTXOs after withdraws"
        );
        assertEquals(
          freeAfterWithdraws.length,
          2,
          "Should have 2 FREE UTXOs after withdraws"
        );

        const totalAfterWithdraws = utxoAccount.getTotalBalance();
        assertEquals(
          totalAfterWithdraws,
          300000n,
          "Total balance should be 300000 after withdraws (only third UTXO)"
        );

        // Step 6: Make new deposit to one of the FREE UTXOs
        const freeUtxo = freeAfterWithdraws[0];
        const newDepositAmount = 150000n; // 0.015 XLM

        const newDepositTx = new MoonlightTransactionBuilder({
          network: networkConfig.networkPassphrase,
          channelId: channelId,
          authId: authId,
          asset: Asset.native(),
        });

        const createOp = op.create(freeUtxo.publicKey, newDepositAmount);
        newDepositTx.addOperation(createOp);
        newDepositTx.addOperation(
          op
            .deposit(user.address() as Ed25519PublicKey, newDepositAmount)
            .addConditions([createOp.toCondition()])
        );

        const latestLedger = await rpc.getLatestLedger();
        const signatureExpirationLedger = latestLedger.sequence + 100;
        const nonce = generateNonce();

        await newDepositTx.signExtWithEd25519(
          userKeys,
          signatureExpirationLedger,
          nonce
        );

        await newDepositTx.signWithProvider(
          providerKeys,
          signatureExpirationLedger,
          nonce
        );

        await channelClient.invokeRaw({
          operationArgs: {
            function: ChannelInvokeMethods.transact,
            args: [newDepositTx.buildXDR()],
            auth: [...newDepositTx.getSignedAuthEntries()],
          },
          config: txConfig,
        });

        utxoAccount.updateUTXOState(3, UTXOStatus.UNSPENT, newDepositAmount);

        // Step 7: Verify final state
        const finalUnspent = utxoAccount.getUTXOsByState(UTXOStatus.UNSPENT);
        const finalSpent = utxoAccount.getUTXOsByState(UTXOStatus.SPENT);
        const finalFree = utxoAccount.getUTXOsByState(UTXOStatus.FREE);

        assertEquals(
          finalUnspent.length,
          2,
          "Should have 2 UNSPENT UTXOs at end"
        );
        assertEquals(finalSpent.length, 2, "Should have 2 SPENT UTXOs at end");
        assertEquals(finalFree.length, 1, "Should have 1 FREE UTXO at end");

        const finalTotal = utxoAccount.getTotalBalance();
        const expectedFinalTotal = 300000n + 150000n; // Third original + new deposit
        assertEquals(
          finalTotal,
          expectedFinalTotal,
          "Final balance should be sum of remaining UNSPENT UTXOs"
        );

        // Verify individual balances
        assertEquals(
          finalUnspent[0].balance,
          300000n,
          "First UNSPENT should have 300000"
        );
        assertEquals(
          finalUnspent[1].balance,
          150000n,
          "Second UNSPENT should have 150000"
        );
      });
    });
  }
);
