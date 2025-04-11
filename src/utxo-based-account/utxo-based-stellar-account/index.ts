import { UtxoBasedAccount } from "../index.ts";
import type {
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex,
} from "../../derivation/stellar/types.ts";

export class UtxoBasedStellarAccount extends UtxoBasedAccount<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
> {}
