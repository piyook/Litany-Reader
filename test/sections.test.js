import { describe, expect, it } from 'vitest';
import { indexSections, showAuthors, splitTitle } from '../public/lib/sections.js';

describe('splitTitle', () => {
  it.each([
    ['Litany Against Fear', 'Litany Against', 'Fear', 'against'],
    ['Litany against Self-Criticism', 'Litany against', 'Self-Criticism', 'against'],
    ['Litany for Calm', 'Litany for', 'Calm', 'toward'],
    ['Litany of Gratitude', 'Litany of', 'Gratitude', 'toward'],
  ])('splits "%s"', (title, prefix, key, group) => {
    expect(splitTitle(title)).toEqual({ prefix, key, group });
  });

  it.each(['The Bene Gesserit Litany', 'Litany', 'Litany for', 'Litany Fortitude'])(
    'keeps "%s" whole, under More',
    (title) => {
      expect(splitTitle(title)).toEqual({ prefix: '', key: title, group: 'more' });
    },
  );
});

describe('indexSections', () => {
  const items = [
    { id: 'a', title: 'Litany Against Anxiety' },
    { id: 'b', title: 'Litany Against Fear' },
    { id: 'c', title: 'Litany for Calm' },
    { id: 'd', title: 'Litany of Gratitude' },
    { id: 'e', title: 'Morning Words' },
  ];
  const shape = (secs) => secs.map((s) => [s.key, s.label, s.items.map((it) => it.id)]);

  it('groups by title, favourites first and also left in their group, keeping the order', () => {
    expect(shape(indexSections(items, ['d', 'b']))).toEqual([
      ['fav', 'Favourites', ['b', 'd']],
      ['against', 'Holding steady', ['a', 'b']],
      ['toward', 'Every day', ['c', 'd']],
      ['more', 'More', ['e']],
    ]);
  });

  it('leaves out empty sections', () => {
    expect(shape(indexSections(items.slice(0, 2), []))).toEqual([['against', 'Holding steady', ['a', 'b']]]);
  });

  it('calls the list "Litanies" when no title matches the usual forms', () => {
    const plain = [
      { id: 'x', title: 'Alpha' },
      { id: 'y', title: 'Beta' },
    ];
    expect(shape(indexSections(plain, ['y']))).toEqual([
      ['fav', 'Favourites', ['y']],
      ['more', 'Litanies', ['x', 'y']],
    ]);
  });
});

describe('showAuthors', () => {
  it('hides author tags when every litany has the same author', () => {
    expect(showAuthors([{ author: 'Jo' }, { author: 'Jo' }])).toBe(false);
    expect(showAuthors([{ author: '' }, {}])).toBe(false);
  });

  it('shows them when the authors differ', () => {
    expect(showAuthors([{ author: 'Jo' }, { author: 'Sam' }])).toBe(true);
    expect(showAuthors([{ author: 'Jo' }, { author: '' }])).toBe(true);
  });
});
