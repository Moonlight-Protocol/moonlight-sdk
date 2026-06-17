# Moonlight SDK

**⚠️ Work in Progress ⚠️**

> This SDK is currently under active development for the Moonlight privacy
> protocol. Features and APIs are subject to change. Please use with caution and
> expect ongoing updates.

## Overview

The Moonlight SDK provides developers with the tools to deploy, manage, and
interact with Moonlight privacy pools on the Stellar network using Soroban smart
contracts. It simplifies the process of building applications that leverage the
Moonlight protocol's privacy-preserving features, including standardized UTXO
address derivation and seamless account management.

## Features

This SDK provides functionalities to:

- **Deploy & Manage Privacy Pools:** Set up and administer Moonlight privacy
  pool smart contracts on Stellar Soroban (`PoolEngine`).
- **Interact with Privacy Pools:** Deposit assets into, withdraw assets from,
  and query balances within deployed privacy pools (`PoolEngine`).
- **Derive Private UTXO Addresses:** Generate standardized UTXO key pairs based
  on a root secret, following the Moonlight protocol specifications
  (`Derivator`).
- **Manage UTXO-Based Accounts:** Seamlessly create and manage the state of
  UTXO-based accounts, tracking balances and statuses (FREE, UNSPENT, SPENT)
  (`UtxoBasedStellarAccount`).
- **Handle Privacy Transactions:** Facilitate the creation and submission of
  transactions for deposits and withdrawals involving private UTXOs.

## Running tests

- **`deno task test:unit`** — unit tests only (`*.unit.test.ts`). No network or
  running stack required; fully deterministic. This is the fast inner loop and
  what to run while developing.
- **`deno task test:integration`** / **`deno task test`** (the latter is what CI
  runs) — also runs the `*.integration.test.ts` suites. These deploy contracts
  to and transact on **public Stellar testnet** (`NetworkConfig.TestNet()`);
  there is **no local-stack override** today, so they require outbound network
  access and Friendbot funding. Because they hit shared public testnet, the
  transaction-submit step can intermittently fail
  (`ColibriError STX_002:
  Failed to send transaction`) when the network is
  congested — re-run before treating it as a real failure.

The bundled contract WASMs under `test/contracts/` are the artifacts the
integration tests deploy; refresh them from the matching `soroban-core` release
whenever the contracts change (see the channel-auth method map in
`src/channel-auth/constants.ts`).

## Contributing

We welcome contributions! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file
for guidelines on how to contribute to this project.
