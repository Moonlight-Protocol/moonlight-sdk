# Copilot Code Generation Instructions

## Project Overview

This is the Moonlight SDK, a privacy-focused toolkit for blockchain development with special emphasis on Stellar Soroban smart contracts.

## Core Collaboration Guidelines

- Suggest better abstractions that make implementation simpler and more readable
- Prioritize readability and understandability as this is an SDK
- Manage complexity carefully, especially for protocol-specific business rules
- Avoid code bloat and unnecessary functions
- When suggesting significant changes, provide reasoning and seek confirmation first
- Always explain the rationale behind implementation approaches
- Keep unit tests in the same directory as the features they test
- Place integration tests in the test/integration folder
- Aim for elegant solutions that balance simplicity with correctness
- When in doubt about adding complexity, ask and explain potential value

## Code Style Guidelines

### General

- Use TypeScript for all code files
- Include appropriate JSDoc comments for functions and classes
- Use meaningful variable and function names
- Follow a functional programming style where appropriate

### Imports

- Always include file extensions in imports (e.g., `.ts`, `.js`)
- For Deno compatibility, use explicit file extensions in imports
- Order imports alphabetically: built-in modules, external dependencies, then local modules

### TypeScript

- Use explicit typing rather than implicit where possible
- Use interfaces for object shapes
- Use type guards and assertions appropriately
- Prefer readonly properties when objects shouldn't be modified
- Use undefined over null when possible
- All types must be placed in the types.ts file at the same directory
- All enums should be placed in their own files, also at the same directory as you would create it

### Error Handling

- Use async/await with try/catch for asynchronous code
- Provide meaningful error messages
- Use custom error classes when appropriate

### Testing

#### Unit Tests

- Write unit tests for all functionality
- Use descriptive test names that clearly indicate what's being tested
- Structure tests using Deno's nested test pattern:
  - Use `Deno.test()` with a single main test name for the class/module
  - Use `t.step()` for individual test cases within the module
  - Use descriptive step names in format "method/feature should behavior when condition"
- Group related test cases together under the main test
- Mock dependencies appropriately to isolate the unit under test
- Include setup/teardown code within the relevant test steps
- Use assertion functions from Deno standard library
- Create helper functions for repetitive test setup
- Keep unit tests in the same directory as the features they test

#### Integration Tests

- Place all integration tests in the test/integration folder
- Never use mocks in integration tests - use real components and features
- Test the interaction between multiple components
- Structure tests using Deno's nested test pattern similar to unit tests
- Use descriptive file names that indicate which features are being tested
- Include appropriate setup for real network/blockchain interactions
- Create comprehensive tests that cover complete workflows
- Document any external dependencies or requirements for running integration tests

### Blockchain-specific

- Always validate inputs before sending to the blockchain
- Handle network errors gracefully
- Provide appropriate logging for transactions
- Use Buffer for binary data handling
- Follow cryptographic best practices

## Architecture Patterns

- Use dependency injection where appropriate
- Separate concerns: data access, business logic, presentation
- Use factory patterns for object creation
- Keep modules small and focused

## Documentation

- Include usage examples in JSDoc comments
- Document public APIs thoroughly
- Explain complex algorithms or business logic in comments

## Deno-specific Guidelines

- Use Deno native APIs instead of Node.js APIs when possible
- Reference the deno.json import map for dependencies
- Ensure compatibility with Deno's permissions model
- Use TypeScript features fully supported by Deno

## Moonlight SDK Specifics

- Follow the established pattern for UTXO-based privacy components
- Maintain consistent API patterns across the SDK
- When implementing cryptographic functions, prioritize security over performance
- Include proper input validation for all public-facing APIs

## General Instructions:

- **No Placeholders**: Never include placeholder text in generated code or documentation.
- **Ask First**: Always ask for the necessary information to replace any potential placeholders before generating the content.
- **Use Provided Information**: Use the information provided by the user to fill in the details accurately.
- **Refer to Existing Files**: Before creating a new file, always check if an existing file can be modified to include the new content.
