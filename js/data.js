/* ============================================================
   DATA LAYER — localStorage based
   Ganti ke API/backend nanti tinggal ubah di sini
============================================================ */

/* ---------- ADMIN PASSWORD ---------- */
const ADMIN_PASSWORD = 'rexnh2026';

const DB = {
  KEYS: {
    PRODUCTS: 'rexnh_products',
    BANNER: 'rexnh_banner',
    ORDERS: 'rexnh_orders',
    SETTINGS: 'rexnh_settings',
    AUTH: 'rexnh_admin_auth'
  },

  /* ---------- AUTH ---------- */
  isLoggedIn() {
    return sessionStorage.getItem(this.KEYS.AUTH) === 'true';
  },

  login(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(this.KEYS.AUTH, 'true');
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(this.KEYS.AUTH);
  },

  /* ---------- PRODUCTS ---------- */
  getProducts() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    } catch { return []; }
  },

  saveProducts(products) {
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
  },

  addProduct(product) {
    const products = this.getProducts();
    product.id = 'P' + Date.now();
    product.createdAt = new Date().toISOString();
    products.push(product);
    this.saveProducts(products);
    return product;
  },

  updateProduct(id, data) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
    this.saveProducts(products);
    return products[idx];
  },

  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  },

  getProduct(id) {
    return this.getProducts().find(p => p.id === id);
  },

  /* ---------- BANNER ---------- */
  getBanner() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.BANNER) || 'null');
    } catch { return null; }
  },

  saveBanner(banner) {
    localStorage.setItem(this.KEYS.BANNER, JSON.stringify(banner));
  },

  clearBanner() {
    localStorage.removeItem(this.KEYS.BANNER);
  },

  /* ---------- ORDERS ---------- */
  getOrders() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    } catch { return []; }
  },

  saveOrders(orders) {
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
  },

  addOrder(order) {
    const orders = this.getOrders();
    order.id = 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    order.createdAt = new Date().toISOString();
    order.status = 'pending';
    orders.unshift(order);
    this.saveOrders(orders);
    return order;
  },

  updateOrderStatus(id, status) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    this.saveOrders(orders);
    return orders[idx];
  },

  findOrder(id) {
    return this.getOrders().find(o => o.id === id);
  },

  findOrdersByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return this.getOrders().filter(o =>
      (o.customer?.phone || '').replace(/\D/g, '').includes(clean)
    );
  },

  /* ---------- CATEGORIES (derived) ---------- */
  getCategories() {
    const products = this.getProducts();
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  },

  /* ---------- ORDER STATUS HELPERS ---------- */
  statusLabel(status) {
    return {
      pending: 'Menunggu Pembayaran',
      processing: 'Diproses',
      paid: 'Dibayar',
      completed: 'Selesai',
      cancelled: 'Dibatalkan'
    }[status] || status;
  },

  statusDescription(status) {
    return {
      pending: 'Pesanan sudah dibuat, menunggu pembayaran kamu.',
      processing: 'Pembayaran diterima. Pesanan sedang kami proses.',
      paid: 'Pembayaran terkonfirmasi. Produk segera dikirim.',
      completed: 'Pesanan selesai. Terima kasih sudah order!',
      cancelled: 'Pesanan dibatalkan.'
    }[status] || '';
  }
};

/* ---------- HELPERS ---------- */
function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
