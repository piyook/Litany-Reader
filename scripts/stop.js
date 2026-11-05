// `npm stop`: asks the background server to shut down.
const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, '..', '.server.json');

(async () => {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    console.log('Litany Reader is not running.');
    return;
  }
  try {
    const res = await fetch(`http://localhost:${state.port}/__shutdown`, {
      method: 'POST',
      headers: { 'X-Litany-Token': state.token },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('Litany Reader stopped.');
  } catch {
    // The server is gone (or not answering): stop it by process id if it still exists.
    try {
      process.kill(state.pid);
      console.log('Litany Reader stopped.');
    } catch {
      console.log('Litany Reader was not running.');
    }
    try { fs.unlinkSync(stateFile); } catch {}
  }
})();
