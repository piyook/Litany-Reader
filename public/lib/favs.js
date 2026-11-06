// Favourites: up to three litany ids, kept in a cookie in the order they were added.

export const MAX_FAVS = 3;

// The favourites in a document.cookie string. Anything unreadable counts as none.
export function parseFavs(cookie) {
  try {
    const m = cookie.match(/(?:^|;\s*)litany-favs=([^;]*)/);
    const a = m ? JSON.parse(decodeURIComponent(m[1])) : [];
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, MAX_FAVS) : [];
  } catch {
    return [];
  }
}

// The cookie that saves `favs` for a year.
export const favsCookie = (favs) =>
  `litany-favs=${encodeURIComponent(JSON.stringify(favs))}; Max-Age=31536000; Path=/; SameSite=Lax`;

// The list with `id` added or removed, or null when the limit stops it being added.
export function toggled(favs, id) {
  if (favs.includes(id)) return favs.filter((f) => f !== id);
  if (favs.length >= MAX_FAVS) return null;
  return [...favs, id];
}

// Favourites first, then the rest, each keeping the order of `items`.
export const favsFirst = (items, favs) => [
  ...items.filter((it) => favs.includes(it.id)),
  ...items.filter((it) => !favs.includes(it.id)),
];
