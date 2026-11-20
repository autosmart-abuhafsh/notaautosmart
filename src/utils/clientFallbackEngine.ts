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

export interface LocalDbState {
  USERS: StoredUser[];
  CLIENTS: Client[];
  SERVICES: ServiceItem[];
  INVOICES: Invoice[];
  INVOICE_ITEMS: InvoiceLineItem[];
  PAYMENTS: Payment[];
  SETTINGS: CompanySettingsMap;
  ACTIVITY_LOGS: ActivityLog[];
}

export interface GasLocalConfig {
  webAppUrl: string;
  apiSecret: string;
  lastSync: string | null;
  spreadsheetName?: string;
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
    return ((import.meta.env?.VITE_GAS_WEB_APP_URL as string) || '').trim();
  } catch {
    return '';
  }
}

function getEnvGasSecret(): string {
  try {
    return ((import.meta.env?.VITE_GAS_API_SECRET as string) || '').trim();
  } catch {
    return '';
  }
}

export function loadLocalGasConfig(): GasLocalConfig {
  const envUrl = getEnvGasUrl();
  const envSecret = getEnvGasSecret();
  try {
    const raw = localStorage.getItem(STORAGE_GAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GasLocalConfig>;
      return {
        webAppUrl: (parsed.webAppUrl || envUrl || '').trim(),
        apiSecret: (parsed.apiSecret || envSecret || '').trim(),
        lastSync: parsed.lastSync || null,
        spreadsheetName: parsed.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE',
      };
    }
  } catch {
    // ignore
  }
  return {
    webAppUrl: envUrl,
    apiSecret: envSecret,
    lastSync: null,
    spreadsheetName: 'AUTOSMART_INVOICE_DATABASE',
  };
}

export function saveLocalGasConfig(cfg: GasLocalConfig): void {
  try {
    localStorage.setItem(STORAGE_GAS_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function appendLocalActivityLog(
  db: LocalDbState,
  user: { id: string; name?: string } | null | undefined,
  activity: string,
  description: string
): ActivityLog {
  if (!Array.isArray(db.ACTIVITY_LOGS)) {
    db.ACTIVITY_LOGS = [];
  }
  const nextNum = db.ACTIVITY_LOGS.length + 1;
  const entry: ActivityLog = {
    id: `LOG-${String(nextNum).padStart(4, '0')}-${Date.now().toString().slice(-4)}`,
    user_id: user?.id || 'USR-0001',
    user_name: user?.name || 'Administrator Autosmart',
    activity,
    description: description.trim(),
    timestamp: new Date().toISOString(),
  };
  db.ACTIVITY_LOGS.unshift(entry);
  if (db.ACTIVITY_LOGS.length > 300) {
    db.ACTIVITY_LOGS.length = 300;
  }
  return entry;
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
        if (!Array.isArray(parsed.ACTIVITY_LOGS)) {
          parsed.ACTIVITY_LOGS = [];
        }
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

/**
 * Merges server bootstrap data with browser localStorage safely.
 * Protects against Vercel serverless cold-starts where the server's ephemeral /tmp database
 * resets to 0 clients/invoices while the browser still has user-created records.
 */
export function mirrorBootstrapToLocalDb(boot: {
  clients?: Client[];
  services?: ServiceItem[];
  invoices?: Invoice[];
  payments?: Payment[];
  settings?: CompanySettingsMap;
  users?: User[];
  activityLogs?: ActivityLog[];
}): {
  mergedDb: LocalDbState;
  mergedSettings: CompanySettingsMap;
  customSettingsToPush: Partial<CompanySettingsMap> | null;
  localHadMoreData: boolean;
} {
  const current = loadLocalDb();
  let localHadMoreData = false;

  // Clients: if server returned non-empty OR local is also empty, use server;
  // if server cold-started empty while local has clients, merge/keep local!
  if (Array.isArray(boot.clients)) {
    if (boot.clients.length > 0 || current.CLIENTS.length === 0) {
      // Merge any local clients not in server by id if server had fewer
      const serverIds = new Set(boot.clients.map((c) => c.id));
      const missingLocal = current.CLIENTS.filter((c) => !serverIds.has(c.id));
      if (boot.clients.length === 0 && missingLocal.length > 0) {
        localHadMoreData = true;
      } else {
        current.CLIENTS = boot.clients;
      }
    } else {
      localHadMoreData = true;
    }
  }

  if (Array.isArray(boot.services) && boot.services.length > 0) {
    current.SERVICES = boot.services;
  }

  if (Array.isArray(boot.invoices)) {
    if (boot.invoices.length > 0 || current.INVOICES.length === 0) {
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
    } else {
      localHadMoreData = true;
    }
  }

  if (Array.isArray(boot.payments)) {
    if (boot.payments.length > 0 || current.PAYMENTS.length === 0) {
      current.PAYMENTS = boot.payments;
    } else {
      localHadMoreData = true;
    }
  }

  const mergedSettings: CompanySettingsMap = {
    ...DEFAULT_SETTINGS,
  };
  const customToPush: Partial<CompanySettingsMap> = {};
  let hasCustomToPush = false;

  if (current.SETTINGS) {
    for (const [k, v] of Object.entries(current.SETTINGS)) {
      if (typeof v === 'string' && v.trim() !== '') {
        mergedSettings[k] = v;
      }
    }
  }

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
    if (boot.activityLogs.length > 0) {
      // Merge unique logs by id, sorted newest first
      const byId = new Map<string, ActivityLog>();
      for (const l of [...boot.activityLogs, ...current.ACTIVITY_LOGS]) {
        if (l && l.id && !byId.has(l.id)) {
          byId.set(l.id, l);
        }
      }
      current.ACTIVITY_LOGS = Array.from(byId.values())
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, 300);
    }
  }

  saveLocalDb(current);

  return {
    mergedDb: current,
    mergedSettings,
    customSettingsToPush: hasCustomToPush ? customToPush : null,
    localHadMoreData,
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
 * Validates a Google Apps Script Web App URL and returns a helpful error message if misconfigured.
 */
export function validateGasWebAppUrl(rawUrl: string): string | null {
  const clean = rawUrl.trim();
  if (!clean) return null;
  if (!clean.startsWith('https://script.google.com/')) {
    return 'URL harus diawali dengan https://script.google.com/macros/s/.../exec';
  }
  if (clean.includes('/home/projects/') || clean.endsWith('/edit')) {
    return 'URL yang dimasukkan adalah URL Editor Apps Script (/edit), bukan URL Web App. Klik tombol biru "Deploy -> New deployment -> Web app" lalu salin Web App URL yang berakhiran /exec.';
  }
  if (clean.endsWith('/dev')) {
    return 'URL berakhiran /dev hanya bisa diakses saat login pemilik. Gunakan URL Deployment produksi yang berakhiran /exec agar aplikasi dapat menyimpan data.';
  }
  return null;
}

/**
 * Sends a CORS-safe POST request directly to Google Apps Script Web App
 * using Content-Type: text/plain;charset=utf-8 (avoids preflight OPTIONS error on GitHub.io & Vercel).
 */
export async function postToGasDirect(
  webAppUrl: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const urlErr = validateGasWebAppUrl(webAppUrl);
  if (urlErr) {
    throw new Error(urlErr);
  }

  const res = await fetch(webAppUrl.trim(), {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Google Apps Script merespons HTTP ${res.status}`);
  }

  if (rawText.trim().startsWith('<')) {
    throw new Error(
      'Google Apps Script mengembalikan halaman HTML/Login (bukan JSON). Pastikan saat Deploy Web App di Apps Script: (1) Execute as = "Me", (2) Who has access = "Anyone / Siapa saja", dan (3) URL diakhiri /exec.'
    );
  }

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(
      'Respons dari Google Apps Script bukan format JSON yang valid. Pastikan Code.gs sudah di-deploy ulang (Manage deployments -> Edit -> New version -> Deploy).'
    );
  }
}

export async function syncLocalDbToGasIfConfigured(
  db?: LocalDbState,
  latestActivityLog?: ActivityLog
): Promise<{
  synced: boolean;
  error?: string;
  lastSync?: string | null;
  spreadsheetName?: string;
}> {
  const cfg = loadLocalGasConfig();
  if (!cfg.webAppUrl) {
    return { synced: false };
  }

  const activeDb = db || loadLocalDb();

  try {
    const settingsRows = Object.entries(activeDb.SETTINGS).map(
      ([k, v], idx) => ({
        id: `SET-${String(idx + 1).padStart(3, '0')}`,
        setting_key: k,
        setting_value: v,
        updated_at: new Date().toISOString(),
      })
    );

    const response = await postToGasDirect(cfg.webAppUrl, {
      action: 'syncAll',
      apiSecret: cfg.apiSecret,
      secret: cfg.apiSecret,
      activityLog: latestActivityLog,
      payload: {
        USERS: activeDb.USERS.map(({ password_plain: _p, ...u }) => ({
          ...u,
          password_hash: 'scrypt_hash_protected',
        })),
        CLIENTS: activeDb.CLIENTS,
        SERVICES: activeDb.SERVICES,
        INVOICES: activeDb.INVOICES,
        INVOICE_ITEMS: activeDb.INVOICE_ITEMS,
        PAYMENTS: activeDb.PAYMENTS,
        COMPANY_SETTINGS: settingsRows,
        ACTIVITY_LOGS: activeDb.ACTIVITY_LOGS,
      },
    });

    if (!response.ok) {
      return {
        synced: false,
        error: String(
          response.error || 'Google Apps Script menolak penyimpanan.'
        ),
      };
    }

    cfg.lastSync = new Date().toISOString();
    if (typeof response.spreadsheetName === 'string' && response.spreadsheetName) {
      cfg.spreadsheetName = response.spreadsheetName;
    }
    saveLocalGasConfig(cfg);
    return {
      synced: true,
      lastSync: cfg.lastSync,
      spreadsheetName: cfg.spreadsheetName,
    };
  } catch (err) {
    return {
      synced: false,
      error:
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke Google Apps Script.',
    };
  }
}

/**
 * Pulls all 8 sheets directly from Google Apps Script into localStorage DB.
 */
export async function pullFromGasDirectToLocalDb(
  user?: { id: string; name?: string } | null
): Promise<{
  ok: boolean;
  lastSync: string | null;
  spreadsheetName?: string;
  error?: string;
}> {
  const cfg = loadLocalGasConfig();
  if (!cfg.webAppUrl) {
    throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
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

  const db = loadLocalDb();
  const remote = res.data as Record<string, Array<Record<string, unknown>>>;

  if (Array.isArray(remote.CLIENTS)) {
    db.CLIENTS = remote.CLIENTS.map((c) => ({
      id: String(c.id || ''),
      client_name: String(c.client_name || ''),
      contact_person: String(c.contact_person || ''),
      phone: String(c.phone || ''),
      whatsapp: String(c.whatsapp || c.phone || ''),
      email: String(c.email || ''),
      address: String(c.address || ''),
      notes: String(c.notes || ''),
      created_at: String(c.created_at || new Date().toISOString()),
    }));
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

  if (Array.isArray(remote.INVOICES)) {
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

  if (Array.isArray(remote.INVOICE_ITEMS)) {
    db.INVOICE_ITEMS = remote.INVOICE_ITEMS.map((it) => ({
      id: String(it.id || ''),
      invoice_id: String(it.invoice_id || ''),
      service_id: String(it.service_id || ''),
      description: String(it.description || ''),
      quantity: Number(it.quantity) || 1,
      unit: String(it.unit || 'Paket'),
      unit_price: Math.round(Number(it.unit_price) || 0),
      discount: Math.round(Number(it.discount) || 0),
      total: Math.round(Number(it.total) || 0),
    }));
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

  if (
    Array.isArray(remote.COMPANY_SETTINGS) &&
    remote.COMPANY_SETTINGS.length > 0
  ) {
    const nextSettings: CompanySettingsMap = { ...db.SETTINGS };
    for (const row of remote.COMPANY_SETTINGS) {
      const k = String(row.setting_key || '').trim();
      const v = String(row.setting_value ?? '').trim();
      if (k && v) {
        nextSettings[k] = v;
      }
    }
    db.SETTINGS = nextSettings;
  }

  if (Array.isArray(remote.ACTIVITY_LOGS) && remote.ACTIVITY_LOGS.length > 0) {
    db.ACTIVITY_LOGS = remote.ACTIVITY_LOGS.map((l, idx) => ({
      id: String(l.id || `LOG-R-${idx + 1}`),
      user_id: String(l.user_id || 'USR-0001'),
      user_name:
        db.USERS.find((u) => u.id === String(l.user_id || ''))?.name ||
        'Administrator Autosmart',
      activity: String(l.activity || 'ACTIVITY'),
      description: String(l.description || ''),
      timestamp: String(l.timestamp || new Date().toISOString()),
    }));
  }

  if (user) {
    appendLocalActivityLog(
      db,
      user,
      'PULL_DATABASE',
      'Menarik data terbaru dari Google Sheets (AUTOSMART_INVOICE_DATABASE)'
    );
  }

  saveLocalDb(db);
  cfg.lastSync = new Date().toISOString();
  if (typeof res.spreadsheetName === 'string' && res.spreadsheetName) {
    cfg.spreadsheetName = res.spreadsheetName;
  }
  saveLocalGasConfig(cfg);
  return {
    ok: true,
    lastSync: cfg.lastSync,
    spreadsheetName: cfg.spreadsheetName,
  };
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
  appendLocalActivityLog(
    db,
    safeUser,
    'USER_LOGIN',
    `${safeUser.name} (${safeUser.role}) masuk ke sistem.`
  );
  saveLocalDb(db);
  void syncLocalDbToGasIfConfigured(db);

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
    // If GAS is configured and local has 0 clients/invoices and hasn't synced yet, try pulling from GAS once
    if (
      cfg.webAppUrl &&
      db.CLIENTS.length === 0 &&
      db.INVOICES.length === 0 &&
      !cfg.lastSync
    ) {
      try {
        await pullFromGasDirectToLocalDb();
      } catch {
        // continue with local state
      }
    }

    const latestDb = loadLocalDb();
    const latestCfg = loadLocalGasConfig();

    const hydratedInvoices: Invoice[] = latestDb.INVOICES.map((inv) => ({
      ...inv,
      items: latestDb.INVOICE_ITEMS.filter((it) => it.invoice_id === inv.id),
      client: latestDb.CLIENTS.find((c) => c.id === inv.client_id),
    }));

    const logsWithNames: ActivityLog[] = (latestDb.ACTIVITY_LOGS || []).map(
      (log) => ({
        ...log,
        user_name:
          log.user_name ||
          latestDb.USERS.find((u) => u.id === log.user_id)?.name ||
          'Administrator Autosmart',
      })
    );

    const databaseStatus: DatabaseStatus = {
      mode: latestCfg.webAppUrl ? 'GOOGLE_SHEETS' : 'LOCAL_STORAGE',
      connected: Boolean(latestCfg.webAppUrl),
      spreadsheet_name:
        latestCfg.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE',
      gas_url_configured: Boolean(latestCfg.webAppUrl),
      gas_url_masked: latestCfg.webAppUrl
        ? `${latestCfg.webAppUrl.slice(0, 42)}...`
        : '',
      last_sync: latestCfg.lastSync,
      message: latestCfg.webAppUrl
        ? 'Terhubung & Tersinkronisasi Otomatis ke Google Sheets (Google Apps Script)'
        : 'Database Persisten Aktif (Siap disinkronkan ke Google Sheets)',
    };

    return {
      clients: latestDb.CLIENTS,
      services: latestDb.SERVICES,
      invoices: hydratedInvoices,
      payments: latestDb.PAYMENTS,
      settings: latestDb.SETTINGS,
      users: latestDb.USERS.map(({ password_plain: _p, ...u }) => u),
      activityLogs: logsWithNames,
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CREATE_CLIENT',
      `Menambahkan pelanggan ${newClient.client_name} (${newClient.id})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      client: newClient,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_CLIENT',
      `Memperbarui data pelanggan ${db.CLIENTS[idx].client_name} (${id})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      client: db.CLIENTS[idx],
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url.startsWith('/api/clients/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    if (db.INVOICES.some((i) => i.client_id === id)) {
      throw new Error(
        'Pelanggan memiliki riwayat invoice aktif dan tidak dapat dihapus.'
      );
    }
    const target = db.CLIENTS.find((c) => c.id === id);
    db.CLIENTS = db.CLIENTS.filter((c) => c.id !== id);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'DELETE_CLIENT',
      `Menghapus pelanggan ${target?.client_name || id} (${id})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      ok: true,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  // 4. Services & Service Categories CRUD
  if (url === '/api/services/categories' && method === 'POST') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const res = addServiceCategory(currentCats, String(body.category || ''));
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CREATE_CATEGORY',
      `Menambahkan kategori layanan "${res.added}"`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      categories: res.categories,
      added: res.added,
      settings: db.SETTINGS,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url === '/api/services/categories' && method === 'PUT') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const oldCat = String(body.oldCategory || '');
    const newCat = String(body.newCategory || '');
    const res = renameServiceCategory(
      currentCats,
      db.SERVICES,
      oldCat,
      newCat
    );
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    db.SERVICES = res.services;
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'RENAME_CATEGORY',
      `Mengubah nama kategori layanan "${oldCat}" menjadi "${newCat}"`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      categories: res.categories,
      services: db.SERVICES,
      updatedCount: res.updatedCount,
      settings: db.SETTINGS,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url === '/api/services/categories' && method === 'DELETE') {
    const currentCats = parseServiceCategories(
      db.SETTINGS.service_categories,
      db.SERVICES
    );
    const catName = String(body.category || '');
    const res = deleteServiceCategory(
      currentCats,
      db.SERVICES,
      catName,
      body.fallbackCategory ? String(body.fallbackCategory) : undefined
    );
    db.SETTINGS.service_categories = JSON.stringify(res.categories);
    db.SERVICES = res.services;
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'DELETE_CATEGORY',
      `Menghapus kategori layanan "${catName}"`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      categories: res.categories,
      services: db.SERVICES,
      reassignedCount: res.reassignedCount,
      fallbackUsed: res.fallbackUsed,
      settings: db.SETTINGS,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url === '/api/services/categories/reset' && method === 'POST') {
    const merged = parseServiceCategories(null, db.SERVICES);
    const resetCats = Array.from(
      new Set([...DEFAULT_SERVICE_CATEGORIES, ...merged])
    );
    db.SETTINGS.service_categories = JSON.stringify(resetCats);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'RESET_CATEGORIES',
      'Memulihkan daftar kategori layanan standar'
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      categories: resetCats,
      settings: db.SETTINGS,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CREATE_SERVICE',
      `Menambahkan layanan ${newService.service_name} (${newService.id}) dengan harga Rp ${newService.price.toLocaleString('id-ID')}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      service: newService,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_SERVICE',
      `Memperbarui layanan ${db.SERVICES[idx].service_name} (${id})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      service: db.SERVICES[idx],
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url.startsWith('/api/services/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    const target = db.SERVICES.find((s) => s.id === id);
    db.SERVICES = db.SERVICES.filter((s) => s.id !== id);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'DELETE_SERVICE',
      `Menghapus layanan ${target?.service_name || id} (${id})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      ok: true,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const issueDate = String(body.issue_date || '') || now.split('T')[0];
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
    const client = db.CLIENTS.find((c) => c.id === newInvoice.client_id);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CREATE_INVOICE',
      `Membuat invoice ${invoiceNumber} untuk ${client?.client_name || newInvoice.client_id} senilai Rp ${newInvoice.grand_total.toLocaleString('id-ID')}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);

    return {
      invoice: {
        ...newInvoice,
        items: newItems,
        client,
      },
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
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
      notes: body.notes !== undefined ? String(body.notes) : existing.notes,
      updated_at: new Date().toISOString(),
    };

    db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
    db.INVOICE_ITEMS.push(...newItems);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_INVOICE',
      `Memperbarui invoice ${existing.invoice_number}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);

    return {
      invoice: {
        ...db.INVOICES[idx],
        items: newItems,
        client: db.CLIENTS.find((c) => c.id === db.INVOICES[idx].client_id),
      },
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url.startsWith('/api/invoices/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    const target = db.INVOICES.find((i) => i.id === id);
    db.INVOICES = db.INVOICES.filter((i) => i.id !== id);
    db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
    db.PAYMENTS = db.PAYMENTS.filter((p) => p.invoice_id !== id);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'DELETE_INVOICE',
      `Menghapus invoice ${target?.invoice_number || id} beserta item terkait`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      ok: true,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const updatedInvoice = db.INVOICES.find(
      (i) => i.id === newPayment.invoice_id
    );
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'RECORD_PAYMENT',
      `Mencatat pembayaran ${receiptNumber} sebesar Rp ${newPayment.amount.toLocaleString('id-ID')} untuk invoice ${updatedInvoice?.invoice_number || newPayment.invoice_id}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      payment: newPayment,
      invoice: updatedInvoice,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url.startsWith('/api/payments/') && method === 'PUT') {
    const id = url.split('/').pop() || '';
    const idx = db.PAYMENTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Data pembayaran tidak ditemukan.');
    db.PAYMENTS[idx] = {
      ...db.PAYMENTS[idx],
      payment_date: String(body.payment_date || db.PAYMENTS[idx].payment_date),
      amount: Math.max(1, Math.round(Number(body.amount) || 0)),
      payment_method: body.payment_method || db.PAYMENTS[idx].payment_method,
      reference_number: String(
        body.reference_number ?? db.PAYMENTS[idx].reference_number
      ),
      notes: String(body.notes ?? db.PAYMENTS[idx].notes),
    };
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_PAYMENT',
      `Memperbarui catatan pembayaran ${db.PAYMENTS[idx].receipt_number}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      payment: db.PAYMENTS[idx],
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  if (url.startsWith('/api/payments/') && method === 'DELETE') {
    const id = url.split('/').pop() || '';
    const target = db.PAYMENTS.find((p) => p.id === id);
    db.PAYMENTS = db.PAYMENTS.filter((p) => p.id !== id);
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'DELETE_PAYMENT',
      `Menghapus bukti pembayaran ${target?.receipt_number || id}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      ok: true,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  // 7. Settings & Users
  if (url === '/api/settings' && method === 'PUT') {
    db.SETTINGS = {
      ...db.SETTINGS,
      ...(body as Partial<CompanySettingsMap>),
    };
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_SETTINGS',
      'Memperbarui pengaturan identitas perusahaan dan konfigurasi invoice'
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    return {
      settings: db.SETTINGS,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CREATE_USER',
      `Menambahkan pengguna ${newUser.name} (${newUser.role})`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    const { password_plain: _p, ...safe } = newUser;
    return {
      user: safe,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
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
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'UPDATE_USER',
      `Memperbarui hak akses / profil pengguna ${db.USERS[idx].name}`
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    const { password_plain: _p, ...safe } = db.USERS[idx];
    return {
      user: safe,
      gasSynced: syncRes.synced,
      gasError: syncRes.error,
    };
  }

  // 8. Google Apps Script Database Endpoints (Direct Browser -> GAS)
  if (url === '/api/database/config' && method === 'POST') {
    const cleanUrl = String(body.webAppUrl || '').trim();
    const urlErr = validateGasWebAppUrl(cleanUrl);
    if (urlErr) {
      throw new Error(urlErr);
    }

    const nextCfg: GasLocalConfig = {
      webAppUrl: cleanUrl,
      apiSecret: String(body.apiSecret || '').trim(),
      lastSync: cfg.lastSync,
      spreadsheetName: cfg.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE',
    };
    saveLocalGasConfig(nextCfg);

    const log = appendLocalActivityLog(
      db,
      currentUser,
      'CONFIGURE_DATABASE',
      cleanUrl
        ? 'Menghubungkan & menyinkronkan aplikasi ke Google Apps Script Web App'
        : 'Mengaktifkan mode penyimpanan lokal'
    );
    saveLocalDb(db);

    let autoSyncRes: {
      synced: boolean;
      error?: string;
      spreadsheetName?: string;
    } = { synced: false };

    if (nextCfg.webAppUrl) {
      autoSyncRes = await syncLocalDbToGasIfConfigured(db, log);
      if (!autoSyncRes.synced && autoSyncRes.error) {
        throw new Error(autoSyncRes.error);
      }
    }

    const refreshed = loadLocalGasConfig();
    return {
      ok: true,
      autoSynced: autoSyncRes.synced,
      databaseStatus: {
        mode: refreshed.webAppUrl ? 'GOOGLE_SHEETS' : 'LOCAL_STORAGE',
        connected: Boolean(refreshed.webAppUrl),
        spreadsheet_name:
          refreshed.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE',
        gas_url_configured: Boolean(refreshed.webAppUrl),
        gas_url_masked: refreshed.webAppUrl
          ? `${refreshed.webAppUrl.slice(0, 42)}...`
          : '',
        last_sync: refreshed.lastSync,
        message: refreshed.webAppUrl
          ? 'Terhubung & Tersinkronisasi Otomatis ke Google Sheets (Google Apps Script)'
          : 'Database Persisten Aktif (Siap disinkronkan ke Google Sheets)',
      },
    };
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
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }
    const log = appendLocalActivityLog(
      db,
      currentUser,
      'SYNC_DATABASE',
      'Sinkronisasi seluruh 8 sheet ke Google Sheets (AUTOSMART_INVOICE_DATABASE) berhasil'
    );
    saveLocalDb(db);
    const syncRes = await syncLocalDbToGasIfConfigured(db, log);
    if (!syncRes.synced) {
      throw new Error(
        syncRes.error || 'Gagal menyinkronkan data ke Google Sheets.'
      );
    }
    return {
      ok: true,
      last_sync: syncRes.lastSync,
    };
  }

  if (url === '/api/database/pull' && method === 'POST') {
    const pullRes = await pullFromGasDirectToLocalDb(currentUser);
    return {
      ok: pullRes.ok,
      last_sync: pullRes.lastSync,
    };
  }

  return { ok: true };
}
