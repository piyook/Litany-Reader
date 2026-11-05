// `npm start`: runs the server in the background and opens the browser.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || 8484;
const url = `http://localhost:${port}`;
const noOpen = process.argv.includes('--no-open');

const isUp = () => fetch(`${url}/api/litanies`).then((r) => r.ok, () => false);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function openBrowser() {
  if (noOpen) return;
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

(async () => {
  if (await isUp()) {
    console.log(`Already running at ${url}`);
    return openBrowser();
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

  for (let i = 0; i < 50; i++) {
    if (await isUp()) {
      console.log(`Litany Reader running at ${url}  (stop it with: npm stop)`);
      return openBrowser();
    }
    await wait(100);
  }
  console.error('The server did not start. See server.log for details.');
  process.exit(1);
})();
