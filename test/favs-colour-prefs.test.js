import { afterEach, describe, expect, it, vi } from 'vitest';
import { hexToRgb, lerp, mix, rgb } from '../public/lib/colour.js';
import { favsCookie, favsFirst, MAX_FAVS, parseFavs, toggled } from '../public/lib/favs.js';
import { read, readFlag, readObject, save, saveFlag, saveObject } from '../public/lib/prefs.js';

describe('favourites', () => {
  it('reads the list back from the cookie it writes', () => {
    const cookie = `theme=dark; ${favsCookie(['a.txt', 'b c.txt']).split(';')[0]}`;
    expect(parseFavs(cookie)).toEqual(['a.txt', 'b c.txt']);
  });

  it('keeps the cookie for a year', () => {
    expect(favsCookie([])).toContain('Max-Age=31536000');
  });

  it('treats a missing or broken cookie as no favourites, and drops anything odd', () => {
    expect(parseFavs('')).toEqual([]);
    expect(parseFavs('litany-favs=%7Bnot-json')).toEqual([]);
    expect(parseFavs(`litany-favs=${encodeURIComponent('{"a":1}')}`)).toEqual([]);
    expect(parseFavs(`litany-favs=${encodeURIComponent('["a",2,"b","c","d"]')}`)).toEqual(['a', 'b', 'c']);
  });

  it('adds and removes, and refuses a fourth', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggled(['a', 'b', 'c'], 'd')).toBeNull();
    expect(MAX_FAVS).toBe(3);
  });

  it('puts favourites first, each group in its own order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(favsFirst(items, ['c', 'b']).map((it) => it.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('colour', () => {
  it('reads hex colours from CSS, spaces and all', () => {
    expect(hexToRgb(' #ff8000')).toEqual([255, 128, 0]);
  });

  it('blends between two colours', () => {
    expect(lerp([0, 0, 0], [100, 200, 255], 0.5)).toEqual([50, 100, 128]);
    expect(mix([0, 0, 0], [10, 20, 30], 1)).toBe('rgb(10,20,30)');
    expect(rgb([1, 2, 3])).toBe('rgb(1,2,3)');
  });
});

describe('prefs', () => {
  afterEach(() => vi.unstubAllGlobals());

  const memoryStore = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
  };

  it('saves and reads flags, text and objects', () => {
    vi.stubGlobal('localStorage', memoryStore());
    saveFlag('on', true);
    saveFlag('off', false);
    save('word', 'hello');
    saveObject('obj', { a: 1 });
    expect(readFlag('on')).toBe(true);
    expect(readFlag('off')).toBe(false);
    expect(readFlag('missing')).toBe(false);
    expect(read('word')).toBe('hello');
    expect(readObject('obj', {})).toEqual({ a: 1 });
  });

  it('falls back when an object is missing, broken or not an object', () => {
    vi.stubGlobal('localStorage', memoryStore());
    const fallback = { x: 1 };
    expect(readObject('none', fallback)).toBe(fallback);
    save('bad', '{oops');
    expect(readObject('bad', fallback)).toBe(fallback);
    saveObject('list', [1, 2]);
    expect(readObject('list', fallback)).toBe(fallback);
  });

  it('carries on quietly when storage refuses', () => {
    const refuse = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse });
    expect(() => save('a', '1')).not.toThrow();
    expect(read('a')).toBeNull();
    expect(readFlag('a')).toBe(false);
    expect(readObject('a', 'fb')).toBe('fb');
  });
});
