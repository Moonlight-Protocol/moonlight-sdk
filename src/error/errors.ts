import { GEN_ERRORS } from "./index.ts";
import { DER_ERRORS } from "../derivation/error.ts";
import { UKP_ERRORS } from "../core/utxo-keypair/error.ts";
import { OPR_ERRORS } from "../operation/error.ts";
import { PCH_ERRORS } from "../privacy-channel/error.ts";
import { TBU_ERRORS } from "../transaction-builder/error.ts";
import { UBA_ERRORS } from "../utxo-based-account/error.ts";
export const ERRORS = {
  ...GEN_ERRORS,
  ...DER_ERRORS,
  ...UKP_ERRORS,
  ...OPR_ERRORS,
  ...PCH_ERRORS,
  ...TBU_ERRORS,
  ...UBA_ERRORS,
};
