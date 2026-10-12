const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, INTERNAL_KEY } = require('./config');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const sign = (user) => jwt.sign({ id: user.id, nama: user.nama, role: user.role }, JWT_SECRET, { expiresIn: '4h' });

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Silakan login dulu' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Akses ditolak untuk role ini' });

const isInternal = (req) => req.headers['x-internal-key'] === INTERNAL_KEY;
const internalOnly = (req, res, next) =>
  isInternal(req) ? next() : res.status(403).json({ error: 'Hanya untuk komunikasi antar service' });

module.exports = { hashPassword, verifyPassword, sign, authRequired, requireRole, internalOnly, isInternal };