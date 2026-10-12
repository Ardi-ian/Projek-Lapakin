const { URL, INTERNAL_KEY } = require('./config');

// Panggil service lain. authHeader = isi header Authorization dari request asli.
async function call(port, path, { method = 'GET', authHeader, internal, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  if (internal) headers['x-internal-key'] = INTERNAL_KEY;
  try {
    const r = await fetch(URL(port) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await r.json(); } catch { /* kosong */ }
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 503, data: { error: 'Service tidak bisa dihubungi' } };
  }
}

module.exports = { call };