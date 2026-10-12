const express = require('express');
const cors = require('cors');
const { PORTS } = require('../shared/config');
const { file, load, save, nextId } = require('../shared/db');
const { authRequired, requireRole, internalOnly } = require('../shared/auth');

const PROD = file(__dirname, 'products.json');
const CAT = file(__dirname, 'categories.json');

const app = express();
app.use(cors());
app.use(express.json());

const withCategory = (p, cats) => ({ ...p, kategori: (cats.find((c) => c.id === p.category_id) || {}).nama || '-' });

// Kategori
app.get('/api/categories', (req, res) => res.json(load(CAT)));

app.post('/api/categories', authRequired, requireRole('admin'), (req, res) => {
  const { nama } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'nama kategori wajib diisi' });
  const rows = load(CAT);
  const c = { id: nextId(rows), nama };
  rows.push(c);
  save(CAT, rows);
  res.status(201).json(c);
});

// Produk
app.get('/api/products', (req, res) => {
  const cats = load(CAT);
  const { q, category_id, seller_id } = req.query;
  let rows = load(PROD);
  if (q) rows = rows.filter((p) => p.nama.toLowerCase().includes(String(q).toLowerCase()));
  if (category_id) rows = rows.filter((p) => p.category_id === Number(category_id));
  if (seller_id) rows = rows.filter((p) => p.seller_id === Number(seller_id));
  res.json(rows.map((p) => withCategory(p, cats)));
});

app.get('/api/products/:id', (req, res) => {
  const p = load(PROD).find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(withCategory(p, load(CAT)));
});

function validProduk(b, cats, parsial = false) {
  const err = [];
  if (!parsial || b.nama !== undefined) if (!b.nama) err.push('nama wajib diisi');
  if (!parsial || b.harga !== undefined) if (!(Number(b.harga) > 0)) err.push('harga harus lebih dari 0');
  if (!parsial || b.stok !== undefined) if (!(Number.isInteger(Number(b.stok)) && Number(b.stok) >= 0)) err.push('stok harus bilangan bulat >= 0');
  if (b.category_id !== undefined && !cats.some((c) => c.id === Number(b.category_id))) err.push('kategori tidak ada');
  return err;
}

app.post('/api/products', authRequired, requireRole('penjual', 'admin'), (req, res) => {
  const cats = load(CAT);
  const err = validProduk(req.body || {}, cats);
  if (err.length) return res.status(400).json({ error: err.join(', ') });
  const rows = load(PROD);
  const b = req.body;
  const p = {
    id: nextId(rows), seller_id: req.user.id, category_id: b.category_id !== undefined ? Number(b.category_id) : null,
    nama: b.nama, harga: Number(b.harga), stok: Number(b.stok),
  };
  rows.push(p);
  save(PROD, rows);
  res.status(201).json(withCategory(p, cats));
});

app.put('/api/products/:id', authRequired, requireRole('penjual', 'admin'), (req, res) => {
  const cats = load(CAT);
  const rows = load(PROD);
  const p = rows.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (req.user.role !== 'admin' && p.seller_id !== req.user.id) return res.status(403).json({ error: 'Bukan produk kamu' });
  const err = validProduk(req.body || {}, cats, true);
  if (err.length) return res.status(400).json({ error: err.join(', ') });
  const b = req.body;
  if (b.nama !== undefined) p.nama = b.nama;
  if (b.harga !== undefined) p.harga = Number(b.harga);
  if (b.stok !== undefined) p.stok = Number(b.stok);
  if (b.category_id !== undefined) p.category_id = Number(b.category_id);
  save(PROD, rows);
  res.json(withCategory(p, cats));
});

app.delete('/api/products/:id', authRequired, requireRole('penjual', 'admin'), (req, res) => {
  const rows = load(PROD);
  const idx = rows.findIndex((x) => x.id === Number(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (req.user.role !== 'admin' && rows[idx].seller_id !== req.user.id) return res.status(403).json({ error: 'Bukan produk kamu' });
  rows.splice(idx, 1);
  save(PROD, rows);
  res.json({ pesan: 'Produk dihapus' });
});

// Khusus dipanggil Order service (ubah stok)
app.patch('/api/products/:id/stock', internalOnly, (req, res) => {
  const rows = load(PROD);
  const p = rows.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const delta = Number(req.body && req.body.delta);
  if (!Number.isInteger(delta)) return res.status(400).json({ error: 'delta harus bilangan bulat' });
  if (p.stok + delta < 0) return res.status(400).json({ error: `Stok ${p.nama} tidak cukup` });
  p.stok += delta;
  save(PROD, rows);
  res.json({ id: p.id, stok: p.stok });
});

app.listen(PORTS.product, () => console.log(`[product-service] jalan di port ${PORTS.product}`));