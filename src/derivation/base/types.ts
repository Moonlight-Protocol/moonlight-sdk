/**
 * Represents a plaintext derivation seed composed of context, root, and index
 */
export type PlainDerivationSeed<
  C extends string,
  R extends string,
  I extends string
> = `${C}${R}${I}`;

/**
 * Derivation seed after hashing
 */
export type DerivationSeed = Uint8Array;

/**
 * Sequence index for derivation, typically representing UTXO index
 */
export type SequenceIndex = `${number}`;

/**
 * Basic structure for derivation context components
 */
export interface DerivationComponents<
  C extends string,
  R extends string,
  I extends string
> {
  context: C;
  root: R;
  index: I;
}

/**
 * Parameters for creating a derivation seed
 */
export interface DerivationSeedParams<
  C extends string,
  R extends string,
  I extends string
> {
  context: C;
  root: R;
  index: I;
}
