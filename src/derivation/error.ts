import { MoonlightError } from "../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type DerivationErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export abstract class DerivationError<
  Code extends string
> extends MoonlightError<Code, Meta> {
  override readonly meta: Meta;

  constructor(args: DerivationErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "derivation" as const,
      source: "@Moonlight/derivation",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  UNEXPECTED_ERROR = "DER_000",
  PROPERTY_ALREADY_SET = "DER_001",
  PROPERTY_NOT_SET = "DER_002",
}

// Currently unused, reserving
//
// export class UNEXPECTED_ERROR extends ContractError<Code> {
//   constructor(cause: Error) {
//     super({
//       code: Code.UNEXPECTED_ERROR,
//       message: "An unexpected error occurred in the Contract module!",
//       details: "See the 'cause' for more details",
//       cause,
//       data: {},
//     });
//   }
// }

export class PROPERTY_ALREADY_SET extends DerivationError<Code> {
  constructor(property: string, value: string) {
    super({
      code: Code.PROPERTY_ALREADY_SET,
      message: `Property '${property}' is already set as: ${value}`,
      details: `The property '${property}' has already been set for this derivator. Once set, this property cannot be modified.`,
      data: { property, value },
    });
  }
}

export class PROPERTY_NOT_SET extends DerivationError<Code> {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_NOT_SET,
      message: `Property '${property}' is not set`,
      details: `The property '${property}' must be set before it can be accessed. Please ensure that you have configured this property appropriately before attempting to use it.`,
      data: { property },
    });
  }
}

export const DER_ERRORS = {
  //    [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.PROPERTY_ALREADY_SET]: PROPERTY_ALREADY_SET,
  [Code.PROPERTY_NOT_SET]: PROPERTY_NOT_SET,
};
