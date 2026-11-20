/**
 * ============================================================================
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File 2 dari 2 : Code.gs (Server API Web App & Penyimpanan Otomatis 8 Sheet)
 * Pengembang    : Autosmart Digital Solutions
 * Zona Waktu    : Asia/Jakarta (WIB)
 * ============================================================================
 */

var API_SECRET = '';

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

    var configuredSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || API_SECRET;
    if (configuredSecret && incomingSecret !== configuredSecret) {
      return jsonResponse_({
        ok: false,
        error: 'Akses ditolak: API Secret Key tidak sesuai.'
      });
    }

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

    if (action === 'setup') {
      var setupInfo = ensureDatabaseReady_();
      return jsonResponse_({
        ok: true,
        setup: setupInfo
      });
    }

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
