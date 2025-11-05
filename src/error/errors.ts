import { GEN_ERRORS } from "./index.ts";
import { DER_ERRORS } from "../derivation/error.ts";
import { UKP_ERRORS } from "../core/utxo-keypair/error.ts";
import { OPR_ERRORS } from "../operation/error.ts";

export const ERRORS = {
  ...GEN_ERRORS,
  ...DER_ERRORS,
  ...UKP_ERRORS,
  ...OPR_ERRORS,
};
