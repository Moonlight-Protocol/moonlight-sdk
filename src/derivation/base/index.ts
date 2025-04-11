import { deriveP256KeyPairFromSeed } from "../../utils/secp256r1/deriveP256KeyPairFromSeed.ts";

/**
 * Generates a plain text seed by concatenating context, root, and index
 * @param context - The context where the seed will be used (e.g., network identifier)
 * @param root - The root secret (e.g., account secret key)
 * @param index - The index/variant identifier (e.g., UTXO index)
 * @returns Concatenated seed string
 */
export function generatePlainTextSeed<
  C extends string,
  R extends string,
  I extends string
>(context: C, root: R, index: I): `${C}${R}${I}` {
  return `${context}${root}${index}`;
}

/**
 * Hashes a plaintext seed using SHA-256
 * @param plainTextSeed - The plaintext seed string to hash
 * @returns Hashed seed as Uint8Array
 */
export async function hashSeed<Seed extends string>(
  plainTextSeed: Seed
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(plainTextSeed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataUint8);
  return new Uint8Array(hashBuffer);
}

/**
 * BaseDerivator provides core derivation functionality for generating deterministic keypairs.
 * This class implements a builder pattern for constructing derivators with the necessary context.
 *
 * @typeParam Context - Type for the derivation context (typically a network identifier)
 * @typeParam Root - Type for the derivation root (typically a seed or master key)
 * @typeParam Index - Type for the derivation index (typically a numeric string)
 */
export class BaseDerivator<
  Context extends string = string,
  Root extends string = string,
  Index extends string = string
> {
  protected _context?: Context;
  protected _root?: Root;

  /**
   * Sets the derivation context for this derivator
   *
   * @param context - The context to use for derivation
   * @returns The derivator instance for method chaining
   *
   * @example
   * ```typescript
   * const derivator = new BaseDerivator().withContext("stellar:pubnet");
   * ```
   */
  withContext(context: Context): this {
    if (this._context !== undefined) {
      throw Error("Context has already been set");
    }
    this._context = context;
    return this;
  }

  /**
   * Sets the derivation root for this derivator
   *
   * @param root - The root value to derive from
   * @returns The derivator instance for method chaining
   *
   * @example
   * ```typescript
   * const derivator = new BaseDerivator().withRoot("S123...");
   * ```
   */
  withRoot(root: Root): this {
    if (this._root !== undefined) {
      throw Error("Root has already been set");
    }
    this._root = root;
    return this;
  }

  /**
   * Assembles a plaintext seed by combining context, root, and index
   *
   * @param context - The context for the seed
   * @param root - The root value for the seed
   * @param index - The index for the seed
   * @returns A plaintext seed string
   *
   * @example
   * ```typescript
   * const seed = derivator.assembleSeed("stellar:pubnet", "S123...", "0");
   * ```
   */
  assembleSeed(index: Index): `${Context}${Root}${Index}` {
    this.assertConfigured();

    return generatePlainTextSeed(this._context!, this._root!, index);
  }

  /**
   *
   *  Hashes a plaintext seed using SHA-256
   * @param index - The index to derive at
   * @returns A hashed seed as Uint8Array
   *
   * @example
   * ```typescript
   * const hashedSeed = await derivator.hashSeed("0");
   * ```
   */
  async hashSeed(index: Index): Promise<Uint8Array> {
    this.assertConfigured();

    const seed = this.assembleSeed(index);
    return await hashSeed(seed);
  }

  /**
   * Derives a keypair at the specified index
   *
   * @param index - The index to derive at
   * @returns Promise resolving to a keypair with public and private keys
   * @throws Error if the derivator is not properly configured
   *
   * @example
   * ```typescript
   * const keypair = await derivator
   *   .withContext("stellar:pubnet")
   *   .withRoot("S123...")
   *   .deriveKeypair("0");
   * ```
   */
  async deriveKeypair(
    index: Index
  ): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    this.assertConfigured();

    const seed = this.assembleSeed(index);
    const hashedSeed = await hashSeed(seed);
    return deriveP256KeyPairFromSeed(hashedSeed);
  }

  /**
   * Gets the current context value
   *
   * @returns The current context or undefined if not set
   *
   * @example
   * ```typescript
   * const context = derivator.getContext();
   * ```
   */
  getContext(): Context {
    if (this._context === undefined) {
      throw Error("Context is required but has not been set");
    }
    return this._context;
  }

  /**
   * Checks if the derivator is fully configured and ready to derive keypairs
   *
   * @returns boolean indicating if the derivator has all required properties
   *
   * @example
   * ```typescript
   * if (derivator.isConfigured()) {
   *   // safe to derive keypairs
   * }
   * ```
   */
  isConfigured(): boolean {
    return !!this._context && !!this._root;
  }

  /**
   * Checks if the derivator is fully configured and throws an error if not
   *
   * @throws Error if the derivator is not properly configured
   */
  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        "Derivator is not properly configured: missing context or root"
      );
    }
  }
}
