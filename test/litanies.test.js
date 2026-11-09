import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { listFiles, parseLitany, listLitanies } = require('../scripts/litanies.js');

let dir;
const write = (name, text) => fs.writeFile(path.join(dir, name), text);
const parse = async (text) => {
  await write('t.txt', text);
  return parseLitany('t.txt', dir);
};

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'litanies-'));
});
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

describe('parseLitany', () => {
  it('takes the first line as the title and the rest as steps, trimmed, without blank lines', async () => {
    expect(await parse('  Title  \n\nOne\n   Two  \n\n')).toEqual({
      title: 'Title',
      lines: ['One', 'Two'],
      short: [],
      author: '',
    });
  });

  it('reads Windows line endings and drops a byte-order mark', async () => {
    const got = await parse('﻿Title\r\nOne\r\nTwo\r\n');
    expect(got.title).toBe('Title');
    expect(got.lines).toEqual(['One', 'Two']);
  });

  it.each(['Short version', 'Short version:', 'short form', 'SHORT FORM :'])(
    'splits off a short form at "%s"',
    async (marker) => {
      const got = await parse(`Title\nOne\nTwo\n${marker}\nQuick`);
      expect(got.lines).toEqual(['One', 'Two']);
      expect(got.short).toEqual(['Quick']);
    },
  );

  it('does not treat a step that mentions a short version as the marker', async () => {
    const got = await parse('Title\nShort version of me\nTwo');
    expect(got.lines).toEqual(['Short version of me', 'Two']);
    expect(got.short).toEqual([]);
  });

  it('takes an Author line at the end as the credit', async () => {
    const got = await parse('Title\nOne\nAuthor: Jo Bloggs');
    expect(got.lines).toEqual(['One']);
    expect(got.author).toBe('Jo Bloggs');
  });

  it('keeps an Author line that is not the last line as a step', async () => {
    const got = await parse('Title\nAuthor: Jo\nOne');
    expect(got.lines).toEqual(['Author: Jo', 'One']);
    expect(got.author).toBe('');
  });

  it.each(['.', '!', '?'])('keeps an Author line ending in "%s" as a step', async (end) => {
    const got = await parse(`Title\nOne\nAuthor: I am the author of my day${end}`);
    expect(got.lines).toEqual(['One', `Author: I am the author of my day${end}`]);
    expect(got.author).toBe('');
  });

  it('credits the author of each form once, or both when they differ', async () => {
    const same = await parse('Title\nOne\nAuthor: Jo\nShort version\nQuick\nAuthor: Jo');
    expect(same).toMatchObject({ lines: ['One'], short: ['Quick'], author: 'Jo' });
    const both = await parse('Title\nOne\nAuthor: Jo\nShort form\nQuick\nAuthor: Sam');
    expect(both.author).toBe('Jo, Sam');
  });

  it('reads a file with only a short form as its one form', async () => {
    const got = await parse('Title\nShort version\nQuick\nAlso quick');
    expect(got.lines).toEqual(['Quick', 'Also quick']);
    expect(got.short).toEqual([]);
  });

  it('shows the title as the only step of a file with no steps', async () => {
    expect((await parse('Just a title')).lines).toEqual(['Just a title']);
  });

  it('names an empty file after its file name', async () => {
    await write('Quiet Mind.TXT', '');
    expect(await parseLitany('Quiet Mind.TXT', dir)).toEqual({
      title: 'Quiet Mind',
      lines: ['Quiet Mind'],
      short: [],
      author: '',
    });
  });
});

describe('listFiles and listLitanies', () => {
  let lib;
  beforeAll(async () => {
    lib = await fs.mkdtemp(path.join(os.tmpdir(), 'litany-index-'));
    await fs.writeFile(path.join(lib, 'b.txt'), 'Zebra Calm\nOne');
    await fs.writeFile(path.join(lib, 'a.TXT'), 'Apple Peace\nOne\nAuthor: Jo');
    await fs.writeFile(path.join(lib, 'notes.md'), '# not a litany');
  });
  afterAll(() => fs.rm(lib, { recursive: true, force: true }));

  it('lists only .txt files, in any letter case', async () => {
    expect((await listFiles(lib)).sort()).toEqual(['a.TXT', 'b.txt']);
  });

  it('gives the id, title, author and opening line of each litany, sorted by title', async () => {
    expect(await listLitanies(lib)).toEqual([
      { id: 'a.TXT', title: 'Apple Peace', author: 'Jo', first: 'One' },
      { id: 'b.txt', title: 'Zebra Calm', author: '', first: 'One' },
    ]);
  });

  it('gives no opening line for a litany that is only a title', async () => {
    const solo = await fs.mkdtemp(path.join(os.tmpdir(), 'litany-solo-'));
    await fs.writeFile(path.join(solo, 'q.txt'), 'Quiet');
    expect(await listLitanies(solo)).toEqual([{ id: 'q.txt', title: 'Quiet', author: '', first: '' }]);
    await fs.rm(solo, { recursive: true, force: true });
  });

  it('reads the litanies folder by default', async () => {
    const files = await listFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith('.txt'))).toBe(true);
  });
});
