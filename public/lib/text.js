// Text helpers: splitting long lines into breaths, and counting letters.

const MIN_PART = 3; // never leave a part shorter than this many words

// How strong a pause a word ends on: 3 for . ! ? then 2 for ; : — then 1 for a comma.
export const pauseStrength = (w) => (/[.!?]["'”’)\]]*$/.test(w) ? 3 : /[;:—–]$/.test(w) ? 2 : /,$/.test(w) ? 1 : 0);

// A line longer than `max` words is broken at its strongest pause nearest the
// middle, again and again, so each part fits one breath.
export function splitText(text, max) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return [words.join(' ')];
  let best = -1,
    bestScore = -Infinity;
  for (let i = MIN_PART - 1; i < words.length - MIN_PART; i++) {
    const s = pauseStrength(words[i]);
    if (!s) continue;
    const score = s * 100 - Math.abs(i + 1 - words.length / 2);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) return [words.join(' ')]; // no natural pause: leave it whole
  return [...splitText(words.slice(0, best + 1).join(' '), max), ...splitText(words.slice(best + 1).join(' '), max)];
}

export const charCount = (t) => [...t.replace(/\s+/g, '')].length;
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;
export const hasLetter = (s) => /[\p{L}\p{N}]/u.test(s);

// The steps the reader shows, from the lines as written. With `maxWords` 0 each
// line is one step. For step k, partSrc[k] is its source line, partStart[k] and
// partLen[k] its slice of that line's characters (spaces left out), and
// partWord[k] the position of its first word in the line.
export function buildParts(src, maxWords) {
  const parts = { lines: [], partSrc: [], partStart: [], partLen: [], partWord: [] };
  src.forEach((text, r) => {
    let start = 0,
      word = 0;
    for (const part of maxWords ? splitText(text, maxWords) : [text]) {
      const len = charCount(part);
      parts.lines.push(part);
      parts.partSrc.push(r);
      parts.partStart.push(start);
      parts.partLen.push(len);
      parts.partWord.push(word);
      start += len;
      word += wordCount(part);
    }
  });
  return parts;
}

// The first and last letter of a word's characters, so punctuation around a
// hidden word stays visible. [a, b] with b < a when there are no letters.
export function letterRange(chs) {
  let a = 0,
    b = chs.length - 1;
  while (a <= b && !hasLetter(chs[a])) a++;
  while (b >= a && !hasLetter(chs[b])) b--;
  return [a, b];
}
