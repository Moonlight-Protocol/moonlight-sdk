import { BaseDerivator } from "../../derivation/index.ts";
import { MoonlightError } from "../../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type UTXOKeypairErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export abstract class UTXOKeypairError<
  Code extends string
> extends MoonlightError<Code, Meta> {
  override readonly meta: Meta;

  constructor(args: UTXOKeypairErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "utxo-keypair" as const,
      source: "@Moonlight/utxo-keypair",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  UNEXPECTED_ERROR = "UKP_000",
  DERIVATOR_NOT_CONFIGURED = "UKP_001",
}

// Currently unused, reserving
//
// export class UNEXPECTED_ERROR extends ContractError<Code> {
//   constructor(cause: Error) {
//     super({
//       code: Code.UNEXPECTED_ERROR,
//       message: "An unexpected error occurred in the UTXOKeypair module!",
//       details: "See the 'cause' for more details",
//       cause,
//       data: {},
//     });
//   }
// }

export class DERIVATOR_NOT_CONFIGURED extends UTXOKeypairError<Code> {
  constructor(derivator: BaseDerivator<string, string, string>) {
    super({
      code: Code.DERIVATOR_NOT_CONFIGURED,
      message: `Derivator is not configured!`,
      details: `The derivator provided to the UTXOKeypair is not properly configured. Check the derivator's context and root settings.`,
      data: {
        derivator: {
          isRootSet: derivator.isSet("root"),
          isContextSet: derivator.isSet("context"),
          context: derivator.isSet("context")
            ? derivator.getContext()
            : undefined,
        },
      },
    });
  }
}

export const UKP_ERRORS = {
  //    [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.DERIVATOR_NOT_CONFIGURED]: DERIVATOR_NOT_CONFIGURED,
};
