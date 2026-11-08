// Copies the version from package.json into public/version.js, so the app can
// show it. Runs by itself during `npm version`, which then commits the file.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const file = path.join(ROOT, 'public', 'version.js');

// Line endings follow the machine, as the formatter expects.
const lines = [
  "// The app's version, shown at the foot of the settings panel.",
  "// Written by scripts/write-version.js when `npm version` runs; don't edit by hand.",
  `export const VERSION = '${version}';`,
  '',
];
fs.writeFileSync(file, lines.join(os.EOL));
console.log(`public/version.js set to ${version}`);
