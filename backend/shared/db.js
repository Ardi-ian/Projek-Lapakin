const fs = require('fs');
const path = require('path');

const file = (dir, name) => path.join(dir, 'data', name);

function load(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
}
function save(f, rows) {
  fs.writeFileSync(f, JSON.stringify(rows, null, 2));
}
function nextId(rows) {
  return rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
}

module.exports = { file, load, save, nextId };