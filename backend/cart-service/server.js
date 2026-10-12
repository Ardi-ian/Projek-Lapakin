const express = require('express');
const cors = require('cors');
const { PORTS } = require('../shared/config');
const { file, load, save, nextId } = require('../shared/db');
const { authRequired } = require('../shared/auth');
const { call } = require('../shared/http');

const CARTS = file(__dirname, 'carts.json');
const ITEMS = file(__dirname, 'cart_items.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/cart', authRequired);

function getCart(userId) {
  const carts = load(CARTS);
  let cart = carts.find((c) => c.user_id === userId);
  if (!cart) {
    cart = { id: nextId(carts), user_id: userId };
    carts.push(cart);
    save(CARTS, carts);
  }
  return cart;
}

app.get('/api/cart', async (req, res) => {
  const cart = getCart(req.user.id);
  const rows = load(ITEMS).filter((i) => i.cart_id === cart.id);
  const items = [];
  for (const i of rows) {
    const r = await call(PORTS.product, `/api/products/${i.product_id}`);
    if (!r.ok) continue; // produk sudah dihapus
    const p = r.data;
    items.push({ id: i.id, product_id: p.id, nama: p.nama, harga: p.harga, stok: p.stok, seller_id: p.seller_id, qty: i.qty, subtotal: p.harga * i.qty });
  }
  res.json({ cart_id: cart.id, items, total: items.reduce((s, i) => s + i.subtotal, 0) });
});

app.post('/api/cart/items', async (req, res) => {
  const product_id = Number(req.body && req.body.product_id);
  const qty = Number((req.body && req.body.qty) || 1);
  if (!product_id || !Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'product_id dan qty (>= 1) wajib benar' });
  const r = await call(PORTS.product, `/api/products/${product_id}`);
  if (!r.ok) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const cart = getCart(req.user.id);
  const items = load(ITEMS);
  let item = items.find((i) => i.cart_id === cart.id && i.product_id === product_id);
  const total = (item ? item.qty : 0) + qty;
  if (total > r.data.stok) return res.status(400).json({ error: `Stok ${r.data.nama} hanya ${r.data.stok}` });
  if (item) item.qty = total;
  else { item = { id: nextId(items), cart_id: cart.id, product_id, qty }; items.push(item); }
  save(ITEMS, items);
  res.status(201).json(item);
});

app.put('/api/cart/items/:id', async (req, res) => {
  const qty = Number(req.body && req.body.qty);
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty harus bilangan bulat >= 1' });
  const cart = getCart(req.user.id);
  const items = load(ITEMS);
  const item = items.find((i) => i.id === Number(req.params.id) && i.cart_id === cart.id);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan' });
  const r = await call(PORTS.product, `/api/products/${item.product_id}`);
  if (r.ok && qty > r.data.stok) return res.status(400).json({ error: `Stok ${r.data.nama} hanya ${r.data.stok}` });
  item.qty = qty;
  save(ITEMS, items);
  res.json(item);
});

app.delete('/api/cart/items/:id', (req, res) => {
  const cart = getCart(req.user.id);
  const items = load(ITEMS);
  const idx = items.findIndex((i) => i.id === Number(req.params.id) && i.cart_id === cart.id);
  if (idx < 0) return res.status(404).json({ error: 'Item tidak ditemukan' });
  items.splice(idx, 1);
  save(ITEMS, items);
  res.json({ pesan: 'Item dihapus' });
});

app.delete('/api/cart', (req, res) => {
  const cart = getCart(req.user.id);
  save(ITEMS, load(ITEMS).filter((i) => i.cart_id !== cart.id));
  res.json({ pesan: 'Keranjang dikosongkan' });
});

app.listen(PORTS.cart, () => console.log(`[cart-service]    jalan di port ${PORTS.cart}`));