export function toSafeInteger(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      'Database value cannot be represented as a safe nonnegative JSON integer.',
    );
  }
  return Number(value);
}
