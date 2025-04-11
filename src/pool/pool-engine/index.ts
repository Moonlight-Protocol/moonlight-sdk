import { StellarPlus } from "stellar-plus";
import type {
  BaseInvocation,
  ContractEngineConstructorArgs,
  SorobanInvokeArgs,
  SorobanSimulateArgs,
} from "stellar-plus/lib/stellar-plus/core/contract-engine/types";
import {
  type PoolEngineConstructorArgs,
  type ContractConstructorArgs,
  type ReadMapping,
  type WriteMapping,
  type Bundle,
  type BundlePayloadAction,
  SimplePayloadAction,
} from "./types.ts";

import type { ReadMethods, WriteMethods } from "./types.ts";
import type { SorobanTransactionPipelineOutput } from "stellar-plus/lib/stellar-plus/core/pipelines/soroban-transaction/types";

import type { SorobanTransactionPipelineInput as _SorobanTransactionPipelineInput } from "stellar-plus/lib/stellar-plus/core/pipelines/soroban-transaction/types";
import { Buffer } from "buffer";
import { bigintToLE } from "../../utils/conversion/bigintToLE.ts";
import {
  StellarDerivator,
  type StellarNetworkId,
} from "../../derivation/index.ts";
import type { StellarSmartContractId } from "../../utils/types/stellar.types.ts";

const ContractEngine = StellarPlus.Core.ContractEngine;

export class PoolEngine extends ContractEngine {
  public assetContractId: string;
  public derivator: StellarDerivator;

  private _networkId: StellarNetworkId;

  constructor({
    networkConfig,
    wasm,
    assetContractId,
    poolContractId,
  }: PoolEngineConstructorArgs) {
    super({
      networkConfig,
      contractParameters: {
        wasm,
        contractId: poolContractId,
      },
    } as ContractEngineConstructorArgs);

    this._networkId = networkConfig.networkPassphrase as StellarNetworkId;
    this.assetContractId = assetContractId;

    const derivator = new StellarDerivator();
    this.derivator = derivator;
  }

  /**
   * Creates a new instance of the PoolEngine class and loads the WASM specification.
   * @param {PoolEngineConstructorArgs} args - The constructor arguments.
   * @returns {Promise<PoolEngine>} A promise that resolves to a new instance of the PoolEngine class.
   */
  public static async create(
    args: PoolEngineConstructorArgs
  ): Promise<PoolEngine> {
    const pool = new PoolEngine(args);
    await pool.loadSpecFromWasm();
    return pool;
  }

  /**
   * Sets the context for the contract engine.
   * This method is used to set the network and contract ID for the contract engine.
   */
  public setContext() {
    const contractId = this.getContractId();
    const networkId = this._networkId;
    this.derivator.withNetworkAndContract(
      networkId,
      contractId as StellarSmartContractId
    );
  }

  /**
   * Deploys a new contract instance and initializes it with the provided arguments.
   * The asset contract ID is set to the assetContractId of the PoolEngine instance.
   *
   * This method overrides the deploy method of the ContractEngine class and automatically
   * sets the derivation context for the contract.
   *
   * @param {BaseInvocation} args - The transaction invocation arguments.
   * @param {string} args.contractArgs.admin - The admin address.
   * */
  public override async deploy(
    args: BaseInvocation & {
      contractArgs: {
        admin: string;
      };
    }
  ): Promise<SorobanTransactionPipelineOutput> {
    const result = await super.deploy({
      ...args,
      contractArgs: {
        asset: this.assetContractId,
        admin: args.contractArgs.admin, // Use the admin value from contractArgs instead of header.source
      } as ContractConstructorArgs,
    });

    this.setContext();
    return result;
  }

  /**
   *  Reads the contract state using the specified method and arguments.
   *
   * @param {BaseInvocation} args - The transaction invocation arguments.
   * @param { _SorobanTransactionPipelineInput['options']} args.options - The options for the transaction pipeline.
   * @param {M} args.method - The read method to call.
   * @param {ReadMapping[M]["input"]} args.methodArgs - The arguments for the read method.
   * @returns {Promise<ReadMapping[M]["output"]>} A promise that resolves to the output of the read method.
   * */

  public async read<M extends ReadMethods>(
    args: BaseInvocation & { method: M; methodArgs: ReadMapping[M]["input"] }
  ): Promise<ReadMapping[M]["output"]> {
    return (await this.readFromContract(
      args as SorobanSimulateArgs<ReadMapping[M]["input"]>
    )) as Promise<ReadMapping[M]["output"]>;
  }

  /**
   * Writes to the contract state using the specified method and arguments.
   *
   * @param {BaseInvocation} args - The transaction invocation arguments.
   * @param { SorobanGetTransactionPipelineInput['options']} args.options - The options for the transaction pipeline.
   * @param {M} args.method - The write method to call.
   * @param {WriteMapping[M]["input"]} args.methodArgs - The arguments for the write method.
   * @returns {Promise<SorobanTransactionPipelineOutput>} A promise that resolves to the output of the write method.
   * */
  public async write<M extends WriteMethods>(
    args: BaseInvocation & { method: M; methodArgs: WriteMapping[M]["input"] }
  ): Promise<SorobanTransactionPipelineOutput> {
    return (await this.invokeContract(
      args as SorobanInvokeArgs<WriteMapping[M]["input"]>
    )) as Promise<SorobanTransactionPipelineOutput>;
  }

  /**
   * Builds an authorization payload for a UTXO burn.
   *
   * @param {Uint8Array} utxo - The UTXO to be burned.
   * @param {bigint} amount - The amount to be burned.
   *
   * @returns {Uint8Array} The payload for the burn operation.
   *
   * */
  public buildBurnPayload(args: { utxo: Uint8Array; amount: bigint }) {
    const { utxo, amount } = args;

    const action = SimplePayloadAction.BURN;
    const prefix = Buffer.from(action); // 4 bytes

    // For an i128, we need 16 bytes in little-endian order.
    const amountBytes = bigintToLE(amount, 16);
    // Concatenate prefix, utxo, and amountBytes.
    const payload = Buffer.concat([
      prefix,
      Buffer.from(utxo),
      Buffer.from(amountBytes),
    ]);
    return new Uint8Array(payload);
  }

  /**
   * Builds an authorization payload for a UTXO withdrawal.
   *
   * @param {Uint8Array} utxo - The UTXO to be withdrawn.
   * @param {bigint} amount - The amount to be withdrawn.
   *
   * @returns {Uint8Array} The payload for the withdraw operation.
   *
   * */
  public buildWithdrawPayload(args: {
    utxo: Uint8Array;
    amount: bigint;
  }): Uint8Array {
    return this.buildBurnPayload(args);
  }

  /**
   * Builds an authorization payload payload for a UTXO bundle transaction.
   *
   * @param {Bundle} args.bundle - The bundle containing spend and create UTXOs.
   * @param {BundlePayloadAction | string} args.action - The action to be performed on the bundle. Can be a standardized action or a custom string.
   *
   * @returns {Uint8Array} The payload for the bundle operation.
   *
   * */
  public buildBundlePayload(args: {
    bundle: Bundle;
    action: BundlePayloadAction | string;
  }): Uint8Array {
    const { bundle, action } = args;

    const encoder = new TextEncoder();
    // "BUNDLE" is 6 bytes as an ASCII string.
    const encodedPrefix = encoder.encode("BUNDLE");
    const parts: Uint8Array[] = [encodedPrefix];

    // Append standardized bundle action or custom
    const encodedAction = encoder.encode(action);
    parts.push(encodedAction);

    // Append each spend UTXO (assumed to be 65 bytes each)
    for (const utxo of bundle.spend) {
      parts.push(new Uint8Array(utxo));
    }

    // For each create tuple, append the 65-byte UTXO and the amount in little-endian (8 bytes)
    for (const [utxo, amount] of bundle.create) {
      parts.push(new Uint8Array(utxo));
      const amountBytes = bigintToLE(amount, 16);
      parts.push(amountBytes);
    }

    // Concatenate all parts into one Uint8Array
    const payloadBuffer = Buffer.concat(parts);
    return new Uint8Array(payloadBuffer);
  }

  // /**
  //  * Derives a UTXO keypair using the specified root and index.
  //  *
  //  * @param {StellarDerivationRoot} root - The root for the derivation. Generally the Stellar secret key for the master account.
  //  * @param {StellarDerivationIndex} index - The index for the derivation. Generated based on the derived sequence.
  //  *
  //  * @returns {Promise<UTXOKeypair>} A promise that resolves to the derived UTXO keypair.
  //  * */
  // public async deriveUtxoKeypair(
  //   root: StellarDerivationRoot,
  //   index: StellarDerivationIndex
  // ): Promise<UTXOKeypair> {
  //   const derivationSeed = this.derivator.generatePlainTextSeed(root, index);
  //   const hashedSeed = await this.derivator.hashSeed(derivationSeed);
  //   return deriveP256KeyPairFromSeed(hashedSeed);
  // }
  //
  // This will be incorporated by the UTX-BASED-ACCOUNT based on the context provided by this pool.
}
