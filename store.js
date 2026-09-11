// ============================================================
// STARFIELD
// ============================================================
(function() {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, stars = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; buildStars(); }
  function buildStars() {
    stars = [];
    const count = Math.min(180, Math.floor((w * h) / 12000));
    for (let i = 0; i < count; i++) {
      stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.3, baseA: Math.random() * 0.5 + 0.15, twinkle: Math.random() * Math.PI * 2, speed: 0.005 + Math.random() * 0.015 });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.twinkle += s.speed;
      const alpha = s.baseA + Math.sin(s.twinkle) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
      ctx.fill();
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ============================================================
// CART SYSTEM
// ============================================================
const Cart = {
  items: JSON.parse(localStorage.getItem('andre_store_cart') || '[]'),
  save() { localStorage.setItem('andre_store_cart', JSON.stringify(this.items)); },
  add(product, price) {
    const existing = this.items.find(i => i.product === product);
    if (existing) existing.qty += 1;
    else this.items.push({ product, price, qty: 1 });
    this.save(); this.updateUI();
  },
  remove(product) {
    this.items = this.items.filter(i => i.product !== product);
    this.save(); this.updateUI();
  },
  getTotal() { return this.items.reduce((sum, i) => sum + (i.price * i.qty), 0); },
  getCount() { return this.items.reduce((sum, i) => sum + i.qty, 0); },
  updateUI() {
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (!countEl) return;
    countEl.textContent = this.getCount();
    if (this.items.length === 0) {
      itemsEl.innerHTML = '<p class="cart-empty">Keranjang kosong</p>';
      totalEl.textContent = 'Rp 0';
      checkoutBtn.disabled = true;
      return;
    }
    itemsEl.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.product}</div>
          <div class="cart-item-price">Rp ${formatRupiah(item.price * item.qty)}</div>
        </div>
        <button class="cart-item-remove" onclick="Cart.remove('${item.product.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i></button>
      </div>
    `).join('');
    totalEl.textContent = 'Rp ' + formatRupiah(this.getTotal());
    checkoutBtn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
};

function formatRupiah(num) { return num.toLocaleString('id-ID'); }

// ============================================================
// FILTER & SORT
// ============================================================
function filterProducts() {
  const activeFilter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('sortSelect')?.value || 'popular';
  const cards = Array.from(document.querySelectorAll('.product-card'));
  let visible = 0;

  cards.forEach(card => {
    const category = card.dataset.category;
    const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const desc = card.querySelector('p')?.textContent.toLowerCase() || '';
    const matchesFilter = activeFilter === 'all' || category === activeFilter;
    const matchesSearch = !searchQuery || title.includes(searchQuery) || desc.includes(searchQuery);
    if (matchesFilter && matchesSearch) { card.classList.remove('hidden'); visible++; }
    else card.classList.add('hidden');
  });

  const visibleCards = cards.filter(c => !c.classList.contains('hidden'));
  visibleCards.sort((a, b) => {
    const priceA = parseInt(a.dataset.price), priceB = parseInt(b.dataset.price);
    const ratingA = parseFloat(a.dataset.rating), ratingB = parseFloat(b.dataset.rating);
    const soldA = parseInt(a.dataset.sold), soldB = parseInt(b.dataset.sold);
    if (sortBy === 'price-low') return priceA - priceB;
    if (sortBy === 'price-high') return priceB - priceA;
    if (sortBy === 'rating') return ratingB - ratingA;
    return soldB - soldA;
  });

  const grid = document.getElementById('productGrid');
  visibleCards.forEach(card => grid.appendChild(card));

  const countEl = document.getElementById('productCount');
  if (countEl) countEl.textContent = `${visible} produk ditemukan`;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  Cart.updateUI();

  // Search toggle
  const searchToggle = document.getElementById('searchToggle');
  const searchBar = document.getElementById('searchBar');
  const searchClose = document.getElementById('searchClose');
  const searchInput = document.getElementById('searchInput');

  searchToggle?.addEventListener('click', () => {
    searchBar.classList.add('open');
    searchInput.focus();
  });
  searchClose?.addEventListener('click', () => {
    searchBar.classList.remove('open');
    searchInput.value = '';
    filterProducts();
  });
  searchInput?.addEventListener('input', filterProducts);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterProducts();
    });
  });

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', filterProducts);

  // Buy buttons
  document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      Cart.add(btn.dataset.product, parseInt(btn.dataset.price, 10));
      openCart();
    });
  });

  // Cart toggle
  const cartBtn = document.getElementById('cartBtn');
  const cartClose = document.getElementById('cartClose');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawer = document.getElementById('cartDrawer');

  window.openCart = () => {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeCart = () => {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  };
  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  // Checkout
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (Cart.items.length === 0) return;
    initiatePayment();
  });
});

// ============================================================
// DUITKU PAYMENT (Production Ready Structure)
// ============================================================
async function initiatePayment() {
  const checkoutBtn = document.getElementById('checkoutBtn');
  const originalText = checkoutBtn.innerHTML;
  checkoutBtn.disabled = true;
  checkoutBtn.innerHTML = '<i data-lucide="loader-2"></i> Memproses...';
  if (window.lucide) lucide.createIcons();

  try {
    const orderId = 'ANDRE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const paymentData = {
      merchantOrderId: orderId,
      paymentAmount: Cart.getTotal(),
      productDetails: Cart.items.map(i => i.product).join(', '),
      email: 'customer@example.com',
      customerVaName: 'Customer',
      items: Cart.items,
      returnUrl: window.location.origin + '/?payment=success',
      callbackUrl: window.location.origin + '/api/duitku-callback'
    };

    // ============================================================
    // PRODUCTION: Uncomment setelah backend siap
    // ============================================================
    // const response = await fetch('/api/create-payment', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(paymentData)
    // });
    // const result = await response.json();
    // if (result.paymentUrl) window.location.href = result.paymentUrl;
    // else throw new Error(result.error || 'Gagal membuat pembayaran');

    // ============================================================
    // DEVELOPMENT: Log ke console
    // ============================================================
    console.log('Payment initiated:', paymentData);
    alert('Order ID: ' + orderId + '\nTotal: Rp ' + formatRupiah(Cart.getTotal()) + '\n\nIntegrasi Duitku siap. Deploy backend untuk mengaktifkan pembayaran.');

  } catch (error) {
    console.error('Payment error:', error);
    alert('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
}

// ============================================================
// SMOOTH SCROLL
// ============================================================
(function() {
  if (typeof Lenis === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -80, duration: 1.2 }); }
    });
  });
})();
