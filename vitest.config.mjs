import { defineConfig } from 'vitest/config';

const MINIMUM = { statements: 97, branches: 93, functions: 97, lines: 97 };

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // `npm run test:coverage`. The json report is the one fallow reads.
    coverage: {
      provider: 'v8',
      include: ['server.js', 'scripts/**/*.js'],
      reporter: ['text', 'html', 'json'],
      // The least the tests must run of the code that reads the litanies and
      // the settings. The server's start and shutdown, and the command
      // scripts, run as programs and have no minimum.
      thresholds: {
        'scripts/litanies.js': MINIMUM,
        'scripts/env.js': MINIMUM,
      },
    },
  },
});
