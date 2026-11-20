/**
 * ============================================================================
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File 1 dari 2 : Setup.gs (Inisialisasi Struktur 8 Tabel Spreadsheet)
 * Pengembang    : Autosmart Digital Solutions
 * Tagline       : Skill Up For Digital Collaboration
 * Database      : AUTOSMART_INVOICE_DATABASE
 * ============================================================================
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

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  var nowIso = new Date().toISOString();

  var usersSheet = ss.getSheetByName('USERS');
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    var defaultUsers = [
      ['USR-0001', 'Administrator Autosmart', 'admin@autosmart.id', 'scrypt_hash_protected', 'Administrator', 'Aktif', nowIso],
      ['USR-0002', 'Staf Administrasi & Billing', 'staff@autosmart.id', 'scrypt_hash_protected', 'Staff', 'Aktif', nowIso]
    ];
    usersSheet.getRange(2, 1, defaultUsers.length, 7).setValues(defaultUsers);
  }

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

  var logsSheet = ss.getSheetByName('ACTIVITY_LOGS');
  if (logsSheet && logsSheet.getLastRow() <= 1) {
    logsSheet.getRange(2, 1, 1, 5).setValues([
      ['LOG-0001', 'USR-0001', 'SETUP_DATABASE', 'Inisialisasi 8 Sheet Database Autosmart Invoice berhasil dijalankan', nowIso]
    ]);
  }

  SpreadsheetApp.flush();

  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheets: sheetNames
  };
}

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
