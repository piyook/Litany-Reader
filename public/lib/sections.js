// The index, in sections: favourites first (always open), then litanies grouped
// by how their title starts, so new litanies find their own place.

// "Litany against …" goes under Holding steady, "Litany for / of …" under Every day,
// anything else under More.
const GROUPS = [
  { key: 'against', label: 'Holding steady' },
  { key: 'toward', label: 'Every day' },
  { key: 'more', label: 'More' },
];

// "Litany Against Fear" → { prefix: 'Litany Against', key: 'Fear', group: 'against' }.
// A title in another form is all key, with no prefix.
export function splitTitle(title) {
  const m = title.match(/^(litany\s+(against|for|of))\s+(\S.*)$/i);
  if (!m) return { prefix: '', key: title, group: 'more' };
  return { prefix: m[1], key: m[3], group: m[2].toLowerCase() === 'against' ? 'against' : 'toward' };
}

// The sections to show, each { key, label, items }, leaving out empty ones.
// A favourite shows under Favourites and in its own group too. When nothing
// matches the usual titles, the one remaining section is just "Litanies".
export function indexSections(items, favs) {
  const sections = [{ key: 'fav', label: 'Favourites', items: items.filter((it) => favs.includes(it.id)) }];
  for (const g of GROUPS) sections.push({ ...g, items: items.filter((it) => splitTitle(it.title).group === g.key) });
  const shown = sections.filter((s) => s.items.length);
  if (!shown.some((s) => s.key === 'against' || s.key === 'toward')) {
    for (const s of shown) if (s.key === 'more') s.label = 'Litanies';
  }
  return shown;
}

// Author tags only help when the litanies are not all by the same person.
export const showAuthors = (items) => new Set(items.map((it) => it.author || '')).size > 1;
