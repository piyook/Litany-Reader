// The colour themes. The colours themselves live in style.css, one block per id;
// this is the list shown in the theme picker, and the rule for which one to start on.
// The <head> script in index.html repeats the ids so it can set the theme before
// the first paint: a test keeps the two lists the same.

export const THEMES = [
  { id: 'dusk', name: 'Dusk' },
  { id: 'dawn', name: 'Dawn' },
  { id: 'midnight', name: 'Midnight' },
  { id: 'forest', name: 'Forest' },
  { id: 'parchment', name: 'Parchment' },
  { id: 'ember', name: 'Ember' },
];

const DEFAULT_THEME = 'dusk';
// Before themes there were two, saved as "dark" and "light".
const OLD_NAMES = { dark: 'dusk', light: 'dawn' };

// The theme to use: the saved one, else Dawn on a system set to light, else Dusk.
export function resolveTheme(saved, systemIsLight = false) {
  const id = OLD_NAMES[saved] ?? saved;
  if (THEMES.some((t) => t.id === id)) return id;
  return systemIsLight ? 'dawn' : DEFAULT_THEME;
}
