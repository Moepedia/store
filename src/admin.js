/* ============================================================
   ADMIN LOGIC — Supabase Auth + RLS (ES Module)
============================================================ */
import { DB, initSupabase, rupiah, formatDate } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- HELPERS ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

function showSuccess(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* ---------- SCREEN MANAGEMENT ---------- */
function showSetup() {
  $('#setupScreen').classList.remove('hidden');
  $('#loginScreen').classList.add('hidden');
  $('#adminLayout').style.display = 'none';
}

function showLogin() {
  $('#setupScreen').classList.add('hidden');
  $('#loginScreen').classList.remove('hidden');
  $('#adminLayout').style.display = 'none';
  setTimeout(() => $('#loginEmail')?.focus(), 100);
}

function showAdmin() {
  $('#setupScreen').classList.add('hidden');
  $('#loginScreen').classList.add('hidden');
  $('#adminLayout').style.display = 'grid';
  renderDashboard();
}

async function checkAuth() {
  if (!DB.isConfigured()) {
    showSetup();
    return;
  }
  const loggedIn = await DB.isLoggedIn();
  if (loggedIn) showAdmin();
  else showLogin();
}

/* ---------- SETUP WIZARD ---------- */
$('#setupTestBtn')?.addEventListener('click', async () => {
  const url = $('#setupUrl').value.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const key = $('#setupKey').value.trim();

  if (!url || !key) {
    showError('setupError', 'URL dan key wajib diisi');
    return;
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    showError('setupError', 'Format URL salah. Contoh: https://xxxxx.supabase.co');
    return;
  }

  const btn = $('#setupTestBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Testing koneksi...';

  try {
    const testClient = window.supabase.createClient(url, key);
    const { error } = await testClient.from('products').select('id').limit(1);

    if (error && !error.message.includes('does not exist') && !error.message.includes('relation')) {
      throw new Error(error.message);
    }

    DB.saveSbConfig({ url, key });
    showSuccess('setupSuccess', 'Koneksi berhasil! Mengalihkan ke login...');
    setTimeout(() => showLogin(), 1200);
  } catch (e) {
    showError('setupError', 'Koneksi gagal: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

$('#setupSkipBtn')?.addEventListener('click', () => {
  if (!confirm('Lewati setup? Data akan disimpan di localStorage saja.')) return;
  showLogin();
});

/* ---------- LOGIN ---------- */
$('#loginBtn')?.addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const pw = $('#loginPassword').value;

  if (!email || !pw) {
    showError('loginError', 'Email dan password wajib diisi');
    return;
  }

  const btn = $('#loginBtn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Memverifikasi...';

  try {
    if (DB.client()) {
      await DB.login(email, pw);
    } else {
      const ok = await DB.verifyPassword(pw);
      if (!ok) throw new Error('Password salah');
    }

    btn.disabled = false;
    btn.innerHTML = originalHTML;
    $('#loginError').classList.remove('show');
    $('#loginEmail').value = '';
    $('#loginPassword').value = '';
    showAdmin();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    showError('loginError', e.message || 'Email atau password salah');
    $('#loginPassword').value = '';
    $('#loginPassword').focus();
  }
});

$('#loginPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('#loginBtn').click();
});

$('#logoutBtn')?.addEventListener('click', async () => {
  if (!confirm('Logout dari admin panel?')) return;
  await DB.logout();
  checkAuth();
});

/* ---------- TABS ---------- */
$$('.sidebar-nav button').forEach(btn => {
  btn.addEventListener('click', async () => {
    $$('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'dashboard') await renderDashboard();
    if (btn.dataset.tab === 'products') await renderProductsTable();
    if (btn.dataset.tab === 'orders') await renderOrdersTable();
    if (btn.dataset.tab === 'banner') await renderBannerPanel();
    if (btn.dataset.tab === 'settings') await renderSettingsPanel();
  });
});

/* ---------- DASHBOARD ---------- */
async function renderDashboard() {
  const products = await DB.getProducts();
  const orders = await DB.getOrders();
  const revenue = orders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((s, o) => s + (o.total || 0), 0);

  $('#statProducts').textContent = products.length;
  $('#statOrders').textContent = orders.length;
  $('#statRevenue').textContent = rupiah(revenue);
}

/* ---------- BANNER ---------- */
let pendingBannerImage = null;

async function renderBannerPanel() {
  const banner = await DB.getBanner();
  const wrap = $('#bannerPreviewWrap');
  const linkInput = $('#bannerLinkInput');

  if (banner && banner.image) {
    wrap.innerHTML = `<img src="${banner.image}" class="preview-img" alt="Banner">`;
    linkInput.value = banner.link || '';
    pendingBannerImage = banner.image;
  } else {
    wrap.innerHTML = '<p style="color:var(--text-3);font-size:13px;margin-bottom:12px">Belum ada banner.</p>';
    linkInput.value = '';
    pendingBannerImage = null;
  }
}

$('#bannerFile')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 2MB');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingBannerImage = ev.target.result;
    $('#bannerPreviewWrap').innerHTML = `<img src="${pendingBannerImage}" class="preview-img" alt="Preview">`;
  };
  reader.readAsDataURL(file);
});

$('#saveBannerBtn')?.addEventListener('click', async () => {
  if (!pendingBannerImage) {
    alert('Upload gambar banner dulu');
    return;
  }
  try {
    await DB.saveBanner({
      image: pendingBannerImage,
      link: $('#bannerLinkInput').value.trim()
    });
    alert('Banner tersimpan');
  } catch (e) {
    alert('Gagal simpan banner: ' + e.message);
  }
});

$('#clearBannerBtn')?.addEventListener('click', async () => {
  if (!confirm('Hapus banner?')) return;
  await DB.clearBanner();
  pendingBannerImage = null;
  renderBannerPanel();
});

/* ---------- PRODUCTS TABLE ---------- */
async function renderProductsTable() {
  const products = await DB.getProducts();
  const tbody = $('#productsTable');

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Belum ada produk</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${p.image
            ? `<img src="${p.image}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid var(--border)">`
            : `<div style="width:36px;height:36px;border-radius:6px;background:var(--bg-3);border:1px solid var(--border)"></div>`}
          <div>
            <div style="color:var(--text);font-weight:500">${escapeHtml(p.title)}</div>
            <div style="font-size:11.5px;color:var(--text-3)">${p.id}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(p.category_label || p.categoryLabel || p.category || '-')}</td>
      <td style="color:var(--text);font-weight:500">${rupiah(p.price)}</td>
      <td>
        ${p.badge
          ? `<span class="status-pill" style="background:var(--bg-3);color:var(--text-2)">${p.badge}</span>`
          : '<span style="color:var(--text-3)">-</span>'}
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProductConfirm('${p.id}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ---------- PRODUCT MODAL ---------- */
let pendingProductImage = null;

function openProductModal(mode, product) {
  pendingProductImage = product?.image || null;
  $('#productModalTitle').textContent = mode === 'edit' ? 'Edit Produk' : 'Tambah Produk';
  $('#pId').value = product?.id || '';
  $('#pTitle').value = product?.title || '';
  $('#pCategory').value = product?.category || 'source-code';
  $('#pCategoryLabel').value = product?.category_label || product?.categoryLabel || '';
  $('#pPrice').value = product?.price || '';
  $('#pOldPrice').value = product?.old_price || product?.oldPrice || '';
  $('#pPriceSuffix').value = product?.price_suffix || product?.priceSuffix || '';
  $('#pBadge').value = product?.badge || '';
  $('#pRating').value = product?.rating || '5.0';
  $('#pSold').value = product?.sold || 0;
  $('#pDesc').value = product?.desc_text || product?.desc || '';
  $('#pFullDesc').value = product?.full_desc || product?.fullDesc || '';
  $('#pFeatures').value = product?.features || '';
  $('#pImageFile').value = '';

  const wrap = $('#pImagePreviewWrap');
  wrap.innerHTML = pendingProductImage
    ? `<img src="${pendingProductImage}" class="preview-img" alt="Preview">`
    : '';

  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

$('#addProductBtn')?.addEventListener('click', () => openProductModal('add'));

$$('[data-close-admin-modal]').forEach(el => {
  el.addEventListener('click', () => {
    el.closest('.admin-modal').classList.remove('open');
  });
});

$('#pImageFile')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran gambar maksimal 2MB');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingProductImage = ev.target.result;
    $('#pImagePreviewWrap').innerHTML = `<img src="${pendingProductImage}" class="preview-img" alt="Preview">`;
  };
  reader.readAsDataURL(file);
});

$('#saveProductBtn')?.addEventListener('click', async () => {
  const title = $('#pTitle').value.trim();
  const price = parseInt($('#pPrice').value, 10);

  if (!title || !price) {
    alert('Nama produk dan harga wajib diisi');
    return;
  }

  const data = {
    title,
    category: $('#pCategory').value,
    category_label: $('#pCategoryLabel').value.trim() || $('#pCategory').value,
    price,
    old_price: parseInt($('#pOldPrice').value, 10) || null,
    price_suffix: $('#pPriceSuffix').value.trim() || '',
    badge: $('#pBadge').value || '',
    rating: $('#pRating').value.trim() || '5.0',
    sold: parseInt($('#pSold').value, 10) || 0,
    desc_text: $('#pDesc').value.trim(),
    full_desc: $('#pFullDesc').value.trim(),
    features: $('#pFeatures').value.trim(),
    image: pendingProductImage || ''
  };

  const btn = $('#saveProductBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const id = $('#pId').value;
    if (id) await DB.updateProduct(id, data);
    else await DB.addProduct(data);

    closeProductModal();
    await renderProductsTable();
    await renderDashboard();
  } catch (e) {
    alert('Gagal simpan produk: ' + e.message);
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

window.editProduct = async function(id) {
  const product = await DB.getProduct(id);
  if (product) openProductModal('edit', product);
};

window.deleteProductConfirm = async function(id) {
  if (!confirm('Hapus produk ini?')) return;
  try {
    await DB.deleteProduct(id);
    await renderProductsTable();
    await renderDashboard();
  } catch (e) {
    alert('Gagal hapus produk: ' + e.message);
  }
};

/* ---------- ORDERS TABLE ---------- */
async function renderOrdersTable() {
  const orders = await DB.getOrders();
  const tbody = $('#ordersTable');

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada pesanan</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="color:var(--text);font-weight:500">${escapeHtml(o.id)}</td>
      <td>
        <div style="color:var(--text)">${escapeHtml(o.customer_name || o.customer?.name || '-')}</div>
        <div style="font-size:11.5px;color:var(--text-3)">${escapeHtml(o.customer_phone || o.customer?.phone || '')}</div>
      </td>
      <td style="color:var(--text);font-weight:500">${rupiah(o.total)}</td>
      <td><span class="status-pill ${o.status}">${DB.statusLabel(o.status)}</span></td>
      <td>${formatDate(o.created_at || o.createdAt)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">Detail</button>
          <select class="btn btn-secondary btn-sm" style="padding:5px 8px" onchange="changeStatus('${o.id}', this.value)">
            <option value="">Ubah Status</option>
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Menunggu</option>
            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Diproses</option>
            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Dibayar</option>
            <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Selesai</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
          </select>
        </div>
      </td>
    </tr>
  `).join('');
}

window.changeStatus = async function(id, status) {
  if (!status) return;
  try {
    await DB.updateOrderStatus(id, status);
    await renderOrdersTable();
    await renderDashboard();
  } catch (e) {
    alert('Gagal ubah status: ' + e.message);
  }
};

window.viewOrder = async function(id) {
  const order = await DB.findOrder(id);
  if (!order) return;
  const items = (order.items || []).map(i => `${i.product} × ${i.qty} = ${rupiah(i.price * i.qty)}`).join('\n');
  alert(
    `Order ID: ${order.id}\n` +
    `Customer: ${order.customer_name || order.customer?.name || '-'}\n` +
    `Email: ${order.customer_email || order.customer?.email || '-'}\n` +
    `Phone: ${order.customer_phone || order.customer?.phone || '-'}\n` +
    `Status: ${DB.statusLabel(order.status)}\n` +
    `Tanggal: ${formatDate(order.created_at || order.createdAt)}\n\n` +
    `Items:\n${items}\n\n` +
    `Total: ${rupiah(order.total)}`
  );
};

/* ---------- EXPORT CSV ---------- */
$('#exportOrdersBtn')?.addEventListener('click', async () => {
  const orders = await DB.getOrders();
  if (orders.length === 0) {
    alert('Belum ada pesanan untuk di-export');
    return;
  }

  const headers = ['Order ID', 'Tanggal', 'Nama', 'Email', 'Phone', 'Produk', 'Total', 'Status'];
  const rows = orders.map(o => {
    const items = (o.items || []).map(i => `${i.product} x${i.qty}`).join('; ');
    return [
      o.id,
      formatDate(o.created_at || o.createdAt),
      o.customer_name || o.customer?.name || '',
      o.customer_email || o.customer?.email || '',
      o.customer_phone || o.customer?.phone || '',
      items,
      o.total,
      DB.statusLabel(o.status)
    ];
  });

  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rexnh-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ---------- SETTINGS PANEL ---------- */
async function renderSettingsPanel() {
  const configured = DB.isConfigured();
  const cfg = DB.getSbConfig();
  const statusWrap = $('#connStatusWrap');
  const user = await DB.getUser();

  if (configured) {
    statusWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="connection-badge online"><span class="dot"></span>Terhubung ke Supabase</span>
        <span style="font-size:12.5px;color:var(--text-3)">${escapeHtml(cfg.url)}</span>
      </div>
      ${user ? `<div style="margin-top:12px;font-size:13px;color:var(--text-2)">
        <strong>Login sebagai:</strong> ${escapeHtml(user.email)}
      </div>` : ''}
    `;
  } else {
    statusWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="connection-badge offline"><span class="dot"></span>Menggunakan localStorage</span>
        <span style="font-size:12.5px;color:var(--text-3)">Supabase belum dikonfigurasi</span>
      </div>
    `;
  }

  $('#sbUrl').value = cfg?.url || '';
  $('#sbKey').value = cfg?.key || '';
}

/* ---------- SAVE SUPABASE CONFIG ---------- */
$('#saveSbBtn')?.addEventListener('click', async () => {
  const url = $('#sbUrl').value.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const key = $('#sbKey').value.trim();

  if (!url || !key) {
    alert('URL dan key wajib diisi');
    return;
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    alert('Format URL salah. Contoh: https://xxxxx.supabase.co');
    return;
  }

  const btn = $('#saveSbBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Testing...';

  try {
    const testClient = window.supabase.createClient(url, key);
    const { error } = await testClient.from('products').select('id').limit(1);

    if (error && !error.message.includes('does not exist') && !error.message.includes('relation')) {
      throw new Error(error.message);
    }

    DB.saveSbConfig({ url, key });
    alert('Koneksi berhasil! Konfigurasi tersimpan. Silakan login ulang.');
    await DB.logout();
    checkAuth();
  } catch (e) {
    alert('Koneksi gagal: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

$('#clearSbBtn')?.addEventListener('click', async () => {
  if (!confirm('Hapus konfigurasi Supabase? Data akan kembali ke localStorage.')) return;
  DB.clearSbConfig();
  await DB.logout();
  checkAuth();
  alert('Konfigurasi Supabase dihapus.');
});

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  await checkAuth();
});
