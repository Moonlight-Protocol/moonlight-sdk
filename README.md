# Moonlight SDK

**⚠️ Work in Progress ⚠️**

> This SDK is currently under active development for the Moonlight privacy protocol. Features and APIs are subject to change. Please use with caution and expect ongoing updates.

## Overview

The Moonlight SDK provides developers with the tools to deploy, manage, and interact with Moonlight privacy pools on the Stellar network using Soroban smart contracts. It simplifies the process of building applications that leverage the Moonlight protocol's privacy-preserving features, including standardized UTXO address derivation and seamless account management.

## Features

This SDK provides functionalities to:

- **Deploy & Manage Privacy Pools:** Set up and administer Moonlight privacy pool smart contracts on Stellar Soroban (`PoolEngine`).
- **Interact with Privacy Pools:** Deposit assets into, withdraw assets from, and query balances within deployed privacy pools (`PoolEngine`).
- **Derive Private UTXO Addresses:** Generate standardized UTXO key pairs based on a root secret, following the Moonlight protocol specifications (`Derivator`).
- **Manage UTXO-Based Accounts:** Seamlessly create and manage the state of UTXO-based accounts, tracking balances and statuses (FREE, UNSPENT, SPENT) (`UtxoBasedStellarAccount`).
- **Handle Privacy Transactions:** Facilitate the creation and submission of transactions for deposits and withdrawals involving private UTXOs.

## Contributing

We welcome contributions! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.
