export function traverseObjectLog(
  // deno-lint-ignore no-explicit-any
  obj: any,
  options: { maxDepth?: number; nodeThreshold?: number } = {},
  currentDepth: number = 0,
): void {
  const { maxDepth = Infinity, nodeThreshold = Infinity } = options;

  // If we've reached the maximum depth, log the value and stop recursing.
  if (currentDepth === maxDepth) {
    console.log(
      " ".repeat(currentDepth * 2) + `Max depth reached. Value:`,
      obj,
    );
    return;
  }

  // If the current value is not an object, just log it.
  if (typeof obj !== "object" || obj === null) {
    console.log(" ".repeat(currentDepth * 2) + obj);
    return;
  }

  // Get the keys of the object.
  const keys = Object.keys(obj);

  // If the number of keys exceeds the threshold, log the count and return.
  if (keys.length > nodeThreshold) {
    console.log(
      " ".repeat(currentDepth * 2) + `Branch has ${keys.length} nodes`,
    );
    return;
  }

  // Otherwise, log each key and recursively traverse its value.
  for (const key of keys) {
    console.log(" ".repeat(currentDepth * 2) + key, obj[key]);
    traverseObjectLog(obj[key], options, currentDepth + 1);
  }
}
