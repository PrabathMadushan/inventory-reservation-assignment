import { toSafeInteger } from './safe-integer';

describe('Exact integer JSON serialization', () => {
  it('preserves zero, seeded prices, and the maximum safe value', () => {
    expect(toSafeInteger(0n)).toBe(0);
    expect(toSafeInteger(2500000n)).toBe(2500000);
    expect(toSafeInteger(9007199254740991n)).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([-1n, 9007199254740992n])(
    'rejects unsafe database value %s',
    (value) => {
      expect(() => toSafeInteger(value)).toThrow(RangeError);
    },
  );
});
