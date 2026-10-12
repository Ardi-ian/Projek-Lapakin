const path = require('path');
const { save } = require('./shared/db');
const { hashPassword } = require('./shared/auth');

const f = (svc, name) => path.join(__dirname, `${svc}-service`, 'data', name);

save(f('user', 'users.json'), [
  { id: 1, nama: 'Admin Lapakin', email: 'admin@lapakin.com', password: hashPassword('admin123'), role: 'admin' },
  { id: 2, nama: 'Toko Budi', email: 'penjual@lapakin.com', password: hashPassword('penjual123'), role: 'penjual' },
  { id: 3, nama: 'Siti Pembeli', email: 'pembeli@lapakin.com', password: hashPassword('pembeli123'), role: 'pembeli' },
]);
save(f('user', 'addresses.json'), [
  { id: 1, user_id: 3, penerima: 'Siti Pembeli', alamat: 'Jl. Merdeka No. 10, Jakarta', telepon: '081234567890' },
]);
save(f('product', 'categories.json'), [
  { id: 1, nama: 'Fashion' }, { id: 2, nama: 'Elektronik' }, { id: 3, nama: 'Rumah Tangga' }, { id: 4, nama: 'Hobi' },
]);
save(f('product', 'products.json'), [
  { id: 1, seller_id: 2, category_id: 1, nama: 'Kaos Polos Hitam', harga: 65000, stok: 40 },
  { id: 2, seller_id: 2, category_id: 1, nama: 'Jaket Hoodie', harga: 175000, stok: 20 },
  { id: 3, seller_id: 2, category_id: 2, nama: 'Earphone Bluetooth', harga: 150000, stok: 25 },
  { id: 4, seller_id: 2, category_id: 2, nama: 'Power Bank 10000 mAh', harga: 130000, stok: 15 },
  { id: 5, seller_id: 2, category_id: 3, nama: 'Botol Minum Stainless', harga: 55000, stok: 50 },
  { id: 6, seller_id: 2, category_id: 3, nama: 'Lampu Meja LED', harga: 85000, stok: 18 },
  { id: 7, seller_id: 2, category_id: 4, nama: 'Papan Catur Lipat', harga: 70000, stok: 12 },
  { id: 8, seller_id: 2, category_id: 4, nama: 'Set Pensil Warna 24', harga: 45000, stok: 30 },
]);
['carts', 'cart_items'].forEach((n) => save(f('cart', `${n}.json`), []));
['orders', 'order_items'].forEach((n) => save(f('order', `${n}.json`), []));
save(f('payment', 'payments.json'), []);

console.log('Data awal siap.');
console.log('Akun: admin@lapakin.com / admin123, penjual@lapakin.com / penjual123, pembeli@lapakin.com / pembeli123');