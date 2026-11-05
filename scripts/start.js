// `npm start`: runs the server in the background and opens the browser.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv, DEFAULT_PORT } = require('./env');
const { isUp, waitUntilUp, openBrowser } = require('./browser');

loadEnv();
const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || DEFAULT_PORT;
const url = `http://localhost:${port}`;

(async () => {
  if (await isUp(url)) {
    console.log(`Already running at ${url}`);
    return openBrowser(url);
  }
  const log = fs.openSync(path.join(root, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, PORT: String(port) },
  });
  child.unref();

  if (await waitUntilUp(url, 5000)) {
    console.log(`Litany Reader running at ${url}  (stop it with: npm stop)`);
    return openBrowser(url);
  }
  console.error('The server did not start. See server.log for details.');
  process.exit(1);
})();
