/**
 * Asserts that the given condition is true.
 * Throws the provided error if the condition is false.
 *
 * @param condition - The condition to check
 * @param error - The error to throw if condition is false
 * @throws  The provided error if condition is false
 */
export function assert(condition: unknown, error: Error): asserts condition {
  if (!condition) {
    throw error;
  }
}
