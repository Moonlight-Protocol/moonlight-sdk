import {
  StellarSecretKey,
  StellarSmartContractId,
} from "../../utils/types/stellar.types.ts";
import type { PlainDerivationSeed, SequenceIndex } from "../base/types.ts";
import type { StellarNetworkId } from "./stellar-network-id.ts";

export type StellarDerivationContext = StellarNetworkContext;
export type StellarDerivationRoot = StellarSecretKey;
export type StellarDerivationIndex = SequenceIndex;

export type StellarDerivationSeed = PlainDerivationSeed<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
>;

// Stellar Network Context combines the following:
// - NetworkId: Passphrase of the network.
// - SmartContractId: The smart contract id. Starts with the prefix C.
export type StellarNetworkContext =
  `${StellarNetworkId}${StellarSmartContractId}`;
