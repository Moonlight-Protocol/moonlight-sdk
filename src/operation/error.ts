import type { UTXOPublicKey } from "../core/utxo-keypair-base/types.ts";
import { MoonlightError } from "../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type OperationErrorShape = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export enum Code {
  UNEXPECTED_ERROR = "OPR_000",
  PROPERTY_NOT_SET = "OPR_001",
  AMOUNT_TOO_LOW = "OPR_002",
  INVALID_ED25519_PK = "OPR_003",

  CANNOT_CONVERT_SPEND_OP = "OPR_004",
  UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION = "OPR_005",
  OP_IS_NOT_CREATE = "OPR_006",
  OP_IS_NOT_SPEND = "OPR_007",
  OP_IS_NOT_DEPOSIT = "OPR_008",
  OP_IS_NOT_WITHDRAW = "OPR_009",
}

export abstract class OperationError extends MoonlightError<Code, Meta> {
  override readonly meta: Meta;

  constructor(args: OperationErrorShape) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "operation" as const,
      source: "@Moonlight/operation",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export class PROPERTY_NOT_SET extends OperationError {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_NOT_SET,
      message: `Property not set: ${property}`,
      details: `The required property ${property} is not set in the operation.`,
      data: { property },
    });
  }
}

export class AMOUNT_TOO_LOW extends OperationError {
  constructor(amount: bigint) {
    super({
      code: Code.AMOUNT_TOO_LOW,
      message: `Amount too low: ${amount}`,
      details: `The provided amount ${amount} is below the minimum required. It must be greater than zero.`,
      data: { amount: `${amount}` },
    });
  }
}

export class INVALID_ED25519_PK extends OperationError {
  constructor(publicKey: string) {
    super({
      code: Code.INVALID_ED25519_PK,
      message: `Invalid Ed25519 public key: ${publicKey}`,
      details: `The provided public key ${publicKey} is not a valid Stellar Ed25519 key. It must follow the strkey standard.`,
      data: { publicKey: `${publicKey}` },
    });
  }
}

export class CANNOT_CONVERT_SPEND_OP extends OperationError {
  constructor(utxoPublicKey: UTXOPublicKey) {
    super({
      code: Code.CANNOT_CONVERT_SPEND_OP,
      message: `Cannot convert spend operation to condition.`,
      details: `The conversion of operation to condition failed because the operation is of type SPEND. This type cannot be used as a condition.`,
      data: { utxoPublicKey },
    });
  }
}

export class UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION extends OperationError {
  constructor(opType: string) {
    super({
      code: Code.UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION,
      message: `Unsupported operation type for SCVal conversion: ${opType}`,
      details: `The operation type ${opType} is not supported for conversion to SCVal. Only DEPOSIT and WITHDRAW types are supported.`,
      data: { opType },
    });
  }
}

export class OP_IS_NOT_CREATE extends OperationError {
  constructor(opType: string) {
    super({
      code: Code.OP_IS_NOT_CREATE,
      message: `Operation is not of type CREATE`,
      details: `The current operation could not be converted to ScVal as a CREATE operation because the type doesn't match.`,
      data: { opType },
    });
  }
}

export class OP_IS_NOT_SPEND extends OperationError {
  constructor(opType: string) {
    super({
      code: Code.OP_IS_NOT_SPEND,
      message: `Operation is not of type SPEND`,
      details: `The current operation could not be converted to ScVal as a SPEND operation because the type doesn't match.`,
      data: { opType },
    });
  }
}

export class OP_IS_NOT_DEPOSIT extends OperationError {
  constructor(opType: string) {
    super({
      code: Code.OP_IS_NOT_DEPOSIT,
      message: `Operation is not of type DEPOSIT`,
      details: `The current operation could not be converted to ScVal as a DEPOSIT operation because the type doesn't match.`,
      data: { opType },
    });
  }
}
export class OP_IS_NOT_WITHDRAW extends OperationError {
  constructor(opType: string) {
    super({
      code: Code.OP_IS_NOT_WITHDRAW,
      message: `Operation is not of type WITHDRAW`,
      details: `The current operation could not be converted to ScVal as a WITHDRAW operation because the type doesn't match.`,
      data: { opType },
    });
  }
}

export const OPR_ERRORS = {
  [Code.AMOUNT_TOO_LOW]: AMOUNT_TOO_LOW,
  [Code.INVALID_ED25519_PK]: INVALID_ED25519_PK,
  [Code.PROPERTY_NOT_SET]: PROPERTY_NOT_SET,
  [Code.CANNOT_CONVERT_SPEND_OP]: CANNOT_CONVERT_SPEND_OP,
  [Code.UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION]:
    UNSUPPORTED_OP_TYPE_FOR_SCVAL_CONVERSION,
  [Code.OP_IS_NOT_CREATE]: OP_IS_NOT_CREATE,
  [Code.OP_IS_NOT_SPEND]: OP_IS_NOT_SPEND,
  [Code.OP_IS_NOT_DEPOSIT]: OP_IS_NOT_DEPOSIT,
  [Code.OP_IS_NOT_WITHDRAW]: OP_IS_NOT_WITHDRAW,
};
