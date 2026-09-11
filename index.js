// ============================================================
// STARFIELD
// ============================================================
(function() {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, stars = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars = [];
    const count = Math.min(200, Math.floor((w * h) / 10000));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        baseA: Math.random() * 0.5 + 0.15,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015
      });
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

  save() {
    localStorage.setItem('andre_store_cart', JSON.stringify(this.items));
  },

  add(product, price) {
    const existing = this.items.find(i => i.product === product);
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({ product, price, qty: 1 });
    }
    this.save();
    this.updateUI();
  },

  remove(product) {
    this.items = this.items.filter(i => i.product !== product);
    this.save();
    this.updateUI();
  },

  getTotal() {
    return this.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  },

  getCount() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  },

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
        <button class="cart-item-remove" onclick="Cart.remove('${item.product.replace(/'/g, "\\'")}')">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `).join('');

    totalEl.textContent = 'Rp ' + formatRupiah(this.getTotal());
    checkoutBtn.disabled = false;

    if (window.lucide) lucide.createIcons();
  }
};

// ============================================================
// FORMAT RUPIAH
// ============================================================
function formatRupiah(num) {
  return num.toLocaleString('id-ID');
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Init Lucide icons
  if (window.lucide) lucide.createIcons();

  // Init cart UI
  Cart.updateUI();

  // Buy buttons
  document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.product;
      const price = parseInt(btn.dataset.price, 10);
      Cart.add(product, price);
      openCart();
    });
  });

  // Order buttons
  document.querySelectorAll('.btn-order').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = btn.dataset.product;
      const price = parseInt(btn.dataset.price, 10);
      Cart.add(product, price);
      openCart();
    });
  });

  // Cart toggle
  const cartBtn = document.getElementById('cartBtn');
  const cartClose = document.getElementById('cartClose');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartDrawer = document.getElementById('cartDrawer');

  function openCart() {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  cartBtn?.addEventListener('click', openCart);
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

  // Expose openCart globally for buy buttons
  window.openCart = openCart;

  // Checkout button
  const checkoutBtn = document.getElementById('checkoutBtn');
  checkoutBtn?.addEventListener('click', () => {
    if (Cart.items.length === 0) return;
    initiatePayment();
  });
});

// ============================================================
// DUITKU PAYMENT INTEGRATION
// ============================================================
async function initiatePayment() {
  const checkoutBtn = document.getElementById('checkoutBtn');
  const originalText = checkoutBtn.innerHTML;

  checkoutBtn.disabled = true;
  checkoutBtn.innerHTML = '<i data-lucide="loader-2"></i> Memproses...';
  if (window.lucide) lucide.createIcons();

  try {
    // Generate unique order ID
    const orderId = 'ANDRE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Prepare payment data
    const paymentData = {
      merchantOrderId: orderId,
      paymentAmount: Cart.getTotal(),
      productDetails: Cart.items.map(i => i.product).join(', '),
      email: 'customer@example.com', // Ganti dengan form input di production
      customerVaName: 'Customer',
      items: Cart.items,
      returnUrl: window.location.origin + '/?payment=success',
      callbackUrl: window.location.origin + '/api/duitku-callback'
    };

    // ============================================================
    // PRODUCTION: Kirim ke backend untuk diproses ke Duitku API
    // ============================================================
    // const response = await fetch('/api/create-payment', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(paymentData)
    // });
    // const result = await response.json();
    // window.location.href = result.paymentUrl;

    // ============================================================
    // DEVELOPMENT: Simulasi redirect ke Duitku Sandbox
    // ============================================================
    console.log('Payment initiated:', paymentData);

    // Tampilkan info ke user (sementara, sampai backend ready)
    alert(
      'Order ID: ' + orderId + '\n' +
      'Total: Rp ' + formatRupiah(Cart.getTotal()) + '\n\n' +
      'Integrasi Duitku akan segera aktif. Hubungi WhatsApp untuk menyelesaikan pembayaran.'
    );

    // Clear cart setelah sukses (uncomment di production)
    // Cart.items = [];
    // Cart.save();
    // Cart.updateUI();
    // closeCart();

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
// SMOOTH SCROLL (Lenis)
// ============================================================
(function() {
  if (typeof Lenis === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80, duration: 1.2 });
      }
    });
  });
})();

// ============================================================
// GSAP ANIMATIONS
// ============================================================
(function() {
  if (typeof gsap === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  // Hero animation
  gsap.from('.hero-badge', { opacity: 0, y: 20, duration: 0.8, ease: 'power3.out' });
  gsap.from('h1', { opacity: 0, y: 30, duration: 0.9, delay: 0.1, ease: 'power3.out' });
  gsap.from('.hero-desc', { opacity: 0, y: 20, duration: 0.8, delay: 0.2, ease: 'power3.out' });
  gsap.from('.hero-actions', { opacity: 0, y: 20, duration: 0.8, delay: 0.3, ease: 'power3.out' });
  gsap.from('.stat', { opacity: 0, y: 20, duration: 0.8, delay: 0.4, stagger: 0.1, ease: 'power3.out' });

  // Product cards on scroll
  gsap.utils.toArray('.product-card, .service-card').forEach((card, i) => {
    gsap.from(card, {
      opacity: 0,
      y: 30,
      duration: 0.7,
      delay: (i % 4) * 0.1,
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        once: true
      }
    });
  });
})();
