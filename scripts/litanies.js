// Reading and parsing litany .txt files. Used by the server and by the static build.
const fs = require('node:fs/promises');
const path = require('node:path');

// LITANY_DIR points the reader at another folder of litanies (the end-to-end tests use their own).
const LITANY_DIR = path.resolve(process.env.LITANY_DIR || path.join(__dirname, '..', 'litanies'));

async function listFiles(dir = LITANY_DIR) {
  const names = await fs.readdir(dir);
  return names.filter((n) => n.toLowerCase().endsWith('.txt'));
}

async function parseLitany(file, dir = LITANY_DIR) {
  let text = await fs.readFile(path.join(dir, file), 'utf8');
  text = text.replace(/^﻿/, ''); // byte-order mark
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines.shift() || file.replace(/\.txt$/i, '');
  // An optional "Short version" (or "Short form") line starts a quick form of the litany.
  let short = [];
  const s = lines.findIndex((l) => /^short\s+(version|form)\s*:?$/i.test(l));
  if (s >= 0) {
    short = lines.slice(s + 1);
    lines.splice(s);
  }
  // An "Author: <name>" line at the end of either form is a credit, not a step.
  // A line ending like a sentence (". ! ?") is a step that happens to start "Author:".
  const authors = [];
  for (const form of [lines, short]) {
    const m = form.length && form[form.length - 1].match(/^author\s*:\s*(.*[^.!?\s])\s*$/i);
    if (m) {
      form.pop();
      if (!authors.includes(m[1])) authors.push(m[1]);
    }
  }
  // A file with only a short form reads it as its one form; an empty file shows its title.
  if (!lines.length) {
    lines.push(...short);
    short = [];
  }
  if (!lines.length) lines.push(title);
  return { title, lines, short, author: authors.join(', ') };
}

// The index: id, title and author of every litany, sorted by title.
async function listLitanies(dir = LITANY_DIR) {
  const files = await listFiles(dir);
  const items = await Promise.all(
    files.map(async (id) => {
      const { title, author } = await parseLitany(id, dir);
      return { id, title, author };
    }),
  );
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

module.exports = { listFiles, parseLitany, listLitanies };
