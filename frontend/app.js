// ===== Pembantu =====
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const STATUS = { menunggu_pembayaran: 'Menunggu pembayaran', dibayar: 'Dibayar', dikirim: 'Dikirim', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let view = 'produk';
let filter = { q: '', category_id: '' };

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { keluar(true); }
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
  return d;
}

let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = err ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2800);
}
const gagal = (e) => toast(e.message, true);

function simpanLogin(data) {
  token = data.token; user = data.user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function keluar(diam) {
  token = null; user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  view = 'produk';
  if (!diam) toast('Kamu sudah keluar');
  render();
}

// ===== Menu =====
function menuUntuk() {
  if (!user) return [['produk', 'Produk'], ['masuk', 'Masuk / Daftar']];
  const m = [['produk', 'Produk']];
  if (user.role === 'pembeli') m.push(['keranjang', 'Keranjang'], ['pesanan', 'Pesanan'], ['alamat', 'Alamat']);
  if (user.role === 'penjual') m.push(['kelola', 'Produk Saya'], ['pesanan', 'Pesanan Masuk']);
  if (user.role === 'admin') m.push(['kelola', 'Semua Produk'], ['kategori', 'Kategori'], ['pesanan', 'Semua Pesanan']);
  return m;
}
function renderNav() {
  let h = menuUntuk().map(([v, t]) => `<a class="${v === view ? 'on' : ''}" data-act="nav" data-v="${v}">${t}</a>`).join('');
  if (user) h += `<span>${esc(user.nama)} (${esc(user.role)})</span><a data-act="keluar">Keluar</a>`;
  $('#nav').innerHTML = h;
}

// ===== Halaman =====
const views = {};

views.masuk = async () => {
  $('#app').innerHTML = `
    <div class="login-box">
      <div class="card">
        <h2>Masuk</h2>
        <form data-form="login">
          <label>Email</label><input name="email" type="email" required style="width:100%">
          <label>Password</label><input name="password" type="password" required style="width:100%">
          <div class="aksi"><button>Masuk</button></div>
        </form>
        <p class="kecil">Akun demo: pembeli@lapakin.com / pembeli123, penjual@lapakin.com / penjual123, admin@lapakin.com / admin123</p>
      </div>
      <div class="card">
        <h2>Daftar akun baru</h2>
        <form data-form="daftar">
          <label>Nama</label><input name="nama" required style="width:100%">
          <label>Email</label><input name="email" type="email" required style="width:100%">
          <label>Password (min. 6 karakter)</label><input name="password" type="password" minlength="6" required style="width:100%">
          <label>Daftar sebagai</label>
          <select name="role"><option value="pembeli">Pembeli</option><option value="penjual">Penjual</option></select>
          <div class="aksi"><button>Daftar</button></div>
        </form>
      </div>
    </div>`;
};

views.produk = async () => {
  const p = new URLSearchParams();
  if (filter.q) p.set('q', filter.q);
  if (filter.category_id) p.set('category_id', filter.category_id);
  const [kat, prod] = await Promise.all([api('/categories'), api('/products?' + p.toString())]);
  const opsi = kat.map((k) => `<option value="${k.id}" ${String(k.id) === String(filter.category_id) ? 'selected' : ''}>${esc(k.nama)}</option>`).join('');
  const kartu = prod.map((x) => `
    <div class="card produk">
      <h3>${esc(x.nama)}</h3>
      <div class="kecil">${esc(x.kategori)} · stok ${x.stok}</div>
      <div class="harga">${rp(x.harga)}</div>
      ${user && user.role === 'pembeli'
        ? (x.stok > 0 ? `<button data-act="tambah" data-id="${x.id}">+ Keranjang</button>` : '<span class="kecil">Stok habis</span>')
        : (!user ? '<span class="kecil">Masuk dulu untuk membeli</span>' : '')}
    </div>`).join('');
  $('#app').innerHTML = `
    <h2>Produk</h2>
    <form class="card form-baris" data-form="cari">
      <div><label>Cari</label><input name="q" value="${esc(filter.q)}" placeholder="nama produk"></div>
      <div><label>Kategori</label><select name="category_id"><option value="">Semua</option>${opsi}</select></div>
      <button>Cari</button>
    </form>
    <div class="grid">${kartu || '<p>Produk tidak ditemukan.</p>'}</div>`;
};

views.keranjang = async () => {
  const [c, alamat] = await Promise.all([api('/cart'), api('/users/addresses')]);
  if (!c.items.length) { $('#app').innerHTML = '<h2>Keranjang</h2><div class="card">Keranjangmu masih kosong.</div>'; return; }
  const baris = c.items.map((i) => `
    <tr>
      <td>${esc(i.nama)}<div class="kecil">stok ${i.stok}</div></td>
      <td>${rp(i.harga)}</td>
      <td><input type="number" min="1" max="${i.stok}" value="${i.qty}" style="width:70px" data-change="qty" data-id="${i.id}"></td>
      <td>${rp(i.subtotal)}</td>
      <td><button class="merah" data-act="hapusItem" data-id="${i.id}">Hapus</button></td>
    </tr>`).join('');
  const opsiAlamat = alamat.map((a) => `<option value="${a.id}">${esc(a.penerima)} - ${esc(a.alamat)}</option>`).join('');
  $('#app').innerHTML = `
    <h2>Keranjang</h2>
    <div class="card"><table>
      <tr><th>Produk</th><th>Harga</th><th>Jumlah</th><th>Subtotal</th><th></th></tr>${baris}
      <tr><td colspan="3" class="kanan"><b>Total</b></td><td colspan="2"><b>${rp(c.total)}</b></td></tr>
    </table></div>
    <div class="card">
      <h3 style="margin-top:0">Checkout</h3>
      ${alamat.length
        ? `<label>Alamat pengiriman</label><select id="alamat-checkout" style="width:100%">${opsiAlamat}</select>
           <div class="aksi"><button data-act="checkout">Checkout sekarang</button></div>`
        : '<p class="err">Kamu belum punya alamat. Tambahkan dulu di menu Alamat.</p>'}
    </div>`;
};

views.pesanan = async () => {
  const rows = await api('/orders');
  if (!rows.length) { $('#app').innerHTML = '<h2>Pesanan</h2><div class="card">Belum ada pesanan.</div>'; return; }
  const kartu = rows.map((o) => {
    const isi = o.items.map((i) => `<li>${esc(i.nama_produk)} × ${i.qty} (${rp(i.harga)})</li>`).join('');
    let aksi = '';
    if (user.role === 'pembeli' && o.status === 'menunggu_pembayaran') {
      aksi = `<select id="metode-${o.id}"><option value="transfer_bank">Transfer bank</option><option value="e_wallet">E-wallet</option><option value="cod">Bayar di tempat (COD)</option></select>
              <button data-act="bayar" data-id="${o.id}">Bayar</button>`;
    }
    if (user.role !== 'pembeli' && o.status === 'dibayar') aksi = `<button data-act="status" data-id="${o.id}" data-st="dikirim">Tandai dikirim</button>`;
    if (user.role !== 'pembeli' && o.status === 'dikirim') aksi = `<button data-act="status" data-id="${o.id}" data-st="selesai">Tandai selesai</button>`;
    return `<div class="card">
      <b>Pesanan #${o.id}</b> <span class="badge ${o.status}">${STATUS[o.status] || o.status}</span>
      <div class="kecil">${new Date(o.tanggal).toLocaleString('id-ID')}</div>
      <ul>${isi}</ul>
      <b>Total: ${rp(o.total)}</b>
      ${aksi ? `<div class="aksi">${aksi}</div>` : ''}
    </div>`;
  }).join('');
  $('#app').innerHTML = `<h2>${user.role === 'pembeli' ? 'Pesanan Saya' : 'Pesanan'}</h2>${kartu}`;
};

views.alamat = async () => {
  const rows = await api('/users/addresses');
  const daftar = rows.map((a) => `
    <div class="card"><b>${esc(a.penerima)}</b> · ${esc(a.telepon)}<br>${esc(a.alamat)}
      <div class="aksi"><button class="merah" data-act="hapusAlamat" data-id="${a.id}">Hapus</button></div></div>`).join('');
  $('#app').innerHTML = `
    <h2>Alamat Pengiriman</h2>
    ${daftar || '<div class="card">Belum ada alamat.</div>'}
    <form class="card" data-form="alamat">
      <h3 style="margin-top:0">Tambah alamat</h3>
      <label>Nama penerima</label><input name="penerima" required style="width:100%">
      <label>Alamat lengkap</label><input name="alamat" required style="width:100%">
      <label>Telepon</label><input name="telepon" required style="width:100%">
      <div class="aksi"><button>Simpan alamat</button></div>
    </form>`;
};

views.kelola = async () => {
  const [kat, prod] = await Promise.all([api('/categories'), api(user.role === 'admin' ? '/products' : '/products?seller_id=' + user.id)]);
  const opsi = kat.map((k) => `<option value="${k.id}">${esc(k.nama)}</option>`).join('');
  const baris = prod.map((p) => `
    <tr><td>${esc(p.nama)}</td><td>${esc(p.kategori)}</td><td>${rp(p.harga)}</td><td>${p.stok}</td>
    <td><button class="abu" data-act="ubahStok" data-id="${p.id}" data-stok="${p.stok}">Ubah stok</button>
        <button class="merah" data-act="hapusProduk" data-id="${p.id}">Hapus</button></td></tr>`).join('');
  $('#app').innerHTML = `
    <h2>${user.role === 'admin' ? 'Semua Produk' : 'Produk Saya'}</h2>
    <form class="card form-baris" data-form="produk">
      <div><label>Nama produk</label><input name="nama" required></div>
      <div><label>Kategori</label><select name="category_id">${opsi}</select></div>
      <div><label>Harga (Rp)</label><input name="harga" type="number" min="1" required style="width:120px"></div>
      <div><label>Stok</label><input name="stok" type="number" min="0" required style="width:90px"></div>
      <button>Tambah produk</button>
    </form>
    <div class="card"><table><tr><th>Nama</th><th>Kategori</th><th>Harga</th><th>Stok</th><th></th></tr>${baris || '<tr><td colspan="5">Belum ada produk.</td></tr>'}</table></div>`;
};

views.kategori = async () => {
  const kat = await api('/categories');
  $('#app').innerHTML = `
    <h2>Kategori</h2>
    <form class="card form-baris" data-form="kategori">
      <div><label>Nama kategori baru</label><input name="nama" required></div><button>Tambah</button>
    </form>
    <div class="card"><ul>${kat.map((k) => `<li>${esc(k.nama)}</li>`).join('')}</ul></div>`;
};

function render() {
  const butuhLogin = ['keranjang', 'pesanan', 'alamat', 'kelola', 'kategori'];
  if (butuhLogin.includes(view) && !user) view = 'masuk';
  if (!menuUntuk().some(([v]) => v === view)) view = 'produk';
  renderNav();
  views[view]().catch((e) => { $('#app').innerHTML = `<p class="err">${esc(e.message)}</p>`; });
}
function pindah(v) { view = v; render(); }

// ===== Aksi tombol =====
const aksi = {
  nav: (d) => pindah(d.v),
  keluar: () => keluar(),
  tambah: (d) => api('/cart/items', { method: 'POST', body: { product_id: Number(d.id), qty: 1 } }).then(() => toast('Masuk ke keranjang')).catch(gagal),
  hapusItem: (d) => api('/cart/items/' + d.id, { method: 'DELETE' }).then(render).catch(gagal),
  checkout: () => api('/orders/checkout', { method: 'POST', body: { address_id: Number($('#alamat-checkout').value) } })
    .then(() => { toast('Pesanan dibuat, silakan bayar'); pindah('pesanan'); }).catch(gagal),
  bayar: (d) => api('/payments', { method: 'POST', body: { order_id: Number(d.id), metode: $('#metode-' + d.id).value } })
    .then(() => { toast('Pembayaran berhasil'); render(); }).catch(gagal),
  status: (d) => api(`/orders/${d.id}/status`, { method: 'PUT', body: { status: d.st } }).then(() => { toast('Status diperbarui'); render(); }).catch(gagal),
  hapusAlamat: (d) => api('/users/addresses/' + d.id, { method: 'DELETE' }).then(render).catch(gagal),
  hapusProduk: (d) => { if (confirm('Hapus produk ini?')) api('/products/' + d.id, { method: 'DELETE' }).then(render).catch(gagal); },
  ubahStok: (d) => {
    const v = prompt('Stok baru:', d.stok);
    if (v === null) return;
    api('/products/' + d.id, { method: 'PUT', body: { stok: Number(v) } }).then(render).catch(gagal);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && aksi[el.dataset.act]) aksi[el.dataset.act](el.dataset);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change="qty"]');
  if (!el) return;
  api('/cart/items/' + el.dataset.id, { method: 'PUT', body: { qty: Number(el.value) } }).then(render).catch((err) => { gagal(err); render(); });
});

// ===== Formulir =====
const formulir = {
  login: (f) => api('/users/login', { method: 'POST', body: f }).then((d) => { simpanLogin(d); toast('Selamat datang, ' + d.user.nama); pindah('produk'); }),
  daftar: (f) => api('/users/register', { method: 'POST', body: f })
    .then(() => api('/users/login', { method: 'POST', body: { email: f.email, password: f.password } }))
    .then((d) => { simpanLogin(d); toast('Akun dibuat'); pindah('produk'); }),
  cari: (f) => { filter = { q: f.q, category_id: f.category_id }; render(); },
  alamat: (f) => api('/users/addresses', { method: 'POST', body: f }).then(() => { toast('Alamat disimpan'); render(); }),
  produk: (f) => api('/products', { method: 'POST', body: { nama: f.nama, category_id: Number(f.category_id), harga: Number(f.harga), stok: Number(f.stok) } })
    .then(() => { toast('Produk ditambahkan'); render(); }),
  kategori: (f) => api('/categories', { method: 'POST', body: f }).then(() => { toast('Kategori ditambahkan'); render(); }),
};

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  Promise.resolve(formulir[form.dataset.form](data)).catch(gagal);
});

render();