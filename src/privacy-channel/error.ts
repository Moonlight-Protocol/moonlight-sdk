import { MoonlightError } from "../error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type PrivacyChannelErrorShape = {
  code: Code;
  message: string;
  details: string;
  cause?: Error;
  data: unknown;
};

export enum Code {
  UNEXPECTED_ERROR = "PCH_000",
  PROPERTY_NOT_SET = "PCH_001",
}

export abstract class PrivacyChannelError extends MoonlightError<Code, Meta> {
  override readonly meta: Meta;

  constructor(args: PrivacyChannelErrorShape) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "privacy-channel" as const,
      source: "@Moonlight/privacy-channel",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export class PROPERTY_NOT_SET extends PrivacyChannelError {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_NOT_SET,
      message: `Property not set: ${property}`,
      details: `The required property ${property} is not set in the privacy channel.`,
      data: { property },
    });
  }
}

export const PCH_ERRORS = {
  [Code.PROPERTY_NOT_SET]: PROPERTY_NOT_SET,
};
