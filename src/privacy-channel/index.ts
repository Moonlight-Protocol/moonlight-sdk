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

export class PrivacyChannel {
  private _client: Contract;
  private _authId: ContractId;
  private _networkConfig: NetworkConfig;
  private _derivator: StellarDerivator;

  private constructor(
    networkConfig: NetworkConfig,
    channelId: ContractId,
    authId: ContractId
  ) {
    this._networkConfig = networkConfig;

    this._client = Contract.create({
      networkConfig,
      contractConfig: { contractId: channelId, spec: ChannelSpec },
    });

    this._authId = authId;

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

  private require(arg: "_client"): Contract;
  private require(arg: "_authId"): ContractId;
  private require(arg: "_networkConfig"): NetworkConfig;
  private require(arg: "_derivator"): StellarDerivator;
  private require(
    arg: "_client" | "_authId" | "_networkConfig" | "_derivator"
  ): Contract | ContractId | NetworkConfig | StellarDerivator {
    if (this[arg]) return this[arg];
    throw new Error(`Property ${arg} is not set in the Channel instance.`);
  }

  //==========================================
  // Getter Methods
  //==========================================
  //
  //

  private getclient(): Contract {
    return this.require("_client");
  }

  public getAuthId(): ContractId {
    return this.require("_authId");
  }

  public getNetworkConfig(): NetworkConfig {
    return this.require("_networkConfig");
  }
  public getDerivator(): StellarDerivator {
    return this.require("_derivator");
  }

  public getChannelId(): ContractId {
    return this.getclient().getContractId();
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
    return (await this.getclient().read(args)) as Promise<
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
    config: TransactionConfig;
  }): ReturnType<Contract["invoke"]> {
    return await this.invoke(args);
  }
}
