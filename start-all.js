const { spawn } = require('child_process');
const path = require('path');

const services = [
  'user-service', 'product-service', 'cart-service',
  'order-service', 'payment-service', 'api-gateway'
];

const procs = services.map((name) => {
  const p = spawn(process.execPath, [path.join(__dirname, 'backend', name, 'server.js')], { stdio: 'inherit' });
  p.on('exit', (code) => console.log(`[${name}] berhenti (kode ${code})`));
  return p;
});

function stopAll() { procs.forEach((p) => p.kill()); process.exit(); }
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

setTimeout(() => console.log('\nLapakin siap. Buka http://localhost:3000\n'), 1200);