import { describe, expect, it } from 'vitest';
import { hash, hiddenWords, levelOf, MEM_MAX, memKey } from '../public/lib/memorise.js';

const LINE = 'I must not fear. Fear is the mind-killer — it ends here.';

describe('memKey and levelOf', () => {
  it('keeps the short form apart from the long one', () => {
    expect(memKey('fear.txt', false)).toBe('fear.txt');
    expect(memKey('fear.txt', true)).toBe('fear.txt#short');
  });

  it('starts at level 1 and stays between 1 and the top level', () => {
    expect(levelOf({}, 'x')).toBe(1);
    expect(levelOf({ x: 3 }, 'x')).toBe(3);
    expect(levelOf({ x: 0 }, 'x')).toBe(1);
    expect(levelOf({ x: 99 }, 'x')).toBe(MEM_MAX);
    expect(levelOf({ x: 'junk' }, 'x')).toBe(1);
  });
});

describe('hash', () => {
  it('always gives the same unsigned number for the same text', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
    expect(hash('')).toBe(2166136261);
  });
});

describe('hiddenWords', () => {
  const words = LINE.split(/\s+/);
  const withLetters = words.filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

  it('hides a quarter, half, three quarters, then every word with letters', () => {
    for (let level = 1; level <= MEM_MAX; level++) {
      expect(hiddenWords(LINE, level).size).toBe(Math.ceil((withLetters * level) / MEM_MAX));
    }
  });

  it('never hides a word with no letters, such as a dash', () => {
    expect(hiddenWords(LINE, MEM_MAX).has(words.indexOf('—'))).toBe(false);
  });

  it('chooses the same words every time, and keeps them hidden at higher levels', () => {
    expect([...hiddenWords(LINE, 2)]).toEqual([...hiddenWords(LINE, 2)]);
    for (let level = 1; level < MEM_MAX; level++) {
      const higher = hiddenWords(LINE, level + 1);
      for (const i of hiddenWords(LINE, level)) expect(higher.has(i)).toBe(true);
    }
  });
});
