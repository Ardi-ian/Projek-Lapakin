const PORTS = { gateway: 3000, user: 3001, product: 3002, cart: 3003, order: 3004, payment: 3005 };
const URL = (port) => `http://127.0.0.1:${port}`;

module.exports = {
  PORTS,
  URL,
  JWT_SECRET: 'lapakin-rahasia-ganti-nanti',
  INTERNAL_KEY: 'lapakin-kunci-internal-antar-service',
};