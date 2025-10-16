import {
  Contract,
  type NetworkConfig,
  type ContractId,
  type TransactionConfig,
} from "@colibri/core";
import {
  type AuthInvokeMethods,
  type AuthReadMethods,
  AuthSpec,
} from "./constants.ts";
import type { AuthInvoke, AuthRead } from "./types.ts";

export class ChannelAuth {
  private _client: Contract;
  private _networkConfig: NetworkConfig;

  public constructor(networkConfig: NetworkConfig, authId: ContractId) {
    this._networkConfig = networkConfig;

    this._client = Contract.create({
      networkConfig,
      contractConfig: { contractId: authId, spec: AuthSpec },
    });
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
  private require(arg: "_networkConfig"): NetworkConfig;
  private require(arg: "_client" | "_networkConfig"): Contract | NetworkConfig {
    if (this[arg]) return this[arg];
    throw new Error(`Property ${arg} is not set in the Channel instance.`);
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
   * Returns the Contract ID of the auth contract.
   *
   * @params None
   * @returns {ContractId} The Contract ID of the auth contract.
   * @throws {Error} If the client instance is not set.
   * */
  public getAuthId(): ContractId {
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
   * @param {AuthReadMethods[M]["input"]} args.methodArgs - The arguments for the read method.
   * @returns {Promise<AuthReadMethods[M]["output"]>} A promise that resolves to the output of the read method.
   * */

  public async read<M extends AuthReadMethods>(args: {
    method: M;
    methodArgs: AuthRead[M]["input"];
  }): Promise<AuthRead[M]["output"]> {
    return (await this.getClient().read(args)) as Promise<
      AuthRead[M]["output"]
    >;
  }

  /**
   * Invoke the contract state using the specified method and arguments.
   *
   * @param args
   * @param {M} args.method - The write method to call.
   * @param {AuthInvokeMethods[M]["input"]} args.methodArgs - The arguments for the write method.
   * @returns {ReturnType<Contract["invoke"]>} A promise that resolves to the invoke colibri response.
   * */
  public async invoke<M extends AuthInvokeMethods>(args: {
    method: M;
    methodArgs: AuthInvoke[M]["input"];
    config: TransactionConfig;
  }) {
    return await this.getClient().invoke(args);
  }
}
