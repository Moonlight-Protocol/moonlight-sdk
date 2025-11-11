import type { Ed25519PublicKey } from "@colibri/core";
import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import { MoonlightError } from "../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type TransactionBuilderErrorShape = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export enum Code {
  UNEXPECTED_ERROR = "TBU_000",
  PROPERTY_NOT_SET = "TBU_001",
  UNSUPPORTED_OP_TYPE = "TBU_002",
  DUPLICATE_CREATE_OP = "TBU_003",
  DUPLICATE_SPEND_OP = "TBU_004",
  DUPLICATE_DEPOSIT_OP = "TBU_005",
  DUPLICATE_WITHDRAW_OP = "TBU_006",
  AMOUNT_TOO_LOW = "TBU_007",
  NO_SPEND_OPS = "TBU_008",
  NO_DEPOSIT_OPS = "TBU_009",
  NO_WITHDRAW_OPS = "TBU_010",
  NO_EXT_OPS = "TBU_011",
  MISSING_PROVIDER_SIGNATURE = "TBU_012",
  NO_CONDITIONS_FOR_SPEND_OP = "TBU_013",
}

export abstract class TransactionBuilderError extends MoonlightError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: TransactionBuilderErrorShape) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "transaction-builder" as const,
      source: "@Moonlight/transaction-builder",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export class PROPERTY_NOT_SET extends TransactionBuilderError {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_NOT_SET,
      message: `Property not set: ${property}`,
      details:
        `The required property ${property} is not set in the transaction builder.`,
      data: { property },
    });
  }
}

export class UNSUPPORTED_OP_TYPE extends TransactionBuilderError {
  constructor(opType: string) {
    super({
      code: Code.UNSUPPORTED_OP_TYPE,
      message: `Unsupported operation type: ${opType}`,
      details:
        `The operation type ${opType} is not supported in the transaction builder.`,
      data: { opType },
    });
  }
}

export class DUPLICATE_CREATE_OP extends TransactionBuilderError {
  constructor(utxoPk: UTXOPublicKey) {
    super({
      code: Code.DUPLICATE_CREATE_OP,
      message: `Duplicate create operation for UTXO public key: ${utxoPk}`,
      details:
        `A create operation for the UTXO public key ${utxoPk} already exists in the transaction builder.`,
      data: { utxoPk },
    });
  }
}

export class DUPLICATE_SPEND_OP extends TransactionBuilderError {
  constructor(utxoPk: UTXOPublicKey) {
    super({
      code: Code.DUPLICATE_SPEND_OP,
      message: `Duplicate spend operation for UTXO public key: ${utxoPk}`,
      details:
        `A spend operation for the UTXO public key ${utxoPk} already exists in the transaction builder.`,
      data: { utxoPk },
    });
  }
}

export class DUPLICATE_DEPOSIT_OP extends TransactionBuilderError {
  constructor(publicKey: Ed25519PublicKey) {
    super({
      code: Code.DUPLICATE_DEPOSIT_OP,
      message: `Duplicate deposit operation for public key: ${publicKey}`,
      details:
        `A deposit operation for the public key ${publicKey} already exists in the transaction builder.`,
      data: { publicKey },
    });
  }
}
export class DUPLICATE_WITHDRAW_OP extends TransactionBuilderError {
  constructor(publicKey: Ed25519PublicKey) {
    super({
      code: Code.DUPLICATE_WITHDRAW_OP,
      message: `Duplicate withdraw operation for public key: ${publicKey}`,
      details:
        `A withdraw operation for the public key ${publicKey} already exists in the transaction builder.`,
      data: { publicKey },
    });
  }
}

export class NO_SPEND_OPS extends TransactionBuilderError {
  constructor(utxoPk: UTXOPublicKey) {
    super({
      code: Code.NO_SPEND_OPS,
      message: `No spend operations found for the UTXO: ${utxoPk}`,
      details:
        `There are no spend operations associated with the UTXO public key ${utxoPk} in the transaction builder.`,
      data: { utxoPk },
    });
  }
}

export class NO_DEPOSIT_OPS extends TransactionBuilderError {
  constructor(publicKey: Ed25519PublicKey) {
    super({
      code: Code.NO_DEPOSIT_OPS,
      message: `No deposit operations found for the public key: ${publicKey}`,
      details:
        `There are no deposit operations associated with the public key ${publicKey} in the transaction builder.`,
      data: { publicKey },
    });
  }
}

export class NO_WITHDRAW_OPS extends TransactionBuilderError {
  constructor(publicKey: Ed25519PublicKey) {
    super({
      code: Code.NO_WITHDRAW_OPS,
      message: `No withdraw operations found for the public key: ${publicKey}`,
      details:
        `There are no withdraw operations associated with the public key ${publicKey} in the transaction builder.`,
      data: { publicKey },
    });
  }
}

export class NO_EXT_OPS extends TransactionBuilderError {
  constructor(publicKey: Ed25519PublicKey) {
    super({
      code: Code.NO_EXT_OPS,
      message:
        `No deposit or withdraw operations found for the public key: ${publicKey}`,
      details:
        `There are no deposit or withdraw operations associated with the public key ${publicKey} in the transaction builder.`,
      data: { publicKey },
    });
  }
}

export class AMOUNT_TOO_LOW extends TransactionBuilderError {
  constructor(amount: bigint) {
    super({
      code: Code.AMOUNT_TOO_LOW,
      message: `Amount too low: ${amount}`,
      details:
        `The provided amount ${amount} is below the minimum required. It must be greater than zero.`,
      data: { amount: `${amount}` },
    });
  }
}

export class MISSING_PROVIDER_SIGNATURE extends TransactionBuilderError {
  constructor() {
    super({
      code: Code.MISSING_PROVIDER_SIGNATURE,
      message: `Missing provider signature`,
      details:
        `No provider signatures have been added to the transaction builder.`,
      data: {},
    });
  }
}

export class NO_CONDITIONS_FOR_SPEND_OP extends TransactionBuilderError {
  constructor(utxoPk: UTXOPublicKey) {
    super({
      code: Code.NO_CONDITIONS_FOR_SPEND_OP,
      message: `No conditions found for spend operation with UTXO: ${utxoPk}`,
      details:
        `The spend operation associated with the UTXO public key ${utxoPk} does not have any conditions set in the transaction builder.`,
      data: { utxoPk },
    });
  }
}

export const TBU_ERRORS = {
  [Code.PROPERTY_NOT_SET]: PROPERTY_NOT_SET,
  [Code.UNSUPPORTED_OP_TYPE]: UNSUPPORTED_OP_TYPE,
  [Code.DUPLICATE_CREATE_OP]: DUPLICATE_CREATE_OP,
  [Code.DUPLICATE_SPEND_OP]: DUPLICATE_SPEND_OP,
  [Code.DUPLICATE_DEPOSIT_OP]: DUPLICATE_DEPOSIT_OP,
  [Code.DUPLICATE_WITHDRAW_OP]: DUPLICATE_WITHDRAW_OP,
  [Code.NO_SPEND_OPS]: NO_SPEND_OPS,
  [Code.AMOUNT_TOO_LOW]: AMOUNT_TOO_LOW,
  [Code.NO_DEPOSIT_OPS]: NO_DEPOSIT_OPS,
  [Code.NO_WITHDRAW_OPS]: NO_WITHDRAW_OPS,
  [Code.NO_EXT_OPS]: NO_EXT_OPS,
  [Code.MISSING_PROVIDER_SIGNATURE]: MISSING_PROVIDER_SIGNATURE,
};
