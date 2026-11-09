import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLineItemTotal,
  calculateInvoiceTotals,
  resolveInvoiceStatus,
  generateNextDocumentNumber,
  sanitizeSpreadsheetInput,
  formatRupiah,
  computeDashboardMetrics,
} from './invoiceLogic';
import type { Invoice, Payment } from '../types/invoice';

test('calculateLineItemTotal computes quantity * unit_price - discount accurately', () => {
  assert.equal(calculateLineItemTotal(2, 3500000, 500000), 6500000);
  assert.equal(calculateLineItemTotal(1, 1500000, 0), 1500000);
  assert.equal(calculateLineItemTotal(1, 500000, 900000), 0); // never negative
});

test('calculateInvoiceTotals computes subtotal, discount, optional tax, grand total, and balance', () => {
  // Without tax
  const resNoTax = calculateInvoiceTotals({
    items: [
      { quantity: 1, unit_price: 5500000, discount: 500000 }, // 5.000.000
      { quantity: 2, unit_price: 1200000, discount: 0 }, // 2.400.000
    ],
    overallDiscount: 400000,
    additionalCost: 150000,
    taxEnabled: false,
    taxRate: 11,
    amountPaid: 3000000,
  });

  assert.equal(resNoTax.subtotal, 7400000);
  assert.equal(resNoTax.discount, 400000);
  assert.equal(resNoTax.tax_amount, 0);
  assert.equal(resNoTax.grand_total, 7150000);
  assert.equal(resNoTax.balance, 4150000);

  // With 11% tax enabled
  const resWithTax = calculateInvoiceTotals({
    items: [{ quantity: 1, unit_price: 10000000, discount: 0 }],
    overallDiscount: 1000000, // taxable base = 9.000.000
    additionalCost: 0,
    taxEnabled: true,
    taxRate: 11, // tax = 990.000
    amountPaid: 5000000,
  });

  assert.equal(resWithTax.subtotal, 10000000);
  assert.equal(resWithTax.tax_amount, 990000);
  assert.equal(resWithTax.grand_total, 9990000);
  assert.equal(resWithTax.balance, 4990000);
});

test('resolveInvoiceStatus handles Paid, Partially Paid, Overdue, Draft, and Unpaid', () => {
  assert.equal(
    resolveInvoiceStatus({
      currentStatus: 'Unpaid',
      grandTotal: 5000000,
      amountPaid: 5000000,
      dueDate: '2026-12-01',
      todayDate: '2026-11-08',
    }),
    'Paid'
  );

  assert.equal(
    resolveInvoiceStatus({
      currentStatus: 'Unpaid',
      grandTotal: 5000000,
      amountPaid: 2000000,
      dueDate: '2026-10-01',
      todayDate: '2026-11-08',
    }),
    'Partially Paid'
  );

  assert.equal(
    resolveInvoiceStatus({
      currentStatus: 'Unpaid',
      grandTotal: 5000000,
      amountPaid: 0,
      dueDate: '2026-10-15',
      todayDate: '2026-11-08',
    }),
    'Overdue'
  );

  assert.equal(
    resolveInvoiceStatus({
      currentStatus: 'Draft',
      grandTotal: 5000000,
      amountPaid: 0,
      dueDate: '2026-10-15',
      todayDate: '2026-11-08',
    }),
    'Draft'
  );
});

test('generateNextDocumentNumber increments sequentially without duplicates', () => {
  assert.equal(
    generateNextDocumentNumber([], 'INV/ASM', '2026'),
    'INV/ASM/2026/0001'
  );
  assert.equal(
    generateNextDocumentNumber(
      ['INV/ASM/2026/0001', 'INV/ASM/2026/0004', 'INV/ASM/2026/0002'],
      'INV/ASM',
      '2026'
    ),
    'INV/ASM/2026/0005'
  );
  assert.equal(
    generateNextDocumentNumber(['KW/ASM/2026/0009'], 'KW/ASM', '2026'),
    'KW/ASM/2026/0010'
  );
});

test('sanitizeSpreadsheetInput prevents formula injection', () => {
  assert.equal(sanitizeSpreadsheetInput('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeSpreadsheetInput('+cmd|...'), "'+cmd|...");
  assert.equal(sanitizeSpreadsheetInput('PT Maju Bersama'), 'PT Maju Bersama');
});

test('formatRupiah formats numbers cleanly without decimals', () => {
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(5500000), 'Rp 5.500.000');
  assert.equal(formatRupiah(12500000.4), 'Rp 12.500.000');
});

test('computeDashboardMetrics aggregates real invoice and payment metrics', () => {
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv-1',
      invoice_number: 'INV/ASM/2026/0001',
      client_id: 'CLT-0001',
      issue_date: '2026-11-01',
      due_date: '2026-11-15',
      subtotal: 5000000,
      discount: 0,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 5000000,
      amount_paid: 5000000,
      balance: 0,
      status: 'Paid',
      notes: '',
      created_at: '2026-11-01',
      updated_at: '2026-11-02',
    },
    {
      id: 'inv-2',
      invoice_number: 'INV/ASM/2026/0002',
      client_id: 'CLT-0002',
      issue_date: '2026-10-01',
      due_date: '2026-10-20',
      subtotal: 8000000,
      discount: 0,
      additional_cost: 0,
      tax_rate: 0,
      tax_amount: 0,
      grand_total: 8000000,
      amount_paid: 0,
      balance: 8000000,
      status: 'Overdue',
      notes: '',
      created_at: '2026-10-01',
      updated_at: '2026-10-01',
    },
  ];
  const samplePayments: Payment[] = [
    {
      id: 'pay-1',
      receipt_number: 'KW/ASM/2026/0001',
      invoice_id: 'inv-1',
      payment_date: '2026-11-02',
      amount: 5000000,
      payment_method: 'Transfer Bank',
      reference_number: 'TRX-001',
      notes: 'Lunas',
      created_at: '2026-11-02',
    },
  ];

  const metrics = computeDashboardMetrics(
    sampleInvoices,
    samplePayments,
    '2026-11-08'
  );
  assert.equal(metrics.totalInvoices, 2);
  assert.equal(metrics.totalInvoiceValue, 13000000);
  assert.equal(metrics.totalPaidReceived, 5000000);
  assert.equal(metrics.totalReceivables, 8000000);
  assert.equal(metrics.paidInvoicesCount, 1);
  assert.equal(metrics.unpaidInvoicesCount, 1);
  assert.equal(metrics.overdueInvoicesCount, 1);
});
