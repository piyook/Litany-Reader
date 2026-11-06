import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { invalidBranches } = require('../scripts/validate-branch-name.js');

describe('invalidBranches', () => {
  it.each(['main', 'dev', 'feat/x', 'fix/a-b', 'hotfix/1', 'release/v1.4.0', 'chore/tidy'])('accepts %s', (name) => {
    expect(invalidBranches([name])).toEqual([]);
  });

  it.each(['master', 'develop', 'feat', 'feat/', 'feature/x', 'Main', 'my-branch', 'dev2'])('refuses %s', (name) => {
    expect(invalidBranches([name])).toEqual([name]);
  });

  it('returns only the bad names from a list', () => {
    expect(invalidBranches(['dev', 'oops', 'feat/ok', 'nope/x'])).toEqual(['oops', 'nope/x']);
  });
});
