import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { loadEnv, DEFAULT_PORT } = require('../scripts/env.js');

const KEYS = ['LR_PLAIN', 'LR_SPACED', 'LR_DOUBLE', 'LR_SINGLE', 'LR_MIXED', 'LR_EMPTY', 'LR_SET', 'LR_EQ'];
let dir;

const envFile = (text) => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, text);
  return file;
};

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('loadEnv', () => {
  it('sets KEY=value lines, skipping comments, blank lines and lines that are not settings', () => {
    loadEnv(
      envFile(
        [
          '# a comment',
          '',
          'LR_PLAIN=8080',
          '  LR_SPACED  =  two words  ',
          'LR_DOUBLE="quoted"',
          "LR_SINGLE='quoted'",
          'LR_MIXED="not matched\'',
          'LR_EMPTY=',
          'LR_EQ=a=b',
          'not a setting',
          '1BAD=x',
        ].join('\r\n'),
      ),
    );
    expect(process.env.LR_PLAIN).toBe('8080');
    expect(process.env.LR_SPACED).toBe('two words');
    expect(process.env.LR_DOUBLE).toBe('quoted');
    expect(process.env.LR_SINGLE).toBe('quoted');
    expect(process.env.LR_MIXED).toBe('"not matched\'');
    expect(process.env.LR_EMPTY).toBe('');
    expect(process.env.LR_EQ).toBe('a=b');
    expect(process.env['1BAD']).toBeUndefined();
  });

  it('leaves values already in the environment alone', () => {
    process.env.LR_SET = 'from the shell';
    loadEnv(envFile('LR_SET=from the file'));
    expect(process.env.LR_SET).toBe('from the shell');
  });

  it('does nothing when there is no .env file', () => {
    expect(() => loadEnv(path.join(os.tmpdir(), 'no-such-dir', '.env'))).not.toThrow();
  });

  it('defaults to port 8484', () => {
    expect(DEFAULT_PORT).toBe(8484);
  });
});
