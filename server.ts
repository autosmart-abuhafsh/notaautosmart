import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const LOCAL_DATA_DIR = path.resolve(process.cwd(), 'data');

function resolveWritableDataDir(): string {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    const tmpDir = path.join(os.tmpdir(), 'autosmart_data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const seedDb = path.join(LOCAL_DATA_DIR, 'autosmart_db.json');
    const targetDb = path.join(tmpDir, 'autosmart_db.json');
    if (fs.existsSync(seedDb) && !fs.existsSync(targetDb)) {
      try {
        fs.copyFileSync(seedDb, targetDb);
      } catch {
        // fallback to createInitialDatabase
      }
    }
    return tmpDir;
  }

  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    return LOCAL_DATA_DIR;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'autosmart_data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'autosmart_db.json');
const GAS_CONFIG_FILE = path.join(DATA_DIR, 'gas_config.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SESSION_SECRET =
  process.env.GAS_API_SECRET || 'autosmart-invoice-token-secret-2026';

function createSignedToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifySignedToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const payload = `${userId}.${ts}`;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  if (sig === expected) return userId;
  return null;
}

// --- Password Hashing (never plaintext) ---
function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(key, 'hex'),
      Buffer.from(derived, 'hex')
    );
  } catch {
    return false;
  }
}

// --- Formula Injection Prevention ---
function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return val == null ? '' : String(val);
  const trimmed = val.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

// --- Timezone Helper (Asia/Jakarta) ---
function getJakartaDateStr(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function getJakartaTimestamp(): string {
  return new Date().toISOString();
}

// --- Concurrency Lock (equivalent to LockService) ---
let lockPromise: Promise<void> = Promise.resolve();
async function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let release!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previousLock = lockPromise;
  lockPromise = previousLock.then(() => nextLock);
  await previousLock;
  try {
    return await fn();
  } finally {
    release();
  }
}

// --- Database Structure matching 8 Google Sheets ---
interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'Administrator' | 'Staff';
  status: 'Aktif' | 'Nonaktif';
  created_at: string;
}

interface DbClient {
  id: string;
  client_name: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
}

interface DbService {
  id: string;
  service_name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  status: 'Aktif' | 'Nonaktif';
  created_at: string;
}

interface DbInvoice {
  id: string;
  invoice_number: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount: number;
  additional_cost: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  balance: number;
  status:
    | 'Draft'
    | 'Sent'
    | 'Unpaid'
    | 'Partially Paid'
    | 'Paid'
    | 'Overdue'
    | 'Cancelled';
  notes: string;
  created_at: string;
  updated_at: string;
}

interface DbInvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  total: number;
}

interface DbPayment {
  id: string;
  receipt_number: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method:
    | 'Transfer Bank'
    | 'Tunai'
    | 'QRIS'
    | 'E-Wallet'
    | 'Metode lainnya';
  reference_number: string;
  notes: string;
  created_at: string;
}

interface DbCompanySetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
}

interface DbActivityLog {
  id: string;
  user_id: string;
  activity: string;
  description: string;
  timestamp: string;
}

interface AutosmartDatabase {
  USERS: DbUser[];
  CLIENTS: DbClient[];
  SERVICES: DbService[];
  INVOICES: DbInvoice[];
  INVOICE_ITEMS: DbInvoiceItem[];
  PAYMENTS: DbPayment[];
  COMPANY_SETTINGS: DbCompanySetting[];
  ACTIVITY_LOGS: DbActivityLog[];
}

interface GasConfig {
  webAppUrl: string;
  apiSecret: string;
  lastSync: string | null;
}

const OFFICIAL_DEFAULT_SETTINGS: Record<string, string> = {
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

function loadGasConfig(): GasConfig {
  const envUrl =
    process.env.GAS_WEB_APP_URL || process.env.VITE_GAS_WEB_APP_URL || '';
  const envSecret = process.env.GAS_API_SECRET || '';
  if (fs.existsSync(GAS_CONFIG_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(GAS_CONFIG_FILE, 'utf-8'));
      return {
        webAppUrl: parsed.webAppUrl || envUrl,
        apiSecret: parsed.apiSecret || envSecret,
        lastSync: parsed.lastSync || null,
      };
    } catch {
      // fallback
    }
  }
  return {
    webAppUrl: envUrl,
    apiSecret: envSecret,
    lastSync: null,
  };
}

function saveGasConfig(cfg: GasConfig): void {
  fs.writeFileSync(GAS_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function buildDatabaseStatusObject(cfg: GasConfig) {
  return {
    mode: cfg.webAppUrl ? ('GOOGLE_SHEETS' as const) : ('LOCAL_STORAGE' as const),
    connected: Boolean(cfg.webAppUrl),
    spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
    gas_url_configured: Boolean(cfg.webAppUrl),
    gas_url: cfg.webAppUrl || undefined,
    gas_url_masked: cfg.webAppUrl ? `${cfg.webAppUrl.slice(0, 42)}...` : '',
    last_sync: cfg.lastSync,
    message: cfg.webAppUrl
      ? 'Terhubung ke Google Sheets melalui Google Apps Script Proxy'
      : 'Database Persisten Aktif (Siap disinkronkan ke Google Sheets)',
  };
}

function createInitialDatabase(): AutosmartDatabase {
  const now = getJakartaTimestamp();
  const COMPANY_SETTINGS: DbCompanySetting[] = Object.entries(
    OFFICIAL_DEFAULT_SETTINGS
  ).map(([key, val], idx) => ({
    id: `SET-${String(idx + 1).padStart(3, '0')}`,
    setting_key: key,
    setting_value: val,
    updated_at: now,
  }));

  // All 16 Service Categories from PRD Section 6
  const initialServices: Array<{
    name: string;
    category: string;
    desc: string;
    unit: string;
    price: number;
  }> = [
    {
      name: 'Website Profesional Korporasi',
      category: 'Website Profesional',
      desc: 'Pengembangan website bisnis profesional responsif dengan CMS kustom dan optimasi kecepatan.',
      unit: 'Paket',
      price: 7500000,
    },
    {
      name: 'Landing Page Konversi Tinggi',
      category: 'Landing Page',
      desc: 'Desain dan pembuatan landing page kampanye produk/layanan terintegrasi WhatsApp & analitik.',
      unit: 'Halaman',
      price: 2500000,
    },
    {
      name: 'Website Company Profile Eksklusif',
      category: 'Website Company Profile',
      desc: 'Website profil perusahaan multi-halaman untuk membangun kredibilitas korporat.',
      unit: 'Paket',
      price: 5500000,
    },
    {
      name: 'Website E-Commerce & Katalog Transaksi',
      category: 'Website E-Commerce',
      desc: 'Toko online lengkap dengan manajemen produk, keranjang belanja, dan kalkulasi pengiriman.',
      unit: 'Paket',
      price: 12000000,
    },
    {
      name: 'Website Travel & Manajemen Umroh',
      category: 'Website Travel & Umroh',
      desc: 'Portal pemesanan paket perjalanan wisata dan umroh dengan manajemen jadwal keberangkatan.',
      unit: 'Paket',
      price: 14500000,
    },
    {
      name: 'Manajemen Kampanye Digital Marketing',
      category: 'Digital Marketing',
      desc: 'Pengelolaan iklan digital terarah, optimasi konversi, dan laporan performa bulanan.',
      unit: 'Bulan',
      price: 4000000,
    },
    {
      name: 'Google Apps Script Automation Suite',
      category: 'Google Apps Script Application',
      desc: 'Pembuatan aplikasi otomatisasi alur kerja terintegrasi Google Workspace (Sheets, Docs, Drive, Gmail).',
      unit: 'Sistem',
      price: 4500000,
    },
    {
      name: 'Executive Business Dashboard',
      category: 'Business Dashboard',
      desc: 'Dashboard pemantauan KPI bisnis, penjualan, dan operasional secara real-time.',
      unit: 'Sistem',
      price: 6500000,
    },
    {
      name: 'Custom CRM System & Pipeline',
      category: 'CRM System',
      desc: 'Sistem pengelolaan pelanggan, tindak lanjut prospek, dan histori transaksi terpusat.',
      unit: 'Sistem',
      price: 9500000,
    },
    {
      name: 'Custom Web Application',
      category: 'Web Application',
      desc: 'Pengembangan aplikasi berbasis web sesuai proses bisnis spesifik perusahaan.',
      unit: 'Proyek',
      price: 15000000,
    },
    {
      name: 'Sistem Otomatisasi Bisnis Terpadu',
      category: 'Sistem Otomatisasi Bisnis',
      desc: 'Integrasi sistem operasional, pengingat otomatis, dan pembuatan dokumen dinamis.',
      unit: 'Sistem',
      price: 8000000,
    },
    {
      name: 'Sistem Manajemen Keuangan & Kas',
      category: 'Manajemen Keuangan',
      desc: 'Sistem pencatatan arus kas, piutang, invoice, dan pembukuan keuangan perusahaan.',
      unit: 'Sistem',
      price: 7000000,
    },
    {
      name: 'Jasa Analisis & Pemodelan Keuangan',
      category: 'Analisis Keuangan',
      desc: 'Penyusunan proyeksi keuangan, analisis profitabilitas, dan evaluasi efisiensi biaya.',
      unit: 'Laporan',
      price: 5000000,
    },
    {
      name: 'Maintenance & Keamanan Website Tahunan',
      category: 'Maintenance Website',
      desc: 'Pemeliharaan rutin server, backup berkala, pembaruan sistem, dan pemantauan keamanan.',
      unit: 'Tahun',
      price: 3600000,
    },
    {
      name: 'Jasa Pengembangan Aplikasi Kustom',
      category: 'Jasa Pengembangan Aplikasi',
      desc: 'Layanan rekayasa perangkat lunak end-to-end mulai dari perancangan hingga deployment.',
      unit: 'Proyek',
      price: 18000000,
    },
    {
      name: 'Konsultasi & Implementasi Layanan Digital',
      category: 'Layanan Digital Lainnya',
      desc: 'Pendampingan transformasi digital dan pelatihan kolaborasi tim berbasis teknologi.',
      unit: 'Sesi',
      price: 2000000,
    },
  ];

  const SERVICES: DbService[] = initialServices.map((s, idx) => ({
    id: `SRV-${String(idx + 1).padStart(4, '0')}`,
    service_name: s.name,
    category: s.category,
    description: s.desc,
    unit: s.unit,
    price: s.price,
    status: 'Aktif',
    created_at: '2026-01-10T08:00:00.000Z',
  }));

  const USERS: DbUser[] = [
    {
      id: 'USR-0001',
      name: 'Administrator Autosmart',
      email: 'admin@autosmart.id',
      password_hash: hashPassword('admin123'),
      role: 'Administrator',
      status: 'Aktif',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'USR-0002',
      name: 'Staf Administrasi & Billing',
      email: 'staff@autosmart.id',
      password_hash: hashPassword('staff123'),
      role: 'Staff',
      status: 'Aktif',
      created_at: '2026-01-05T00:00:00.000Z',
    },
  ];

  return {
    USERS,
    CLIENTS: [],
    SERVICES,
    INVOICES: [],
    INVOICE_ITEMS: [],
    PAYMENTS: [],
    COMPANY_SETTINGS,
    ACTIVITY_LOGS: [],
  };
}

function ensureOfficialSettingsHydrated(db: AutosmartDatabase): boolean {
  let changed = false;
  const now = getJakartaTimestamp();
  if (!Array.isArray(db.COMPANY_SETTINGS)) {
    db.COMPANY_SETTINGS = [];
  }
  for (const [key, defaultVal] of Object.entries(OFFICIAL_DEFAULT_SETTINGS)) {
    if (!defaultVal) continue;
    const found = db.COMPANY_SETTINGS.find((s) => s.setting_key === key);
    if (!found) {
      db.COMPANY_SETTINGS.push({
        id: `SET-${String(db.COMPANY_SETTINGS.length + 1).padStart(3, '0')}`,
        setting_key: key,
        setting_value: defaultVal,
        updated_at: now,
      });
      changed = true;
    } else if (!found.setting_value || !found.setting_value.trim()) {
      found.setting_value = defaultVal;
      found.updated_at = now;
      changed = true;
    }
  }
  return changed;
}

function readDb(): AutosmartDatabase {
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AutosmartDatabase;
    const hydrated = ensureOfficialSettingsHydrated(parsed);
    const recomputed = recomputeAllInvoices(parsed);
    if (hydrated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(recomputed, null, 2), 'utf-8');
    }
    return recomputed;
  } catch {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function writeDb(db: AutosmartDatabase): void {
  recomputeAllInvoices(db);
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function logActivity(
  db: AutosmartDatabase,
  userId: string,
  activity: string,
  description: string
): void {
  const nextNum = db.ACTIVITY_LOGS.length + 1;
  db.ACTIVITY_LOGS.unshift({
    id: `LOG-${String(nextNum).padStart(4, '0')}-${Date.now().toString().slice(-4)}`,
    user_id: userId,
    activity,
    description: sanitizeString(description),
    timestamp: getJakartaTimestamp(),
  });
  if (db.ACTIVITY_LOGS.length > 300) {
    db.ACTIVITY_LOGS.length = 300;
  }
}

function recomputeAllInvoices(db: AutosmartDatabase): AutosmartDatabase {
  const today = getJakartaDateStr();
  for (const inv of db.INVOICES) {
    const payments = db.PAYMENTS.filter((p) => p.invoice_id === inv.id);
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    inv.amount_paid = Math.round(paidSum);
    inv.balance = Math.max(0, Math.round(inv.grand_total - inv.amount_paid));

    if (inv.status !== 'Cancelled') {
      if (inv.grand_total > 0 && inv.amount_paid >= inv.grand_total) {
        inv.status = 'Paid';
      } else if (inv.amount_paid > 0 && inv.amount_paid < inv.grand_total) {
        inv.status = 'Partially Paid';
      } else if (inv.status !== 'Draft') {
        if (inv.due_date && inv.due_date < today) {
          inv.status = 'Overdue';
        } else if (inv.status === 'Paid' || inv.status === 'Partially Paid') {
          inv.status = 'Unpaid';
        }
      }
    }
  }
  return db;
}

function getSettingsMap(db: AutosmartDatabase): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of db.COMPANY_SETTINGS) {
    map[row.setting_key] = row.setting_value;
  }
  return map;
}

function generateSequentialNumber(
  existingNumbers: string[],
  prefix: string,
  year: string
): string {
  const cleanPrefix = prefix.replace(/\/+$/, '').trim() || 'INV/ASM';
  const cleanYear = year.trim() || '2026';
  const basePattern = `${cleanPrefix}/${cleanYear}/`;

  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (!num) continue;
    if (num.startsWith(basePattern)) {
      const parsed = parseInt(num.slice(basePattern.length), 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
    } else {
      const parts = num.split('/');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  }
  return `${basePattern}${String(maxSeq + 1).padStart(4, '0')}`;
}

function generateEntityId(existingIds: string[], prefix: string): string {
  let max = 0;
  for (const id of existingIds) {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

// --- Session Store ---
interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

function loadSessions(): Record<string, SessionRecord> {
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSessions(sessions: Record<string, SessionRecord>): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

// --- Sync Helper with Google Apps Script Web App ---
let lastGasHydrateAt = 0;

function extractServerDeletedIdsFromLogs(logs: DbActivityLog[]): Set<string> {
  const deleted = new Set<string>();
  const idRegex = /\b((?:CLT|SRV|INV|PAY|USR)-\d+)\b/g;
  for (const log of logs) {
    if (String(log.activity || '').toUpperCase().startsWith('DELETE_')) {
      const desc = String(log.description || '');
      let match: RegExpExecArray | null;
      while ((match = idRegex.exec(desc)) !== null) {
        deleted.add(match[1]);
      }
    }
  }
  return deleted;
}

async function hydrateFromGasIfNeeded(force: boolean = false): Promise<boolean> {
  const cfg = loadGasConfig();
  if (!cfg.webAppUrl) return false;

  const nowMs = Date.now();
  if (!force && nowMs - lastGasHydrateAt < 1500) {
    return false;
  }
  lastGasHydrateAt = nowMs;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const gasRes = await fetch(cfg.webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'exportAll',
        secret: cfg.apiSecret,
        apiSecret: cfg.apiSecret,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!gasRes.ok) return false;
    const rawText = await gasRes.text();
    if (rawText.trim().startsWith('<')) return false;
    const payload = JSON.parse(rawText) as {
      ok?: boolean;
      data?: Partial<Record<keyof AutosmartDatabase, Array<Record<string, unknown>>>>;
    };
    if (!payload?.ok || !payload.data) return false;

    const remote = payload.data;
    const currentDb = readDb();

    const remoteLogs: DbActivityLog[] = Array.isArray(remote.ACTIVITY_LOGS)
      ? remote.ACTIVITY_LOGS.map((l, idx) => ({
          id: String(l.id || `LOG-R-${idx + 1}`),
          user_id: String(l.user_id || 'USR-0001'),
          activity: String(l.activity || 'ACTIVITY'),
          description: String(l.description || ''),
          timestamp: String(l.timestamp || getJakartaTimestamp()),
        }))
      : [];

    const deletedIds = extractServerDeletedIdsFromLogs([
      ...remoteLogs,
      ...currentDb.ACTIVITY_LOGS,
    ]);

    const remoteIsFreshEmptySheet =
      !cfg.lastSync &&
      remoteLogs.length === 0 &&
      (!Array.isArray(remote.CLIENTS) || remote.CLIENTS.length === 0) &&
      (!Array.isArray(remote.INVOICES) || remote.INVOICES.length === 0) &&
      (!Array.isArray(remote.SERVICES) || remote.SERVICES.length <= 16);

    let changed = false;

    if (Array.isArray(remote.CLIENTS)) {
      const mappedClients: DbClient[] = remote.CLIENTS.map((c) => ({
        id: String(c.id || ''),
        client_name: String(c.client_name || ''),
        contact_person: String(c.contact_person || ''),
        phone: String(c.phone || ''),
        whatsapp: String(c.whatsapp || c.phone || ''),
        email: String(c.email || ''),
        address: String(c.address || ''),
        notes: String(c.notes || ''),
        created_at: String(c.created_at || getJakartaTimestamp()),
      })).filter((c) => c.id && !deletedIds.has(c.id));

      if (remoteIsFreshEmptySheet && currentDb.CLIENTS.length > 0) {
        const remoteIds = new Set(mappedClients.map((c) => c.id));
        for (const localClient of currentDb.CLIENTS) {
          if (!remoteIds.has(localClient.id) && !deletedIds.has(localClient.id)) {
            mappedClients.push(localClient);
          }
        }
      }
      currentDb.CLIENTS = mappedClients;
      changed = true;
    }

    if (Array.isArray(remote.SERVICES) && remote.SERVICES.length > 0) {
      const mappedServices: DbService[] = remote.SERVICES.map((s) => ({
        id: String(s.id || ''),
        service_name: String(s.service_name || ''),
        category: String(s.category || 'Layanan Digital Lainnya'),
        description: String(s.description || ''),
        unit: String(s.unit || 'Paket'),
        price: Math.round(Number(s.price) || 0),
        status: (s.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif') as DbService['status'],
        created_at: String(s.created_at || getJakartaTimestamp()),
      })).filter((s) => s.id && !deletedIds.has(s.id));

      if (remoteIsFreshEmptySheet && currentDb.SERVICES.length > 0) {
        const remoteIds = new Set(mappedServices.map((s) => s.id));
        for (const localSrv of currentDb.SERVICES) {
          const num = parseInt(localSrv.id.replace(/\D/g, ''), 10);
          const isCustom =
            (!Number.isNaN(num) && num > 16) ||
            localSrv.created_at !== '2026-01-10T08:00:00.000Z';
          if (isCustom && !remoteIds.has(localSrv.id) && !deletedIds.has(localSrv.id)) {
            mappedServices.unshift(localSrv);
          }
        }
      }
      currentDb.SERVICES = mappedServices;
      changed = true;
    }

    if (Array.isArray(remote.INVOICES)) {
      const mappedInvoices: DbInvoice[] = remote.INVOICES.map((inv) => ({
        id: String(inv.id || ''),
        invoice_number: String(inv.invoice_number || ''),
        client_id: String(inv.client_id || ''),
        issue_date: String(inv.issue_date || getJakartaDateStr()),
        due_date: String(inv.due_date || getJakartaDateStr()),
        subtotal: Math.round(Number(inv.subtotal) || 0),
        discount: Math.round(Number(inv.discount) || 0),
        additional_cost: Math.round(Number(inv.additional_cost) || 0),
        tax_rate: Number(inv.tax_rate) || 0,
        tax_amount: Math.round(Number(inv.tax_amount) || 0),
        grand_total: Math.round(Number(inv.grand_total) || 0),
        amount_paid: Math.round(Number(inv.amount_paid) || 0),
        balance: Math.round(Number(inv.balance) || 0),
        status: (inv.status as DbInvoice['status']) || 'Unpaid',
        notes: String(inv.notes || ''),
        created_at: String(inv.created_at || getJakartaTimestamp()),
        updated_at: String(inv.updated_at || getJakartaTimestamp()),
      })).filter((inv) => inv.id && !deletedIds.has(inv.id));

      if (remoteIsFreshEmptySheet && currentDb.INVOICES.length > 0) {
        const remoteIds = new Set(mappedInvoices.map((i) => i.id));
        for (const localInv of currentDb.INVOICES) {
          if (!remoteIds.has(localInv.id) && !deletedIds.has(localInv.id)) {
            mappedInvoices.push(localInv);
          }
        }
      }
      currentDb.INVOICES = mappedInvoices;
      changed = true;
    }

    if (Array.isArray(remote.INVOICE_ITEMS)) {
      const activeInvIds = new Set(currentDb.INVOICES.map((i) => i.id));
      const mappedItems: DbInvoiceItem[] = remote.INVOICE_ITEMS.map((it) => ({
        id: String(it.id || ''),
        invoice_id: String(it.invoice_id || ''),
        service_id: String(it.service_id || ''),
        description: String(it.description || ''),
        quantity: Number(it.quantity) || 1,
        unit: String(it.unit || 'Paket'),
        unit_price: Math.round(Number(it.unit_price) || 0),
        discount: Math.round(Number(it.discount) || 0),
        total: Math.round(Number(it.total) || 0),
      })).filter((it) => it.id && activeInvIds.has(it.invoice_id));

      if (remoteIsFreshEmptySheet && currentDb.INVOICE_ITEMS.length > 0) {
        const remoteItemIds = new Set(mappedItems.map((it) => it.id));
        for (const localIt of currentDb.INVOICE_ITEMS) {
          if (
            !remoteItemIds.has(localIt.id) &&
            activeInvIds.has(localIt.invoice_id)
          ) {
            mappedItems.push(localIt);
          }
        }
      }
      currentDb.INVOICE_ITEMS = mappedItems;
      changed = true;
    }

    if (Array.isArray(remote.PAYMENTS)) {
      const activeInvIds = new Set(currentDb.INVOICES.map((i) => i.id));
      const mappedPayments: DbPayment[] = remote.PAYMENTS.map((p) => ({
        id: String(p.id || ''),
        receipt_number: String(p.receipt_number || ''),
        invoice_id: String(p.invoice_id || ''),
        payment_date: String(p.payment_date || getJakartaDateStr()),
        amount: Math.round(Number(p.amount) || 0),
        payment_method:
          (p.payment_method as DbPayment['payment_method']) || 'Transfer Bank',
        reference_number: String(p.reference_number || ''),
        notes: String(p.notes || ''),
        created_at: String(p.created_at || getJakartaTimestamp()),
      })).filter(
        (p) => p.id && !deletedIds.has(p.id) && activeInvIds.has(p.invoice_id)
      );

      if (remoteIsFreshEmptySheet && currentDb.PAYMENTS.length > 0) {
        const remotePayIds = new Set(mappedPayments.map((p) => p.id));
        for (const localPay of currentDb.PAYMENTS) {
          if (
            !remotePayIds.has(localPay.id) &&
            !deletedIds.has(localPay.id) &&
            activeInvIds.has(localPay.invoice_id)
          ) {
            mappedPayments.push(localPay);
          }
        }
      }
      currentDb.PAYMENTS = mappedPayments;
      changed = true;
    }

    if (Array.isArray(remote.COMPANY_SETTINGS) && remote.COMPANY_SETTINGS.length > 0) {
      const remoteSettingsMap = new Map<string, string>();
      for (const s of remote.COMPANY_SETTINGS) {
        const k = String(s.setting_key || '');
        const v = String(s.setting_value ?? '');
        if (k && v.trim()) {
          remoteSettingsMap.set(k, v);
        }
      }
      if (remoteSettingsMap.size > 0) {
        const now = getJakartaTimestamp();
        for (const [k, v] of remoteSettingsMap.entries()) {
          const idx = currentDb.COMPANY_SETTINGS.findIndex(
            (row) => row.setting_key === k
          );
          if (idx >= 0) {
            currentDb.COMPANY_SETTINGS[idx].setting_value = v;
          } else {
            currentDb.COMPANY_SETTINGS.push({
              id: `SET-${String(currentDb.COMPANY_SETTINGS.length + 1).padStart(3, '0')}`,
              setting_key: k,
              setting_value: v,
              updated_at: now,
            });
          }
        }
        ensureOfficialSettingsHydrated(currentDb);
        changed = true;
      }
    }

    if (remoteLogs.length > 0) {
      const seenLogIds = new Set<string>();
      const combinedLogs: DbActivityLog[] = [];
      for (const l of [...remoteLogs, ...currentDb.ACTIVITY_LOGS]) {
        if (l && l.id && !seenLogIds.has(l.id)) {
          seenLogIds.add(l.id);
          combinedLogs.push(l);
        }
      }
      combinedLogs.sort((a, b) =>
        String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
      );
      currentDb.ACTIVITY_LOGS = combinedLogs.slice(0, 300);
      changed = true;
    }

    if (changed) {
      writeDb(currentDb);
    }
    return changed;
  } catch {
    return false;
  }
}

async function syncWithGasIfConfigured(db: AutosmartDatabase): Promise<{
  synced: boolean;
  error?: string;
}> {
  const cfg = loadGasConfig();
  if (!cfg.webAppUrl) return { synced: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(cfg.webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'syncAll',
        secret: cfg.apiSecret,
        apiSecret: cfg.apiSecret,
        payload: db,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { synced: false, error: `HTTP ${res.status}` };
    }
    const rawText = await res.text();
    if (rawText.trim().startsWith('<')) {
      return {
        synced: false,
        error:
          'Google Apps Script mengembalikan halaman Login HTML (bukan JSON). Pastikan saat Deploy Web App: Who has access = Anyone / Siapa saja, dan gunakan URL berakhiran /exec.',
      };
    }
    const data = JSON.parse(rawText) as { ok?: boolean; error?: string };
    if (data && data.ok) {
      cfg.lastSync = getJakartaTimestamp();
      saveGasConfig(cfg);
      return { synced: true };
    }
    return { synced: false, error: data?.error || 'Respons GAS tidak valid' };
  } catch (err) {
    return { synced: false, error: String(err) };
  }
}

// --- Express App Setup (Exported for both standalone server and Vercel Serverless) ---
export const app = express();
app.use(express.json({ limit: '10mb' }));

// Recover GAS config from client headers on stateless Vercel Serverless instances
app.use((req, _res, next) => {
  const headerGasUrl = String(req.headers['x-gas-web-app-url'] || '').trim();
  const headerGasSecret = req.headers['x-gas-api-secret'];
  if (
    headerGasUrl &&
    headerGasUrl.startsWith('https://script.google.com/') &&
    !headerGasUrl.includes('/home/projects/') &&
    !headerGasUrl.endsWith('/edit')
  ) {
    const cfg = loadGasConfig();
    if (!cfg.webAppUrl || cfg.webAppUrl !== headerGasUrl) {
      cfg.webAppUrl = headerGasUrl;
      if (typeof headerGasSecret === 'string') {
        cfg.apiSecret = headerGasSecret.trim();
      }
      saveGasConfig(cfg);
    }
  }
  next();
});

// Auth Helper
function getAuthenticatedUser(req: express.Request): DbUser | null {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const db = readDb();

  if (token === 'demo-autostart-admin') {
    return db.USERS.find((u) => u.role === 'Administrator') || db.USERS[0];
  }

  if (!token) return null;

  // 1. Check stateless signed token (for Vercel Serverless instances)
  const signedUserId = verifySignedToken(token);
  if (signedUserId) {
    const foundUser = db.USERS.find(
      (u) => u.id === signedUserId && u.status === 'Aktif'
    );
    if (foundUser) return foundUser;
  }

  // 2. Check session store file
  const sessions = loadSessions();
  const session = sessions[token];
  if (!session) return null;
  const user = db.USERS.find(
    (u) => u.id === session.userId && u.status === 'Aktif'
  );
  return user || null;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
    return;
  }
  (req as express.Request & { user?: DbUser }).user = user;
  next();
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = (req as express.Request & { user?: DbUser }).user;
  if (!user || user.role !== 'Administrator') {
    res.status(403).json({
      error: 'Akses ditolak. Fitur ini hanya untuk Administrator.',
    });
    return;
  }
  next();
}

// --- AUTH ENDPOINTS ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email dan password wajib diisi.' });
    return;
  }
  const db = readDb();
  const user = db.USERS.find(
    (u) => u.email.toLowerCase() === String(email).trim().toLowerCase()
  );
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    res.status(401).json({ error: 'Email atau password tidak sesuai.' });
    return;
  }
  if (user.status !== 'Aktif') {
    res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan.' });
    return;
  }

  const token = createSignedToken(user.id);
  await withLock(() => {
    const sessions = loadSessions();
    sessions[token] = {
      token,
      userId: user.id,
      createdAt: getJakartaTimestamp(),
    };
    saveSessions(sessions);
      logActivity(
        db,
        user.id,
        'USER_LOGIN',
        `${user.name} (${user.role}) masuk ke sistem.`
      );
      writeDb(db);
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
      },
    });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
      },
    });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (token && token !== 'demo-autostart-admin') {
      const sessions = loadSessions();
      delete sessions[token];
      saveSessions(sessions);
    }
    res.json({ ok: true });
  });

  // --- BOOTSTRAP / FULL STATE ENDPOINT ---
  app.get('/api/bootstrap', requireAuth, async (req, res) => {
    const forceSync = req.query.sync === '1';
    await hydrateFromGasIfNeeded(forceSync);
    const db = readDb();
    const cfg = loadGasConfig();
    const user = (req as express.Request & { user: DbUser }).user;

    const hydratedInvoices = db.INVOICES.map((inv) => ({
      ...inv,
      items: db.INVOICE_ITEMS.filter((it) => it.invoice_id === inv.id),
      client: db.CLIENTS.find((c) => c.id === inv.client_id),
    }));

    const safeUsers =
      user.role === 'Administrator'
        ? db.USERS.map(({ password_hash: _ph, ...u }) => u)
        : [];

    const logsWithNames = db.ACTIVITY_LOGS.slice(0, 50).map((log) => {
      const found = db.USERS.find((u) => u.id === log.user_id);
      return {
        ...log,
        user_name: found ? found.name : 'Sistem',
      };
    });

    res.json({
      clients: db.CLIENTS,
      services: db.SERVICES,
      invoices: hydratedInvoices,
      payments: db.PAYMENTS,
      settings: getSettingsMap(db),
      users: safeUsers,
      activityLogs: logsWithNames,
      databaseStatus: buildDatabaseStatusObject(cfg),
    });
  });

  // --- CLIENTS CRUD ---
  app.post('/api/clients', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};
    if (!body.client_name || !String(body.client_name).trim()) {
      res.status(400).json({ error: 'Nama pelanggan / perusahaan wajib diisi.' });
      return;
    }

    const result = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const newClient: DbClient = {
        id: generateEntityId(
          db.CLIENTS.map((c) => c.id),
          'CLT'
        ),
        client_name: sanitizeString(body.client_name),
        contact_person: sanitizeString(body.contact_person || ''),
        phone: sanitizeString(body.phone || ''),
        whatsapp: sanitizeString(body.whatsapp || body.phone || ''),
        email: sanitizeString(body.email || ''),
        address: sanitizeString(body.address || ''),
        notes: sanitizeString(body.notes || ''),
        created_at: getJakartaTimestamp(),
      };
      db.CLIENTS.unshift(newClient);
      logActivity(
        db,
        user.id,
        'CREATE_CLIENT',
        `Menambahkan pelanggan ${newClient.client_name} (${newClient.id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return { client: newClient, syncRes };
    });

    res.status(201).json({
      client: result.client,
      gasSynced: result.syncRes.synced,
      gasError: result.syncRes.error,
    });
  });

  app.put('/api/clients/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};
    if (!body.client_name || !String(body.client_name).trim()) {
      res.status(400).json({ error: 'Nama pelanggan / perusahaan wajib diisi.' });
      return;
    }

    const result = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const idx = db.CLIENTS.findIndex((c) => c.id === id);
      if (idx === -1) return null;

      db.CLIENTS[idx] = {
        ...db.CLIENTS[idx],
        client_name: sanitizeString(body.client_name),
        contact_person: sanitizeString(body.contact_person || ''),
        phone: sanitizeString(body.phone || ''),
        whatsapp: sanitizeString(body.whatsapp || body.phone || ''),
        email: sanitizeString(body.email || ''),
        address: sanitizeString(body.address || ''),
        notes: sanitizeString(body.notes || ''),
      };
      logActivity(
        db,
        user.id,
        'UPDATE_CLIENT',
        `Memperbarui data pelanggan ${db.CLIENTS[idx].client_name} (${id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return { client: db.CLIENTS[idx], syncRes };
    });

    if (!result) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }
    res.json({
      client: result.client,
      gasSynced: result.syncRes.synced,
      gasError: result.syncRes.error,
    });
  });

  app.delete('/api/clients/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const result = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const hasInvoices = db.INVOICES.some((inv) => inv.client_id === id);
      if (hasInvoices) {
        return {
          ok: false,
          reason:
            'Pelanggan memiliki riwayat invoice aktif dan tidak dapat dihapus.',
        };
      }
      const target = db.CLIENTS.find((c) => c.id === id);
      if (!target) return { ok: false, reason: 'Pelanggan tidak ditemukan.' };
      db.CLIENTS = db.CLIENTS.filter((c) => c.id !== id);
      logActivity(
        db,
        user.id,
        'DELETE_CLIENT',
        `Menghapus pelanggan ${target.client_name} (${id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return { ok: true, syncRes };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({
      ok: true,
      gasSynced: result.syncRes?.synced,
      gasError: result.syncRes?.error,
    });
  });

  // --- SERVICE CATEGORIES & SERVICES CRUD ---
  const DEFAULT_SERVICE_CATEGORIES_SERVER = [
    'Website Profesional',
    'Landing Page',
    'Website Company Profile',
    'Website E-Commerce',
    'Website Travel & Umroh',
    'Digital Marketing',
    'Google Apps Script Application',
    'Business Dashboard',
    'CRM System',
    'Web Application',
    'Sistem Otomatisasi Bisnis',
    'Manajemen Keuangan',
    'Analisis Keuangan',
    'Maintenance Website',
    'Jasa Pengembangan Aplikasi',
    'Layanan Digital Lainnya',
  ];

  function getDbCategories(db: AutosmartDatabase): string[] {
    const row = db.COMPANY_SETTINGS.find(
      (s) => s.setting_key === 'service_categories'
    );
    if (row && row.setting_value.trim()) {
      try {
        const parsed = JSON.parse(row.setting_value);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const cleaned: string[] = [];
          for (const item of parsed) {
            const str = sanitizeString(item);
            if (str && !seen.has(str.toLowerCase())) {
              seen.add(str.toLowerCase());
              cleaned.push(str);
            }
          }
          if (cleaned.length > 0) return cleaned;
        }
      } catch {
        // fallback below
      }
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of DEFAULT_SERVICE_CATEGORIES_SERVER) {
      seen.add(c.toLowerCase());
      result.push(c);
    }
    for (const s of db.SERVICES) {
      const cat = sanitizeString(s.category);
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        result.push(cat);
      }
    }
    return result;
  }

  function saveDbCategories(db: AutosmartDatabase, categories: string[]): void {
    const now = getJakartaTimestamp();
    const jsonVal = JSON.stringify(categories);
    const idx = db.COMPANY_SETTINGS.findIndex(
      (s) => s.setting_key === 'service_categories'
    );
    if (idx >= 0) {
      db.COMPANY_SETTINGS[idx].setting_value = jsonVal;
      db.COMPANY_SETTINGS[idx].updated_at = now;
    } else {
      db.COMPANY_SETTINGS.push({
        id: `SET-${String(db.COMPANY_SETTINGS.length + 1).padStart(3, '0')}`,
        setting_key: 'service_categories',
        setting_value: jsonVal,
        updated_at: now,
      });
    }
  }

  app.post('/api/services/categories', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const rawCat = sanitizeString(req.body?.category);
    if (!rawCat) {
      res.status(400).json({ error: 'Nama kategori layanan wajib diisi.' });
      return;
    }

    const result = await withLock(async () => {
      const db = readDb();
      const categories = getDbCategories(db);
      if (categories.some((c) => c.toLowerCase() === rawCat.toLowerCase())) {
        return {
          ok: false as const,
          error: `Kategori "${rawCat}" sudah ada dalam daftar.`,
        };
      }
      const nextCategories = [...categories, rawCat];
      saveDbCategories(db, nextCategories);
      logActivity(
        db,
        user.id,
        'CREATE_SERVICE_CATEGORY',
        `Menambahkan kategori layanan baru: ${rawCat}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return {
        ok: true as const,
        categories: nextCategories,
        added: rawCat,
        settings: getSettingsMap(db),
      };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  app.put('/api/services/categories', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const oldCategory = String(req.body?.oldCategory ?? '').trim();
    const newCategory = sanitizeString(req.body?.newCategory);

    if (!oldCategory) {
      res.status(400).json({ error: 'Kategori asal wajib dipilih.' });
      return;
    }
    if (!newCategory) {
      res.status(400).json({ error: 'Nama kategori baru wajib diisi.' });
      return;
    }

    const result = await withLock(async () => {
      const db = readDb();
      const categories = getDbCategories(db);
      const targetIdx = categories.findIndex((c) => c === oldCategory);
      if (targetIdx === -1) {
        return {
          ok: false as const,
          error: `Kategori "${oldCategory}" tidak ditemukan.`,
        };
      }
      const dupIdx = categories.findIndex(
        (c, idx) =>
          idx !== targetIdx && c.toLowerCase() === newCategory.toLowerCase()
      );
      if (dupIdx !== -1) {
        return {
          ok: false as const,
          error: `Kategori "${newCategory}" sudah digunakan.`,
        };
      }

      const nextCategories = [...categories];
      nextCategories[targetIdx] = newCategory;
      saveDbCategories(db, nextCategories);

      let updatedCount = 0;
      for (const srv of db.SERVICES) {
        if (srv.category === oldCategory) {
          srv.category = newCategory;
          updatedCount += 1;
        }
      }

      logActivity(
        db,
        user.id,
        'UPDATE_SERVICE_CATEGORY',
        `Mengubah nama kategori layanan "${oldCategory}" menjadi "${newCategory}" (${updatedCount} layanan diperbarui)`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return {
        ok: true as const,
        categories: nextCategories,
        services: db.SERVICES,
        updatedCount,
        settings: getSettingsMap(db),
      };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.delete('/api/services/categories', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const targetCategory = String(req.body?.category ?? '').trim();
    const requestedFallback = req.body?.fallbackCategory
      ? String(req.body.fallbackCategory).trim()
      : '';

    if (!targetCategory) {
      res.status(400).json({ error: 'Kategori yang akan dihapus wajib dipilih.' });
      return;
    }

    const result = await withLock(async () => {
      const db = readDb();
      const categories = getDbCategories(db);
      if (!categories.includes(targetCategory)) {
        return {
          ok: false as const,
          error: `Kategori "${targetCategory}" tidak ditemukan.`,
        };
      }
      if (categories.length <= 1) {
        return {
          ok: false as const,
          error:
            'Minimal harus terdapat 1 kategori layanan aktif di dalam sistem.',
        };
      }

      const nextCategories = categories.filter((c) => c !== targetCategory);
      const fallbackUsed =
        requestedFallback && nextCategories.includes(requestedFallback)
          ? requestedFallback
          : nextCategories.includes('Layanan Digital Lainnya')
            ? 'Layanan Digital Lainnya'
            : nextCategories[0];

      let reassignedCount = 0;
      for (const srv of db.SERVICES) {
        if (srv.category === targetCategory) {
          srv.category = fallbackUsed;
          reassignedCount += 1;
        }
      }

      saveDbCategories(db, nextCategories);
      logActivity(
        db,
        user.id,
        'DELETE_SERVICE_CATEGORY',
        `Menghapus kategori layanan "${targetCategory}"${
          reassignedCount > 0
            ? ` dan memindahkan ${reassignedCount} layanan ke "${fallbackUsed}"`
            : ''
        }`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return {
        ok: true as const,
        categories: nextCategories,
        services: db.SERVICES,
        reassignedCount,
        fallbackUsed,
        settings: getSettingsMap(db),
      };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/services/categories/reset', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;

    const result = await withLock(async () => {
      const db = readDb();
      const seen = new Set<string>();
      const nextCategories: string[] = [];
      for (const c of DEFAULT_SERVICE_CATEGORIES_SERVER) {
        seen.add(c.toLowerCase());
        nextCategories.push(c);
      }
      for (const s of db.SERVICES) {
        const cat = sanitizeString(s.category);
        if (cat && !seen.has(cat.toLowerCase())) {
          seen.add(cat.toLowerCase());
          nextCategories.push(cat);
        }
      }
      saveDbCategories(db, nextCategories);
      logActivity(
        db,
        user.id,
        'RESET_SERVICE_CATEGORIES',
        'Mengembalikan daftar kategori layanan standar dilengkapi kategori aktif'
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return {
        categories: nextCategories,
        settings: getSettingsMap(db),
      };
    });

    res.json(result);
  });

  app.post('/api/services', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};
    if (!body.service_name || !String(body.service_name).trim()) {
      res.status(400).json({ error: 'Nama layanan wajib diisi.' });
      return;
    }

    const created = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const cleanCat =
        sanitizeString(body.category) || 'Layanan Digital Lainnya';
      const newService: DbService = {
        id: generateEntityId(
          db.SERVICES.map((s) => s.id),
          'SRV'
        ),
        service_name: sanitizeString(body.service_name),
        category: cleanCat,
        description: sanitizeString(body.description || ''),
        unit: sanitizeString(body.unit || 'Paket'),
        price: Math.max(0, Math.round(Number(body.price) || 0)),
        status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        created_at: getJakartaTimestamp(),
      };
      db.SERVICES.unshift(newService);
      const cats = getDbCategories(db);
      if (!cats.some((c) => c.toLowerCase() === cleanCat.toLowerCase())) {
        saveDbCategories(db, [...cats, cleanCat]);
      }
      logActivity(
        db,
        user.id,
        'CREATE_SERVICE',
        `Menambahkan layanan ${newService.service_name} (${newService.id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return { service: newService, syncRes };
    });

    res.status(201).json({
      service: created.service,
      gasSynced: created.syncRes.synced,
      gasError: created.syncRes.error,
    });
  });

  app.put('/api/services/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};
    if (!body.service_name || !String(body.service_name).trim()) {
      res.status(400).json({ error: 'Nama layanan wajib diisi.' });
      return;
    }

    const updated = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const idx = db.SERVICES.findIndex((s) => s.id === id);
      if (idx === -1) return null;

      const cleanCat =
        sanitizeString(body.category) || 'Layanan Digital Lainnya';
      db.SERVICES[idx] = {
        ...db.SERVICES[idx],
        service_name: sanitizeString(body.service_name),
        category: cleanCat,
        description: sanitizeString(body.description || ''),
        unit: sanitizeString(body.unit || 'Paket'),
        price: Math.max(0, Math.round(Number(body.price) || 0)),
        status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      };
      const cats = getDbCategories(db);
      if (!cats.some((c) => c.toLowerCase() === cleanCat.toLowerCase())) {
        saveDbCategories(db, [...cats, cleanCat]);
      }
      logActivity(
        db,
        user.id,
        'UPDATE_SERVICE',
        `Memperbarui layanan ${db.SERVICES[idx].service_name} (${id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return { service: db.SERVICES[idx], syncRes };
    });

    if (!updated) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    res.json({
      service: updated.service,
      gasSynced: updated.syncRes.synced,
      gasError: updated.syncRes.error,
    });
  });

  app.delete('/api/services/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const deleted = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const target = db.SERVICES.find((s) => s.id === id);
      if (!target) return null;
      db.SERVICES = db.SERVICES.filter((s) => s.id !== id);
      logActivity(
        db,
        user.id,
        'DELETE_SERVICE',
        `Menghapus layanan ${target.service_name} (${id})`
      );
      writeDb(db);
      const syncRes = await syncWithGasIfConfigured(db);
      return syncRes;
    });

    if (!deleted) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    res.json({
      ok: true,
      gasSynced: deleted.synced,
      gasError: deleted.error,
    });
  });

  // --- INVOICES CRUD ---
  app.get('/api/invoices/next-number', requireAuth, (_req, res) => {
    const db = readDb();
    const settings = getSettingsMap(db);
    const prefix = settings.invoice_prefix || 'INV/ASM';
    const year = settings.document_year || '2026';
    const nextNumber = generateSequentialNumber(
      db.INVOICES.map((i) => i.invoice_number),
      prefix,
      year
    );
    res.json({ nextNumber });
  });

  app.post('/api/invoices', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};
    if (!body.client_id) {
      res.status(400).json({ error: 'Pelanggan wajib dipilih.' });
      return;
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ error: 'Invoice harus memiliki minimal 1 item layanan.' });
      return;
    }

    const created = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const settings = getSettingsMap(db);
      const prefix = settings.invoice_prefix || 'INV/ASM';
      const year = settings.document_year || '2026';

      const invoiceId = generateEntityId(
        db.INVOICES.map((i) => i.id),
        'INV'
      );
      const invoiceNumber = generateSequentialNumber(
        db.INVOICES.map((i) => i.invoice_number),
        prefix,
        year
      );

      const newItems: DbInvoiceItem[] = body.items.map(
        (rawItem: Record<string, unknown>, idx: number) => {
          const qty = Math.max(1, Number(rawItem.quantity) || 1);
          const unitPrice = Math.max(
            0,
            Math.round(Number(rawItem.unit_price) || 0)
          );
          const itemDiscount = Math.max(
            0,
            Math.round(Number(rawItem.discount) || 0)
          );
          const total = Math.max(0, Math.round(qty * unitPrice - itemDiscount));

          return {
            id: `ITM-${Date.now().toString().slice(-5)}-${idx + 1}`,
            invoice_id: invoiceId,
            service_id: sanitizeString(rawItem.service_id || ''),
            description: sanitizeString(rawItem.description || 'Layanan'),
            quantity: qty,
            unit: sanitizeString(rawItem.unit || 'Paket'),
            unit_price: unitPrice,
            discount: itemDiscount,
            total,
          };
        }
      );

      const subtotal = newItems.reduce((s, it) => s + it.total, 0);
      const discount = Math.min(
        subtotal,
        Math.max(0, Math.round(Number(body.discount) || 0))
      );
      const additionalCost = Math.max(
        0,
        Math.round(Number(body.additional_cost) || 0)
      );
      const taxRate = Math.max(0, Number(body.tax_rate) || 0);
      const taxableBase = Math.max(0, subtotal - discount);
      const taxAmount =
        taxRate > 0 ? Math.round((taxableBase * taxRate) / 100) : 0;
      const grandTotal = Math.max(
        0,
        Math.round(subtotal - discount + additionalCost + taxAmount)
      );

      const now = getJakartaTimestamp();
      const issueDate = sanitizeString(body.issue_date || getJakartaDateStr());
      const dueDate = sanitizeString(body.due_date || issueDate);
      const requestedStatus = body.status === 'Draft' ? 'Draft' : 'Unpaid';

      const newInvoice: DbInvoice = {
        id: invoiceId,
        invoice_number: invoiceNumber,
        client_id: sanitizeString(body.client_id),
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        discount,
        additional_cost: additionalCost,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        amount_paid: 0,
        balance: grandTotal,
        status: requestedStatus,
        notes: sanitizeString(body.notes || ''),
        created_at: now,
        updated_at: now,
      };

      db.INVOICES.unshift(newInvoice);
      db.INVOICE_ITEMS.push(...newItems);

      const client = db.CLIENTS.find((c) => c.id === newInvoice.client_id);
      logActivity(
        db,
        user.id,
        'CREATE_INVOICE',
        `Membuat invoice ${invoiceNumber} untuk ${client?.client_name || newInvoice.client_id} senilai Rp ${grandTotal.toLocaleString('id-ID')}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      return {
        ...newInvoice,
        items: newItems,
        client,
      };
    });

    res.status(201).json({ invoice: created });
  });

  app.put('/api/invoices/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};

    if (!body.client_id) {
      res.status(400).json({ error: 'Pelanggan wajib dipilih.' });
      return;
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ error: 'Invoice harus memiliki minimal 1 item layanan.' });
      return;
    }

    const updated = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const idx = db.INVOICES.findIndex((i) => i.id === id);
      if (idx === -1) return null;

      const existing = db.INVOICES[idx];
      // Nomor invoice tidak berubah ketika invoice diedit (PRD Section 7.C)
      const immutableInvoiceNumber = existing.invoice_number;

      const newItems: DbInvoiceItem[] = body.items.map(
        (rawItem: Record<string, unknown>, itemIdx: number) => {
          const qty = Math.max(1, Number(rawItem.quantity) || 1);
          const unitPrice = Math.max(
            0,
            Math.round(Number(rawItem.unit_price) || 0)
          );
          const itemDiscount = Math.max(
            0,
            Math.round(Number(rawItem.discount) || 0)
          );
          const total = Math.max(0, Math.round(qty * unitPrice - itemDiscount));

          return {
            id:
              typeof rawItem.id === 'string' && rawItem.id.startsWith('ITM-')
                ? rawItem.id
                : `ITM-${Date.now().toString().slice(-5)}-${itemIdx + 1}`,
            invoice_id: id,
            service_id: sanitizeString(rawItem.service_id || ''),
            description: sanitizeString(rawItem.description || 'Layanan'),
            quantity: qty,
            unit: sanitizeString(rawItem.unit || 'Paket'),
            unit_price: unitPrice,
            discount: itemDiscount,
            total,
          };
        }
      );

      const subtotal = newItems.reduce((s, it) => s + it.total, 0);
      const discount = Math.min(
        subtotal,
        Math.max(0, Math.round(Number(body.discount) || 0))
      );
      const additionalCost = Math.max(
        0,
        Math.round(Number(body.additional_cost) || 0)
      );
      const taxRate = Math.max(0, Number(body.tax_rate) || 0);
      const taxableBase = Math.max(0, subtotal - discount);
      const taxAmount =
        taxRate > 0 ? Math.round((taxableBase * taxRate) / 100) : 0;
      const grandTotal = Math.max(
        0,
        Math.round(subtotal - discount + additionalCost + taxAmount)
      );

      db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
      db.INVOICE_ITEMS.push(...newItems);

      const allowedStatus =
        body.status === 'Cancelled'
          ? 'Cancelled'
          : body.status === 'Draft'
            ? 'Draft'
            : body.status === 'Sent'
              ? 'Sent'
              : existing.status === 'Draft' && body.status !== 'Draft'
                ? 'Unpaid'
                : existing.status;

      db.INVOICES[idx] = {
        ...existing,
        invoice_number: immutableInvoiceNumber,
        client_id: sanitizeString(body.client_id),
        issue_date: sanitizeString(body.issue_date || existing.issue_date),
        due_date: sanitizeString(body.due_date || existing.due_date),
        subtotal,
        discount,
        additional_cost: additionalCost,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        status: allowedStatus,
        notes: sanitizeString(body.notes ?? existing.notes),
        updated_at: getJakartaTimestamp(),
      };

      logActivity(
        db,
        user.id,
        'UPDATE_INVOICE',
        `Memperbarui invoice ${immutableInvoiceNumber}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      const refreshed = db.INVOICES.find((i) => i.id === id)!;
      return {
        ...refreshed,
        items: newItems,
        client: db.CLIENTS.find((c) => c.id === refreshed.client_id),
      };
    });

    if (!updated) {
      res.status(404).json({ error: 'Invoice tidak ditemukan.' });
      return;
    }
    res.json({ invoice: updated });
  });

  app.delete('/api/invoices/:id', requireAuth, requireAdmin, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const deleted = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const target = db.INVOICES.find((i) => i.id === id);
      if (!target) return false;
      db.INVOICES = db.INVOICES.filter((i) => i.id !== id);
      db.INVOICE_ITEMS = db.INVOICE_ITEMS.filter((it) => it.invoice_id !== id);
      db.PAYMENTS = db.PAYMENTS.filter((p) => p.invoice_id !== id);
      logActivity(
        db,
        user.id,
        'DELETE_INVOICE',
        `Menghapus invoice ${target.invoice_number} (${id}) beserta item terkait`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return true;
    });

    if (!deleted) {
      res.status(404).json({ error: 'Invoice tidak ditemukan.' });
      return;
    }
    res.json({ ok: true });
  });

  // --- PAYMENTS CRUD & RECEIPT GENERATION ---
  app.post('/api/payments', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};

    if (!body.invoice_id) {
      res.status(400).json({ error: 'Invoice terkait wajib dipilih.' });
      return;
    }
    const amount = Math.round(Number(body.amount) || 0);
    if (amount <= 0) {
      res.status(400).json({ error: 'Jumlah pembayaran harus lebih besar dari Rp 0.' });
      return;
    }

    const result = await withLock(async () => {
      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const inv = db.INVOICES.find((i) => i.id === body.invoice_id);
      if (!inv) {
        return { ok: false as const, error: 'Invoice tidak ditemukan.' };
      }
      if (inv.status === 'Cancelled') {
        return {
          ok: false as const,
          error: 'Tidak dapat mencatat pembayaran pada invoice yang dibatalkan.',
        };
      }

      // Validasi agar total pembayaran tidak melebihi tagihan tanpa konfirmasi (PRD Section 9)
      if (amount > inv.balance && !body.allow_overpayment) {
        return {
          ok: false as const,
          error: `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${inv.balance.toLocaleString('id-ID')}).`,
        };
      }

      const settings = getSettingsMap(db);
      const receiptPrefix = settings.receipt_prefix || 'KW/ASM';
      const docYear = settings.document_year || '2026';

      const receiptNumber = generateSequentialNumber(
        db.PAYMENTS.map((p) => p.receipt_number),
        receiptPrefix,
        docYear
      );

      const newPayment: DbPayment = {
        id: generateEntityId(
          db.PAYMENTS.map((p) => p.id),
          'PAY'
        ),
        receipt_number: receiptNumber,
        invoice_id: inv.id,
        payment_date: sanitizeString(body.payment_date || getJakartaDateStr()),
        amount,
        payment_method: (body.payment_method || 'Transfer Bank') as DbPayment['payment_method'],
        reference_number: sanitizeString(body.reference_number || ''),
        notes: sanitizeString(body.notes || ''),
        created_at: getJakartaTimestamp(),
      };

      // If invoice was Draft, recording payment transitions it out of Draft
      if (inv.status === 'Draft') {
        inv.status = 'Unpaid';
      }

      db.PAYMENTS.unshift(newPayment);
      inv.updated_at = getJakartaTimestamp();

      logActivity(
        db,
        user.id,
        'RECORD_PAYMENT',
        `Mencatat pembayaran ${receiptNumber} sebesar Rp ${amount.toLocaleString('id-ID')} untuk invoice ${inv.invoice_number}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      const updatedInvoice = db.INVOICES.find((i) => i.id === inv.id)!;
      return {
        ok: true as const,
        payment: newPayment,
        invoice: {
          ...updatedInvoice,
          items: db.INVOICE_ITEMS.filter((it) => it.invoice_id === inv.id),
          client: db.CLIENTS.find((c) => c.id === updatedInvoice.client_id),
        },
      };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  app.put('/api/payments/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};

    const result = await withLock(async () => {
      const db = readDb();
      const idx = db.PAYMENTS.findIndex((p) => p.id === id);
      if (idx === -1) {
        return { ok: false as const, error: 'Data pembayaran tidak ditemukan.' };
      }

      const existing = db.PAYMENTS[idx];
      const inv = db.INVOICES.find((i) => i.id === existing.invoice_id);
      if (!inv) {
        return { ok: false as const, error: 'Invoice terkait tidak ditemukan.' };
      }

      const newAmount =
        body.amount !== undefined
          ? Math.round(Number(body.amount) || 0)
          : existing.amount;

      if (newAmount <= 0) {
        return {
          ok: false as const,
          error: 'Jumlah pembayaran harus lebih besar dari Rp 0.',
        };
      }

      // Only Administrator can change payment nominal; Staff can edit notes/reference
      if (newAmount !== existing.amount && user.role !== 'Administrator') {
        return {
          ok: false as const,
          error: 'Hanya Administrator yang diizinkan mengubah nominal pembayaran.',
        };
      }

      const otherPaymentsSum = db.PAYMENTS.filter(
        (p) => p.invoice_id === inv.id && p.id !== id
      ).reduce((s, p) => s + p.amount, 0);

      if (otherPaymentsSum + newAmount > inv.grand_total && !body.allow_overpayment) {
        return {
          ok: false as const,
          error: 'Total pembayaran melebihi nilai Grand Total invoice.',
        };
      }

      db.PAYMENTS[idx] = {
        ...existing,
        payment_date: sanitizeString(body.payment_date || existing.payment_date),
        amount: newAmount,
        payment_method: (body.payment_method || existing.payment_method) as DbPayment['payment_method'],
        reference_number: sanitizeString(
          body.reference_number ?? existing.reference_number
        ),
        notes: sanitizeString(body.notes ?? existing.notes),
      };

      logActivity(
        db,
        user.id,
        'UPDATE_PAYMENT',
        `Memperbarui catatan pembayaran ${existing.receipt_number}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      return { ok: true as const, payment: db.PAYMENTS[idx] };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ payment: result.payment });
  });

  app.delete('/api/payments/:id', requireAuth, requireAdmin, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const deleted = await withLock(async () => {
      const db = readDb();
      const target = db.PAYMENTS.find((p) => p.id === id);
      if (!target) return false;
      db.PAYMENTS = db.PAYMENTS.filter((p) => p.id !== id);
      logActivity(
        db,
        user.id,
        'DELETE_PAYMENT',
        `Menghapus bukti pembayaran ${target.receipt_number} sebesar Rp ${target.amount.toLocaleString('id-ID')}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return true;
    });

    if (!deleted) {
      res.status(404).json({ error: 'Pembayaran tidak ditemukan.' });
      return;
    }
    res.json({ ok: true });
  });

  // --- COMPANY SETTINGS ---
  app.put('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const updates = req.body || {};

    const updatedMap = await withLock(async () => {
      const db = readDb();
      const now = getJakartaTimestamp();

      for (const [key, rawValue] of Object.entries(updates)) {
        const val =
          key === 'logo_url' || key === 'qris_url'
            ? String(rawValue || '')
            : sanitizeString(rawValue);
        const existingIdx = db.COMPANY_SETTINGS.findIndex(
          (s) => s.setting_key === key
        );
        if (existingIdx >= 0) {
          db.COMPANY_SETTINGS[existingIdx].setting_value = val;
          db.COMPANY_SETTINGS[existingIdx].updated_at = now;
        } else {
          db.COMPANY_SETTINGS.push({
            id: `SET-${String(db.COMPANY_SETTINGS.length + 1).padStart(3, '0')}`,
            setting_key: key,
            setting_value: val,
            updated_at: now,
          });
        }
      }

      logActivity(
        db,
        user.id,
        'UPDATE_SETTINGS',
        'Memperbarui pengaturan identitas perusahaan dan konfigurasi invoice'
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return getSettingsMap(db);
    });

    res.json({ settings: updatedMap });
  });

  // --- USERS MANAGEMENT (Administrator Only) ---
  app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const admin = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};
    if (!body.name || !body.email || !body.password) {
      res
        .status(400)
        .json({ error: 'Nama, email, dan password wajib diisi.' });
      return;
    }

    const result = await withLock(async () => {
      const db = readDb();
      const exists = db.USERS.some(
        (u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase()
      );
      if (exists) {
        return { ok: false as const, error: 'Email sudah terdaftar.' };
      }

      const newUser: DbUser = {
        id: generateEntityId(
          db.USERS.map((u) => u.id),
          'USR'
        ),
        name: sanitizeString(body.name),
        email: sanitizeString(body.email).toLowerCase(),
        password_hash: hashPassword(String(body.password)),
        role: body.role === 'Administrator' ? 'Administrator' : 'Staff',
        status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        created_at: getJakartaTimestamp(),
      };

      db.USERS.push(newUser);
      logActivity(
        db,
        admin.id,
        'CREATE_USER',
        `Menambahkan pengguna ${newUser.name} (${newUser.role})`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      const { password_hash: _ph, ...safeUser } = newUser;
      return { ok: true as const, user: safeUser };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ user: result.user });
  });

  app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const admin = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};

    const result = await withLock(async () => {
      const db = readDb();
      const idx = db.USERS.findIndex((u) => u.id === id);
      if (idx === -1) {
        return { ok: false as const, error: 'Pengguna tidak ditemukan.' };
      }

      const target = db.USERS[idx];
      db.USERS[idx] = {
        ...target,
        name: sanitizeString(body.name || target.name),
        email: sanitizeString(body.email || target.email).toLowerCase(),
        role:
          body.role === 'Administrator'
            ? 'Administrator'
            : body.role === 'Staff'
              ? 'Staff'
              : target.role,
        status:
          body.status === 'Nonaktif'
            ? 'Nonaktif'
            : body.status === 'Aktif'
              ? 'Aktif'
              : target.status,
        password_hash:
          body.password && String(body.password).trim().length >= 4
            ? hashPassword(String(body.password))
            : target.password_hash,
      };

      logActivity(
        db,
        admin.id,
        'UPDATE_USER',
        `Memperbarui hak akses / profil pengguna ${db.USERS[idx].name}`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);

      const { password_hash: _ph, ...safeUser } = db.USERS[idx];
      return { ok: true as const, user: safeUser };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  // --- GOOGLE SHEETS / APPS SCRIPT PROXY & CONNECTION CONFIG ---
  app.post(
    '/api/database/config',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const admin = (req as express.Request & { user: DbUser }).user;
      const { webAppUrl, apiSecret } = req.body || {};
      const cleanUrl = String(webAppUrl || '').trim();

      if (cleanUrl && !cleanUrl.startsWith('https://script.google.com/')) {
        res.status(400).json({
          error:
            'URL Google Apps Script harus diawali dengan https://script.google.com/...',
        });
        return;
      }

      const cfg = loadGasConfig();
      cfg.webAppUrl = cleanUrl;
      if (apiSecret !== undefined) {
        cfg.apiSecret = String(apiSecret).trim();
      }
      saveGasConfig(cfg);

      if (cleanUrl) {
        await hydrateFromGasIfNeeded(true);
      }

      const db = readDb();
      logActivity(
        db,
        admin.id,
        'CONFIGURE_DATABASE',
        cleanUrl
          ? 'Menghubungkan konfigurasi server-side proxy ke Google Apps Script'
          : 'Mengaktifkan mode penyimpanan lokal (DEMO_LOCAL)'
      );
      writeDb(db);

      // Jika URL Web App diisi, langsung coba sinkronisasi awal ke Google Sheets
      let autoSyncResult: { synced: boolean; error?: string } = {
        synced: false,
      };
      if (cleanUrl) {
        autoSyncResult = await syncWithGasIfConfigured(db);
      }

      const refreshedCfg = loadGasConfig();

      res.json({
        ok: true,
        autoSynced: autoSyncResult.synced,
        autoSyncError: autoSyncResult.error,
        databaseStatus: buildDatabaseStatusObject(refreshedCfg),
      });
    }
  );

  app.post(
    '/api/database/test',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const cfg = loadGasConfig();
      const targetUrl = String(req.body?.webAppUrl || cfg.webAppUrl || '').trim();
      const targetSecret =
        req.body?.apiSecret !== undefined
          ? String(req.body.apiSecret).trim()
          : cfg.apiSecret;

      if (!targetUrl) {
        res.status(400).json({
          error:
            'Masukkan URL Web App Google Apps Script (https://script.google.com/macros/s/.../exec) terlebih dahulu.',
        });
        return;
      }

      if (!targetUrl.startsWith('https://script.google.com/')) {
        res.status(400).json({
          error:
            'URL Web App harus diawali dengan https://script.google.com/...',
        });
        return;
      }

      if (
        targetUrl.includes('/home/projects/') ||
        targetUrl.endsWith('/edit')
      ) {
        res.status(400).json({
          error:
            'URL yang dimasukkan adalah URL Editor Apps Script (/edit), bukan URL Web App. Klik tombol biru "Deploy -> New deployment -> Web app" lalu salin Web App URL yang berakhiran /exec.',
        });
        return;
      }

      if (targetUrl.endsWith('/dev')) {
        res.status(400).json({
          error:
            'URL berakhiran /dev hanya bisa diakses saat login pemilik. Gunakan URL Deployment produksi yang berakhiran /exec agar aplikasi dapat menyimpan data.',
        });
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const gasRes = await fetch(targetUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'ping',
            secret: targetSecret,
            apiSecret: targetSecret,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!gasRes.ok) {
          res.status(502).json({
            error: `Server Apps Script merespons HTTP ${gasRes.status}. Pastikan akses Web App disetel ke "Anyone / Siapa saja".`,
          });
          return;
        }

        const rawText = await gasRes.text();
        if (rawText.trim().startsWith('<')) {
          res.status(400).json({
            error:
              'Google Apps Script mengembalikan halaman Login Google (bukan JSON). Pastikan saat Deploy Web App di Apps Script: (1) Execute as = "Me", (2) Who has access = "Anyone / Siapa saja", dan (3) gunakan URL berakhiran /exec.',
          });
          return;
        }

        const data = JSON.parse(rawText) as {
          ok?: boolean;
          error?: string;
          spreadsheetName?: string;
          spreadsheetId?: string;
          spreadsheetUrl?: string;
          counts?: Record<string, number>;
          serverTime?: string;
        };

        if (!data || !data.ok) {
          res.status(400).json({
            error:
              data?.error ||
              'Respons dari Google Apps Script tidak valid. Pastikan Code.gs dan Setup.gs sudah dipasang.',
          });
          return;
        }

        res.json({
          ok: true,
          spreadsheetName: data.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE',
          spreadsheetId: data.spreadsheetId || '',
          spreadsheetUrl: data.spreadsheetUrl || '',
          counts: data.counts || {},
          serverTime: data.serverTime || '',
        });
      } catch (err) {
        res.status(502).json({
          error: `Gagal menghubungi URL Google Apps Script: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  );

  app.post(
    '/api/database/sync',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const admin = (req as express.Request & { user: DbUser }).user;
      const cfg = loadGasConfig();

      if (!cfg.webAppUrl) {
        res.status(400).json({
          error:
            'URL Google Apps Script belum dikonfigurasi. Silakan masukkan URL Web App terlebih dahulu.',
        });
        return;
      }

      await hydrateFromGasIfNeeded(true);
      const db = readDb();
      const clientLocalDb = req.body?.localDb as
        | Partial<AutosmartDatabase>
        | undefined;

      if (clientLocalDb) {
        const deletedIds = extractServerDeletedIdsFromLogs([
          ...(Array.isArray(db.ACTIVITY_LOGS) ? db.ACTIVITY_LOGS : []),
          ...(Array.isArray(clientLocalDb.ACTIVITY_LOGS)
            ? clientLocalDb.ACTIVITY_LOGS
            : []),
        ]);

        if (Array.isArray(clientLocalDb.CLIENTS)) {
          const existingIds = new Set(db.CLIENTS.map((c) => c.id));
          for (const c of clientLocalDb.CLIENTS) {
            if (c && c.id && !existingIds.has(c.id) && !deletedIds.has(c.id)) {
              db.CLIENTS.push(c);
              existingIds.add(c.id);
            }
          }
        }

        if (Array.isArray(clientLocalDb.SERVICES)) {
          const existingIds = new Set(db.SERVICES.map((s) => s.id));
          for (const s of clientLocalDb.SERVICES) {
            if (s && s.id && !existingIds.has(s.id) && !deletedIds.has(s.id)) {
              db.SERVICES.unshift(s);
              existingIds.add(s.id);
            }
          }
        }

        if (Array.isArray(clientLocalDb.INVOICES)) {
          const existingIds = new Set(db.INVOICES.map((i) => i.id));
          for (const inv of clientLocalDb.INVOICES) {
            if (
              inv &&
              inv.id &&
              !existingIds.has(inv.id) &&
              !deletedIds.has(inv.id)
            ) {
              db.INVOICES.push(inv);
              existingIds.add(inv.id);
            }
          }
        }

        if (Array.isArray(clientLocalDb.INVOICE_ITEMS)) {
          const activeInvIds = new Set(db.INVOICES.map((i) => i.id));
          const existingItemIds = new Set(db.INVOICE_ITEMS.map((it) => it.id));
          for (const it of clientLocalDb.INVOICE_ITEMS) {
            if (
              it &&
              it.id &&
              !existingItemIds.has(it.id) &&
              activeInvIds.has(it.invoice_id)
            ) {
              db.INVOICE_ITEMS.push(it);
              existingItemIds.add(it.id);
            }
          }
        }

        if (Array.isArray(clientLocalDb.PAYMENTS)) {
          const activeInvIds = new Set(db.INVOICES.map((i) => i.id));
          const existingPayIds = new Set(db.PAYMENTS.map((p) => p.id));
          for (const p of clientLocalDb.PAYMENTS) {
            if (
              p &&
              p.id &&
              !existingPayIds.has(p.id) &&
              !deletedIds.has(p.id) &&
              activeInvIds.has(p.invoice_id)
            ) {
              db.PAYMENTS.push(p);
              existingPayIds.add(p.id);
            }
          }
        }
      }

      logActivity(
        db,
        admin.id,
        'SYNC_DATABASE',
        'Sinkronisasi 2 arah seluruh 8 sheet ke Google Sheets (AUTOSMART_INVOICE_DATABASE) berhasil'
      );
      writeDb(db);

      const syncRes = await syncWithGasIfConfigured(db);
      if (!syncRes.synced) {
        res.status(502).json({
          error: `Gagal menghubungi Google Apps Script: ${syncRes.error}`,
        });
        return;
      }

      res.json({
        ok: true,
        last_sync: loadGasConfig().lastSync,
      });
    }
  );

  app.post(
    '/api/database/pull',
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const admin = (req as express.Request & { user: DbUser }).user;
      const cfg = loadGasConfig();

      if (!cfg.webAppUrl) {
        res.status(400).json({
          error:
            'URL Google Apps Script belum dikonfigurasi. Silakan simpan URL Web App terlebih dahulu.',
        });
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const gasRes = await fetch(cfg.webAppUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'exportAll',
            secret: cfg.apiSecret,
            apiSecret: cfg.apiSecret,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!gasRes.ok) {
          res.status(502).json({
            error: `Gagal menarik data dari Google Sheets (HTTP ${gasRes.status}).`,
          });
          return;
        }

        const rawText = await gasRes.text();
        if (rawText.trim().startsWith('<')) {
          res.status(400).json({
            error:
              'Google Apps Script mengembalikan halaman Login Google (bukan JSON). Pastikan saat Deploy Web App: Who has access = "Anyone / Siapa saja" dan URL berakhiran /exec.',
          });
          return;
        }

        const payload = JSON.parse(rawText) as {
          ok?: boolean;
          error?: string;
          data?: Partial<Record<keyof AutosmartDatabase, Array<Record<string, unknown>>>>;
        };

        if (!payload?.ok || !payload.data) {
          res.status(400).json({
            error:
              payload?.error ||
              'Data dari Google Sheets kosong atau format tidak sesuai.',
          });
          return;
        }

        const remote = payload.data;
        await withLock(async () => {
          const currentDb = readDb();

          if (Array.isArray(remote.CLIENTS)) {
            currentDb.CLIENTS = remote.CLIENTS.map((c) => ({
              id: String(c.id || ''),
              client_name: String(c.client_name || ''),
              contact_person: String(c.contact_person || ''),
              phone: String(c.phone || ''),
              whatsapp: String(c.whatsapp || ''),
              email: String(c.email || ''),
              address: String(c.address || ''),
              notes: String(c.notes || ''),
              created_at: String(c.created_at || getJakartaTimestamp()),
            }));
          }

          if (Array.isArray(remote.SERVICES) && remote.SERVICES.length > 0) {
            currentDb.SERVICES = remote.SERVICES.map((s) => ({
              id: String(s.id || ''),
              service_name: String(s.service_name || ''),
              category: String(s.category || 'Layanan Digital Lainnya'),
              description: String(s.description || ''),
              unit: String(s.unit || 'Paket'),
              price: Math.round(Number(s.price) || 0),
              status: s.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
              created_at: String(s.created_at || getJakartaTimestamp()),
            }));
          }

          if (Array.isArray(remote.INVOICES)) {
            currentDb.INVOICES = remote.INVOICES.map((inv) => ({
              id: String(inv.id || ''),
              invoice_number: String(inv.invoice_number || ''),
              client_id: String(inv.client_id || ''),
              issue_date: String(inv.issue_date || getJakartaDateStr()),
              due_date: String(inv.due_date || getJakartaDateStr()),
              subtotal: Math.round(Number(inv.subtotal) || 0),
              discount: Math.round(Number(inv.discount) || 0),
              additional_cost: Math.round(Number(inv.additional_cost) || 0),
              tax_rate: Number(inv.tax_rate) || 0,
              tax_amount: Math.round(Number(inv.tax_amount) || 0),
              grand_total: Math.round(Number(inv.grand_total) || 0),
              amount_paid: Math.round(Number(inv.amount_paid) || 0),
              balance: Math.round(Number(inv.balance) || 0),
              status: (inv.status as DbInvoice['status']) || 'Unpaid',
              notes: String(inv.notes || ''),
              created_at: String(inv.created_at || getJakartaTimestamp()),
              updated_at: String(inv.updated_at || getJakartaTimestamp()),
            }));
          }

          if (Array.isArray(remote.INVOICE_ITEMS)) {
            currentDb.INVOICE_ITEMS = remote.INVOICE_ITEMS.map((it) => ({
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
            currentDb.PAYMENTS = remote.PAYMENTS.map((p) => ({
              id: String(p.id || ''),
              receipt_number: String(p.receipt_number || ''),
              invoice_id: String(p.invoice_id || ''),
              payment_date: String(p.payment_date || getJakartaDateStr()),
              amount: Math.round(Number(p.amount) || 0),
              payment_method:
                (p.payment_method as DbPayment['payment_method']) ||
                'Transfer Bank',
              reference_number: String(p.reference_number || ''),
              notes: String(p.notes || ''),
              created_at: String(p.created_at || getJakartaTimestamp()),
            }));
          }

          if (
            Array.isArray(remote.COMPANY_SETTINGS) &&
            remote.COMPANY_SETTINGS.length > 0
          ) {
            currentDb.COMPANY_SETTINGS = remote.COMPANY_SETTINGS.map(
              (s, idx) => ({
                id: String(s.id || `SET-0${idx + 1}`),
                setting_key: String(s.setting_key || ''),
                setting_value: String(s.setting_value ?? ''),
                updated_at: String(s.updated_at || getJakartaTimestamp()),
              })
            );
            ensureOfficialSettingsHydrated(currentDb);
          }

          logActivity(
            currentDb,
            admin.id,
            'PULL_DATABASE',
            'Menarik data nota, invoice, pembayaran, dan klien dari Google Sheets (AUTOSMART_INVOICE_DATABASE)'
          );
          writeDb(currentDb);

          cfg.lastSync = getJakartaTimestamp();
          saveGasConfig(cfg);
        });

        res.json({
          ok: true,
          last_sync: loadGasConfig().lastSync,
        });
      } catch (err) {
        res.status(502).json({
          error: `Gagal menarik data dari Google Apps Script: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  );

  app.get(
    '/api/database/backup',
    requireAuth,
    requireAdmin,
    (_req, res) => {
      const db = readDb();
      const { USERS, ...rest } = db;
      const safeUsers = USERS.map(({ password_hash: _ph, ...u }) => u);
      res.json({
        database: 'AUTOSMART_INVOICE_DATABASE',
        exported_at: getJakartaTimestamp(),
        sheets: {
          USERS: safeUsers,
          ...rest,
        },
      });
    }
  );

// --- VITE DEV MIDDLEWARE / STATIC PROD SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Autosmart Invoice Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== '1' && process.env.VERCEL !== 'true') {
  startServer();
}

export default app;

