import type {
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex,
  StellarNetworkContext,
} from "./types.ts";
import { BaseDerivator } from "../base/index.ts";
import type { StellarNetworkId } from "./stellar-network-id.ts";
import type { ContractId, Ed25519SecretKey } from "@colibri/core";

/**
 * Assembles a network context string from network ID and smart contract ID
 * @param network - The Stellar network identifier
 * @param contractId - The Stellar smart contract identifier
 * @returns Combined network context string
 */
export function assembleNetworkContext(
  network: StellarNetworkId,
  contractId: ContractId
): StellarNetworkContext {
  return `${network}${contractId}`;
}

/**
 * StellarDerivator - Specialized derivator for Stellar blockchain
 * Extends the base derivator with Stellar-specific configuration methods
 */
export class StellarDerivator extends BaseDerivator<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
> {
  /**
   * Sets the Stellar network context using network ID and contract ID
   * @param network - Stellar network ID (Mainnet, Testnet, etc.)
   * @param contractId - Smart contract ID
   * @throws If context has already been set
   */
  withNetworkAndContract(
    network: StellarNetworkId,
    contractId: ContractId
  ): this {
    const context = assembleNetworkContext(network, contractId);
    return this.withContext(context);
  }

  /**
   * Sets the account secret key as the root component
   * @param secretKey - Stellar secret key (starts with 'S')
   * @throws If root has already been set
   */
  withSecretKey(secretKey: Ed25519SecretKey): this {
    return this.withRoot(secretKey);
  }
}

/**
 * Creates a Stellar derivator pre-configured with network, contract and secret key
 * @param networkId - The Stellar network ID
 * @param contractId - The smart contract ID
 * @param secretKey - The secret key to use as root
 * @returns A configured derivator ready to derive with different indices
 */
export function createForAccount(
  networkId: StellarNetworkId,
  contractId: ContractId,
  secretKey: Ed25519SecretKey
): StellarDerivator {
  return new StellarDerivator()
    .withNetworkAndContract(networkId, contractId)
    .withSecretKey(secretKey);
}
