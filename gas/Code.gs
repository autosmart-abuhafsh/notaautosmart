/**
 * ============================================================================
 * AUTOSMART INVOICE & BILLING MANAGEMENT SYSTEM
 * File 2 dari 2 : Code.gs (Server API Web App & Penyimpanan Nota/Invoice)
 * Pengembang    : Autosmart Digital Solutions
 * Zona Waktu    : Asia/Jakarta (WIB)
 * ============================================================================
 */

var API_SECRET = '';

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
    var ss = getOrCreateSpreadsheet_();
    var body = {};

    if (method === 'POST' && e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return jsonResponse_({ ok: false, error: 'Format JSON tidak valid: ' + parseErr });
      }
    }

    var action = (e && e.parameter && e.parameter.action) || body.action || 'ping';
    var incomingSecret = (e && e.parameter && e.parameter.secret) || body.secret || '';

    var configuredSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET') || API_SECRET;
    if (configuredSecret && incomingSecret !== configuredSecret) {
      return jsonResponse_({
        ok: false,
        error: 'Akses ditolak: API Secret Key tidak sesuai.'
      });
    }

    if (action === 'ping') {
      setupAutosmartDatabase();
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
      var setupInfo = setupAutosmartDatabase();
      return jsonResponse_({
        ok: true,
        setup: setupInfo
      });
    }

    if (action === 'exportAll') {
      setupAutosmartDatabase();
      var dump = {};
      var names = Object.keys(SCHEMA_DEFINITION);
      for (var i = 0; i < names.length; i++) {
        dump[names[i]] = readSheetRows_(ss, names[i]);
      }
      return jsonResponse_({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        data: dump,
        exportedAt: new Date().toISOString()
      });
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

      return jsonResponse_({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        counts: getSheetRowCounts_(ss),
        syncedAt: new Date().toISOString()
      });
    }

    if (action === 'saveInvoice' && body.invoice) {
      setupAutosmartDatabase();
      upsertRowById_(ss, 'INVOICES', SCHEMA_DEFINITION.INVOICES, body.invoice);
      if (Array.isArray(body.items)) {
        replaceInvoiceItems_(ss, body.invoice.id, body.items);
      }
      return jsonResponse_({
        ok: true,
        invoice_number: body.invoice.invoice_number,
        savedAt: new Date().toISOString()
      });
    }

    if (action === 'savePayment' && body.payment) {
      setupAutosmartDatabase();
      upsertRowById_(ss, 'PAYMENTS', SCHEMA_DEFINITION.PAYMENTS, body.payment);
      if (body.invoice) {
        upsertRowById_(ss, 'INVOICES', SCHEMA_DEFINITION.INVOICES, body.invoice);
      }
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
  if (/^[=+\\-@]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

function getSheetRowCounts_(ss) {
  var counts = {};
  var names = Object.keys(SCHEMA_DEFINITION);
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
  writeSheetRows_(ss, 'INVOICE_ITEMS', SCHEMA_DEFINITION.INVOICE_ITEMS, filtered);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
