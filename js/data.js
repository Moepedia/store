/* ============================================================
   DATA LAYER — Supabase + localStorage fallback
   Konfigurasi Supabase & password admin disimpan di localStorage
============================================================ */

const DB = {
  KEYS: {
    PRODUCTS: 'rexnh_products',
    BANNER: 'rexnh_banner',
    ORDERS: 'rexnh_orders',
    AUTH: 'rexnh_admin_auth',
    SB_CONFIG: 'rexnh_supabase_config'
  },

  /* ---------- SUPABASE CONFIG ---------- */
  getSbConfig() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.SB_CONFIG) || 'null');
    } catch { return null; }
  },

  saveSbConfig(config) {
    localStorage.setItem(this.KEYS.SB_CONFIG, JSON.stringify(config));
    // Re-init client
    initSupabase();
  },

  clearSbConfig() {
    localStorage.removeItem(this.KEYS.SB_CONFIG);
    supabaseClient = null;
  },

  isConfigured() {
    const cfg = this.getSbConfig();
    return !!(cfg && cfg.url && cfg.key);
  },

  /* ---------- SUPABASE CLIENT ---------- */
  client() {
    return supabaseClient;
  },

  /* ---------- AUTH (password disimpan di Supabase / fallback localStorage) ---------- */
  async getAdminPassword() {
    // Coba dari Supabase dulu
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('settings')
          .select('value')
          .eq('key', 'admin_password')
          .single();
        if (!error && data?.value) return data.value;
      } catch (e) { /* ignore */ }
    }
    // Fallback localStorage
    return localStorage.getItem('rexnh_admin_password') || 'rexnh2026';
  },

  async setAdminPassword(newPassword) {
    // Simpan ke Supabase
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('settings')
          .upsert([{ key: 'admin_password', value: newPassword }]);
        if (!error) {
          localStorage.setItem('rexnh_admin_password', newPassword);
          return true;
        }
      } catch (e) { /* ignore */ }
    }
    // Fallback localStorage
    localStorage.setItem('rexnh_admin_password', newPassword);
    return true;
  },

  async verifyPassword(password) {
    const stored = await this.getAdminPassword();
    if (password === stored) {
      sessionStorage.setItem(this.KEYS.AUTH, 'true');
      return true;
    }
    return false;
  },

  isLoggedIn() {
    return sessionStorage.getItem(this.KEYS.AUTH) === 'true';
  },

  logout() {
    sessionStorage.removeItem(this.KEYS.AUTH);
  },

  /* ---------- PRODUCTS ---------- */
  async getProducts() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    } catch { return []; }
  },

  async addProduct(product) {
    product.id = 'P' + Date.now();
    product.created_at = new Date().toISOString();

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .insert([product])
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }

    const products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    products.push(product);
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    return product;
  },

  async updateProduct(id, data) {
    data.updated_at = new Date().toISOString();

    if (supabaseClient) {
      try {
        const { data: updated, error } = await supabaseClient
          .from('products')
          .update(data)
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated;
      } catch (e) { /* fallback */ }
    }

    const products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...data };
      localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
      return products[idx];
    }
    return null;
  },

  async deleteProduct(id) {
    if (supabaseClient) {
      try {
        await supabaseClient.from('products').delete().eq('id', id);
      } catch (e) { /* ignore */ }
    }
    const products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products.filter(p => p.id !== id)));
  },

  async getProduct(id) {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    const products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    return products.find(p => p.id === id);
  },

  /* ---------- BANNER ---------- */
  async getBanner() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('banner')
          .select('*')
          .eq('id', 1)
          .single();
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.BANNER) || 'null');
    } catch { return null; }
  },

  async saveBanner(banner) {
    banner.id = 1;
    banner.updated_at = new Date().toISOString();

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('banner').upsert([banner]);
        if (!error) return;
      } catch (e) { /* fallback */ }
    }
    localStorage.setItem(this.KEYS.BANNER, JSON.stringify(banner));
  },

  async clearBanner() {
    if (supabaseClient) {
      try {
        await supabaseClient.from('banner').delete().eq('id', 1);
      } catch (e) { /* ignore */ }
    }
    localStorage.removeItem(this.KEYS.BANNER);
  },

  /* ---------- ORDERS ---------- */
  async getOrders() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    } catch { return []; }
  },

  async addOrder(order) {
    order.id = 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    order.created_at = new Date().toISOString();
    order.status = 'pending';

    const dbOrder = {
      id: order.id,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      items: order.items,
      total: order.total,
      status: order.status,
      created_at: order.created_at
    };

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .insert([dbOrder])
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }

    const orders = JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    orders.unshift(order);
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    return order;
  },

  async updateOrderStatus(id, status) {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (!error) return;
      } catch (e) { /* fallback */ }
    }
    const orders = JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx].status = status;
      localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    }
  },

  async findOrder(id) {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    const orders = JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    return orders.find(o => o.id === id);
  },

  async findOrdersByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .ilike('customer_phone', `%${clean}%`);
        if (!error && data) return data;
      } catch (e) { /* fallback */ }
    }
    const orders = JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    return orders.filter(o => (o.customer_phone || o.customer?.phone || '').replace(/\D/g, '').includes(clean));
  },

  /* ---------- CATEGORIES ---------- */
  async getCategories() {
    const products = await this.getProducts();
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  },

  /* ---------- STATUS HELPERS ---------- */
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

/* ============================================================
   SUPABASE CLIENT INIT
============================================================ */
let supabaseClient = null;

function initSupabase() {
  const cfg = DB.getSbConfig();
  if (!cfg || !cfg.url || !cfg.key) {
    supabaseClient = null;
    console.log('[Supabase] Not configured, using localStorage fallback');
    return;
  }
  if (!window.supabase) {
    console.warn('[Supabase] SDK not loaded');
    return;
  }
  try {
    supabaseClient = window.supabase.createClient(cfg.url, cfg.key);
    console.log('[Supabase] Client initialized:', cfg.url);
  } catch (e) {
    console.error('[Supabase] Init failed:', e);
    supabaseClient = null;
  }
}

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

/* ---------- AUTO INIT (setelah DOM ready) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
