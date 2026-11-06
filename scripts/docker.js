// `npm run docker:start` / `npm run docker:stop`: runs the reader in Docker.
// start builds the image if needed, starts the container in the background and opens the browser.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv, DEFAULT_PORT } = require('./env');
const { waitUntilUp, openBrowser } = require('./browser');

loadEnv();
const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || DEFAULT_PORT;
const url = `http://localhost:${port}`;
const action = process.argv[2];

const compose = (...args) => spawnSync('docker', ['compose', ...args], { cwd: root, stdio: 'inherit' }).status;

(async () => {
  if (action === 'stop') process.exit(compose('down'));
  if (action !== 'start') {
    console.error('Usage: node scripts/docker.js start|stop');
    process.exit(1);
  }
  const status = compose('up', '-d', '--build');
  if (status !== 0) {
    console.error('Docker could not start the reader. Is Docker running, and is the port free?');
    process.exit(status || 1);
  }
  if (await waitUntilUp(url, 10000)) {
    console.log(`Litany Reader running in Docker at ${url}  (stop it with: npm run docker:stop)`);
    return openBrowser(url);
  }
  console.error('The container started but the reader is not answering. See: npm run docker:logs');
  process.exit(1);
})();
