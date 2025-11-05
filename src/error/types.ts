export type ErrorDomain = "derivation" | "general" | "utxo-keypair";

export type BaseMeta = {
  cause?: unknown; // chained errors
  data?: unknown; // domain-specific payload
};

export interface MoonlightErrorShape<
  Code extends string,
  Meta extends BaseMeta
> {
  domain: ErrorDomain;
  code: Code; // ex: "CC_001"
  message: string;
  source: string; // ex: "@Moonlight-sdk/core"
  details?: string;
  diagnostic?: Diagnostic;
  meta?: Meta;
}

export type Diagnostic = {
  rootCause: string;
  suggestion: string;
  materials?: string[];
};
