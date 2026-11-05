// Shared by the start scripts: wait for the reader to answer, then open it in the browser.
const { spawn } = require('child_process');

const isUp = (url) => fetch(`${url}/api/litanies`).then((r) => r.ok, () => false);

// Resolves true once the reader answers, false after `ms` milliseconds.
async function waitUntilUp(url, ms) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function openBrowser(url) {
  if (process.argv.includes('--no-open')) return;
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

module.exports = { isUp, waitUntilUp, openBrowser };
