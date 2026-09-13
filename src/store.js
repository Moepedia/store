/* ============================================================
   STOREFRONT LOGIC — ES Module
============================================================ */
import { DB, initSupabase, rupiah, formatDate } from './data.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- ESCAPE HELPERS ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- TOAST ---------- */
function showToast(msg) {
  const toast = $('#toast');
  if (!toast) return;
  $('#toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ---------- CART ---------- */
const Cart = {
  items: JSON.parse(localStorage.getItem('rexnh_cart') || '[]'),
  save() { localStorage.setItem('rexnh_cart', JSON.stringify(this.items)); },

  add(product, price) {
    const found = this.items.find(i => i.product === product);
    if (found) found.qty++;
    else this.items.push({ product, price, qty: 1 });
    this.save();
    this.render();
    showToast('Ditambahkan ke keranjang');
  },

  remove(product) {
    this.items = this.items.filter(i => i.product !== product);
    this.save();
    this.render();
  },

  clear() {
    this.items = [];
    this.save();
    this.render();
  },

  total() { return this.items.reduce((s, i) => s + i.price * i.qty, 0); },
  count() { return this.items.reduce((s, i) => s + i.qty, 0); },

  render() {
    const badge = $('#cartBadge');
    const body = $('#drawerBody');
    const total = $('#totalValue');
    const checkout = $('#checkoutBtn');
    if (!badge) return;

    badge.textContent = this.count();
    badge.style.display = this.count() > 0 ? 'flex' : 'none';

    if (this.items.length === 0) {
      body.innerHTML = '<p class="empty">Keranjang kosong</p>';
      total.textContent = 'Rp 0';
      checkout.disabled = true;
      return;
    }

    body.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.product)}</div>
          <div class="cart-item-price">${item.qty} × ${rupiah(item.price)}</div>
        </div>
        <button class="cart-item-remove" data-remove="${escapeAttr(item.product)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');

    total.textContent = rupiah(this.total());
    checkout.disabled = false;

    body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tmp = document.createElement('textarea');
        tmp.innerHTML = btn.dataset.remove;
        this.remove(tmp.value);
      });
    });
  }
};

/* ---------- DRAWER ---------- */
const drawer = $('#drawer');
const overlay = $('#overlay');

function openDrawer() {
  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

$('#cartBtn')?.addEventListener('click', openDrawer);
$('#drawerClose')?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);

/* ---------- MODAL ---------- */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (!drawer.classList.contains('open')) document.body.style.overflow = '';
}
$$('[data-close-modal]').forEach(el => {
  el.addEventListener('click', () => {
    el.closest('.modal').classList.remove('open');
    if (!drawer.classList.contains('open')) document.body.style.overflow = '';
  });
});

/* ---------- BANNER ---------- */
async function renderBanner() {
  const banner = await DB.getBanner();
  const section = $('#bannerSection');
  if (!section) return;

  if (!banner || !banner.image) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  $('#bannerImg').src = banner.image;
  const link = $('#bannerLink');
  if (banner.link) {
    link.href = banner.link;
    link.target = '_blank';
    link.rel = 'noopener';
  } else {
    link.removeAttribute('href');
    link.removeAttribute('target');
  }
}

/* ---------- CATEGORIES ---------- */
let activeFilter = 'all';

async function renderCategories() {
  const catsInner = $('#catsInner');
  if (!catsInner) return;

  const categories = await DB.getCategories();
  const labels = {
    'source-code': 'Source Code',
    'template': 'Template',
    'service': 'Jasa'
  };

  let html = '<button class="cat active" data-filter="all">Semua</button>';
  categories.forEach(cat => {
    html += `<button class="cat" data-filter="${escapeAttr(cat)}">${escapeHtml(labels[cat] || cat)}</button>`;
  });
  catsInner.innerHTML = html;

  catsInner.querySelectorAll('.cat').forEach(tab => {
    tab.addEventListener('click', () => {
      catsInner.querySelectorAll('.cat').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      applyFilters();
    });
  });
}

/* ---------- PRODUCTS RENDER ---------- */
async function renderProducts() {
  const grid = $('#grid');
  const emptyState = $('#emptyState');
  if (!grid) return;

  let products = [];
  try {
    products = await DB.getProducts();
  } catch (e) {
    console.error('[Store] getProducts error:', e);
    products = [];
  }

  if (!Array.isArray(products)) {
    console.warn('[Store] products is not array:', products);
    products = [];
  }

  if (products.length === 0) {
    grid.innerHTML = '';
    emptyState?.classList.remove('hidden');
    $('#resultCount').textContent = '0 produk';
    return;
  }

  emptyState?.classList.add('hidden');

  grid.innerHTML = products.map(p => {
    const badge = p.badge ? `<span class="badge ${escapeAttr(p.badge)}">${badgeLabel(p.badge)}</span>` : '';
    const thumb = p.image
      ? `<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" loading="lazy">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    const oldPrice = (p.old_price || p.oldPrice) ? `<span class="price-old">${rupiah(p.old_price || p.oldPrice)}</span>` : '';
    const suffix = (p.price_suffix || p.priceSuffix) ? `<span class="price-suffix">${escapeHtml(p.price_suffix || p.priceSuffix)}</span>` : '';
    const rating = p.rating || '5.0';
    const sold = p.sold || 0;
    const soldLabel = p.category === 'service' ? 'pesanan' : 'terjual';
    const catLabel = p.category_label || p.categoryLabel || p.category || '';
    const desc = p.desc_text || p.desc || '';
    const createdAt = p.created_at || p.createdAt || '';

    return `
      <article class="card"
        data-id="${escapeAttr(p.id)}"
        data-category="${escapeAttr(p.category || '')}"
        data-price="${p.price || 0}"
        data-rating="${escapeAttr(rating)}"
        data-sold="${sold}"
        data-created="${escapeAttr(createdAt)}">
        <div class="card-thumb">
          ${thumb}
          ${badge}
        </div>
        <div class="card-body">
          <span class="card-cat">${escapeHtml(catLabel)}</span>
          <h3 class="card-title">${escapeHtml(p.title)}</h3>
          <p class="card-desc">${escapeHtml(desc)}</p>
          <div class="card-meta">
            <div class="meta-item">
              <svg class="star" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${escapeHtml(rating)}
            </div>
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${sold} ${soldLabel}
            </div>
          </div>
          <div class="card-foot">
            <div class="price">
              <span class="price-now">${rupiah(p.price)}${suffix}</span>
              ${oldPrice}
            </div>
            <button class="btn-buy" data-product="${escapeAttr(p.title)}" data-price="${p.price}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              ${p.category === 'service' ? 'Pesan' : 'Beli'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindProductEvents();
  applyFilters();
}

function badgeLabel(badge) {
  return { hot: 'Terlaris', best: 'Terbaik', new: 'Baru' }[badge] || badge;
}

function bindProductEvents() {
  $$('.card').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-buy')) return;
      const product = await DB.getProduct(card.dataset.id);
      if (!product) return;
      showProductModal(product);
    });
  });

  $$('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tmp = document.createElement('textarea');
      tmp.innerHTML = btn.dataset.product;
      Cart.add(tmp.value, parseInt(btn.dataset.price, 10));
      openDrawer();
    });
  });
}

/* ---------- PRODUCT MODAL ---------- */
function showProductModal(product) {
  $('#modalTitle').textContent = product.title;
  $('#modalCat').textContent = product.category_label || product.categoryLabel || product.category || '';
  $('#modalDesc').textContent = product.full_desc || product.fullDesc || product.desc_text || product.desc || '';
  $('#modalPrice').textContent = rupiah(product.price);
  const oldP = product.old_price || product.oldPrice;
  $('#modalPriceOld').textContent = oldP ? rupiah(oldP) : '';

  const features = (product.features || '').split('|').filter(Boolean);
  $('#modalFeatures').innerHTML = features.map(f => `
    <li>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      ${escapeHtml(f)}
    </li>
  `).join('');

  const thumbWrap = $('#modalThumbWrap');
  if (product.image) {
    $('#modalThumb').src = product.image;
    thumbWrap.style.display = 'block';
  } else {
    thumbWrap.style.display = 'none';
  }

  const buyBtn = $('#modalBuyBtn');
  buyBtn.onclick = () => {
    Cart.add(product.title, product.price);
    closeModal('productModal');
    openDrawer();
  };

  openModal('productModal');
}

/* ---------- FILTER / SEARCH / SORT ---------- */
function applyFilters() {
  const grid = $('#grid');
  const searchInput = $('#searchInput');
  const sortSelect = $('#sortSelect');
  const resultCount = $('#resultCount');
  if (!grid) return;

  const q = (searchInput?.value || '').toLowerCase().trim();
  const cards = Array.from(grid.querySelectorAll('.card'));
  let visible = 0;

  cards.forEach(card => {
    const cat = card.dataset.category;
    const title = card.querySelector('.card-title').textContent.toLowerCase();
    const desc = card.querySelector('.card-desc').textContent.toLowerCase();
    const matchCat = activeFilter === 'all' || cat === activeFilter;
    const matchSearch = !q || title.includes(q) || desc.includes(q);
    if (matchCat && matchSearch) { card.classList.remove('hidden'); visible++; }
    else card.classList.add('hidden');
  });

  const sortBy = sortSelect?.value || 'popular';
  const visibleCards = cards.filter(c => !c.classList.contains('hidden'));
  visibleCards.sort((a, b) => {
    const pa = +a.dataset.price, pb = +b.dataset.price;
    const ra = +a.dataset.rating, rb = +b.dataset.rating;
    const sa = +a.dataset.sold, sb = +b.dataset.sold;
    const ca = a.dataset.created || '', cb = b.dataset.created || '';
    if (sortBy === 'price-low') return pa - pb;
    if (sortBy === 'price-high') return pb - pa;
    if (sortBy === 'rating') return rb - ra;
    if (sortBy === 'newest') return cb.localeCompare(ca);
    return sb - sa;
  });
  visibleCards.forEach(c => grid.appendChild(c));

  if (resultCount) resultCount.textContent = visible + ' produk';
}

/* ---------- CHECKOUT ---------- */
$('#checkoutBtn')?.addEventListener('click', () => {
  if (Cart.items.length === 0) return;

  $('#orderSummary').innerHTML = `
    <div class="order-summary-title">Ringkasan Order</div>
    ${Cart.items.map(i => `
      <div class="order-line">
        <span>${escapeHtml(i.product)} × ${i.qty}</span>
        <span>${rupiah(i.price * i.qty)}</span>
      </div>
    `).join('')}
    <div class="order-line total">
      <span>Total</span>
      <span>${rupiah(Cart.total())}</span>
    </div>
  `;

  closeDrawer();
  openModal('checkoutModal');
});

/* ---------- PAYMENT ---------- */
$('#coPayBtn')?.addEventListener('click', async () => {
  const name = $('#coName').value.trim();
  const email = $('#coEmail').value.trim();
  const phone = $('#coPhone').value.trim();

  if (!name || !email || !phone) {
    showToast('Lengkapi data terlebih dahulu');
    return;
  }

  const btn = $('#coPayBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const order = await DB.addOrder({
      customer: { name, email, phone },
      items: Cart.items.map(i => ({ product: i.product, price: i.price, qty: i.qty })),
      total: Cart.total(),
      status: 'pending',
      paymentMethod: 'duitku'
    });

    const payload = {
      merchantOrderId: order.id,
      paymentAmount: order.total,
      productDetails: order.items.map(i => i.product).join(', '),
      email: email,
      customerVaName: name,
      phoneNumber: phone,
      items: order.items,
      returnUrl: window.location.origin + '/order.html?order=' + order.id,
      callbackUrl: window.location.origin + '/api/duitku-callback'
    };

    // ============================================================
    // PRODUCTION: uncomment setelah backend siap
    // ============================================================
    // const res = await fetch('/api/create-payment', {
    //   method: 'POST',
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify(payload)
    // });
    // const data = await res.json();
    // if (data.paymentUrl) {
    //   Cart.clear();
    //   window.location.href = data.paymentUrl;
    // } else throw new Error(data.error || 'Gagal');

    console.log('Order saved:', order);
    showToast('Order ' + order.id + ' berhasil dibuat');
    Cart.clear();
    btn.disabled = false;
    btn.innerHTML = originalText;
    closeModal('checkoutModal');
    setTimeout(() => {
      window.location.href = 'order.html?order=' + order.id;
    }, 600);
  } catch (e) {
    console.error('Order error:', e);
    showToast('Gagal: ' + (e.message || 'Unknown error'));
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

/* ---------- GLOBAL FOOTER FILTER ---------- */
window.filterFromFooter = function(cat) {
  const tab = document.querySelector(`.cat[data-filter="${cat}"]`);
  if (tab) {
    tab.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    activeFilter = cat;
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log('[Store] Render start. Client ready:', !!DB.client());

  await renderBanner();
  await renderProducts();
  await renderCategories();
  Cart.render();

  $('#searchInput')?.addEventListener('input', applyFilters);
  $('#sortSelect')?.addEventListener('change', applyFilters);
});
