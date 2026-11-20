/**
 * Template Kode Google Apps Script Resmi untuk AUTOSMART INVOICE
 * Terdiri dari 2 file terpisah agar rapi dan mudah dipasang (copas):
 * 1. Setup.gs — Inisialisasi struktur 8 Sheet Database (AUTOSMART_INVOICE_DATABASE)
 * 2. Code.gs  — Server Web App API (doGet & doPost) untuk penyimpanan Nota, Invoice, Kwitansi, Klien & Activity Logs
 */

export const SETUP_GS_CODE = `/**
 * ============================================================================
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File 1 dari 2 : Setup.gs (Inisialisasi Struktur 8 Tabel Spreadsheet)
 * Pengembang    : Autosmart Digital Solutions
 * Tagline       : Skill Up For Digital Collaboration
 * Database      : AUTOSMART_INVOICE_DATABASE
 * ============================================================================
 *
 * CARA PAKAI FILE INI:
 * 1. Buat file bernama "Setup.gs" di editor Google Apps Script Anda.
 * 2. Salin (Copas) seluruh kode ini ke dalam "Setup.gs", lalu tekan Ctrl+S (Simpan).
 * 3. Pilih fungsi "setupAutosmartDatabase" di bagian atas editor, lalu klik "Jalankan (Run)".
 * 4. Berikan izin akses (Review Permissions -> Pilih Akun Google -> Advanced -> Go to project).
 * 5. Otomatis 8 Sheet tabel database akan dibuat lengkap dengan warna header Navy (#101B35).
 */

var SPREADSHEET_NAME = 'AUTOSMART_INVOICE_DATABASE';

var SCHEMA_DEFINITION = {
  USERS: [
    'id',
    'name',
    'email',
    'password_hash',
    'role',
    'status',
    'created_at'
  ],
  CLIENTS: [
    'id',
    'client_name',
    'contact_person',
    'phone',
    'whatsapp',
    'email',
    'address',
    'notes',
    'created_at'
  ],
  SERVICES: [
    'id',
    'service_name',
    'category',
    'description',
    'unit',
    'price',
    'status',
    'created_at'
  ],
  INVOICES: [
    'id',
    'invoice_number',
    'client_id',
    'issue_date',
    'due_date',
    'subtotal',
    'discount',
    'additional_cost',
    'tax_rate',
    'tax_amount',
    'grand_total',
    'amount_paid',
    'balance',
    'status',
    'notes',
    'created_at',
    'updated_at'
  ],
  INVOICE_ITEMS: [
    'id',
    'invoice_id',
    'service_id',
    'description',
    'quantity',
    'unit',
    'unit_price',
    'discount',
    'total'
  ],
  PAYMENTS: [
    'id',
    'receipt_number',
    'invoice_id',
    'payment_date',
    'amount',
    'payment_method',
    'reference_number',
    'notes',
    'created_at'
  ],
  COMPANY_SETTINGS: [
    'id',
    'setting_key',
    'setting_value',
    'updated_at'
  ],
  ACTIVITY_LOGS: [
    'id',
    'user_id',
    'activity',
    'description',
    'timestamp'
  ]
};

/**
 * Fungsi Utama: Jalankan fungsi ini 1x dari tombol "Run / Jalankan" di Apps Script
 * untuk membuat 8 sheet database secara otomatis.
 */
function setupAutosmartDatabase() {
  var ss = getOrCreateSpreadsheet_();
  var sheetNames = Object.keys(SCHEMA_DEFINITION);

  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var headers = SCHEMA_DEFINITION[name];
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    var currentHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

    if (currentHeaders.length === 0 || String(currentHeaders[0]) !== headers[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#101B35');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('left');
      sheet.setFrozenRows(1);
    }
  }

  // Hapus "Sheet1" bawaan jika masih kosong dan tidak dipakai
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  var nowIso = new Date().toISOString();

  // Isi akun default USERS jika masih kosong
  var usersSheet = ss.getSheetByName('USERS');
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    var defaultUsers = [
      ['USR-0001', 'Administrator Autosmart', 'admin@autosmart.id', 'scrypt_hash_protected', 'Administrator', 'Aktif', nowIso],
      ['USR-0002', 'Staf Administrasi & Billing', 'staff@autosmart.id', 'scrypt_hash_protected', 'Staff', 'Aktif', nowIso]
    ];
    usersSheet.getRange(2, 1, defaultUsers.length, 7).setValues(defaultUsers);
  }

  // Isi pengaturan awal COMPANY_SETTINGS jika masih kosong
  var settingsSheet = ss.getSheetByName('COMPANY_SETTINGS');
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    var defaultSettings = [
      ['SET-001', 'company_name', 'Autosmart Digital Solutions', nowIso],
      ['SET-002', 'tagline', 'Skill Up For Digital Collaboration', nowIso],
      ['SET-003', 'business_field', 'Digital Learning & Business Solution', nowIso],
      ['SET-004', 'address', 'Jl. Brigjen Slamet Riadi VIII/56 Kec. Klojen Kel. Oro-Oro Dowo Kota Malang, Jawa Timur 65112, Indonesia.', nowIso],
      ['SET-005', 'whatsapp', '085726686267', nowIso],
      ['SET-006', 'email', 'autosmart2025@gmail.com', nowIso],
      ['SET-007', 'website', 'https://autosmart-abuhafsh.github.io/Autosmart/', nowIso],
      ['SET-008', 'logo_url', '/assets/autosmart-logo.png', nowIso],
      ['SET-009', 'bank_name', 'BCA', nowIso],
      ['SET-010', 'bank_account_name', 'Muhammad', nowIso],
      ['SET-011', 'bank_account_number', '0113593935', nowIso],
      ['SET-012', 'invoice_prefix', 'INV/ASM', nowIso],
      ['SET-013', 'receipt_prefix', 'KW/ASM', nowIso],
      ['SET-014', 'document_year', '2026', nowIso],
      ['SET-015', 'currency', 'IDR', nowIso],
      ['SET-016', 'tax_enabled', 'false', nowIso],
      ['SET-017', 'tax_rate', '11', nowIso]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }

  // Catat log inisialisasi awal di ACTIVITY_LOGS jika masih kosong
  var logsSheet = ss.getSheetByName('ACTIVITY_LOGS');
  if (logsSheet && logsSheet.getLastRow() <= 1) {
    logsSheet.getRange(2, 1, 1, 5).setValues([
      ['LOG-0001', 'USR-0001', 'SETUP_DATABASE', 'Inisialisasi 8 Sheet Database Autosmart Invoice berhasil dijalankan', nowIso]
    ]);
  }

  SpreadsheetApp.flush();

  var result = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheets: sheetNames
  };

  Logger.log('Database Autosmart Berhasil Dibuat: ' + JSON.stringify(result));
  return result;
}

/**
 * Mengambil Spreadsheet aktif (jika script dibuat dari dalam Google Sheets)
 * atau membuat file Spreadsheet baru bernama AUTOSMART_INVOICE_DATABASE.
 */
function getOrCreateSpreadsheet_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('SPREADSHEET_ID');

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {}
  }

  var created = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}
`;

export const CODE_GS_CODE = `/**
 * ============================================================================
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File 2 dari 2 : Code.gs (Server API Web App & Penyimpanan Otomatis 8 Sheet)
 * Pengembang    : Autosmart Digital Solutions
 * Zona Waktu    : Asia/Jakarta (WIB)
 * ============================================================================
 *
 * CARA PAKAI FILE INI:
 * 1. Buka file "Code.gs" di editor Google Apps Script yang sama dengan "Setup.gs".
 * 2. Hapus kode kosong bawaan (function myFunction), lalu Copas seluruh kode ini.
 * 3. Tekan Ctrl+S untuk menyimpan.
 * 4. Klik tombol biru "Deploy" (Terapkan) -> "New deployment" (Deployment baru).
 * 5. Pilih jenis "Web app":
 *    - Description : Server Database Autosmart Invoice
 *    - Execute as  : Me (Email Anda sendiri)
 *    - Who has access: Anyone (Siapa saja)  <-- WAJIB PILIH "Anyone / Siapa saja"
 * 6. Klik "Deploy", lalu salin "Web app URL" (berakhiran .../exec) ke menu
 *    "Koneksi Google Sheets" di aplikasi Autosmart Invoice.
 */

var API_SECRET = '';

// Fallback skema otomatis apabila Setup.gs belum dijalankan terpisah
var DEFAULT_SCHEMA_ = {
  USERS: ['id', 'name', 'email', 'password_hash', 'role', 'status', 'created_at'],
  CLIENTS: ['id', 'client_name', 'contact_person', 'phone', 'whatsapp', 'email', 'address', 'notes', 'created_at'],
  SERVICES: ['id', 'service_name', 'category', 'description', 'unit', 'price', 'status', 'created_at'],
  INVOICES: ['id', 'invoice_number', 'client_id', 'issue_date', 'due_date', 'subtotal', 'discount', 'additional_cost', 'tax_rate', 'tax_amount', 'grand_total', 'amount_paid', 'balance', 'status', 'notes', 'created_at', 'updated_at'],
  INVOICE_ITEMS: ['id', 'invoice_id', 'service_id', 'description', 'quantity', 'unit', 'unit_price', 'discount', 'total'],
  PAYMENTS: ['id', 'receipt_number', 'invoice_id', 'payment_date', 'amount', 'payment_method', 'reference_number', 'notes', 'created_at'],
  COMPANY_SETTINGS: ['id', 'setting_key', 'setting_value', 'updated_at'],
  ACTIVITY_LOGS: ['id', 'user_id', 'activity', 'description', 'timestamp']
};

function getSchema_() {
  return (typeof SCHEMA_DEFINITION !== 'undefined' && SCHEMA_DEFINITION)
    ? SCHEMA_DEFINITION
    : DEFAULT_SCHEMA_;
}

function ensureDatabaseReady_() {
  if (typeof setupAutosmartDatabase === 'function') {
    return setupAutosmartDatabase();
  }
  var ss = resolveSpreadsheet_();
  var schema = getSchema_();
  var names = Object.keys(schema);
  for (var i = 0; i < names.length; i++) {
    var sName = names[i];
    var headers = schema[sName];
    var sheet = ss.getSheetByName(sName) || ss.insertSheet(sName);
    if (sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setBackground('#101B35').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  SpreadsheetApp.flush();
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheets: names
  };
}

function resolveSpreadsheet_() {
  if (typeof getOrCreateSpreadsheet_ === 'function') {
    return getOrCreateSpreadsheet_();
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (e) {}
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {}
  }
  var created = SpreadsheetApp.create('AUTOSMART_INVOICE_DATABASE');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    var ss = resolveSpreadsheet_();
    var schema = getSchema_();
    var body = {};

    if (method === 'POST' && e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return jsonResponse_({ ok: false, error: 'Format JSON tidak valid: ' + parseErr });
      }
    }

    var action = (e && e.parameter && e.parameter.action) || body.action || 'ping';
    var incomingSecret =
      (e && e.parameter && e.parameter.secret) ||
      body.secret ||
      body.apiSecret ||
      '';

    // Validasi Secret Key jika API_SECRET diatur
    var configuredSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || API_SECRET;
    if (configuredSecret && incomingSecret !== configuredSecret) {
      return jsonResponse_({
        ok: false,
        error: 'Akses ditolak: API Secret Key tidak sesuai.'
      });
    }

    // 1. PING / TEST KONEKSI & RINGKASAN JUMLAH DATA
    if (action === 'ping') {
      ensureDatabaseReady_();
      return jsonResponse_({
        ok: true,
        message: 'Terhubung ke Server Google Apps Script Autosmart Invoice',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        counts: getSheetRowCounts_(ss),
        serverTime: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
      });
    }

    // 2. INISIALISASI DATABASE (SETUP 8 SHEET)
    if (action === 'setup') {
      var setupInfo = ensureDatabaseReady_();
      return jsonResponse_({
        ok: true,
        setup: setupInfo
      });
    }

    // 3. TARIK SELURUH DATA DARI GOOGLE SHEETS KE APLIKASI (PULL / EXPORT ALL)
    if (action === 'exportAll') {
      ensureDatabaseReady_();
      var dump = {};
      var names = Object.keys(schema);
      for (var i = 0; i < names.length; i++) {
        dump[names[i]] = readSheetRows_(ss, names[i]);
      }
      return jsonResponse_({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        counts: getSheetRowCounts_(ss),
        data: dump,
        exportedAt: new Date().toISOString()
      });
    }

    // 4. SIMPAN / SINKRONISASI SELURUH DATA KE GOOGLE SHEETS (PUSH / SYNC ALL)
    if (action === 'syncAll' && body.payload) {
      ensureDatabaseReady_();
      var payload = body.payload;
      var sheetNames = Object.keys(schema);

      for (var j = 0; j < sheetNames.length; j++) {
        var sName = sheetNames[j];
        if (Array.isArray(payload[sName])) {
          writeSheetRows_(ss, sName, schema[sName], payload[sName]);
        }
      }

      if (body.activityLog && body.activityLog.id) {
        upsertRowById_(ss, 'ACTIVITY_LOGS', schema.ACTIVITY_LOGS, body.activityLog);
      }

      SpreadsheetApp.flush();

      return jsonResponse_({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        counts: getSheetRowCounts_(ss),
        syncedAt: new Date().toISOString()
      });
    }

    // 5. SIMPAN / UPDATE 1 BARIS PADA SHEET TERTENTU + LOG AKTIVITAS
    if (action === 'upsertRow' && body.sheetName && body.record) {
      ensureDatabaseReady_();
      var targetSheet = String(body.sheetName);
      if (!schema[targetSheet]) {
        return jsonResponse_({ ok: false, error: 'Sheet tidak dikenali: ' + targetSheet });
      }
      upsertRowById_(ss, targetSheet, schema[targetSheet], body.record);
      if (body.activityLog && body.activityLog.id) {
        upsertRowById_(ss, 'ACTIVITY_LOGS', schema.ACTIVITY_LOGS, body.activityLog);
      }
      SpreadsheetApp.flush();
      return jsonResponse_({
        ok: true,
        sheetName: targetSheet,
        counts: getSheetRowCounts_(ss),
        savedAt: new Date().toISOString()
      });
    }

    // 6. SIMPAN SATU NOTA / INVOICE BARU ATAU UPDATE LANGSUNG
    if (action === 'saveInvoice' && body.invoice) {
      ensureDatabaseReady_();
      upsertRowById_(ss, 'INVOICES', schema.INVOICES, body.invoice);
      if (Array.isArray(body.items)) {
        replaceInvoiceItems_(ss, body.invoice.id, body.items);
      }
      if (body.activityLog && body.activityLog.id) {
        upsertRowById_(ss, 'ACTIVITY_LOGS', schema.ACTIVITY_LOGS, body.activityLog);
      }
      SpreadsheetApp.flush();
      return jsonResponse_({
        ok: true,
        invoice_number: body.invoice.invoice_number,
        savedAt: new Date().toISOString()
      });
    }

    // 7. SIMPAN BUKTI PEMBAYARAN / KWITANSI LANGSUNG
    if (action === 'savePayment' && body.payment) {
      ensureDatabaseReady_();
      upsertRowById_(ss, 'PAYMENTS', schema.PAYMENTS, body.payment);
      if (body.invoice) {
        upsertRowById_(ss, 'INVOICES', schema.INVOICES, body.invoice);
      }
      if (body.activityLog && body.activityLog.id) {
        upsertRowById_(ss, 'ACTIVITY_LOGS', schema.ACTIVITY_LOGS, body.activityLog);
      }
      SpreadsheetApp.flush();
      return jsonResponse_({
        ok: true,
        receipt_number: body.payment.receipt_number,
        savedAt: new Date().toISOString()
      });
    }

    return jsonResponse_({
      ok: false,
      error: 'Action tidak dikenali: ' + action
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: String(err)
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mencegah Formula Injection & menjaga batas karakter sel Google Sheets (maks 50.000)
 */
function sanitizeCell_(val) {
  if (typeof val !== 'string') return val;
  var trimmed = val.trim();
  if (trimmed.length > 49000) {
    trimmed = trimmed.slice(0, 49000);
  }
  if (/^[=+\\-@]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

/**
 * Menghitung jumlah baris transaksi di setiap sheet
 */
function getSheetRowCounts_(ss) {
  var counts = {};
  var schema = getSchema_();
  var names = Object.keys(schema);
  for (var i = 0; i < names.length; i++) {
    var s = ss.getSheetByName(names[i]);
    counts[names[i]] = s ? Math.max(0, s.getLastRow() - 1) : 0;
  }
  return counts;
}

/**
 * Membaca seluruh baris dari satu sheet menjadi Array of Objects
 */
function readSheetRows_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var hasValue = false;
    for (var c = 0; c < headers.length; c++) {
      var cellVal = values[r][c];
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasValue = true;
      }
      if (cellVal instanceof Date) {
        obj[headers[c]] = Utilities.formatDate(cellVal, 'Asia/Jakarta', 'yyyy-MM-dd');
      } else {
        obj[headers[c]] = cellVal;
      }
    }
    if (hasValue) {
      rows.push(obj);
    }
  }
  return rows;
}

/**
 * Menulis ulang seluruh baris pada satu sheet secara cepat (batch setValues)
 */
function writeSheetRows_(ss, sheetName, headers, records) {
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  var matrix = [headers];

  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var colName = headers[c];
      var val = rec[colName];
      if (colName === 'password_hash' && (val === undefined || val === null || val === '')) {
        val = 'scrypt_hash_protected';
      }
      row.push(val === undefined || val === null ? '' : sanitizeCell_(val));
    }
    matrix.push(row);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#101B35');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Tambah atau perbarui 1 baris berdasarkan kolom 'id'
 */
function upsertRowById_(ss, sheetName, headers, record) {
  var rows = readSheetRows_(ss, sheetName);
  var found = false;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(record.id)) {
      rows[i] = record;
      found = true;
      break;
    }
  }
  if (!found) {
    rows.unshift(record);
  }
  writeSheetRows_(ss, sheetName, headers, rows);
}

/**
 * Mengganti rincian item untuk satu invoice_id tertentu
 */
function replaceInvoiceItems_(ss, invoiceId, newItems) {
  var schema = getSchema_();
  var existing = readSheetRows_(ss, 'INVOICE_ITEMS');
  var filtered = [];
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i].invoice_id) !== String(invoiceId)) {
      filtered.push(existing[i]);
    }
  }
  for (var j = 0; j < newItems.length; j++) {
    filtered.push(newItems[j]);
  }
  writeSheetRows_(ss, 'INVOICE_ITEMS', schema.INVOICE_ITEMS, filtered);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
