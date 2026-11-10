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

  var settingsSheet = ss.getSheetByName('COMPANY_SETTINGS');
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    var nowIso = new Date().toISOString();
    var defaultSettings = [
      ['SET-01', 'company_name', 'Autosmart Digital Solutions', nowIso],
      ['SET-02', 'tagline', 'Skill Up For Digital Collaboration', nowIso],
      ['SET-03', 'business_field', 'Digital Learning & Business Solution', nowIso],
      ['SET-04', 'invoice_prefix', 'INV/ASM', nowIso],
      ['SET-05', 'receipt_prefix', 'KW/ASM', nowIso],
      ['SET-06', 'document_year', '2026', nowIso],
      ['SET-07', 'currency', 'IDR', nowIso],
      ['SET-08', 'tax_enabled', 'false', nowIso],
      ['SET-09', 'tax_rate', '11', nowIso]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }

  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheets: sheetNames
  };
}

function getOrCreateSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('SPREADSHEET_ID');

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {}
  }

  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty('SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (e) {}

  var created = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}
