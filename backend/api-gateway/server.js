const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { PORTS, URL } = require('../shared/config');

const app = express();
app.use(cors());

// Daftar rute: awalan alamat -> service tujuan
const rute = [
  [['/api/users'], PORTS.user],
  [['/api/products', '/api/categories'], PORTS.product],
  [['/api/cart'], PORTS.cart],
  [['/api/orders'], PORTS.order],
  [['/api/payments'], PORTS.payment],
];

rute.forEach(([filter, port]) => {
  app.use(createProxyMiddleware({
    target: URL(port),
    pathFilter: filter,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service tidak tersedia' }));
      },
    },
  }));
});

// Tampilan web (folder frontend)
app.use(express.static(path.join(__dirname, '../../frontend')));

app.listen(PORTS.gateway, () => console.log(`[api-gateway]     jalan di port ${PORTS.gateway}`));