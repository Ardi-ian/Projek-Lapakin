const express = require('express');
const cors = require('cors');
const { PORTS } = require('../shared/config');
const { file, load, save, nextId } = require('../shared/db');
const { authRequired, isInternal } = require('../shared/auth');
const { call } = require('../shared/http');

const ORDERS = file(__dirname, 'orders.json');
const ITEMS = file(__dirname, 'order_items.json');
const STATUS = ['menunggu_pembayaran', 'dibayar', 'dikirim', 'selesai', 'dibatalkan'];

const app = express();
app.use(cors());
app.use(express.json());

// Boleh dilihat oleh: pemilik pesanan, penjual yang produknya ada di pesanan, admin
function bolehLihat(order, items, user) {
  if (user.role === 'admin' || order.user_id === user.id) return true;
  return user.role === 'penjual' && items.some((i) => i.order_id === order.id && i.seller_id === user.id);
}

// Checkout: keranjang jadi pesanan
app.post('/api/orders/checkout', authRequired, async (req, res) => {
  const auth = req.headers.authorization;
  const address_id = Number(req.body && req.body.address_id);
  if (!address_id) return res.status(400).json({ error: 'address_id wajib diisi' });

  const a = await call(PORTS.user, '/api/users/addresses', { authHeader: auth });
  if (!a.ok) return res.status(a.status).json(a.data);
  const alamat = a.data.find((x) => x.id === address_id);
  if (!alamat) return res.status(404).json({ error: 'Alamat tidak ditemukan' });

  const c = await call(PORTS.cart, '/api/cart', { authHeader: auth });
  if (!c.ok) return res.status(c.status).json(c.data);
  const cartItems = c.data.items;
  if (!cartItems.length) return res.status(400).json({ error: 'Keranjang masih kosong' });
  for (const i of cartItems) {
    if (i.qty > i.stok) return res.status(400).json({ error: `Stok ${i.nama} tidak cukup (sisa ${i.stok})` });
  }

  // Kurangi stok; kalau ada yang gagal, kembalikan yang sudah terpotong
  const done = [];
  for (const i of cartItems) {
    const s = await call(PORTS.product, `/api/products/${i.product_id}/stock`, { method: 'PATCH', internal: true, body: { delta: -i.qty } });
    if (!s.ok) {
      for (const d of done) await call(PORTS.product, `/api/products/${d.product_id}/stock`, { method: 'PATCH', internal: true, body: { delta: d.qty } });
      return res.status(400).json(s.data || { error: 'Gagal mengurangi stok' });
    }
    done.push(i);
  }

  const orders = load(ORDERS);
  const order = {
    id: nextId(orders), user_id: req.user.id, address_id,
    total: c.data.total, status: 'menunggu_pembayaran', tanggal: new Date().toISOString(),
  };
  orders.push(order);
  save(ORDERS, orders);

  const items = load(ITEMS);
  const baru = cartItems.map((i) => ({
    id: 0, order_id: order.id, product_id: i.product_id, seller_id: i.seller_id,
    nama_produk: i.nama, qty: i.qty, harga: i.harga,
  }));
  baru.forEach((b) => { b.id = nextId(items); items.push(b); });
  save(ITEMS, items);

  await call(PORTS.cart, '/api/cart', { method: 'DELETE', authHeader: auth });
  res.status(201).json({ ...order, alamat, items: baru });
});

// Daftar pesanan
app.get('/api/orders', authRequired, (req, res) => {
  const items = load(ITEMS);
  let rows = load(ORDERS).filter((o) => bolehLihat(o, items, req.user));
  if (req.user.role === 'admin') rows = load(ORDERS);
  res.json(rows.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })).reverse());
});

// Detail pesanan (boleh juga dipanggil service lain dengan header internal)
app.get('/api/orders/:id', (req, res, next) => (isInternal(req) ? next() : authRequired(req, res, next)), (req, res) => {
  const items = load(ITEMS);
  const o = load(ORDERS).find((x) => x.id === Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (!isInternal(req) && !bolehLihat(o, items, req.user)) return res.status(403).json({ error: 'Bukan pesanan kamu' });
  res.json({ ...o, items: items.filter((i) => i.order_id === o.id) });
});

// Ubah status: penjual/admin, atau service lain (pembayaran) dengan header internal
app.put('/api/orders/:id/status', (req, res, next) => (isInternal(req) ? next() : authRequired(req, res, next)), (req, res) => {
  const status = req.body && req.body.status;
  if (!STATUS.includes(status)) return res.status(400).json({ error: `status harus salah satu dari: ${STATUS.join(', ')}` });
  const orders = load(ORDERS);
  const items = load(ITEMS);
  const o = orders.find((x) => x.id === Number(req.params.id));
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (!isInternal(req)) {
    const penjualOk = req.user.role === 'penjual' && items.some((i) => i.order_id === o.id && i.seller_id === req.user.id);
    if (req.user.role !== 'admin' && !penjualOk) return res.status(403).json({ error: 'Tidak boleh mengubah pesanan ini' });
  }
  o.status = status;
  save(ORDERS, orders);
  res.json(o);
});

app.listen(PORTS.order, () => console.log(`[order-service]   jalan di port ${PORTS.order}`));