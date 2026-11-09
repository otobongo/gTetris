import { describe, expect, it } from 'vitest';
import { openSeed } from './LettersApp';

describe('openSeed (the seed a Letter Builder level opens with)', () => {
  const fresh = 999;

  it('starts a fresh run with a new seed', () => {
    expect(openSeed(null, 'letters:1:5-6', fresh)).toBe(fresh);
  });

  it('keeps the stored seed when the set is unchanged', () => {
    expect(openSeed({ set: 'letters:1:5-6', seed: 42 }, 'letters:1:5-6', fresh)).toBe(42);
  });

  it('keeps the stored seed on a band change, so solved puzzles stay put', () => {
    expect(openSeed({ set: 'letters:1:5-6', seed: 42 }, 'letters:1:7-8', fresh)).toBe(42);
  });

  it('takes a new seed after a set version bump, like the kit games', () => {
    expect(openSeed({ set: 'letters:1:5-6', seed: 42 }, 'letters:2:5-6', fresh)).toBe(fresh);
  });

  it('takes a new seed when the version bump comes with a band change', () => {
    expect(openSeed({ set: 'letters:1:5-6', seed: 42 }, 'letters:2:7-8', fresh)).toBe(fresh);
  });
});
