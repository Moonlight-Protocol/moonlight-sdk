import { GEN_ERRORS } from "./index.ts";
import { DER_ERRORS } from "../derivation/error.ts";

export const ERRORS = {
  ...GEN_ERRORS,
  ...DER_ERRORS,
};
