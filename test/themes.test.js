import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveTheme, THEMES } from '../public/lib/themes.js';

const ids = THEMES.map((t) => t.id);
const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');

describe('themes', () => {
  it('has six themes, Dusk first', () => {
    expect(ids).toEqual(['dusk', 'dawn', 'midnight', 'forest', 'parchment', 'ember']);
    expect(THEMES.every((t) => t.name)).toBe(true);
  });

  it('keeps a saved theme', () => {
    for (const id of ids) expect(resolveTheme(id)).toBe(id);
    expect(resolveTheme('ember', true)).toBe('ember');
  });

  it('maps the names saved before themes existed', () => {
    expect(resolveTheme('dark')).toBe('dusk');
    expect(resolveTheme('light')).toBe('dawn');
  });

  it('starts on Dusk, or Dawn on a light system, when nothing usable is saved', () => {
    for (const bad of [null, undefined, '', 'neon']) {
      expect(resolveTheme(bad)).toBe('dusk');
      expect(resolveTheme(bad, true)).toBe('dawn');
    }
  });

  it('has the same ids in the page head script and in style.css', () => {
    const head = read('index.html').match(/\[((?:'[a-z]+',?\s*)+)\]\.includes\(t\)/)?.[1];
    expect(head?.match(/[a-z]+/g)).toEqual(ids);
    const css = read('style.css');
    for (const id of ids) expect(css).toContain(`[data-theme="${id}"]`);
  });
});
