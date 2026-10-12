const express = require('express');
const cors = require('cors');
const { PORTS } = require('../shared/config');
const { file, load, save, nextId } = require('../shared/db');
const { hashPassword, verifyPassword, sign, authRequired } = require('../shared/auth');

const USERS = file(__dirname, 'users.json');
const ADDR = file(__dirname, 'addresses.json');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/users/register', (req, res) => {
  const { nama, email, password, role } = req.body || {};
  if (!nama || !email || !password) return res.status(400).json({ error: 'nama, email, dan password wajib diisi' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  const peran = role === 'penjual' ? 'penjual' : 'pembeli';
  const users = load(USERS);
  if (users.some((u) => u.email.toLowerCase() === String(email).toLowerCase()))
    return res.status(409).json({ error: 'Email sudah terdaftar' });
  const user = { id: nextId(users), nama, email, password: hashPassword(password), role: peran };
  users.push(user);
  save(USERS, users);
  res.status(201).json({ id: user.id, nama, email, role: peran });
});

app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = load(USERS).find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.password))
    return res.status(401).json({ error: 'Email atau password salah' });
  res.json({ token: sign(user), user: { id: user.id, nama: user.nama, email: user.email, role: user.role } });
});

app.get('/api/users/me', authRequired, (req, res) => {
  const user = load(USERS).find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ id: user.id, nama: user.nama, email: user.email, role: user.role });
});

// Alamat pengiriman
app.get('/api/users/addresses', authRequired, (req, res) => {
  res.json(load(ADDR).filter((a) => a.user_id === req.user.id));
});

app.post('/api/users/addresses', authRequired, (req, res) => {
  const { penerima, alamat, telepon } = req.body || {};
  if (!penerima || !alamat || !telepon) return res.status(400).json({ error: 'penerima, alamat, dan telepon wajib diisi' });
  const rows = load(ADDR);
  const a = { id: nextId(rows), user_id: req.user.id, penerima, alamat, telepon };
  rows.push(a);
  save(ADDR, rows);
  res.status(201).json(a);
});

app.delete('/api/users/addresses/:id', authRequired, (req, res) => {
  const rows = load(ADDR);
  const idx = rows.findIndex((a) => a.id === Number(req.params.id) && a.user_id === req.user.id);
  if (idx < 0) return res.status(404).json({ error: 'Alamat tidak ditemukan' });
  rows.splice(idx, 1);
  save(ADDR, rows);
  res.json({ pesan: 'Alamat dihapus' });
});

app.listen(PORTS.user, () => console.log(`[user-service]    jalan di port ${PORTS.user}`));