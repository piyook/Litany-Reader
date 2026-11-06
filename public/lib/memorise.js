// Learn by heart: hides a share of the words. Level 1 hides a quarter, 2 half,
// 3 three quarters, 4 all. Levels are kept per litany and per form. The same
// words are chosen every time, and a word hidden at one level stays hidden at
// the higher ones.
import { hasLetter } from './text.js';

export const MEM_MAX = 4;
export const MEM_PILL = ['', 'Hide 25%', 'Hide 50%', 'Hide 75%', 'Hide all'];
export const MEM_TOAST = ['', 'a quarter of the words', 'half the words', 'three quarters of the words', 'every word'];

export const memKey = (id, short) => id + (short ? '#short' : '');
export const levelOf = (levels, key) => Math.min(MEM_MAX, Math.max(1, parseInt(levels[key], 10) || 1));

// A fixed shuffle: the same text always gives the same number.
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The positions of the words in `text` to hide at `level`.
export function hiddenWords(text, level) {
  const words = text.split(/\s+/);
  const order = words
    .map((_, i) => i)
    .filter((i) => hasLetter(words[i]))
    .sort((a, b) => hash(`${text}|${a}`) - hash(`${text}|${b}`));
  return new Set(order.slice(0, Math.ceil((order.length * level) / MEM_MAX)));
}
