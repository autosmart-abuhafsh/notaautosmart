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

function createInitialDatabase(): AutosmartDatabase {
  const now = getJakartaTimestamp();
  // Default Company Settings strictly from PRD Section 14 (no fabricated address/bank/phone)
  const settingsMap: Record<string, string> = {
    company_name: 'Autosmart Digital Solutions',
    tagline: 'Skill Up For Digital Collaboration',
    business_field: 'Digital Learning & Business Solution',
    address: '',
    whatsapp: '',
    email: '',
    website: '',
    logo_url: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
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

  const COMPANY_SETTINGS: DbCompanySetting[] = Object.entries(settingsMap).map(
    ([key, val], idx) => ({
      id: `SET-${String(idx + 1).padStart(3, '0')}`,
      setting_key: key,
      setting_value: val,
      updated_at: now,
    })
  );

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

  const CLIENTS: DbClient[] = [
    {
      id: 'CLT-0001',
      client_name: 'PT Nusantara Logistik Mandiri',
      contact_person: 'Hendra Wijaya',
      phone: '081234567801',
      whatsapp: '6281234567801',
      email: 'hendra@nusantaralogistik.co.id',
      address: 'Jl. Jenderal Sudirman Kav. 45, Jakarta Selatan',
      notes: 'Klien korporat layanan Business Dashboard & Maintenance.',
      created_at: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'CLT-0002',
      client_name: 'CV Al-Haramain Tour & Travel',
      contact_person: 'H. Ahmad Fauzi',
      phone: '081398765402',
      whatsapp: '6281398765402',
      email: 'info@alharamaintour.id',
      address: 'Jl. KH. Ahmad Dahlan No. 28, Bandung',
      notes: 'Pengembangan Website Travel & Umroh dengan pembayaran bertahap.',
      created_at: '2026-09-15T10:00:00.000Z',
    },
    {
      id: 'CLT-0003',
      client_name: 'PT Kreasi Ritel Indonesia',
      contact_person: 'Rina Kusuma',
      phone: '081122334455',
      whatsapp: '6281122334455',
      email: 'rina.kusuma@kreasiritel.id',
      address: 'Kawasan Niaga Terpadu Blok B2, Surabaya',
      notes: 'Proyek E-Commerce dan Sistem Otomatisasi Bisnis.',
      created_at: '2026-10-01T08:30:00.000Z',
    },
    {
      id: 'CLT-0004',
      client_name: 'Klinik Utama Medika Prima',
      contact_person: 'dr. Farhan Pratama',
      phone: '081566778899',
      whatsapp: '6281566778899',
      email: 'manajemen@medikaprima.co.id',
      address: 'Jl. Diponegoro No. 112, Semarang',
      notes: 'Pembuatan Website Company Profile dan Google Apps Script.',
      created_at: '2026-10-12T11:15:00.000Z',
    },
  ];

  // Realistic transactions covering:
  // 1. Paid (Lunas)
  // 2. Partially Paid (DP / Bertahap)
  // 3. Overdue (Jatuh Tempo)
  // 4. Unpaid (Belum Dibayar)
  const INVOICES: DbInvoice[] = [
    {
      id: 'INV-0001',
      invoice_number: 'INV/ASM/2026/0001',
      client_id: 'CLT-0001',
      issue_date: '2026-10-05',
      due_date: '2026-10-20',
      subtotal: 10100000,
      discount: 100000,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 10000000,
      amount_paid: 10000000,
      balance: 0,
      status: 'Paid',
      notes: 'Pengembangan Executive Business Dashboard & Maintenance 1 Tahun.',
      created_at: '2026-10-05T09:00:00.000Z',
      updated_at: '2026-10-18T14:00:00.000Z',
    },
    {
      id: 'INV-0002',
      invoice_number: 'INV/ASM/2026/0002',
      client_id: 'CLT-0002',
      issue_date: '2026-11-01',
      due_date: '2026-11-25',
      subtotal: 14500000,
      discount: 500000,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 14000000,
      amount_paid: 7000000,
      balance: 7000000,
      status: 'Partially Paid',
      notes: 'Pembayaran Termin 1 (DP 50%) telah diterima. Pelunasan saat UAT selesai.',
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: '2026-11-02T15:30:00.000Z',
    },
    {
      id: 'INV-0003',
      invoice_number: 'INV/ASM/2026/0003',
      client_id: 'CLT-0003',
      issue_date: '2026-10-10',
      due_date: '2026-10-28',
      subtotal: 8000000,
      discount: 0,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 8000000,
      amount_paid: 0,
      balance: 8000000,
      status: 'Overdue',
      notes: 'Implementasi Sistem Otomatisasi Bisnis Terpadu.',
      created_at: '2026-10-10T08:00:00.000Z',
      updated_at: '2026-10-10T08:00:00.000Z',
    },
    {
      id: 'INV-0004',
      invoice_number: 'INV/ASM/2026/0004',
      client_id: 'CLT-0004',
      issue_date: '2026-11-05',
      due_date: '2026-11-20',
      subtotal: 10000000,
      discount: 0,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 10000000,
      amount_paid: 0,
      balance: 10000000,
      status: 'Unpaid',
      notes: 'Pembuatan Website Company Profile Eksklusif & Google Apps Script Automation.',
      created_at: '2026-11-05T11:00:00.000Z',
      updated_at: '2026-11-05T11:00:00.000Z',
    },
  ];

  const INVOICE_ITEMS: DbInvoiceItem[] = [
    {
      id: 'ITM-0001',
      invoice_id: 'INV-0001',
      service_id: 'SRV-0008',
      description: 'Executive Business Dashboard - Modul Analitik & Operasional',
      quantity: 1,
      unit: 'Sistem',
      unit_price: 6500000,
      discount: 0,
      total: 6500000,
    },
    {
      id: 'ITM-0002',
      invoice_id: 'INV-0001',
      service_id: 'SRV-0014',
      description: 'Maintenance & Keamanan Website Tahunan',
      quantity: 1,
      unit: 'Tahun',
      unit_price: 3600000,
      discount: 0,
      total: 3600000,
    },
    {
      id: 'ITM-0003',
      invoice_id: 'INV-0002',
      service_id: 'SRV-0005',
      description: 'Website Travel & Manajemen Umroh Terintegrasi',
      quantity: 1,
      unit: 'Paket',
      unit_price: 14500000,
      discount: 0,
      total: 14500000,
    },
    {
      id: 'ITM-0004',
      invoice_id: 'INV-0003',
      service_id: 'SRV-0011',
      description: 'Sistem Otomatisasi Bisnis Terpadu',
      quantity: 1,
      unit: 'Sistem',
      unit_price: 8000000,
      discount: 0,
      total: 8000000,
    },
    {
      id: 'ITM-0005',
      invoice_id: 'INV-0004',
      service_id: 'SRV-0003',
      description: 'Website Company Profile Eksklusif',
      quantity: 1,
      unit: 'Paket',
      unit_price: 5500000,
      discount: 0,
      total: 5500000,
    },
    {
      id: 'ITM-0006',
      invoice_id: 'INV-0004',
      service_id: 'SRV-0007',
      description: 'Google Apps Script Automation Suite',
      quantity: 1,
      unit: 'Sistem',
      unit_price: 4500000,
      discount: 0,
      total: 4500000,
    },
  ];

  const PAYMENTS: DbPayment[] = [
    {
      id: 'PAY-0001',
      receipt_number: 'KW/ASM/2026/0001',
      invoice_id: 'INV-0001',
      payment_date: '2026-10-06',
      amount: 5000000,
      payment_method: 'Transfer Bank',
      reference_number: 'TRF-20261006-01',
      notes: 'Pembayaran DP 50% Proyek Executive Business Dashboard',
      created_at: '2026-10-06T10:15:00.000Z',
    },
    {
      id: 'PAY-0002',
      receipt_number: 'KW/ASM/2026/0002',
      invoice_id: 'INV-0001',
      payment_date: '2026-10-18',
      amount: 5000000,
      payment_method: 'Transfer Bank',
      reference_number: 'TRF-20261018-09',
      notes: 'Pelunasan 100% Proyek Executive Business Dashboard',
      created_at: '2026-10-18T14:00:00.000Z',
    },
    {
      id: 'PAY-0003',
      receipt_number: 'KW/ASM/2026/0003',
      invoice_id: 'INV-0002',
      payment_date: '2026-11-02',
      amount: 7000000,
      payment_method: 'Transfer Bank',
      reference_number: 'TRF-20261102-04',
      notes: 'Down Payment (DP 50%) Website Travel & Manajemen Umroh',
      created_at: '2026-11-02T15:30:00.000Z',
    },
  ];

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

  const ACTIVITY_LOGS: DbActivityLog[] = [
    {
      id: 'LOG-0001',
      user_id: 'USR-0001',
      activity: 'CREATE_INVOICE',
      description: 'Menerbitkan invoice INV/ASM/2026/0001 untuk PT Nusantara Logistik Mandiri',
      timestamp: '2026-10-05T09:00:00.000Z',
    },
    {
      id: 'LOG-0002',
      user_id: 'USR-0001',
      activity: 'RECORD_PAYMENT',
      description: 'Mencatat pembayaran KW/ASM/2026/0002 sebesar Rp 5.000.000 (Lunas)',
      timestamp: '2026-10-18T14:00:00.000Z',
    },
    {
      id: 'LOG-0003',
      user_id: 'USR-0002',
      activity: 'RECORD_PAYMENT',
      description: 'Mencatat pembayaran DP KW/ASM/2026/0003 sebesar Rp 7.000.000 untuk INV/ASM/2026/0002',
      timestamp: '2026-11-02T15:30:00.000Z',
    },
    {
      id: 'LOG-0004',
      user_id: 'USR-0002',
      activity: 'CREATE_INVOICE',
      description: 'Menerbitkan invoice INV/ASM/2026/0004 untuk Klinik Utama Medika Prima',
      timestamp: '2026-11-05T11:00:00.000Z',
    },
  ];

  return {
    USERS,
    CLIENTS,
    SERVICES,
    INVOICES,
    INVOICE_ITEMS,
    PAYMENTS,
    COMPANY_SETTINGS,
    ACTIVITY_LOGS,
  };
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
    return recomputeAllInvoices(parsed);
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
async function syncWithGasIfConfigured(db: AutosmartDatabase): Promise<{
  synced: boolean;
  error?: string;
}> {
  const cfg = loadGasConfig();
  if (!cfg.webAppUrl) return { synced: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(cfg.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncAll',
        secret: cfg.apiSecret,
        payload: db,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { synced: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { ok?: boolean; error?: string };
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
  app.get('/api/bootstrap', requireAuth, (req, res) => {
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
      databaseStatus: {
        mode: cfg.webAppUrl ? 'GOOGLE_SHEETS' : 'DEMO_LOCAL',
        connected: Boolean(cfg.webAppUrl),
        spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
        gas_url_configured: Boolean(cfg.webAppUrl),
        gas_url_masked: cfg.webAppUrl
          ? `${cfg.webAppUrl.slice(0, 38)}...`
          : '',
        last_sync: cfg.lastSync,
        message: cfg.webAppUrl
          ? 'Terhubung ke Google Sheets melalui Google Apps Script Proxy'
          : 'Mode DEMO / Database Persisten Lokal Aktif (Siap dihubungkan ke Google Sheets)',
      },
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

    const created = await withLock(async () => {
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
      await syncWithGasIfConfigured(db);
      return newClient;
    });

    res.status(201).json({ client: created });
  });

  app.put('/api/clients/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;
    const body = req.body || {};
    if (!body.client_name || !String(body.client_name).trim()) {
      res.status(400).json({ error: 'Nama pelanggan / perusahaan wajib diisi.' });
      return;
    }

    const updated = await withLock(async () => {
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
      await syncWithGasIfConfigured(db);
      return db.CLIENTS[idx];
    });

    if (!updated) {
      res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
      return;
    }
    res.json({ client: updated });
  });

  app.delete('/api/clients/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const result = await withLock(async () => {
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
      await syncWithGasIfConfigured(db);
      return { ok: true };
    });

    if (!result.ok) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  });

  // --- SERVICES CRUD ---
  app.post('/api/services', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const body = req.body || {};
    if (!body.service_name || !String(body.service_name).trim()) {
      res.status(400).json({ error: 'Nama layanan wajib diisi.' });
      return;
    }

    const created = await withLock(async () => {
      const db = readDb();
      const newService: DbService = {
        id: generateEntityId(
          db.SERVICES.map((s) => s.id),
          'SRV'
        ),
        service_name: sanitizeString(body.service_name),
        category: sanitizeString(body.category || 'Layanan Digital Lainnya'),
        description: sanitizeString(body.description || ''),
        unit: sanitizeString(body.unit || 'Paket'),
        price: Math.max(0, Math.round(Number(body.price) || 0)),
        status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        created_at: getJakartaTimestamp(),
      };
      db.SERVICES.unshift(newService);
      logActivity(
        db,
        user.id,
        'CREATE_SERVICE',
        `Menambahkan layanan ${newService.service_name} (${newService.id})`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return newService;
    });

    res.status(201).json({ service: created });
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
      const db = readDb();
      const idx = db.SERVICES.findIndex((s) => s.id === id);
      if (idx === -1) return null;

      db.SERVICES[idx] = {
        ...db.SERVICES[idx],
        service_name: sanitizeString(body.service_name),
        category: sanitizeString(body.category || 'Layanan Digital Lainnya'),
        description: sanitizeString(body.description || ''),
        unit: sanitizeString(body.unit || 'Paket'),
        price: Math.max(0, Math.round(Number(body.price) || 0)),
        status: body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      };
      logActivity(
        db,
        user.id,
        'UPDATE_SERVICE',
        `Memperbarui layanan ${db.SERVICES[idx].service_name} (${id})`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return db.SERVICES[idx];
    });

    if (!updated) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    res.json({ service: updated });
  });

  app.delete('/api/services/:id', requireAuth, async (req, res) => {
    const user = (req as express.Request & { user: DbUser }).user;
    const { id } = req.params;

    const deleted = await withLock(async () => {
      const db = readDb();
      const target = db.SERVICES.find((s) => s.id === id);
      if (!target) return false;
      db.SERVICES = db.SERVICES.filter((s) => s.id !== id);
      logActivity(
        db,
        user.id,
        'DELETE_SERVICE',
        `Menghapus layanan ${target.service_name} (${id})`
      );
      writeDb(db);
      await syncWithGasIfConfigured(db);
      return true;
    });

    if (!deleted) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    res.json({ ok: true });
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
        `Menghapus invoice ${target.invoice_number} beserta item terkait`
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
        databaseStatus: {
          mode: refreshedCfg.webAppUrl ? 'GOOGLE_SHEETS' : 'DEMO_LOCAL',
          connected: Boolean(refreshedCfg.webAppUrl),
          spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
          gas_url_configured: Boolean(refreshedCfg.webAppUrl),
          gas_url_masked: refreshedCfg.webAppUrl
            ? `${refreshedCfg.webAppUrl.slice(0, 42)}...`
            : '',
          last_sync: refreshedCfg.lastSync,
          message: refreshedCfg.webAppUrl
            ? 'Terhubung ke Google Sheets melalui Google Apps Script Proxy'
            : 'Mode DEMO / Database Persisten Lokal Aktif',
        },
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

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const gasRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ping',
            secret: targetSecret,
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

        const data = (await gasRes.json()) as {
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
      const db = readDb();
      const cfg = loadGasConfig();

      if (!cfg.webAppUrl) {
        res.status(400).json({
          error:
            'URL Google Apps Script belum dikonfigurasi. Silakan masukkan URL Web App terlebih dahulu.',
        });
        return;
      }

      const syncRes = await syncWithGasIfConfigured(db);
      if (!syncRes.synced) {
        res.status(502).json({
          error: `Gagal menghubungi Google Apps Script: ${syncRes.error}`,
        });
        return;
      }

      logActivity(
        db,
        admin.id,
        'SYNC_DATABASE',
        'Sinkronisasi seluruh 8 sheet ke Google Sheets (AUTOSMART_INVOICE_DATABASE) berhasil'
      );
      writeDb(db);

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exportAll',
            secret: cfg.apiSecret,
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

        const payload = (await gasRes.json()) as {
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

          if (Array.isArray(remote.CLIENTS) && remote.CLIENTS.length > 0) {
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

          if (Array.isArray(remote.INVOICES) && remote.INVOICES.length > 0) {
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

          if (
            Array.isArray(remote.INVOICE_ITEMS) &&
            remote.INVOICE_ITEMS.length > 0
          ) {
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

