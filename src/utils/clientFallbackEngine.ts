import type {
  ActivityLog,
  Client,
  CompanySettingsMap,
  DatabaseStatus,
  Invoice,
  InvoiceLineItem,
  Payment,
  ServiceItem,
  User,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  generateNextDocumentNumber,
  resolveInvoiceStatus,
  DEFAULT_SERVICE_CATEGORIES,
  parseServiceCategories,
  addServiceCategory,
  renameServiceCategory,
  deleteServiceCategory,
} from './invoiceLogic';

const STORAGE_DB_KEY = 'autosmart_local_db_v1';
const STORAGE_GAS_KEY = 'autosmart_gas_config_v1';

interface StoredUser extends User {
  password_plain?: string;
}

interface LocalDbState {
  USERS: StoredUser[];
  CLIENTS: Client[];
  SERVICES: ServiceItem[];
  INVOICES: Invoice[];
  INVOICE_ITEMS: InvoiceLineItem[];
  PAYMENTS: Payment[];
  SETTINGS: CompanySettingsMap;
  ACTIVITY_LOGS: ActivityLog[];
}

interface GasLocalConfig {
  webAppUrl: string;
  apiSecret: string;
  lastSync: string | null;
}

export const DEFAULT_SETTINGS: CompanySettingsMap = {
  company_name: 'Autosmart Digital Solutions',
  tagline: 'Skill Up For Digital Collaboration',
  business_field: 'Digital Learning & Business Solution',
  address:
    'Jl. Brigjen Slamet Riadi VIII/56 Kec. Klojen Kel. Oro-Oro Dowo Kota Malang, Jawa Timur 65112, Indonesia.',
  whatsapp: '085726686267',
  email: 'autosmart2025@gmail.com',
  website: 'https://autosmart-abuhafsh.github.io/Autosmart/',
  logo_url: '/assets/autosmart-logo.png',
  bank_name: 'BCA',
  bank_account_name: 'Muhammad',
  bank_account_number: '0113593935',
  qris_url: '',
  invoice_prefix: 'INV/ASM',
  receipt_prefix: 'KW/ASM',
  document_year: '2026',
  footer_note:
    'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.',
  terms_and_conditions:
    'Pembayaran dilakukan sesuai jatuh tempo yang tertera pada invoice. Bukti pembayaran sah diterbitkan oleh sistem Autosmart Invoice.',
  tax_enabled: 'false',
  tax_rate: '11',
  currency: 'IDR',
  date_format: 'DD MMMM YYYY',
  signatory_name: 'Administrator Autosmart',
  signatory_role: 'Finance & Administration',
};

function getEnvGasUrl(): string {
  try {
    return (import.meta.env?.VITE_GAS_WEB_APP_URL as string) || '';
  } catch {
    return '';
  }
}

export function loadLocalGasConfig(): GasLocalConfig {
  const envUrl = getEnvGasUrl();
  try {
    const raw = localStorage.getItem(STORAGE_GAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GasLocalConfig>;
      return {
        webAppUrl: parsed.webAppUrl || envUrl,
        apiSecret: parsed.apiSecret || '',
        lastSync: parsed.lastSync || null,
      };
    }
  } catch {
    // ignore
  }
  return {
    webAppUrl: envUrl,
    apiSecret: '',
    lastSync: null,
  };
}

export function saveLocalGasConfig(cfg: GasLocalConfig): void {
  try {
    localStorage.setItem(STORAGE_GAS_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

function createSeedState(): LocalDbState {
  const USERS: StoredUser[] = [
    {
      id: 'USR-0001',
      name: 'Administrator Autosmart',
      email: 'admin@autosmart.id',
      password_plain: 'admin123',
      role: 'Administrator',
      status: 'Aktif',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'USR-0002',
      name: 'Staf Administrasi & Billing',
      email: 'staff@autosmart.id',
      password_plain: 'staff123',
      role: 'Staff',
      status: 'Aktif',
      created_at: '2026-01-05T00:00:00.000Z',
    },
  ];

  const SERVICES: ServiceItem[] = [
    {
      id: 'SRV-0001',
      service_name: 'Website Profesional Korporasi',
      category: 'Website Profesional',
      description:
        'Pengembangan website bisnis profesional responsif dengan CMS kustom dan optimasi kecepatan.',
      unit: 'Paket',
      price: 7500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0002',
      service_name: 'Landing Page Konversi Tinggi',
      category: 'Landing Page',
      description:
        'Desain dan pembuatan landing page kampanye produk/layanan terintegrasi WhatsApp & analitik.',
      unit: 'Halaman',
      price: 2500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0003',
      service_name: 'Website Company Profile Eksklusif',
      category: 'Website Company Profile',
      description:
        'Website profil perusahaan multi-halaman untuk membangun kredibilitas korporat.',
      unit: 'Paket',
      price: 5500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0005',
      service_name: 'Website Travel & Manajemen Umroh',
      category: 'Website Travel & Umroh',
      description:
        'Portal pemesanan paket perjalanan wisata dan umroh dengan manajemen jadwal keberangkatan.',
      unit: 'Paket',
      price: 14500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0007',
      service_name: 'Google Apps Script Automation Suite',
      category: 'Google Apps Script Application',
      description:
        'Pembuatan aplikasi otomatisasi alur kerja terintegrasi Google Workspace (Sheets, Docs, Drive, Gmail).',
      unit: 'Sistem',
      price: 4500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0008',
      service_name: 'Executive Business Dashboard',
      category: 'Business Dashboard',
      description:
        'Dashboard pemantauan KPI bisnis, penjualan, dan operasional secara real-time.',
      unit: 'Sistem',
      price: 6500000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0011',
      service_name: 'Sistem Otomatisasi Bisnis Terpadu',
      category: 'Sistem Otomatisasi Bisnis',
      description:
        'Integrasi sistem operasional, pengingat otomatis, dan pembuatan dokumen dinamis.',
      unit: 'Sistem',
      price: 8000000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
    {
      id: 'SRV-0014',
      service_name: 'Maintenance & Keamanan Website Tahunan',
      category: 'Maintenance Website',
      description:
        'Pemeliharaan rutin server, backup berkala, pembaruan sistem, dan pemantauan keamanan.',
      unit: 'Tahun',
      price: 3600000,
      status: 'Aktif',
      created_at: '2026-01-10T08:00:00.000Z',
    },
  ];

  return {
    USERS,
    CLIENTS: [],
    SERVICES,
    INVOICES: [],
    INVOICE_ITEMS: [],
    PAYMENTS: [],
    SETTINGS: { ...DEFAULT_SETTINGS },
    ACTIVITY_LOGS: [],
  };
}

export function loadLocalDb(): LocalDbState {
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDbState;
      if (parsed && Array.isArray(parsed.USERS) && parsed.USERS.length > 0) {
        const mergedSettings: CompanySettingsMap = { ...DEFAULT_SETTINGS };
        if (parsed.SETTINGS) {
          for (const [k, v] of Object.entries(parsed.SETTINGS)) {
            if (typeof v === 'string' && v.trim() !== '') {
              mergedSettings[k] = v;
            }
          }
        }
        parsed.SETTINGS = mergedSettings;
        return recomputeLocalDb(parsed);
      }
    }
  } catch {
    // fallback
  }
  const seed = createSeedState();
  saveLocalDb(seed);
  return seed;
}

export function saveLocalDb(db: LocalDbState): void {
  recomputeLocalDb(db);
  try {
    localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore quota error
  }
}

export function mirrorBootstrapToLocalDb(boot: {
  clients?: Client[];
  services?: ServiceItem[];
  invoices?: Invoice[];
  payments?: Payment[];
  settings?: CompanySettingsMap;
  users?: User[];
  activityLogs?: ActivityLog[];
}): {
  mergedSettings: CompanySettingsMap;
  customSettingsToPush: Partial<CompanySettingsMap> | null;
} {
  const current = loadLocalDb();
  if (Array.isArray(boot.clients)) current.CLIENTS = boot.clients;
  if (Array.isArray(boot.services)) current.SERVICES = boot.services;
  if (Array.isArray(boot.invoices)) {
    current.INVOICES = boot.invoices.map(
      ({ items: _it, client: _cl, ...rest }) => rest
    );
    const allItems: InvoiceLineItem[] = [];
    for (const inv of boot.invoices) {
      if (Array.isArray(inv.items)) {
        allItems.push(...inv.items);
      }
    }
    current.INVOICE_ITEMS = allItems;
  }
  if (Array.isArray(boot.payments)) current.PAYMENTS = boot.payments;

  const mergedSettings: CompanySettingsMap = {
    ...DEFAULT_SETTINGS,
  };
  const customToPush: Partial<CompanySettingsMap> = {};
  let hasCustomToPush = false;

  // Apply local custom settings first
  if (current.SETTINGS) {
    for (const [k, v] of Object.entries(current.SETTINGS)) {
      if (typeof v === 'string' && v.trim() !== '') {
        mergedSettings[k] = v;
      }
    }
  }

  // Apply server settings, but if local had a custom uploaded data:image logo/qris while server only has default/empty, keep local and push to server
  if (boot.settings) {
    for (const [k, serverVal] of Object.entries(boot.settings)) {
      const cleanServer = typeof serverVal === 'string' ? serverVal.trim() : '';
      const cleanLocal =
        typeof current.SETTINGS?.[k] === 'string'
          ? current.SETTINGS[k]!.trim()
          : '';

      if (
        (k === 'logo_url' || k === 'qris_url') &&
        cleanLocal.startsWith('data:image/') &&
        (!cleanServer || cleanServer === '/assets/autosmart-logo.png')
      ) {
        mergedSettings[k] = cleanLocal;
        customToPush[k] = cleanLocal;
        hasCustomToPush = true;
      } else if (cleanServer !== '') {
        mergedSettings[k] = cleanServer;
      } else if (cleanLocal !== '' && cleanLocal !== DEFAULT_SETTINGS[k]) {
        mergedSettings[k] = cleanLocal;
        customToPush[k] = cleanLocal;
        hasCustomToPush = true;
      }
    }
  }

  current.SETTINGS = mergedSettings;
  if (Array.isArray(boot.activityLogs)) {
    current.ACTIVITY_LOGS = boot.activityLogs;
  }
  saveLocalDb(current);

  return {
    mergedSettings,
    customSettingsToPush: hasCustomToPush ? customToPush : null,
  };
}

function recomputeLocalDb(db: LocalDbState): LocalDbState {
  const today = new Date().toISOString().split('T')[0];
  for (const inv of db.INVOICES) {
    const paid = db.PAYMENTS.filter((p) => p.invoice_id === inv.id).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    inv.amount_paid = Math.round(paid);
    inv.balance = Math.max(0, Math.round(inv.grand_total - inv.amount_paid));
    inv.status = resolveInvoiceStatus({
      currentStatus: inv.status,
      grandTotal: inv.grand_total,
      amountPaid: inv.amount_paid,
      dueDate: inv.due_date,
      todayDate: today,
    });
  }
  return db;
}

function nextEntityId(existingIds: string[], prefix: string): string {
  let max = 0;
  for (const id of existingIds) {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Sends a CORS-safe POST request directly to Google Apps Script Web App
 * using Content-Type: text/plain;charset=utf-8 (avoids preflight OPTIONS error).
 */
async function postToGasDirect(
  webAppUrl: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Google Apps Script merespons HTTP ${res.status}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function syncLocalDbToGasIfConfigured(
  db: LocalDbState
): Promise<void> {
  const cfg = loadLocalGasConfig();
  if (!cfg.webAppUrl) return;

  try {
    const settingsRows = Object.entries(db.SETTINGS).map(([k, v], idx) => ({
      id: `SET-${String(idx + 1).padStart(3, '0')}`,
      setting_key: k,
      setting_value: v,
      updated_at: new Date().toISOString(),
    }));

    await postToGasDirect(cfg.webAppUrl, {
      action: 'syncAll',
      apiSecret: cfg.apiSecret,
      secret: cfg.apiSecret,
      payload: {
        USERS: db.USERS.map(({ password_plain: _p, ...u }) => u),
        CLIENTS: db.CLIENTS,
        SERVICES: db.SERVICES,
        INVOICES: db.INVOICES,
        INVOICE_ITEMS: db.INVOICE_ITEMS,
        PAYMENTS: db.PAYMENTS,
        COMPANY_SETTINGS: settingsRows,
        ACTIVITY_LOGS: db.ACTIVITY_LOGS,
      },
    });
    cfg.lastSync = new Date().toISOString();
    saveLocalGasConfig(cfg);
  } catch {
    // Non-blocking background sync
  }
}

export function authenticateLocalUser(
  email: string,
  password: string
): { token: string; user: User } | { error: string } {
  const db = loadLocalDb();
  const normalized = email.trim().toLowerCase();
  const found = db.USERS.find((u) => u.email.toLowerCase() === normalized);

  if (!found) {
    return { error: 'Email atau password tidak sesuai.' };
  }
  const expectedPass =
    found.password_plain ||
    (found.role === 'Administrator' ? 'admin123' : 'staff123');
  if (password !== expectedPass) {
    return { error: 'Email atau password tidak sesuai.' };
  }
  if (found.status !== 'Aktif') {
    return { error: 'Akun Anda sedang dinonaktifkan.' };
  }

  const { password_plain: _p, ...safeUser } = found;
  const token = `local-token-${safeUser.id}-${Date.now()}`;
  return { token, user: safeUser };
}

export function getUserFromLocalToken(token: string | null): User {
  const db = loadLocalDb();
  if (token && token.startsWith('local-token-')) {
    const parts = token.split('-');
    const userId = `${parts[2]}-${parts[3]}`;
    const found = db.USERS.find((u) => u.id === userId);
    if (found) {
      const { password_plain: _p, ...safe } = found;
      return safe;
    }
  }
  const admin = db.USERS[0];
  const { password_plain: _p, ...safeAdmin } = admin;
  return safeAdmin;
}

export async function handleClientFallbackApi(
  url: string,
  options: RequestInit = {},
  activeToken: string | null = null
): Promise<unknown> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const db = loadLocalDb();
  const currentUser = getUserFromLocalToken(activeToken);
  const cfg = loadLocalGasConfig();

  // 1. Auth Endpoints
  if (url === '/api/auth/login' && method === 'POST') {
    const authResult = authenticateLocalUser(
      String(body.email || ''),
      String(body.password || '')
    );
    if ('error' in authResult) {
      throw new Error(authResult.error);
    }
    return authResult;
  }

  if (url === '/api/auth/me') {
    return { user: currentUser };
  }

  if (url === '/api/auth/logout') {
    return { ok: true };
  }

  // 2. Bootstrap Endpoint
  if (url === '/api/bootstrap' && method === 'GET') {
    const hydratedInvoices: Invoice[] = db.INVOICES.map((inv) => ({
      ...inv,
      items: db.INVOICE_ITEMS.filter((it) => it.invoice_id === inv.id),
      client: db.CLIENTS.find((c) => c.id === inv.client_id),
    }));

    const databaseStatus: DatabaseStatus = {
      mode: cfg.webAppUrl ? 'GOOGLE_SHEETS' : 'LOCAL_STORAGE',
      connected: Boolean(cfg.webAppUrl),
      spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
      gas_url_configured: Boolean(cfg.webAppUrl),
      gas_url_masked: cfg.webAppUrl ? `${cfg.webAppUrl.slice(0, 38)}...` : '',
      last_sync: cfg.lastSync,
      message: cfg.webAppUrl
        ? 'Terhubung ke Google Sheets melalui Google Apps Script'
        : 'Database Persisten Aktif (Siap disinkronkan ke Google Sheets)',
    };

    return {
      clients: db.CLIENTS,
      services: db.SERVICES,
      invoices: hydratedInvoices,
      payments: db.PAYMENTS,
      settings: db.SETTINGS,
      users: db.USERS.map(({ password_plain: _p, ...u }) => u),
      activityLogs: db.ACTIVITY_LOGS,
      databaseStatus,
    };
  }

  // 3. Clients CRUD
  if (url === '/api/clients' && method === 'POST') {
    const newClient: Client = {
      id: nextEntityId(
        db.CLIENTS.map((c) => c.id),
        'CLT'
      ),
      client_name: String(body.client_name || '').trim(),
      contact_person: String(body.contact_person || '').trim(),
      phone: String(body.phone || '').trim(),
      whatsapp: String(body.whatsapp || body.phone || '').trim(),
      email: String(body.email || '').trim(),
      address: String(body.address || '').trim(),
      notes: String(body.notes || '').trim(),
      created_at: new Date().toISOString(),
    };
    db.CLIENTS.unshift(newClient);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { client: newClient };
  }

  if (url.startsWith('/api/clients/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.CLIENTS.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Pelanggan tidak ditemukan.');
    db.CLIENTS[idx] = {
      ...db.CLIENTS[idx],
      client_name: String(body.client_name || '').trim(),
      contact_person: String(body.contact_person || '').trim(),
      phone: String(body.phone || '').trim(),
      whatsapp: String(body.whatsapp || body.phone || '').trim(),
      email: String(body.email || '').trim(),
      address: String(body.address || '').trim(),
      notes: String(body.notes || '').trim(),
    };
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { client: db.CLIENTS[idx] };
  }

  if (url.startsWith('/api/clients/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    if (db.INVOICES.some((i) => i.client_id === id)) {
      throw new Error(
        'Pelanggan memiliki riwayat invoice aktif dan tidak dapat dihapus.'
      );
    }
    db.CLIENTS = db.CLIENTS.filter((c) => c.id !== id);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { ok: true };
  }

  // 4. Services & Service Categories CRUD
  if (url === '/api/services/categories' && method === 'POST') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const res = addServiceCategory(currentCats, String(body.category || ''));
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return {
      categories: res.categories,
      added: res.added,
      settings: db.SETTINGS,
    };
  }

  if (url === '/api/services/categories' && method === 'PUT') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const res = renameServiceCategory(
      currentCats,
      db.SERVICES,
      String(body.oldCategory || ''),
      String(body.newCategory || '')
    );
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    db.SERVICES = res.services;
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return {
      categories: res.categories,
      services: db.SERVICES,
      updatedCount: res.updatedCount,
      settings: db.SETTINGS,
    };
  }

  if (url === '/api/services/categories' && method === 'DELETE') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const res = deleteServiceCategory(
      currentCats,
      db.SERVICES,
      String(body.category || ''),
      body.fallbackCategory ? String(body.fallbackCategory) : undefined
    );
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    db.SERVICES = res.services;
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return {
      categories: res.categories,
      services: db.SERVICES,
      reassignedCount: res.reassignedCount,
      fallbackUsed: res.fallbackUsed,
      settings: db.SETTINGS,
    };
  }

  if (url === '/api/services/categories/reset' && method === 'POST') {
    const merged = parseServiceCategories(null, db.SERVICES);
    const resetCats = Array.from(
      new Set([...DEFAULT_SERVICE_CATEGORIES, ...merged])
    );
    db.SETTINGS.service_categories = JSON.stringify(resetCats);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return {
      categories: resetCats,
      settings: db.SETTINGS,
    };
  }

  if (url === '/api/services' && method === 'POST') {
    const cleanCategory =
      String(body.category || '').trim() || 'Layanan Digital Lainnya';
    const newService: ServiceItem = {
      id: nextEntityId(
        db.SERVICES.map((s) => s.id),
        'SRV'
      ),
      service_name: String(body.service_name || '').trim(),
      category: cleanCategory,
      description: String(body.description || ''),
      unit: String(body.unit || 'Paket'),
      price: Math.max(0, Math.round(Number(body.price) || 0)),
      status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      created_at: new Date().toISOString(),
    };
    db.SERVICES.unshift(newService);
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    if (
      !currentCats.some((c) => c.toLowerCase() === cleanCategory.toLowerCase())
    ) {
      currentCats.push(cleanCategory);
      db.SETTINGS.service_categories = JSON.stringify(currentCats);
    }
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { service: newService };
  }

  if (url.startsWith('/api/services/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.SERVICES.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Layanan tidak ditemukan.');
    const cleanCategory =
      String(body.category || '').trim() || 'Layanan Digital Lainnya';
    db.SERVICES[idx] = {
      ...db.SERVICES[idx],
      service_name: String(body.service_name || '').trim(),
      category: cleanCategory,
      description: String(body.description || ''),
      unit: String(body.unit || 'Paket'),
      price: Math.max(0, Math.round(Number(body.price) || 0)),
      status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    };
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    if (
      !currentCats.some((c) => c.toLowerCase() === cleanCategory.toLowerCase())
    ) {
      currentCats.push(cleanCategory);
      db.SETTINGS.service_categories = JSON.stringify(currentCats);
    }
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { service: db.SERVICES[idx] };
  }

  if (url.startsWith('/api/services/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    db.SERVICES = db.SERVICES.filter((s) => s.id !== id);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { ok: true };
  }

  // 5. Invoices CRUD
  if (url === '/api/invoices' && method === 'POST') {
    const invoiceId = nextEntityId(
      db.INVOICES.map((i) => i.id),
      'INV'
    );
    const invoiceNumber = generateNextDocumentNumber(
      db.INVOICES.map((i) => i.invoice_number),
      db.SETTINGS.invoice_prefix || 'INV/ASM',
      db.SETTINGS.document_year || '2026'
    );
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const newItems: InvoiceLineItem[] = rawItems.map(
      (it: Record<string, unknown>, idx: number) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.max(0, Math.round(Number(it.unit_price) || 0));
        const disc = Math.max(0, Math.round(Number(it.discount) || 0));
        return {
          id: `ITM-${Date.now().toString().slice(-5)}-${idx + 1}`,
          invoice_id: invoiceId,
          service_id: String(it.service_id || ''),
          description: String(it.description || ''),
          quantity: qty,
          unit: String(it.unit || 'Paket'),
          unit_price: unitPrice,
          discount: disc,
          total: Math.max(0, Math.round(qty * unitPrice - disc)),
        };
      }
    );

    const taxRate = Number(body.tax_rate) || 0;
    const totals = calculateInvoiceTotals({
      items: newItems,
      overallDiscount: Number(body.discount) || 0,
      additionalCost: Number(body.additional_cost) || 0,
      taxEnabled: taxRate > 0,
      taxRate,
      amountPaid: 0,
    });

    const now = new Date().toISOString();
    const issueDate =
      String(body.issue_date || '') || now.split('T')[0];
    const dueDate = String(body.due_date || '') || issueDate;

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      client_id: String(body.client_id || ''),
      issue_date: issueDate,
      due_date: dueDate,
      subtotal: totals.subtotal,
      discount: totals.discount,
      additional_cost: totals.additional_cost,
      tax_rate: taxRate,
      tax_amount: totals.tax_amount,
      grand_total: totals.grand_total,
      amount_paid: 0,
      balance: totals.balance,
      status: resolveInvoiceStatus({
        currentStatus: body.status || 'Unpaid',
        grandTotal: totals.grand_total,
        amountPaid: 0,
        dueDate,
      }),
      notes: String(body.notes || ''),
      created_at: now,
      updated_at: now,
    };

    db.INVOICES.unshift(newInvoice);
    db.INVOICE_ITEMS.push(...newItems);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);

    return {
      invoice: {
        ...newInvoice,
        items: newItems,
        client: db.CLIENTS.find((c) => c.id === newInvoice.client_id),
      },
    };
  }

  if (url.startsWith('/api/invoices/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.INVOICES.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Invoice tidak ditemukan.');
    const existing = db.INVOICES[idx];

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const newItems: InvoiceLineItem[] = rawItems.map(
      (it: Record<string, unknown>, itemIdx: number) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.max(0, Math.round(Number(it.unit_price) || 0));
        const disc = Math.max(0, Math.round(Number(it.discount) || 0));
        return {
          id: `ITM-${Date.now().toString().slice(-5)}-${itemIdx + 1}`,
          invoice_id: id,
          service_id: String(it.service_id || ''),
          description: String(it.description || ''),
          quantity: qty,
          unit: String(it.unit || 'Paket'),
          unit_price: unitPrice,
          discount: disc,
          total: Math.max(0, Math.round(qty * unitPrice - disc)),
        };
      }
    );

    const taxRate =
      body.tax_rate !== undefined ? Number(body.tax_rate) : existing.tax_rate;
    const totals = calculateInvoiceTotals({
      items: newItems,
      overallDiscount:
        body.discount !== undefined ? Number(body.discount) : existing.discount,
      additionalCost:
        body.additional_cost !== undefined
          ? Number(body.additional_cost)
          : existing.additional_cost,
      taxEnabled: taxRate > 0,
      taxRate,
      amountPaid: existing.amount_paid,
    });

    const dueDate = String(body.due_date || existing.due_date);
    db.INVOICES[idx] = {
      ...existing,
      client_id: String(body.client_id || existing.client_id),
      issue_date: String(body.issue_date || existing.issue_date),
      due_date: dueDate,
      subtotal: totals.subtotal,
      discount: totals.discount,
      additional_cost: totals.additional_cost,
      tax_rate: taxRate,
      tax_amount: totals.tax_amount,
      grand_total: totals.grand_total,
      balance: totals.balance,
      status: resolveInvoiceStatus({
        currentStatus: body.status || existing.status,
        grandTotal: totals.grand_total,
        amountPaid: existing.amount_paid,
        dueDate,
      }),
      notes:
        body.notes !== undefined ? String(body.notes) : existing.notes,
      updated_at: new Date().toISOString(),
    };

    db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
    db.INVOICE_ITEMS.push(...newItems);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);

    return {
      invoice: {
        ...db.INVOICES[idx],
        items: newItems,
        client: db.CLIENTS.find((c) => c.id === db.INVOICES[idx].client_id),
      },
    };
  }

  if (url.startsWith('/api/invoices/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    db.INVOICES = db.INVOICES.filter((i) => i.id !== id);
    db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
    db.PAYMENTS = db.PAYMENTS.filter((p) => p.invoice_id !== id);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { ok: true };
  }

  // 6. Payments CRUD
  if (url === '/api/payments' && method === 'POST') {
    const receiptNumber = generateNextDocumentNumber(
      db.PAYMENTS.map((p) => p.receipt_number),
      db.SETTINGS.receipt_prefix || 'KW/ASM',
      db.SETTINGS.document_year || '2026'
    );
    const newPayment: Payment = {
      id: nextEntityId(
        db.PAYMENTS.map((p) => p.id),
        'PAY'
      ),
      receipt_number: receiptNumber,
      invoice_id: String(body.invoice_id || ''),
      payment_date:
        String(body.payment_date || '') ||
        new Date().toISOString().split('T')[0],
      amount: Math.max(1, Math.round(Number(body.amount) || 0)),
      payment_method: body.payment_method || 'Transfer Bank',
      reference_number: String(body.reference_number || ''),
      notes: String(body.notes || ''),
      created_at: new Date().toISOString(),
    };
    db.PAYMENTS.unshift(newPayment);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    const updatedInvoice = db.INVOICES.find(
      (i) => i.id === newPayment.invoice_id
    );
    return { payment: newPayment, invoice: updatedInvoice };
  }

  if (url.startsWith('/api/payments/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.PAYMENTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Data pembayaran tidak ditemukan.');
    db.PAYMENTS[idx] = {
      ...db.PAYMENTS[idx],
      payment_date: String(body.payment_date || db.PAYMENTS[idx].payment_date),
      amount: Math.max(1, Math.round(Number(body.amount) || 0)),
      payment_method:
        body.payment_method || db.PAYMENTS[idx].payment_method,
      reference_number: String(
        body.reference_number ?? db.PAYMENTS[idx].reference_number
      ),
      notes: String(body.notes ?? db.PAYMENTS[idx].notes),
    };
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { payment: db.PAYMENTS[idx] };
  }

  if (url.startsWith('/api/payments/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    db.PAYMENTS = db.PAYMENTS.filter((p) => p.id !== id);
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { ok: true };
  }

  // 7. Settings & Users
  if (url === '/api/settings' && method === 'PUT') {
    db.SETTINGS = {
      ...db.SETTINGS,
      ...(body as Partial<CompanySettingsMap>),
    };
    saveLocalDb(db);
    await syncLocalDbToGasIfConfigured(db);
    return { settings: db.SETTINGS };
  }

  if (url === '/api/users' && method === 'POST') {
    const newUser: StoredUser = {
      id: nextEntityId(
        db.USERS.map((u) => u.id),
        'USR'
      ),
      name: String(body.name || '').trim(),
      email: String(body.email || '').trim(),
      password_plain: String(body.password || 'staff123'),
      role: body.role === 'Administrator' ? 'Administrator' : 'Staff',
      status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      created_at: new Date().toISOString(),
    };
    db.USERS.push(newUser);
    saveLocalDb(db);
    const { password_plain: _p, ...safe } = newUser;
    return { user: safe };
  }

  if (url.startsWith('/api/users/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.USERS.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan.');
    db.USERS[idx] = {
      ...db.USERS[idx],
      role: body.role || db.USERS[idx].role,
      status: body.status || db.USERS[idx].status,
    };
    saveLocalDb(db);
    const { password_plain: _p, ...safe } = db.USERS[idx];
    return { user: safe };
  }

  // 8. Google Apps Script Database Endpoints (Direct Browser -> GAS)
  if (url === '/api/database/config' && method === 'POST') {
    const nextCfg: GasLocalConfig = {
      webAppUrl: String(body.webAppUrl || '').trim(),
      apiSecret: String(body.apiSecret || '').trim(),
      lastSync: cfg.lastSync,
    };
    saveLocalGasConfig(nextCfg);
    if (nextCfg.webAppUrl) {
      await syncLocalDbToGasIfConfigured(db);
    }
    return { ok: true };
  }

  if (url === '/api/database/test' && method === 'POST') {
    const targetUrl = String(body.webAppUrl || cfg.webAppUrl || '').trim();
    const targetSecret = String(body.apiSecret ?? cfg.apiSecret ?? '').trim();
    if (!targetUrl) {
      throw new Error(
        'Masukkan URL Web App Google Apps Script terlebih dahulu.'
      );
    }
    const data = await postToGasDirect(targetUrl, {
      action: 'ping',
      apiSecret: targetSecret,
      secret: targetSecret,
    });
    if (!data.ok) {
      throw new Error(String(data.error || 'Gagal menghubungi Apps Script'));
    }
    return data;
  }

  if (url === '/api/database/sync' && method === 'POST') {
    if (!cfg.webAppUrl) {
      throw new Error(
        'URL Web App Google Apps Script belum dikonfigurasi.'
      );
    }
    await syncLocalDbToGasIfConfigured(db);
    return { ok: true, last_sync: loadLocalGasConfig().lastSync };
  }

  if (url === '/api/database/pull' && method === 'POST') {
    if (!cfg.webAppUrl) {
      throw new Error(
        'URL Web App Google Apps Script belum dikonfigurasi.'
      );
    }
    const res = await postToGasDirect(cfg.webAppUrl, {
      action: 'exportAll',
      apiSecret: cfg.apiSecret,
      secret: cfg.apiSecret,
    });
    if (!res.ok || !res.data) {
      throw new Error(
        String(res.error || 'Gagal menarik data dari Google Sheets.')
      );
    }
    const remote = res.data as Record<string, Array<Record<string, unknown>>>;
    if (Array.isArray(remote.CLIENTS) && remote.CLIENTS.length > 0) {
      db.CLIENTS = remote.CLIENTS as unknown as Client[];
    }
    if (Array.isArray(remote.SERVICES) && remote.SERVICES.length > 0) {
      db.SERVICES = remote.SERVICES.map((s) => ({
        id: String(s.id || ''),
        service_name: String(s.service_name || ''),
        category: String(s.category || 'Layanan Digital Lainnya'),
        description: String(s.description || ''),
        unit: String(s.unit || 'Paket'),
        price: Math.round(Number(s.price ?? s.default_price) || 0),
        status: s.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        created_at: String(s.created_at || new Date().toISOString()),
      }));
    }
    if (Array.isArray(remote.INVOICES) && remote.INVOICES.length > 0) {
      db.INVOICES = remote.INVOICES.map((inv) => ({
        id: String(inv.id || ''),
        invoice_number: String(inv.invoice_number || ''),
        client_id: String(inv.client_id || ''),
        issue_date: String(inv.issue_date ?? inv.invoice_date ?? ''),
        due_date: String(inv.due_date || ''),
        subtotal: Math.round(Number(inv.subtotal) || 0),
        discount: Math.round(Number(inv.discount ?? inv.discount_value) || 0),
        additional_cost: Math.round(
          Number(inv.additional_cost ?? inv.additional_fee) || 0
        ),
        tax_rate: Number(inv.tax_rate) || 0,
        tax_amount: Math.round(Number(inv.tax_amount) || 0),
        grand_total: Math.round(Number(inv.grand_total) || 0),
        amount_paid: Math.round(Number(inv.amount_paid) || 0),
        balance: Math.round(
          Number(inv.balance ?? inv.remaining_balance) || 0
        ),
        status:
          (inv.status as Invoice['status']) ||
          (inv.payment_status as Invoice['status']) ||
          'Unpaid',
        notes: String(inv.notes || ''),
        created_at: String(inv.created_at || new Date().toISOString()),
        updated_at: String(inv.updated_at || new Date().toISOString()),
      }));
    }
    if (
      Array.isArray(remote.INVOICE_ITEMS) &&
      remote.INVOICE_ITEMS.length > 0
    ) {
      db.INVOICE_ITEMS = remote.INVOICE_ITEMS as unknown as InvoiceLineItem[];
    }
    if (Array.isArray(remote.PAYMENTS)) {
      db.PAYMENTS = remote.PAYMENTS.map((p) => ({
        id: String(p.id || ''),
        receipt_number: String(p.receipt_number ?? p.payment_number ?? ''),
        invoice_id: String(p.invoice_id || ''),
        payment_date: String(p.payment_date || ''),
        amount: Math.round(Number(p.amount) || 0),
        payment_method:
          (p.payment_method as Payment['payment_method']) || 'Transfer Bank',
        reference_number: String(p.reference_number || ''),
        notes: String(p.notes || ''),
        created_at: String(p.created_at || new Date().toISOString()),
      }));
    }
    saveLocalDb(db);
    cfg.lastSync = new Date().toISOString();
    saveLocalGasConfig(cfg);
    return { ok: true, last_sync: cfg.lastSync };
  }

  return { ok: true };
}
