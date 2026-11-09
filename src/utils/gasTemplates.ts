export const SETUP_GS_CODE = `/**
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File: Setup.gs
 * Pengembang: Autosmart Digital Solutions
 * Nama Spreadsheet: AUTOSMART_INVOICE_DATABASE
 */

var SPREADSHEET_NAME = 'AUTOSMART_INVOICE_DATABASE';

var SCHEMA_DEFINITION = {
  USERS: ['id', 'name', 'email', 'password_hash', 'role', 'status', 'created_at'],
  CLIENTS: ['id', 'client_name', 'contact_person', 'phone', 'whatsapp', 'email', 'address', 'notes', 'created_at'],
  SERVICES: ['id', 'service_name', 'category', 'description', 'unit', 'price', 'status', 'created_at'],
  INVOICES: ['id', 'invoice_number', 'client_id', 'issue_date', 'due_date', 'subtotal', 'discount', 'additional_cost', 'tax_rate', 'tax_amount', 'grand_total', 'amount_paid', 'balance', 'status', 'notes', 'created_at', 'updated_at'],
  INVOICE_ITEMS: ['id', 'invoice_id', 'service_id', 'description', 'quantity', 'unit', 'unit_price', 'discount', 'total'],
  PAYMENTS: ['id', 'receipt_number', 'invoice_id', 'payment_date', 'amount', 'payment_method', 'reference_number', 'notes', 'created_at'],
  COMPANY_SETTINGS: ['id', 'setting_key', 'setting_value', 'updated_at'],
  ACTIVITY_LOGS: ['id', 'user_id', 'activity', 'description', 'timestamp']
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
    if (currentHeaders.length === 0 || currentHeaders[0] !== headers[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#101B35');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sheets: sheetNames
  };
}

function getOrCreateSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (e) {}
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

function sanitizeCell_(val) {
  if (typeof val !== 'string') return val;
  var trimmed = val.trim();
  if (/^[=+\\-@]/.test(trimmed)) return "'" + trimmed;
  return trimmed;
}

function doGet(e) { return handleRequest_(e, 'GET'); }
function doPost(e) { return handleRequest_(e, 'POST'); }

function handleRequest_(e, method) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var ss = getOrCreateSpreadsheet_();
    var body = (method === 'POST' && e && e.postData && e.postData.contents)
      ? JSON.parse(e.postData.contents) : {};
    var action = (e && e.parameter && e.parameter.action) || body.action || 'ping';

    if (action === 'ping') {
      return jsonResponse_({ ok: true, spreadsheetName: ss.getName(), spreadsheetId: ss.getId() });
    }
    if (action === 'setup') {
      return jsonResponse_({ ok: true, setup: setupAutosmartDatabase() });
    }
    if (action === 'exportAll') {
      setupAutosmartDatabase();
      var dump = {};
      var names = Object.keys(SCHEMA_DEFINITION);
      for (var i = 0; i < names.length; i++) dump[names[i]] = readSheetRows_(ss, names[i]);
      return jsonResponse_({ ok: true, data: dump });
    }
    if (action === 'syncAll' && body.payload) {
      setupAutosmartDatabase();
      var payload = body.payload;
      var sheetNames = Object.keys(SCHEMA_DEFINITION);
      for (var j = 0; j < sheetNames.length; j++) {
        var sName = sheetNames[j];
        if (Array.isArray(payload[sName])) {
          writeSheetRows_(ss, sName, SCHEMA_DEFINITION[sName], payload[sName]);
        }
      }
      return jsonResponse_({ ok: true, syncedAt: new Date().toISOString() });
    }
    return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function readSheetRows_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[r][c];
    rows.push(obj);
  }
  return rows;
}

function writeSheetRows_(ss, sheetName, headers, records) {
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clearContents();
  var matrix = [headers];
  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var val = rec[headers[c]];
      row.push(val === undefined || val === null ? '' : sanitizeCell_(val));
    }
    matrix.push(row);
  }
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
