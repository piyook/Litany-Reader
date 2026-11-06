// Builds a static copy of the reader in dist/, for hosting without the server
// (GitHub Pages). The API answers become files at the paths the app asks for:
//   dist/api/index.json            the index
//   dist/api/litany/<id>.json      one litany
const fs = require('node:fs/promises');
const path = require('node:path');
const { listFiles, parseLitany, listLitanies } = require('./litanies');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');

(async () => {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.cp(path.join(ROOT, 'public'), OUT, { recursive: true });
  const dir = path.join(OUT, 'api', 'litany');
  await fs.mkdir(dir, { recursive: true });
  const items = await listLitanies();
  await fs.writeFile(path.join(OUT, 'api', 'index.json'), JSON.stringify(items));
  for (const id of await listFiles()) {
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(await parseLitany(id)));
  }
  console.log(`Built dist/ with ${items.length} litanies.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
