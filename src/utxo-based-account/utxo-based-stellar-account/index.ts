import { UtxoBasedAccount } from "../index.ts";
import type {
  StellarDerivationContext,
  StellarDerivationIndex,
  StellarDerivationRoot,
} from "../../derivation/stellar/types.ts";

export class UtxoBasedStellarAccount extends UtxoBasedAccount<
  StellarDerivationContext,
  StellarDerivationRoot,
  StellarDerivationIndex
> {}
