// Starts the reader for the end-to-end tests, on its own port and with the
// litanies in e2e/litanies. Unlike `npm start` it writes no .server.json, so
// it never gets in the way of a reader you already have running.
const path = require('node:path');

process.env.LITANY_DIR = path.join(__dirname, 'litanies');
const { server } = require('../server.js');

const PORT = Number(process.env.E2E_PORT) || 8597;
server.listen(PORT, '127.0.0.1', () => console.log(`e2e reader on http://127.0.0.1:${PORT}`));
