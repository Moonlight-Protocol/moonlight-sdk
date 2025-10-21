import type { ContractId, Ed25519SecretKey } from "@colibri/core";
import type { PlainDerivationSeed, SequenceIndex } from "../base/types.ts";
import type { StellarNetworkId } from "./stellar-network-id.ts";

export type StellarDerivationContext = StellarNetworkContext;
export type StellarDerivationRoot = Ed25519SecretKey;
export type StellarDerivationIndex = SequenceIndex;

export type StellarDerivationSeed = PlainDerivationSeed<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
>;

// Stellar Network Context combines the following:
// - NetworkId: Passphrase of the network.
// - SmartContractId: The smart contract id. Starts with the prefix C.
export type StellarNetworkContext = `${StellarNetworkId}${ContractId}`;
