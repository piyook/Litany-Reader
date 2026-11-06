// Settings kept in the browser's localStorage. Storage can be missing or
// refuse (private windows, storage turned off), so each call falls back quietly.

const store = () => globalThis.localStorage;

export function read(key) {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}

export function save(key, value) {
  try {
    store().setItem(key, value);
  } catch {}
}

export const readFlag = (key) => read(key) === '1';
export const saveFlag = (key, on) => save(key, on ? '1' : '0');

// A saved object, or `fallback` when there is none or it can not be read.
export function readObject(key, fallback) {
  try {
    const v = JSON.parse(read(key) || 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export const saveObject = (key, value) => save(key, JSON.stringify(value));
