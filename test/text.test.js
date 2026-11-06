import { describe, expect, it } from 'vitest';
import { buildParts, charCount, hasLetter, letterRange, pauseStrength, splitText } from '../public/lib/text.js';

describe('pauseStrength', () => {
  it('ranks full stops above semicolons and dashes, above commas, above nothing', () => {
    expect(pauseStrength('end.')).toBe(3);
    expect(pauseStrength('why?')).toBe(3);
    expect(pauseStrength('said."')).toBe(3);
    expect(pauseStrength('this;')).toBe(2);
    expect(pauseStrength('this—')).toBe(2);
    expect(pauseStrength('this,')).toBe(1);
    expect(pauseStrength('this')).toBe(0);
  });
});

describe('splitText', () => {
  it('leaves a line within the limit whole, tidying its spaces', () => {
    expect(splitText('  one   two three ', 5)).toEqual(['one two three']);
  });

  it('breaks at the strongest pause, even when a weaker one is nearer the middle', () => {
    expect(splitText('one two three. four five, six seven eight nine ten', 6)).toEqual([
      'one two three.',
      'four five, six seven eight nine ten',
    ]);
  });

  it('prefers the pause nearest the middle when two are as strong', () => {
    expect(splitText('a b c, d e f g, h i j k l', 8)).toEqual(['a b c, d e f g,', 'h i j k l']);
  });

  it('never leaves a part shorter than three words', () => {
    expect(splitText('one two. three four five six seven', 4)).toEqual(['one two. three four five six seven']);
  });

  it('leaves a long line with no pause whole', () => {
    const line = 'a b c d e f g h i j';
    expect(splitText(line, 4)).toEqual([line]);
  });

  it('keeps splitting until every part fits, where it can', () => {
    expect(splitText('a b c. d e f. g h i. j k l.', 3)).toEqual(['a b c.', 'd e f.', 'g h i.', 'j k l.']);
  });
});

describe('charCount and hasLetter', () => {
  it('counts characters without spaces, a surrogate pair as one', () => {
    expect(charCount('a b  c')).toBe(3);
    expect(charCount('𝔸 b')).toBe(2);
  });

  it('finds letters and digits in any script, not punctuation', () => {
    expect(hasLetter('é')).toBe(true);
    expect(hasLetter('7')).toBe(true);
    expect(hasLetter('—,.')).toBe(false);
  });
});

describe('buildParts', () => {
  it('gives one step per line when not splitting', () => {
    expect(buildParts(['One two.', 'Three'], 0)).toEqual({
      lines: ['One two.', 'Three'],
      partSrc: [0, 1],
      partStart: [0, 0],
      partLen: [7, 5],
      partWord: [0, 0],
    });
  });

  it('records where each part of a split line starts, in characters and words', () => {
    const p = buildParts(['a b c. d e f'], 3);
    expect(p.lines).toEqual(['a b c.', 'd e f']);
    expect(p.partSrc).toEqual([0, 0]);
    expect(p.partStart).toEqual([0, 4]);
    expect(p.partLen).toEqual([4, 3]);
    expect(p.partWord).toEqual([0, 3]);
  });
});

describe('letterRange', () => {
  it('skips punctuation at either end', () => {
    expect(letterRange([...'"Fear,"'])).toEqual([1, 4]);
  });

  it('is empty for a word with no letters', () => {
    const [a, b] = letterRange([...'—']);
    expect(b).toBeLessThan(a);
  });
});
