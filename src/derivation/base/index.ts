import { assert } from "../../utils/assert/index.ts";
import { deriveP256KeyPairFromSeed } from "../../utils/secp256r1/deriveP256KeyPairFromSeed.ts";
import * as E from "../error.ts";
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

  //==========================================
  // Meta Requirement Methods
  //==========================================

  private requireNo(arg: "context" | "root"): void {
    assert(
      this[`_${arg}`] === undefined,
      new E.PROPERTY_ALREADY_SET(arg, this[`_${arg}`] as string)
    );
  }

  private requireNoContext(): void {
    this.requireNo("context");
  }

  private requireNoRoot(): void {
    this.requireNo("root");
  }

  /**
   * Internal helper method to safely retrieve required properties.
   * Uses method overloading to provide type-safe access to private fields.
   *
   * @param arg - The name of the property to retrieve
   * @returns The value of the requested property
   * @throws {Error} If the requested property is not set
   * @private
   */
  private require(arg: "context"): Context;
  private require(arg: "root"): Root;
  private require(arg: "context" | "root"): Context | Root {
    if (this[`_${arg}`]) return this[`_${arg}`] as Context | Root;
    throw new E.PROPERTY_NOT_SET(arg);
  }

  //==========================================
  // Getter Methods
  //==========================================

  /**
   * Returns the derivation context (e.g., network identifier)
   *
   * @returns The derivation context
   * @throws {Error} If the context is not set (should never happen with factory methods)
   *
   * @example
   * ```typescript
   * const context = derivator.getContext();
   * ```
   */
  public getContext(): Context {
    return this.require("context");
  }

  private getRoot(): Root {
    return this.require("root");
  }

  public isSet(arg: "context" | "root"): boolean {
    return this[`_${arg}`] !== undefined;
  }

  //========

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
    this.requireNoContext();

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
    this.requireNoRoot();

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
    return generatePlainTextSeed(this.getContext(), this.getRoot(), index);
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
    const seed = this.assembleSeed(index);
    const hashedSeed = await hashSeed(seed);
    return deriveP256KeyPairFromSeed(hashedSeed);
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
    return this.isSet("context") && this.isSet("root");
  }
}
