/* ============================================================
   ADMIN LOGIC
============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- AUTH GUARD ---------- */
function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#adminLayout').style.display = 'none';
}
function showAdmin() {
  $('#loginScreen').classList.add('hidden');
  $('#adminLayout').style.display = 'grid';
  renderDashboard();
}

function checkAuth() {
  if (DB.isLoggedIn()) showAdmin();
  else showLogin();
}

$('#loginBtn')?.addEventListener('click', () => {
  const pw = $('#loginPassword').value;
  if (DB.login(pw)) {
    $('#loginError').classList.remove('show');
    $('#loginPassword').value = '';
    showAdmin();
  } else {
    $('#loginError').classList.add('show');
    $('#loginPassword').value = '';
    $('#loginPassword').focus();
  }
});

$('#loginPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('#loginBtn').click();
});

$('#logoutBtn')?.addEventListener('click', () => {
  if (!confirm('Logout dari admin panel?')) return;
  DB.logout();
  showLogin();
});

/* ---------- TABS ---------- */
$$('.sidebar-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') renderDashboard();
    if (btn.dataset.tab === 'products') renderProductsTable();
    if (btn.dataset.tab === 'orders') renderOrdersTable();
    if (btn.dataset.tab === 'banner') renderBannerPanel();
  });
});

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const products = DB.getProducts();
  const orders = DB.getOrders();
  const revenue = orders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((s, o) => s + (o.total || 0), 0);

  $('#statProducts').textContent = products.length;
  $('#statOrders').textContent = orders.length;
  $('#statRevenue').textContent = rupiah(revenue);
}

/* ---------- BANNER ---------- */
let pendingBannerImage = null;

function renderBannerPanel() {
  const banner = DB.getBanner();
  const wrap = $('#bannerPreviewWrap');
  const linkInput = $('#bannerLinkInput');

  if (banner) {
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

$('#saveBannerBtn')?.addEventListener('click', () => {
  if (!pendingBannerImage) {
    alert('Upload gambar banner dulu');
    return;
  }
  DB.saveBanner({
    image: pendingBannerImage,
    link: $('#bannerLinkInput').value.trim()
  });
  alert('Banner tersimpan');
});

$('#clearBannerBtn')?.addEventListener('click', () => {
  if (!confirm('Hapus banner?')) return;
  DB.clearBanner();
  pendingBannerImage = null;
  renderBannerPanel();
});

/* ---------- PRODUCTS TABLE ---------- */
function renderProductsTable() {
  const products = DB.getProducts();
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
      <td>${escapeHtml(p.categoryLabel || p.category || '-')}</td>
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
  $('#pCategoryLabel').value = product?.categoryLabel || '';
  $('#pPrice').value = product?.price || '';
  $('#pOldPrice').value = product?.oldPrice || '';
  $('#pPriceSuffix').value = product?.priceSuffix || '';
  $('#pBadge').value = product?.badge || '';
  $('#pRating').value = product?.rating || '5.0';
  $('#pSold').value = product?.sold || 0;
  $('#pDesc').value = product?.desc || '';
  $('#pFullDesc').value = product?.fullDesc || '';
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

$('#saveProductBtn')?.addEventListener('click', () => {
  const title = $('#pTitle').value.trim();
  const price = parseInt($('#pPrice').value, 10);

  if (!title || !price) {
    alert('Nama produk dan harga wajib diisi');
    return;
  }

  const data = {
    title,
    category: $('#pCategory').value,
    categoryLabel: $('#pCategoryLabel').value.trim() || $('#pCategory').value,
    price,
    oldPrice: parseInt($('#pOldPrice').value, 10) || null,
    priceSuffix: $('#pPriceSuffix').value.trim() || '',
    badge: $('#pBadge').value || '',
    rating: $('#pRating').value.trim() || '5.0',
    sold: parseInt($('#pSold').value, 10) || 0,
    desc: $('#pDesc').value.trim(),
    fullDesc: $('#pFullDesc').value.trim(),
    features: $('#pFeatures').value.trim(),
    image: pendingProductImage || ''
  };

  const id = $('#pId').value;
  if (id) DB.updateProduct(id, data);
  else DB.addProduct(data);

  closeProductModal();
  renderProductsTable();
  renderDashboard();
});

window.editProduct = function(id) {
  const product = DB.getProduct(id);
  if (product) openProductModal('edit', product);
};

window.deleteProductConfirm = function(id) {
  if (!confirm('Hapus produk ini?')) return;
  DB.deleteProduct(id);
  renderProductsTable();
  renderDashboard();
};

/* ---------- ORDERS TABLE ---------- */
function renderOrdersTable() {
  const orders = DB.getOrders();
  const tbody = $('#ordersTable');

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada pesanan</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="color:var(--text);font-weight:500">${escapeHtml(o.id)}</td>
      <td>
        <div style="color:var(--text)">${escapeHtml(o.customer?.name || '-')}</div>
        <div style="font-size:11.5px;color:var(--text-3)">${escapeHtml(o.customer?.phone || '')}</div>
      </td>
      <td style="color:var(--text);font-weight:500">${rupiah(o.total)}</td>
      <td><span class="status-pill ${o.status}">${DB.statusLabel(o.status)}</span></td>
      <td>${formatDate(o.createdAt)}</td>
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

window.changeStatus = function(id, status) {
  if (!status) return;
  DB.updateOrderStatus(id, status);
  renderOrdersTable();
  renderDashboard();
};

window.viewOrder = function(id) {
  const order = DB.findOrder(id);
  if (!order) return;
  const items = order.items.map(i => `${i.product} × ${i.qty} = ${rupiah(i.price * i.qty)}`).join('\n');
  alert(
    `Order ID: ${order.id}\n` +
    `Customer: ${order.customer.name}\n` +
    `Email: ${order.customer.email}\n` +
    `Phone: ${order.customer.phone}\n` +
    `Status: ${DB.statusLabel(order.status)}\n` +
    `Tanggal: ${formatDate(order.createdAt)}\n\n` +
    `Items:\n${items}\n\n` +
    `Total: ${rupiah(order.total)}`
  );
};

/* ---------- EXPORT CSV ---------- */
$('#exportOrdersBtn')?.addEventListener('click', () => {
  const orders = DB.getOrders();
  if (orders.length === 0) {
    alert('Belum ada pesanan untuk di-export');
    return;
  }

  const headers = ['Order ID', 'Tanggal', 'Nama', 'Email', 'Phone', 'Produk', 'Total', 'Status'];
  const rows = orders.map(o => {
    const items = o.items.map(i => `${i.product} x${i.qty}`).join('; ');
    return [
      o.id,
      formatDate(o.createdAt),
      o.customer?.name || '',
      o.customer?.email || '',
      o.customer?.phone || '',
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

/* ---------- HELPERS ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
