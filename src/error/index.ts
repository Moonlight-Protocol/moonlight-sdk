import type {
  BaseMeta,
  MoonlightErrorShape,
  Diagnostic,
  ErrorDomain,
} from "./types.ts";

/**
 * MoonlightError - Custom error class for Moonlight SDK
 * Extends the native Error class with additional properties and methods
 */
export class MoonlightError<
  C extends string = string,
  M extends BaseMeta = BaseMeta
> extends Error {
  readonly domain: ErrorDomain;
  readonly code: C;
  readonly source: string;
  readonly details?: string;
  readonly diagnostic?: Diagnostic;
  readonly meta?: M;

  /**
   *
   * @description Constructs a new MoonlightError instance.
   *
   * @param {MoonlightErrorShape<C, M>} e - The error shape containing all necessary properties.
   */
  constructor(e: MoonlightErrorShape<C, M>) {
    super(e.message);
    this.name = "MoonlightError " + e.code;
    this.domain = e.domain;
    this.code = e.code;
    this.source = e.source;
    this.details = e.details;
    this.diagnostic = e.diagnostic;
    this.meta = e.meta;
  }

  /**
   *
   * @description Serializes the MoonlightError to a JSON-compatible object.
   *
   * @returns {Record<string, unknown>} A JSON-compatible representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      domain: this.domain,
      code: this.code,
      message: this.message,
      source: this.source,
      details: this.details,
      diagnostic: this.diagnostic,
      meta: this.meta,
    };
  }

  /**
   *
   * @description Type guard to check if an unknown value is a MoonlightError.
   *
   * @param {unknown} e - The value to check.
   *
   * @returns {boolean} True if the value is a MoonlightError, false otherwise.
   */
  static is(e: unknown): e is MoonlightError<string, BaseMeta> {
    return e instanceof MoonlightError;
  }

  /**
   *
   * @description Creates a generic unexpected error instance.
   *
   * @param {object} args  - Optional parameters to customize the error
   * @param {ErrorDomain} [domain="general"] - The error domain
   * @param {string} [source="moonlight"] - The source of the error
   * @param {string} [code="GEN_000"] - The error code
   * @param {string} [message="Unexpected error"] - The error message
   * @param {string} [details="An unexpected error occurred"] - Additional details about the error
   * @param {BaseMeta} [meta] - Additional metadata for the error
   * @param {unknown} [cause] - The underlying cause of the error
   *
   * @returns A new instance of MoonlightError
   *
   */
  static unexpected(args?: {
    domain?: ErrorDomain;
    source?: string;
    code?: string;
    message?: string;
    details?: string;
    meta?: BaseMeta;
    cause?: unknown;
  }): MoonlightError {
    return new MoonlightError({
      domain: args?.domain ?? "general",
      source: args?.source ?? "@Moonlight",
      code: args?.code ?? GeneralErrorCode.UNEXPECTED_ERROR,
      message: args?.message ?? "Unexpected error",
      details: args?.details ?? "An unexpected error occurred",
      meta: { ...args?.meta, cause: args?.cause },
    });
  }

  /**
   *
   * @description Creates a MoonlightError from an unknown error.
   *
   * @param {unknown} error - The unknown error to convert
   * @param {Partial<MoonlightError<string, BaseMeta>>} ctx - Optional context to include in the error
   *
   * @returns {MoonlightError} A new instance of MoonlightError
   */
  static fromUnknown(
    error: unknown,
    ctx?: Partial<MoonlightError<string, BaseMeta>>
  ): MoonlightError {
    if (error instanceof MoonlightError) return error;
    if (error instanceof Error) {
      return new MoonlightError({
        domain: ctx?.domain ?? "general",
        source: ctx?.source ?? "@Moonlight",
        code: ctx?.code ?? GeneralErrorCode.UNKNOWN_ERROR,
        message: error.message,
        details: ctx?.details ?? error.stack,
        diagnostic: ctx?.diagnostic,
        meta: { ...ctx?.meta, cause: error },
      });
    }
    return MoonlightError.unexpected({ cause: error, ...ctx });
  }
}

export enum GeneralErrorCode {
  UNEXPECTED_ERROR = "GEN_000",
  UNKNOWN_ERROR = "GEN_001",
}

export const GEN_ERRORS = {
  [GeneralErrorCode.UNEXPECTED_ERROR]: MoonlightError,
  [GeneralErrorCode.UNKNOWN_ERROR]: MoonlightError,
};
