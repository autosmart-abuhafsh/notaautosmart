import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  Payment,
} from '../types/invoice';

/**
 * Format integer amount in Indonesian Rupiah without decimals (e.g., Rp 5.500.000)
 */
export function formatRupiah(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Format YYYY-MM-DD date string to Indonesian readable format
 */
export function formatDateId(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  if (!month || month < 1 || month > 12) return dateStr;
  return `${String(day).padStart(2, '0')} ${months[month - 1]} ${year}`;
}

/**
 * Get current date in Asia/Jakarta as YYYY-MM-DD
 */
export function getJakartaDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Calculate single line item total after item discount (rounded to integer IDR)
 */
export function calculateLineItemTotal(
  quantity: number,
  unitPrice: number,
  itemDiscount: number = 0
): number {
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Math.round(Number(unitPrice) || 0));
  const disc = Math.max(0, Math.round(Number(itemDiscount) || 0));
  return Math.max(0, Math.round(qty * price - disc));
}

export interface InvoiceCalculationInput {
  items: Array<{
    quantity: number;
    unit_price: number;
    discount?: number;
  }>;
  overallDiscount?: number;
  additionalCost?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  amountPaid?: number;
}

export interface InvoiceCalculationResult {
  subtotal: number;
  discount: number;
  additional_cost: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  amount_paid: number;
  balance: number;
}

/**
 * Core Invoice Calculation Engine following PRD Section 7.B:
 * Subtotal = Total seluruh item setelah diskon item.
 * Grand Total = Subtotal - Diskon keseluruhan + Biaya tambahan + Pajak.
 * Sisa Tagihan = Grand Total - Total pembayaran yang sudah diterima.
 */
export function calculateInvoiceTotals(
  input: InvoiceCalculationInput
): InvoiceCalculationResult {
  const subtotal = (input.items || []).reduce((acc, item) => {
    return (
      acc +
      calculateLineItemTotal(
        item.quantity,
        item.unit_price,
        item.discount ?? 0
      )
    );
  }, 0);

  const discount = Math.min(
    subtotal,
    Math.max(0, Math.round(Number(input.overallDiscount) || 0))
  );
  const additionalCost = Math.max(
    0,
    Math.round(Number(input.additionalCost) || 0)
  );

  const effectiveTaxRate = input.taxEnabled
    ? Math.max(0, Number(input.taxRate) || 0)
    : 0;

  const taxableBase = Math.max(0, subtotal - discount);
  const taxAmount =
    effectiveTaxRate > 0
      ? Math.round((taxableBase * effectiveTaxRate) / 100)
      : 0;

  const grandTotal = Math.max(
    0,
    Math.round(subtotal - discount + additionalCost + taxAmount)
  );

  const amountPaid = Math.max(0, Math.round(Number(input.amountPaid) || 0));
  const balance = Math.max(0, grandTotal - amountPaid);

  return {
    subtotal,
    discount,
    additional_cost: additionalCost,
    tax_rate: effectiveTaxRate,
    tax_amount: taxAmount,
    grand_total: grandTotal,
    amount_paid: amountPaid,
    balance,
  };
}

/**
 * Resolve Invoice Status automatically based on payments and due date (PRD Section 7.D & 9)
 */
export function resolveInvoiceStatus(params: {
  currentStatus: InvoiceStatus;
  grandTotal: number;
  amountPaid: number;
  dueDate: string;
  todayDate?: string;
}): InvoiceStatus {
  const { currentStatus, grandTotal, amountPaid, dueDate } = params;
  const today = params.todayDate || getJakartaDateString();

  if (currentStatus === 'Cancelled') {
    return 'Cancelled';
  }

  if (grandTotal > 0 && amountPaid >= grandTotal) {
    return 'Paid';
  }

  if (amountPaid > 0 && amountPaid < grandTotal) {
    return 'Partially Paid';
  }

  if (currentStatus === 'Draft') {
    return 'Draft';
  }

  if (dueDate && dueDate < today) {
    return 'Overdue';
  }

  if (currentStatus === 'Sent') {
    return 'Sent';
  }

  return 'Unpaid';
}

/**
 * Generate sequential document number without duplicates (PRD Section 7.C & 10)
 * Example: INV/ASM/2026/0001 or KW/ASM/2026/0001
 */
export function generateNextDocumentNumber(
  existingNumbers: string[],
  prefix: string = 'INV/ASM',
  year: string = '2026'
): string {
  const cleanPrefix = prefix.replace(/\/+$/, '').trim() || 'INV/ASM';
  const cleanYear = year.trim() || new Date().getFullYear().toString();
  const basePattern = `${cleanPrefix}/${cleanYear}/`;

  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (!num) continue;
    if (num.startsWith(basePattern)) {
      const tail = num.slice(basePattern.length);
      const parsed = parseInt(tail, 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    } else {
      const parts = num.split('/');
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${basePattern}${nextSeq}`;
}

/**
 * Sanitize user input to prevent Spreadsheet Formula Injection (PRD Section 18)
 */
export function sanitizeSpreadsheetInput(value: string): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Normalize phone number to international Indonesian WhatsApp format (628...)
 */
export function normalizeWhatsAppNumber(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

/**
 * Build WhatsApp message templates following PRD Section 12
 */
export function buildWhatsAppMessage(params: {
  type: 'invoice' | 'payment_info' | 'reminder' | 'receipt';
  clientName: string;
  invoiceNumber: string;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  receiptNumber?: string;
  lastPaymentAmount?: number;
  paymentDate?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  companyName?: string;
}): string {
  const company = params.companyName || 'Autosmart Digital Solutions';
  const client = params.clientName || 'Pelanggan';

  if (params.type === 'receipt') {
    return [
      "Assalamu'alaikum warahmatullahi wabarakatuh.",
      '',
      `Yth. Bapak/Ibu ${client},`,
      '',
      `Terima kasih. Berikut kami sampaikan Bukti Pembayaran dari ${company}.`,
      '',
      `Nomor Bukti: ${params.receiptNumber || '-'}`,
      `Nomor Invoice: ${params.invoiceNumber}`,
      `Tanggal Pembayaran: ${formatDateId(params.paymentDate)}`,
      `Nominal Pembayaran: ${formatRupiah(params.lastPaymentAmount || 0)}`,
      `Total Tagihan: ${formatRupiah(params.grandTotal)}`,
      `Total Sudah Dibayar: ${formatRupiah(params.amountPaid)}`,
      `Sisa Tagihan: ${formatRupiah(params.balance)}`,
      `Status: ${params.balance <= 0 ? 'LUNAS' : 'DIBAYAR SEBAGIAN'}`,
      '',
      `Terima kasih atas kepercayaan Anda terhadap layanan ${company}.`,
      '',
      "Wassalamu'alaikum warahmatullahi wabarakatuh.",
    ].join('\n');
  }

  if (params.type === 'reminder') {
    return [
      "Assalamu'alaikum warahmatullahi wabarakatuh.",
      '',
      `Yth. Bapak/Ibu ${client},`,
      '',
      `Semoga Bapak/Ibu selalu dalam keadaan sehat dan sukses. Melalui pesan ini kami ingin mengingatkan kembali terkait tagihan layanan dari ${company}:`,
      '',
      `Nomor Invoice: ${params.invoiceNumber}`,
      `Total Tagihan: ${formatRupiah(params.grandTotal)}`,
      `Sudah Dibayar: ${formatRupiah(params.amountPaid)}`,
      `Sisa Tagihan: ${formatRupiah(params.balance)}`,
      `Jatuh Tempo: ${formatDateId(params.dueDate)}`,
      ...(params.bankName && params.bankAccountNumber
        ? [
            '',
            'Informasi Rekening Pembayaran:',
            `Bank: ${params.bankName}`,
            `No. Rekening: ${params.bankAccountNumber}`,
            `A.n: ${params.bankAccountName || company}`,
          ]
        : []),
      '',
      `Apabila pembayaran telah dilakukan, mohon abaikan pesan ini atau kirimkan bukti konfirmasi pembayaran. Terima kasih atas kerja sama dan kepercayaan Anda kepada ${company}.`,
      '',
      "Wassalamu'alaikum warahmatullahi wabarakatuh.",
    ].join('\n');
  }

  if (params.type === 'payment_info') {
    return [
      "Assalamu'alaikum warahmatullahi wabarakatuh.",
      '',
      `Yth. Bapak/Ibu ${client},`,
      '',
      `Berikut kami sampaikan informasi rekening resmi untuk pembayaran invoice ${params.invoiceNumber} dari ${company}:`,
      '',
      `Sisa Tagihan: ${formatRupiah(params.balance)}`,
      `Jatuh Tempo: ${formatDateId(params.dueDate)}`,
      '',
      `Bank: ${params.bankName || '(Belum diatur di Pengaturan Perusahaan)'}`,
      `Nomor Rekening: ${params.bankAccountNumber || '-'}`,
      `Atas Nama: ${params.bankAccountName || '-'}`,
      '',
      `Terima kasih atas kepercayaan Bapak/Ibu terhadap layanan ${company}.`,
      '',
      "Wassalamu'alaikum warahmatullahi wabarakatuh.",
    ].join('\n');
  }

  // Default: PRD Section 12 exact template for sending Invoice
  return [
    "Assalamu'alaikum warahmatullahi wabarakatuh.",
    '',
    `Yth. Bapak/Mas ${client},`,
    '',
    `Berikut kami sampaikan invoice dari ${company}.`,
    '',
    `Nomor Invoice: ${params.invoiceNumber}`,
    `Total Tagihan: ${formatRupiah(params.grandTotal)}`,
    `Sudah Dibayar: ${formatRupiah(params.amountPaid)}`,
    `Sisa Tagihan: ${formatRupiah(params.balance)}`,
    `Jatuh Tempo: ${formatDateId(params.dueDate)}`,
    '',
    `Terima kasih atas kepercayaan Bapak terhadap layanan ${company}.`,
    '',
    "Wassalamu'alaikum warahmatullahi wabarakatuh.",
  ].join('\n');
}

export interface DashboardMetrics {
  totalInvoices: number;
  totalInvoiceValue: number;
  totalPaidReceived: number;
  totalReceivables: number;
  paidInvoicesCount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
}

/**
 * Compute real Dashboard KPI metrics from actual invoices & payments (PRD Section 4)
 */
export function computeDashboardMetrics(
  invoices: Invoice[],
  payments: Payment[],
  todayDate?: string
): DashboardMetrics {
  const today = todayDate || getJakartaDateString();
  const activeInvoices = invoices.filter((inv) => inv.status !== 'Cancelled');

  let totalInvoiceValue = 0;
  let totalReceivables = 0;
  let paidInvoicesCount = 0;
  let unpaidInvoicesCount = 0;
  let overdueInvoicesCount = 0;

  for (const inv of activeInvoices) {
    const effectiveStatus = resolveInvoiceStatus({
      currentStatus: inv.status,
      grandTotal: inv.grand_total,
      amountPaid: inv.amount_paid,
      dueDate: inv.due_date,
      todayDate: today,
    });

    totalInvoiceValue += inv.grand_total;
    totalReceivables += inv.balance;

    if (effectiveStatus === 'Paid') {
      paidInvoicesCount += 1;
    } else {
      unpaidInvoicesCount += 1;
      if (effectiveStatus === 'Overdue') {
        overdueInvoicesCount += 1;
      }
    }
  }

  const totalPaidReceived = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );

  return {
    totalInvoices: activeInvoices.length,
    totalInvoiceValue,
    totalPaidReceived,
    totalReceivables,
    paidInvoicesCount,
    unpaidInvoicesCount,
    overdueInvoicesCount,
  };
}

export const DEFAULT_SERVICE_CATEGORIES: string[] = [
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

/**
 * Parse stored JSON category list or fall back to DEFAULT_SERVICE_CATEGORIES.
 * If rawJson is not yet initialized, merges any custom categories present on services.
 */
export function parseServiceCategories(
  rawJson: string | undefined | null,
  services?: Array<{ category?: string }>
): string[] {
  if (rawJson && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const cleaned: string[] = [];
        for (const item of parsed) {
          const str = sanitizeSpreadsheetInput(String(item ?? ''));
          if (str && !seen.has(str.toLowerCase())) {
            seen.add(str.toLowerCase());
            cleaned.push(str);
          }
        }
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    } catch {
      // Fallback to default below
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of DEFAULT_SERVICE_CATEGORIES) {
    seen.add(cat.toLowerCase());
    result.push(cat);
  }
  if (Array.isArray(services)) {
    for (const srv of services) {
      const cat = sanitizeSpreadsheetInput(String(srv?.category ?? ''));
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        result.push(cat);
      }
    }
  }
  return result;
}

/**
 * Add a new service category with validation and duplicate prevention.
 */
export function addServiceCategory(
  categories: string[],
  newCategory: string
): { categories: string[]; added: string } {
  const cleanName = sanitizeSpreadsheetInput(newCategory);
  if (!cleanName) {
    throw new Error('Nama kategori layanan wajib diisi.');
  }
  const exists = categories.some(
    (c) => c.toLowerCase() === cleanName.toLowerCase()
  );
  if (exists) {
    throw new Error(`Kategori "${cleanName}" sudah ada dalam daftar.`);
  }
  return {
    categories: [...categories, cleanName],
    added: cleanName,
  };
}

/**
 * Rename an existing service category and update all services referencing the old category name.
 */
export function renameServiceCategory<T extends { category: string }>(
  categories: string[],
  services: T[],
  oldName: string,
  newName: string
): { categories: string[]; services: T[]; updatedCount: number } {
  const cleanOld = String(oldName ?? '').trim();
  const cleanNew = sanitizeSpreadsheetInput(newName);
  if (!cleanOld) {
    throw new Error('Kategori asal tidak valid.');
  }
  if (!cleanNew) {
    throw new Error('Nama kategori baru wajib diisi.');
  }

  const targetIdx = categories.findIndex((c) => c === cleanOld);
  if (targetIdx === -1) {
    throw new Error(`Kategori "${cleanOld}" tidak ditemukan.`);
  }

  const duplicateIdx = categories.findIndex(
    (c, idx) => idx !== targetIdx && c.toLowerCase() === cleanNew.toLowerCase()
  );
  if (duplicateIdx !== -1) {
    throw new Error(`Kategori "${cleanNew}" sudah digunakan.`);
  }

  const nextCategories = [...categories];
  nextCategories[targetIdx] = cleanNew;

  let updatedCount = 0;
  const nextServices = services.map((srv) => {
    if (srv.category === cleanOld) {
      updatedCount += 1;
      return { ...srv, category: cleanNew };
    }
    return srv;
  });

  return {
    categories: nextCategories,
    services: nextServices,
    updatedCount,
  };
}

/**
 * Delete a service category and reassign any services under it to a fallback category.
 */
export function deleteServiceCategory<T extends { category: string }>(
  categories: string[],
  services: T[],
  targetName: string,
  fallbackCategory?: string
): {
  categories: string[];
  services: T[];
  reassignedCount: number;
  fallbackUsed: string;
} {
  const cleanTarget = String(targetName ?? '').trim();
  if (!cleanTarget) {
    throw new Error('Kategori yang akan dihapus tidak valid.');
  }
  if (!categories.includes(cleanTarget)) {
    throw new Error(`Kategori "${cleanTarget}" tidak ditemukan.`);
  }
  if (categories.length <= 1) {
    throw new Error(
      'Minimal harus terdapat 1 kategori layanan aktif di dalam sistem.'
    );
  }

  const nextCategories = categories.filter((c) => c !== cleanTarget);
  const cleanFallback = fallbackCategory ? fallbackCategory.trim() : '';
  const fallbackUsed =
    cleanFallback && nextCategories.includes(cleanFallback)
      ? cleanFallback
      : nextCategories.includes('Layanan Digital Lainnya')
        ? 'Layanan Digital Lainnya'
        : nextCategories[0];

  let reassignedCount = 0;
  const nextServices = services.map((srv) => {
    if (srv.category === cleanTarget) {
      reassignedCount += 1;
      return { ...srv, category: fallbackUsed };
    }
    return srv;
  });

  return {
    categories: nextCategories,
    services: nextServices,
    reassignedCount,
    fallbackUsed,
  };
}

