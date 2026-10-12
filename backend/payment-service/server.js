const express = require('express');
const cors = require('cors');
const { PORTS } = require('../shared/config');
const { file, load, save, nextId } = require('../shared/db');
const { authRequired } = require('../shared/auth');
const { call } = require('../shared/http');

const PAYMENTS = file(__dirname, 'payments.json');
const METODE = ['transfer_bank', 'e_wallet', 'cod'];

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/payments', authRequired);

// Bayar pesanan (simulasi: pembayaran langsung dianggap berhasil)
app.post('/api/payments', async (req, res) => {
  const order_id = Number(req.body && req.body.order_id);
  const metode = req.body && req.body.metode;
  if (!order_id) return res.status(400).json({ error: 'order_id wajib diisi' });
  if (!METODE.includes(metode)) return res.status(400).json({ error: `metode harus salah satu dari: ${METODE.join(', ')}` });

  const o = await call(PORTS.order, `/api/orders/${order_id}`, { authHeader: req.headers.authorization });
  if (!o.ok) return res.status(o.status).json(o.data);
  const order = o.data;
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Itu bukan pesanan kamu' });
  if (order.status !== 'menunggu_pembayaran') return res.status(400).json({ error: `Pesanan berstatus ${order.status}, tidak bisa dibayar` });

  const rows = load(PAYMENTS);
  if (rows.some((p) => p.order_id === order_id)) return res.status(409).json({ error: 'Pesanan ini sudah dibayar' });

  const u = await call(PORTS.order, `/api/orders/${order_id}/status`, { method: 'PUT', internal: true, body: { status: 'dibayar' } });
  if (!u.ok) return res.status(502).json({ error: 'Gagal memperbarui status pesanan' });

  const p = { id: nextId(rows), order_id, metode, status: 'berhasil', tanggal: new Date().toISOString() };
  rows.push(p);
  save(PAYMENTS, rows);
  res.status(201).json({ ...p, jumlah: order.total });
});

// Lihat pembayaran sebuah pesanan
app.get('/api/payments/order/:order_id', async (req, res) => {
  const order_id = Number(req.params.order_id);
  const o = await call(PORTS.order, `/api/orders/${order_id}`, { authHeader: req.headers.authorization });
  if (!o.ok) return res.status(o.status).json(o.data);
  const p = load(PAYMENTS).find((x) => x.order_id === order_id);
  if (!p) return res.status(404).json({ error: 'Belum ada pembayaran untuk pesanan ini' });
  res.json(p);
});

app.listen(PORTS.payment, () => console.log(`[payment-service] jalan di port ${PORTS.payment}`));