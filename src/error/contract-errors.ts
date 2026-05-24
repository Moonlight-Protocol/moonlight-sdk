import {
  type ContractPipelinePlugins,
  createContractErrorMatcherPlugin,
  type KnownContractErrorMap,
} from "@colibri/core";

export const MoonlightContractError = {
  1000: {
    message: "BadArg",
    details:
      "An authorization payload or contract argument could not be decoded into the expected shape.",
  },
  1001: {
    message: "UnexpectedVariant",
    details:
      "A value used during authorization matched a type family but not one of the supported variants.",
  },
  1002: {
    message: "MissingSignature",
    details:
      "A required signature for an authorization signer was not provided.",
  },
  1003: {
    message: "ExtraSignature",
    details:
      "More signatures were provided than the authorization context accepts.",
  },
  1004: {
    message: "InvalidSignatureFormat",
    details:
      "A signature entry could not be parsed as a supported authorization signature shape.",
  },
  1005: {
    message: "UnsupportedSignatureFormat",
    details:
      "A signature entry was well-formed but used a signature format this protocol does not support.",
  },
  1006: {
    message: "MismatchedContract",
    details:
      "A signature or authorization context was produced for a different contract than the one being checked.",
  },
  1007: {
    message: "UnsupportedSigner",
    details: "A signer kind is not supported by this authorization path.",
  },
  1008: {
    message: "NoConditions",
    details: "Authorization was requested without any conditions to evaluate.",
  },
  1009: {
    message: "UnexpectedContext",
    details:
      "The authorization context did not match the invocation shape expected by the checker.",
  },
  1010: {
    message: "SignatureExpired",
    details:
      "A signature was valid structurally but expired before the current ledger.",
  },
  1011: {
    message: "ProviderThresholdNotMet",
    details: "The configured provider-signature threshold was not met.",
  },
  1012: {
    message: "ProviderAlreadyRegistered",
    details: "The provider account is already registered.",
  },
  1013: {
    message: "ProviderNotRegistered",
    details: "The provider account is not registered.",
  },
  2000: {
    message: "UtxoAlreadyExists",
    details:
      "A UTXO creation attempted to write an output identifier that already exists.",
  },
  2001: {
    message: "UtxoDoesNotExist",
    details:
      "A UTXO spend referenced an output identifier that does not exist.",
  },
  2002: {
    message: "UtxoAlreadySpent",
    details: "A UTXO spend referenced an output that has already been spent.",
  },
  2003: {
    message: "UnbalancedBundle",
    details:
      "The transaction bundle does not balance its inputs, deposits, creates, spends, and withdrawals.",
  },
  2004: {
    message: "InvalidCreateAmount",
    details: "A UTXO creation amount must be greater than zero.",
  },
  2005: {
    message: "RepeatedCreateUtxo",
    details:
      "The same UTXO identifier appears more than once in the create set.",
  },
  2006: {
    message: "RepeatedSpendUtxo",
    details:
      "The same UTXO identifier appears more than once in the spend set.",
  },
  2007: {
    message: "UtxoNotFound",
    details: "A requested UTXO could not be found in storage.",
  },
  2008: {
    message: "AuthContractNotSet",
    details:
      "The UTXO module cannot authorize transactions because no authorization contract is configured.",
  },
  3000: {
    message: "RepeatedAccountForDeposit",
    details: "The same account appears more than once in the deposit list.",
  },
  3001: {
    message: "RepeatedAccountForWithdraw",
    details: "The same account appears more than once in the withdraw list.",
  },
  3002: {
    message: "ConflictingConditionsForAccount",
    details:
      "A single account has conflicting deposit, withdraw, or condition requirements in the bundle.",
  },
  3003: {
    message: "AmountOverflow",
    details:
      "An amount calculation exceeded the maximum supported integer value.",
  },
  3004: {
    message: "BundleHasConflictingConditions",
    details:
      "The bundle contains conditions that cannot all be satisfied together.",
  },
  3005: {
    message: "AmountUnderflow",
    details:
      "An amount calculation went below the minimum supported integer value.",
  },
  4000: {
    message: "NotEd25519AccountAddress",
    details:
      "An address payload was expected to be an Ed25519 account address but was not.",
  },
  4001: {
    message: "UnsupportedAddressPayload",
    details: "The address payload type is not supported by this helper.",
  },
} satisfies KnownContractErrorMap;

export function createMoonlightContractErrorPlugins(): ContractPipelinePlugins {
  return {
    invokePipe: [createContractErrorMatcherPlugin(MoonlightContractError)],
    readPipe: [createContractErrorMatcherPlugin(MoonlightContractError)],
  };
}
