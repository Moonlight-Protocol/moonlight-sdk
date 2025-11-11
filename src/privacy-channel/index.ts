import {
  Contract,
  type NetworkConfig,
  type ContractId,
  type TransactionConfig,
} from "@colibri/core";
import { StellarDerivator } from "../derivation/stellar/index.ts";
import type { StellarNetworkId } from "../derivation/stellar/stellar-network-id.ts";
import {
  type ChannelInvokeMethods,
  type ChannelReadMethods,
  ChannelSpec,
} from "./constants.ts";
import type { ChannelInvoke, ChannelRead } from "./types.ts";
import type { xdr } from "@stellar/stellar-sdk";
import * as E from "./error.ts";

export class PrivacyChannel {
  private _client: Contract;
  private _authId: ContractId;
  private _assetId: ContractId;
  private _networkConfig: NetworkConfig;
  private _derivator: StellarDerivator;

  public constructor(
    networkConfig: NetworkConfig,
    channelId: ContractId,
    authId: ContractId,
    assetId: ContractId
  ) {
    this._networkConfig = networkConfig;

    this._client = Contract.create({
      networkConfig,
      contractConfig: { contractId: channelId, spec: ChannelSpec },
    });

    this._authId = authId;

    this._assetId = assetId;

    this._derivator = new StellarDerivator().withNetworkAndContract(
      networkConfig.networkPassphrase as StellarNetworkId,
      channelId as ContractId
    );
  }

  //==========================================
  // Meta Requirement Methods
  //==========================================
  //
  //

  /**
   * Returns the required property if it is set, otherwise throws an error.
   *
   * @param arg - The name of the property to retrieve.
   * @returns The value of the requested property.
   * @throws {Error} If the requested property is not set.
   * */
  private require(arg: "_client"): Contract;
  private require(arg: "_authId"): ContractId;
  private require(arg: "_networkConfig"): NetworkConfig;
  private require(arg: "_derivator"): StellarDerivator;
  private require(arg: "_assetId"): ContractId;
  private require(
    arg: "_client" | "_authId" | "_networkConfig" | "_derivator" | "_assetId"
  ): Contract | ContractId | NetworkConfig | StellarDerivator {
    if (this[arg]) return this[arg];
    throw new E.PROPERTY_NOT_SET(arg);
  }

  //==========================================
  // Getter Methods
  //==========================================
  //
  //

  /**
   * Returns the Contract client instance.
   *
   * @params None
   * @returns {Contract} The Contract client instance.
   * @throws {Error} If the client instance is not set.
   * */
  private getClient(): Contract {
    return this.require("_client");
  }

  /**
   * Returns the Auth contract ID.
   *
   * @params None
   * @returns {ContractId} The Auth contract ID.
   * @throws {Error} If the Auth contract ID is not set.
   * */
  public getAuthId(): ContractId {
    return this.require("_authId");
  }

  /**
   * Returns the Asset contract ID.
   *
   * @params None
   * @returns {ContractId} The Asset contract ID.
   * @throws {Error} If the Asset contract ID is not set.
   * */
  public getAssetId(): ContractId {
    return this.require("_assetId");
  }

  /**
   * Returns the NetworkConfig instance.
   *
   * @params None
   * @returns {NetworkConfig} The NetworkConfig instance.
   * @throws {Error} If the NetworkConfig instance is not set.
   * */
  public getNetworkConfig(): NetworkConfig {
    return this.require("_networkConfig");
  }

  /**
   * Returns the StellarDerivator instance.
   *
   * @params None
   * @returns {StellarDerivator} The StellarDerivator instance.
   * @throws {Error} If the StellarDerivator instance is not set.
   * */
  public getDerivator(): StellarDerivator {
    return this.require("_derivator");
  }

  /**
   * Returns the Contract ID of the privacy channel contract.
   *
   * @params None
   * @returns {ContractId} The Contract ID of the privacy channel contract.
   * @throws {Error} If the client instance is not set.
   * */
  public getChannelId(): ContractId {
    return this.getClient().getContractId();
  }

  //==========================================
  // Read / Write Methods
  //==========================================
  //
  //

  /**
   *  Reads the contract state using the specified method and arguments.
   *
   * @param  args
   * @param {M} args.method - The read method to call.
   * @param {ChannelReadMethods[M]["input"]} args.methodArgs - The arguments for the read method.
   * @returns {Promise<ChannelReadMethods[M]["output"]>} A promise that resolves to the output of the read method.
   * */

  public async read<M extends ChannelReadMethods>(args: {
    method: M;
    methodArgs: ChannelRead[M]["input"];
  }): Promise<ChannelRead[M]["output"]> {
    return (await this.getClient().read(args)) as Promise<
      ChannelRead[M]["output"]
    >;
  }

  /**
   * Invoke the contract state using the specified method and arguments.
   *
   * @param args
   * @param {M} args.method - The write method to call.
   * @param {ChannelInvokeMethods[M]["input"]} args.methodArgs - The arguments for the write method.
   * @returns {ReturnType<Contract["invoke"]>} A promise that resolves to the invoke colibri response.
   * */
  public async invoke<M extends ChannelInvokeMethods>(args: {
    method: M;
    methodArgs: ChannelInvoke[M]["input"];
    auth?: xdr.SorobanAuthorizationEntry[];
    config: TransactionConfig;
  }): Promise<ReturnType<Contract["invoke"]>> {
    return await this.getClient().invoke(args);
  }

  /**
   * Invoke the contract function directly using the specified operation arguments.
   *
   * @param args
   * @param { operationArgs } args.operationArgs - The operation arguments for the invoke.
   * @param { string } args.operationArgs.function - The function name to invoke.
   * @param { xdr.ScVal[] } args.operationArgs.args - The arguments for the function.
   * @param { xdr.SorobanAuthorizationEntry[] } [args.operationArgs.auth] - Optional authorization entries.
   * @param { TransactionConfig } args.config - The transaction configuration.
   * @returns {ReturnType<Contract["invoke"]>} A promise that resolves to the invoke colibri response.
   * */
  public async invokeRaw(args: {
    operationArgs: {
      function: string;
      args: xdr.ScVal[];
      auth?: xdr.SorobanAuthorizationEntry[];
    };
    config: TransactionConfig;
  }): Promise<ReturnType<Contract["invoke"]>> {
    return await this.getClient().invokeRaw(args);
  }
}
