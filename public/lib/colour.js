// Colours as [r, g, b] arrays, and blends between them.

export const hexToRgb = (h) => {
  const hex = h.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
};
export const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const rgb = (c) => `rgb(${c.join(',')})`;
export const mix = (a, b, t) => rgb(lerp(a, b, t));
