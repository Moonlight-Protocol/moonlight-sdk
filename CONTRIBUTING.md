# Contributing to Moonlight SDK

Thank you for your interest in contributing to the Moonlight SDK! Here's how you can help:

## Reporting Issues

If you encounter a bug or have a feature request, please open an issue on [GitHub](https://github.com/Moonlight-Protocol/moonlight-sdk/issues).

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/Moonlight-Protocol/moonlight-sdk.git
   cd moonlight-sdk
   ```

2. Install dependencies:

   ```bash
   deno cache mod.ts
   ```

3. Run tests using the Deno tasks:
   - For **unit tests**, use:
     ```bash
     deno task test:unit
     ```
   - For **integration tests**, use:
     ```bash
     deno task test:integration
     ```

## Writing Tests

### Unit Tests

Unit tests are used to test individual functions or modules in isolation. They should mock any external dependencies to ensure the tests focus solely on the unit under test. Unit tests are located in the same directory as the features they test.

- Use Deno's `Deno.test()` with nested `t.step()` for organizing test cases.
- Mock dependencies to isolate the unit under test.
- Use descriptive test names in the format: `method/feature should behavior when condition`.

Example:

```typescript
// filepath: /path/to/feature.test.ts
Deno.test("FeatureName", async (t) => {
  await t.step("method should return correct value when input is valid", () => {
    // ...test implementation...
  });
});
```

### Integration Tests

Integration tests verify the interaction between multiple components and ensure they work together as expected. These tests do not use mocks and rely on real components. Integration tests are located in the `test/integration` folder.

- Test complete workflows or interactions between components.
- Use real network or blockchain interactions where applicable.
- Include setup and teardown logic to ensure a clean test environment.

Example:

```typescript
// filepath: /Users/fifo/Documents/moonlight/moonlight-sdk/test/integration/feature.integration.test.ts
Deno.test("Integration: FeatureName", async (t) => {
  await t.step("should complete workflow successfully", async () => {
    // ...test implementation...
  });
});
```

## Running Tests

To run tests, use the appropriate Deno task:

- **Unit Tests**: Run all unit tests using:

  ```bash
  deno task test:unit
  ```

- **Integration Tests**: Run all integration tests using:
  ```bash
  deno task test:integration
  ```

For debugging or verbose output, modify the task in `deno.json` to include the `--log-level=debug` flag or run the command manually.

## Submitting Changes

1. Fork the repository and create a new branch for your changes.
2. Make your changes and ensure all tests pass by running:
   ```bash
   deno task test:unit
   deno task test:integration
   ```
3. Submit a pull request with a clear description of your changes.
