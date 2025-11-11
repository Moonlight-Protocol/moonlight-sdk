import { MoonlightError } from "../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type UTXOBasedAccountErrorShape = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export enum Code {
  UNEXPECTED_ERROR = "UBA_000",
  NEGATIVE_INDEX = "UBA_001",
  UTXO_TO_DERIVE_TOO_LOW = "UBA_002",
  MISSING_BATCH_FETCH_FN = "UBA_003",

  MISSING_UTXO_FOR_INDEX = "UBA_004",
}

export abstract class UTXOBasedAccountError extends MoonlightError<Code, Meta> {
  override readonly meta: Meta;

  constructor(args: UTXOBasedAccountErrorShape) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "utxo-based-account" as const,
      source: "@Moonlight/utxo-based-account",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export class NEGATIVE_INDEX extends UTXOBasedAccountError {
  constructor(index: number) {
    super({
      code: Code.NEGATIVE_INDEX,
      message: `Negative index provided: ${index}`,
      details:
        `The provided index ${index} is negative. Indices must be sequential non-negative integers.`,
      data: { index },
    });
  }
}

export class UTXO_TO_DERIVE_TOO_LOW extends UTXOBasedAccountError {
  constructor(utxosToDerive: number) {
    super({
      code: Code.UTXO_TO_DERIVE_TOO_LOW,
      message: `UTXOs to derive too low: ${utxosToDerive}`,
      details:
        `The number of UTXOs to derive must be at least 1. Provided value: ${utxosToDerive}.`,
      data: { utxosToDerive },
    });
  }
}

export class MISSING_BATCH_FETCH_FN extends UTXOBasedAccountError {
  constructor() {
    super({
      code: Code.MISSING_BATCH_FETCH_FN,
      message: `Missing batch fetch function`,
      details:
        `A batch fetch function must be provided to retrieve UTXO public keys in batches.`,
      data: {},
    });
  }
}

export class MISSING_UTXO_FOR_INDEX extends UTXOBasedAccountError {
  constructor(index: number) {
    super({
      code: Code.MISSING_UTXO_FOR_INDEX,
      message: `Missing UTXO for index: ${index}`,
      details:
        `No UTXO public key found for the provided index ${index}. Ensure the index is valid and UTXOs have been derived up to this index.`,
      data: { index },
    });
  }
}

export const UBA_ERRORS = {
  [Code.NEGATIVE_INDEX]: NEGATIVE_INDEX,
  [Code.UTXO_TO_DERIVE_TOO_LOW]: UTXO_TO_DERIVE_TOO_LOW,
  [Code.MISSING_BATCH_FETCH_FN]: MISSING_BATCH_FETCH_FN,
  [Code.MISSING_UTXO_FOR_INDEX]: MISSING_UTXO_FOR_INDEX,
};
