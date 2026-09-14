/* ============================================================
   DATA LAYER — Supabase Auth + RLS + Duitku Settings
============================================================ */

let supabaseClient = null;

const DB = {
  KEYS: {
    PRODUCTS: 'rexnh_products',
    BANNER: 'rexnh_banner',
    ORDERS: 'rexnh_orders',
    SB_CONFIG: 'rexnh_supabase_config'
  },

  /* ---------- SUPABASE CONFIG ---------- */
  getSbConfig() {
    const envUrl = import.meta.env?.VITE_SUPABASE_URL;
    const envKey = import.meta.env?.VITE_SUPABASE_KEY;
    if (envUrl && envKey) return { url: envUrl, key: envKey };
    try {
      const manual = JSON.parse(localStorage.getItem(this.KEYS.SB_CONFIG) || 'null');
      if (manual && manual.url && manual.key) return manual;
    } catch {}
    return null;
  },

  saveSbConfig(config) {
    localStorage.setItem(this.KEYS.SB_CONFIG, JSON.stringify(config));
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

  client() {
    return supabaseClient;
  },

  /* ---------- AUTH ---------- */
  async getSession() {
    if (!supabaseClient) return null;
    try {
      const { data } = await supabaseClient.auth.getSession();
      return data.session;
    } catch (e) { return null; }
  },

  async getUser() {
    if (!supabaseClient) return null;
    try {
      const { data } = await supabaseClient.auth.getUser();
      return data.user;
    } catch (e) { return null; }
  },

  async login(email, password) {
    if (!supabaseClient) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
  },

  async isLoggedIn() {
    if (!supabaseClient) return false;
    const session = await this.getSession();
    return !!session;
  },

  /* ---------- LEGACY AUTH ---------- */
  async getAdminPassword() {
    return localStorage.getItem('rexnh_admin_password') || 'rexnh2026';
  },

  async setAdminPassword(newPassword) {
    localStorage.setItem('rexnh_admin_password', newPassword);
    return true;
  },

  async verifyPassword(password) {
    const stored = await this.getAdminPassword();
    if (password === stored) {
      sessionStorage.setItem('rexnh_admin_auth', 'true');
      return true;
    }
    return false;
  },

  /* ---------- SETTINGS (Duitku, dll) ---------- */
  async getSetting(key) {
    if (!supabaseClient) return null;
    try {
      const { data, error } = await supabaseClient
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!error && data) return data.value;
    } catch (e) { /* ignore */ }
    return null;
  },

  async setSetting(key, value) {
    if (!supabaseClient) throw new Error('Supabase belum dikonfigurasi');
    const { error } = await supabaseClient
      .from('settings')
      .upsert([{ key, value, updated_at: new Date().toISOString() }]);
    if (error) throw error;
  },

  async getDuitkuConfig() {
    if (!supabaseClient) return { merchantCode: '', apiKey: '', env: 'sandbox' };
    try {
      const { data, error } = await supabaseClient
        .from('settings')
        .select('key, value')
        .in('key', ['duitku_merchant_code', 'duitku_api_key', 'duitku_env']);
      if (error) return { merchantCode: '', apiKey: '', env: 'sandbox' };
      const config = {};
      (data || []).forEach(r => { config[r.key] = r.value; });
      return {
        merchantCode: config.duitku_merchant_code || '',
        apiKey: config.duitku_api_key || '',
        env: config.duitku_env || 'sandbox'
      };
    } catch (e) {
      return { merchantCode: '', apiKey: '', env: 'sandbox' };
    }
  },

  async saveDuitkuConfig({ merchantCode, apiKey, env }) {
    if (!supabaseClient) throw new Error('Supabase belum dikonfigurasi');
    const { error } = await supabaseClient
      .from('settings')
      .upsert([
        { key: 'duitku_merchant_code', value: merchantCode, updated_at: new Date().toISOString() },
        { key: 'duitku_api_key', value: apiKey, updated_at: new Date().toISOString() },
        { key: 'duitku_env', value: env, updated_at: new Date().toISOString() }
      ]);
    if (error) throw error;
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
        if (error) console.error('[DB] getProducts error:', error.message);
      } catch (e) {
        console.error('[DB] getProducts exception:', e);
      }
    }
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    } catch { return []; }
  },

  async addProduct(product) {
    product.id = 'P' + Date.now();
    product.created_at = new Date().toISOString();

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('products')
        .insert([product])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
    products.push(product);
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    return product;
  },

  async updateProduct(id, data) {
    data.updated_at = new Date().toISOString();

    if (supabaseClient) {
      const { data: updated, error } = await supabaseClient
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated;
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
      const { error } = await supabaseClient.from('products').delete().eq('id', id);
      if (error) throw error;
      return;
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
          .maybeSingle();
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
          .maybeSingle();
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
      const { error } = await supabaseClient.from('banner').upsert([banner]);
      if (error) throw error;
      return;
    }
    localStorage.setItem(this.KEYS.BANNER, JSON.stringify(banner));
  },

  async clearBanner() {
    if (supabaseClient) {
      await supabaseClient.from('banner').delete().eq('id', 1);
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
      const { data, error } = await supabaseClient
        .from('orders')
        .insert([dbOrder])
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const orders = JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    orders.unshift(order);
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    return order;
  },

  async updateOrderStatus(id, status) {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return;
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
          .maybeSingle();
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
    if (!Array.isArray(products)) return [];
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
function initSupabase() {
  const cfg = DB.getSbConfig();
  if (!cfg || !cfg.url || !cfg.key) {
    supabaseClient = null;
    console.log('[Supabase] Not configured');
    return null;
  }
  if (!window.supabase) {
    console.warn('[Supabase] SDK not loaded');
    return null;
  }
  try {
    supabaseClient = window.supabase.createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('[Supabase] Client initialized:', cfg.url);
    return supabaseClient;
  } catch (e) {
    console.error('[Supabase] Init failed:', e);
    supabaseClient = null;
    return null;
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

export { DB, initSupabase, rupiah, formatDate };
