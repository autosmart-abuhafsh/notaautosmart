import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CompanySettingsMap,
  Invoice,
  Payment,
} from '../types/invoice';
import {
  formatDateId,
  formatRupiah,
  resolveInvoiceStatus,
} from './invoiceLogic';

/**
 * Utility for generating genuine binary PDF documents (.pdf) using jsPDF + jspdf-autotable
 * as well as clean iframe print triggers (A4 and Thermal 80mm) without window.open.
 * Works reliably across Desktop (PC), Mobile (Android/iOS), and sandboxed iframes.
 */

function sanitizeFileName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getIndonesianStatusLabel(status: string): string {
  switch (status) {
    case 'Paid':
      return 'LUNAS (PAID)';
    case 'Partially Paid':
      return 'DIBAYAR SEBAGIAN (DP)';
    case 'Overdue':
      return 'JATUH TEMPO (OVERDUE)';
    case 'Draft':
      return 'DRAFT';
    case 'Sent':
      return 'TERKIRIM (SENT)';
    case 'Cancelled':
      return 'DIBATALKAN';
    default:
      return 'BELUM DIBAYAR (UNPAID)';
  }
}

/**
 * Generates an official A4 Invoice PDF using jsPDF + autoTable.
 * - mode === 'download': immediately downloads `Invoice_<number>.pdf`
 * - mode === 'print': embeds autoPrint instruction, opens hidden PDF/HTML print frame,
 *   and also downloads the PDF if the browser blocks iframe print dialogs.
 */
export function generateInvoicePdf(
  invoice: Invoice,
  settings: CompanySettingsMap,
  mode: 'download' | 'print' = 'download'
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const companyName =
    settings.company_name || 'Autosmart Digital Solutions';
  const tagline =
    settings.tagline || 'Skill Up For Digital Collaboration';
  const businessField =
    settings.business_field || 'Digital Learning & Business Solution';

  const effectiveStatus = resolveInvoiceStatus({
    currentStatus: invoice.status,
    grandTotal: invoice.grand_total,
    amountPaid: invoice.amount_paid,
    dueDate: invoice.due_date,
  });

  // Top Brand Accent Bar (Navy #101B35 + Maroon #800020 + Gold #C5A15B)
  doc.setFillColor(16, 27, 53); // #101B35
  doc.rect(0, 0, 140, 5, 'F');
  doc.setFillColor(197, 161, 91); // #C5A15B
  doc.rect(140, 0, 15, 5, 'F');
  doc.setFillColor(128, 0, 32); // #800020
  doc.rect(155, 0, 55, 5, 'F');

  // Company Header (Left)
  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 27, 53);
  doc.text(companyName.toUpperCase(), 14, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(128, 0, 32);
  doc.text(tagline, 14, y);

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(businessField, 14, y);

  if (settings.address) {
    y += 4.5;
    const addrLines = doc.splitTextToSize(settings.address, 105);
    doc.text(addrLines, 14, y);
    y += (addrLines.length - 1) * 4;
  }

  const contactParts: string[] = [];
  if (settings.whatsapp) contactParts.push(`WA: ${settings.whatsapp}`);
  if (settings.email) contactParts.push(`Email: ${settings.email}`);
  if (settings.website) contactParts.push(`Web: ${settings.website}`);
  if (contactParts.length > 0) {
    y += 4.5;
    doc.setFontSize(8);
    doc.text(contactParts.join('  |  '), 14, y);
  }

  // INVOICE Title & Metadata (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(128, 0, 32);
  doc.text('INVOICE', 196, 17, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(16, 27, 53);
  doc.text(`No. Invoice: ${invoice.invoice_number}`, 196, 24, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Tanggal Terbit: ${formatDateId(invoice.issue_date)}`,
    196,
    29,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(128, 0, 32);
  doc.text(`Jatuh Tempo: ${formatDateId(invoice.due_date)}`, 196, 34, {
    align: 'right',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 27, 53);
  doc.text(
    `Status: ${getIndonesianStatusLabel(effectiveStatus)}`,
    196,
    39.5,
    { align: 'right' }
  );

  const dividerY = Math.max(y + 6, 44);
  doc.setDrawColor(16, 27, 53);
  doc.setLineWidth(0.6);
  doc.line(14, dividerY, 196, dividerY);

  // BILL TO & Balance Highlight Box
  const billToStartY = dividerY + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(128, 0, 32);
  doc.text('DITAGIHKAN KEPADA (BILL TO):', 14, billToStartY);

  let clientY = billToStartY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(16, 27, 53);
  doc.text(
    invoice.client?.client_name || invoice.client_id || '-',
    14,
    clientY
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (invoice.client?.contact_person) {
    clientY += 4.5;
    doc.text(`U.p. ${invoice.client.contact_person}`, 14, clientY);
  }
  if (invoice.client?.address) {
    clientY += 4.5;
    const clientAddr = doc.splitTextToSize(invoice.client.address, 110);
    doc.text(clientAddr, 14, clientY);
    clientY += (clientAddr.length - 1) * 4;
  }
  const clientContact = [
    invoice.client?.whatsapp || invoice.client?.phone || '',
    invoice.client?.email || '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (clientContact) {
    clientY += 4.5;
    doc.text(clientContact, 14, clientY);
  }

  // Right Box: Sisa Tagihan Saat Ini
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(132, billToStartY - 2, 64, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Sisa Tagihan Saat Ini', 192, billToStartY + 4, {
    align: 'right',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(128, 0, 32);
  doc.text(formatRupiah(invoice.balance), 192, billToStartY + 13, {
    align: 'right',
  });

  // Line Items Table using autoTable
  const tableStartY = Math.max(clientY + 7, billToStartY + 24);
  const tableBody = (invoice.items || []).map((item, idx) => {
    const descLines =
      item.discount > 0
        ? `${item.description}\n(Potongan Diskon Item: -${formatRupiah(item.discount)})`
        : item.description;
    return [
      String(idx + 1),
      descLines,
      `${item.quantity} ${item.unit}`,
      formatRupiah(item.unit_price),
      formatRupiah(item.total),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['No', 'Deskripsi Layanan', 'Qty', 'Harga Satuan', 'Total']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [16, 27, 53],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [16, 27, 53],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 36 },
      4: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalTableY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || tableStartY + 25;

  let summaryY = finalTableY + 8;
  if (summaryY > 230) {
    doc.addPage();
    summaryY = 20;
  }

  // Left Column: Informasi Pembayaran Resmi & Catatan
  let leftY = summaryY;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, leftY, 102, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(16, 27, 53);
  doc.text('INFORMASI PEMBAYARAN RESMI', 18, leftY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (
    settings.bank_name ||
    settings.bank_account_number ||
    settings.bank_account_name
  ) {
    doc.setTextColor(71, 85, 105);
    doc.text(`Bank: ${settings.bank_name || '-'}`, 18, leftY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(128, 0, 32);
    doc.text(
      `No. Rekening: ${settings.bank_account_number || '-'}`,
      18,
      leftY + 17.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 27, 53);
    doc.text(
      `Atas Nama: ${settings.bank_account_name || '-'}`,
      18,
      leftY + 23
    );
  } else {
    doc.setTextColor(100, 116, 139);
    const emptyBankLines = doc.splitTextToSize(
      'Informasi rekening bank dapat diatur melalui menu Pengaturan Perusahaan.',
      94
    );
    doc.text(emptyBankLines, 18, leftY + 12);
  }

  leftY += 34;
  if (invoice.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 27, 53);
    doc.text('Catatan & Ketentuan:', 14, leftY);
    leftY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(invoice.notes, 102);
    doc.text(noteLines, 14, leftY);
    leftY += noteLines.length * 4;
  }

  // Right Column: Ringkasan Perhitungan
  let rightY = summaryY + 3;
  const labelX = 124;
  const valX = 196;

  const drawSummaryRow = (
    label: string,
    val: string,
    opts?: { bold?: boolean; color?: [number, number, number] }
  ) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.bold ? 9.5 : 8.5);
    const [r, g, b] = opts?.color || [16, 27, 53];
    doc.setTextColor(r, g, b);
    doc.text(label, labelX, rightY);
    doc.text(val, valX, rightY, { align: 'right' });
    rightY += 6;
  };

  drawSummaryRow('Subtotal', formatRupiah(invoice.subtotal));
  if (invoice.discount > 0) {
    drawSummaryRow('Diskon', `-${formatRupiah(invoice.discount)}`, {
      color: [128, 0, 32],
    });
  }
  if (invoice.additional_cost > 0) {
    drawSummaryRow(
      'Biaya Tambahan',
      formatRupiah(invoice.additional_cost)
    );
  }
  if (invoice.tax_amount > 0) {
    drawSummaryRow(
      `Pajak (${invoice.tax_rate}%)`,
      formatRupiah(invoice.tax_amount)
    );
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(labelX, rightY - 3.5, valX, rightY - 3.5);
  rightY += 2;
  drawSummaryRow('Grand Total', formatRupiah(invoice.grand_total), {
    bold: true,
  });
  drawSummaryRow('Sudah Dibayar', formatRupiah(invoice.amount_paid), {
    color: [4, 120, 87],
  });

  // Sisa Tagihan Box
  doc.setFillColor(128, 0, 32);
  doc.roundedRect(labelX - 2, rightY - 4, 74, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Sisa Tagihan', labelX + 1, rightY + 1.8);
  doc.text(formatRupiah(invoice.balance), valX - 2, rightY + 1.8, {
    align: 'right',
  });
  rightY += 12;

  // Footer & Signature
  const footerStartY = Math.max(leftY + 8, rightY + 8);
  const clampedFooterY = Math.min(footerStartY, 258);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, clampedFooterY, 196, clampedFooterY);

  const footerNote =
    settings.footer_note ||
    'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(16, 27, 53);
  const fLines = doc.splitTextToSize(footerNote, 115);
  doc.text(fLines, 14, clampedFooterY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Dokumen ini diterbitkan secara resmi melalui Sistem Autosmart Invoice.',
    14,
    clampedFooterY + 6 + fLines.length * 4
  );

  // Signature Block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Hormat Kami,', 196, clampedFooterY + 6, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(146, clampedFooterY + 22, 196, clampedFooterY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(16, 27, 53);
  doc.text(
    settings.signatory_name || companyName,
    196,
    clampedFooterY + 26.5,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    settings.signatory_role || 'Finance & Administration',
    196,
    clampedFooterY + 30.5,
    { align: 'right' }
  );

  const fileName = `${sanitizeFileName(`Invoice_${invoice.invoice_number}`)}.pdf`;

  if (mode === 'print') {
    doc.autoPrint();
    triggerCleanPrint(
      'autosmart-invoice-document',
      `Invoice-${invoice.invoice_number}`,
      'A4'
    );
  }

  doc.save(fileName);
  return fileName;
}

/**
 * Generates an official Payment Receipt (Kwitansi) PDF in either A4 or Thermal 80mm format.
 */
export function generateReceiptPdf(
  payment: Payment,
  invoice: Invoice | undefined,
  settings: CompanySettingsMap,
  paperFormat: 'A4' | 'THERMAL_80MM' = 'A4',
  mode: 'download' | 'print' = 'download'
): string {
  const companyName =
    settings.company_name || 'Autosmart Digital Solutions';
  const tagline =
    settings.tagline || 'Skill Up For Digital Collaboration';
  const remainingBalance = invoice ? invoice.balance : 0;
  const statusText =
    remainingBalance <= 0
      ? 'LUNAS (PAID)'
      : 'DIBAYAR SEBAGIAN (PARTIAL / DP)';

  if (paperFormat === 'THERMAL_80MM') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 165],
    });

    let y = 10;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 27, 53);
    doc.text(companyName.toUpperCase(), 40, y, { align: 'center' });

    y += 4.5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.text(tagline, 40, y, { align: 'center' });

    if (settings.whatsapp) {
      y += 4;
      doc.text(`WA: ${settings.whatsapp}`, 40, y, { align: 'center' });
    }

    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(128, 0, 32);
    doc.text('BUKTI PEMBAYARAN', 40, y, { align: 'center' });

    y += 3.5;
    doc.setDrawColor(148, 163, 184);
    doc.line(5, y, 75, y);

    const drawThermalPair = (label: string, val: string, bold = false) => {
      y += 5;
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(16, 27, 53);
      doc.text(label, 5, y);
      const truncated = val.length > 22 ? `${val.slice(0, 21)}…` : val;
      doc.text(truncated, 75, y, { align: 'right' });
    };

    drawThermalPair('No. Kwitansi:', payment.receipt_number, true);
    drawThermalPair('Tanggal:', formatDateId(payment.payment_date));
    drawThermalPair(
      'No. Invoice:',
      invoice?.invoice_number || payment.invoice_id
    );
    drawThermalPair(
      'Pelanggan:',
      invoice?.client?.client_name || '-',
      true
    );
    drawThermalPair('Metode:', payment.payment_method);

    y += 3.5;
    doc.line(5, y, 75, y);

    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.text('Keterangan:', 5, y);
    y += 4;
    const noteLines = doc.splitTextToSize(
      payment.notes || 'Pembayaran Invoice Layanan Digital',
      70
    );
    doc.text(noteLines, 5, y);
    y += (noteLines.length - 1) * 3.5;

    drawThermalPair('NOMINAL BAYAR:', formatRupiah(payment.amount), true);
    drawThermalPair('Sisa Tagihan:', formatRupiah(remainingBalance));
    drawThermalPair(
      'Status:',
      remainingBalance <= 0 ? 'LUNAS' : 'DIBAYAR SEBAGIAN',
      true
    );

    y += 4;
    doc.line(5, y, 75, y);

    y += 6;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `Petugas: ${settings.signatory_name || 'Admin Autosmart'}`,
      40,
      y,
      { align: 'center' }
    );
    y += 4;
    doc.text('Terima kasih atas kepercayaan Anda.', 40, y, {
      align: 'center',
    });

    const fileName = `${sanitizeFileName(`Kwitansi_80mm_${payment.receipt_number}`)}.pdf`;
    if (mode === 'print') {
      doc.autoPrint();
      triggerCleanPrint(
        'autosmart-receipt-document',
        `Kwitansi-${payment.receipt_number}`,
        'THERMAL_80MM'
      );
    }
    doc.save(fileName);
    return fileName;
  }

  // Standard A4 Receipt
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFillColor(16, 27, 53);
  doc.rect(0, 0, 140, 5, 'F');
  doc.setFillColor(197, 161, 91);
  doc.rect(140, 0, 15, 5, 'F');
  doc.setFillColor(128, 0, 32);
  doc.rect(155, 0, 55, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 27, 53);
  doc.text(companyName.toUpperCase(), 14, 16);

  doc.setFontSize(8.5);
  doc.setTextColor(128, 0, 32);
  doc.text(tagline, 14, 21);

  if (settings.address) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(settings.address, 14, 26);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(128, 0, 32);
  doc.text('BUKTI PEMBAYARAN', 196, 17, { align: 'right' });

  doc.setFontSize(9.5);
  doc.setTextColor(16, 27, 53);
  doc.text(`No: ${payment.receipt_number}`, 196, 23, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal: ${formatDateId(payment.payment_date)}`, 196, 28, {
    align: 'right',
  });

  doc.setDrawColor(16, 27, 53);
  doc.setLineWidth(0.6);
  doc.line(14, 34, 196, 34);

  autoTable(doc, {
    startY: 42,
    body: [
      [
        'Telah Diterima Dari (Pelanggan)',
        invoice?.client?.client_name || '-',
      ],
      [
        'Nomor Invoice Terkait',
        invoice?.invoice_number || payment.invoice_id,
      ],
      [
        'Metode Pembayaran',
        `${payment.payment_method}${payment.reference_number ? ` (Ref: ${payment.reference_number})` : ''}`,
      ],
      [
        'Keterangan Pembayaran',
        payment.notes || 'Pembayaran layanan Autosmart Digital Solutions',
      ],
    ],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 3.5,
      textColor: [16, 27, 53],
      lineColor: [241, 245, 249],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 65, textColor: [100, 116, 139], fontStyle: 'bold' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const afterTableY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || 90;

  // Highlight Nominal Box
  const boxY = afterTableY + 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, boxY, 182, 24, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('NOMINAL PEMBAYARAN DITERIMA', 20, boxY + 8);

  doc.setFontSize(16);
  doc.setTextColor(128, 0, 32);
  doc.text(formatRupiah(payment.amount), 20, boxY + 17.5);

  doc.setFontSize(9);
  doc.setTextColor(16, 27, 53);
  doc.text(
    `Sisa Tagihan Invoice: ${formatRupiah(remainingBalance)}`,
    190,
    boxY + 10,
    { align: 'right' }
  );
  doc.setTextColor(4, 120, 87);
  doc.text(`Status: ${statusText}`, 190, boxY + 17, { align: 'right' });

  // Signature Footer
  const sigY = boxY + 38;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    settings.footer_note ||
      'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.',
    14,
    sigY,
    { maxWidth: 110 }
  );

  doc.text('Petugas Administrasi,', 196, sigY, { align: 'right' });
  doc.setDrawColor(203, 213, 225);
  doc.line(146, sigY + 18, 196, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 27, 53);
  doc.text(
    settings.signatory_name || 'Administrator Autosmart',
    196,
    sigY + 23,
    { align: 'right' }
  );

  const fileName = `${sanitizeFileName(`Kwitansi_${payment.receipt_number}`)}.pdf`;
  if (mode === 'print') {
    doc.autoPrint();
    triggerCleanPrint(
      'autosmart-receipt-document',
      `Kwitansi-${payment.receipt_number}`,
      'A4'
    );
  }
  doc.save(fileName);
  return fileName;
}

/**
 * Generates an official A4 Financial Report PDF using jsPDF + autoTable.
 */
export function generateReportPdf(params: {
  reportTitle: string;
  periodLabel: string;
  printDateLabel: string;
  companyName: string;
  summary: {
    totalBilled: number;
    totalActualRevenue: number;
    totalReceivables: number;
  };
  headers: string[];
  rows: Array<Array<string | number>>;
  fileNameBase: string;
  mode?: 'download' | 'print';
}): string {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFillColor(16, 27, 53);
  doc.rect(0, 0, 200, 4, 'F');
  doc.setFillColor(128, 0, 32);
  doc.rect(200, 0, 97, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(128, 0, 32);
  doc.text(params.companyName.toUpperCase(), 14, 13);

  doc.setFontSize(14);
  doc.setTextColor(16, 27, 53);
  doc.text(`Laporan Keuangan: ${params.reportTitle}`, 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${params.periodLabel}`, 283, 14, { align: 'right' });
  doc.text(`Dicetak pada: ${params.printDateLabel}`, 283, 19, {
    align: 'right',
  });

  // Summary Boxes
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 24, 86, 15, 2, 2, 'FD');
  doc.roundedRect(105, 24, 86, 15, 2, 2, 'FD');
  doc.roundedRect(196, 24, 87, 15, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Nilai Invoice Diterbitkan', 18, 29.5);
  doc.text('Total Pendapatan Riil Diterima (Kas)', 109, 29.5);
  doc.text('Total Sisa Piutang Belum Tertagih', 200, 29.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 27, 53);
  doc.text(formatRupiah(params.summary.totalBilled), 18, 36);
  doc.setTextColor(4, 120, 87);
  doc.text(formatRupiah(params.summary.totalActualRevenue), 109, 36);
  doc.setTextColor(128, 0, 32);
  doc.text(formatRupiah(params.summary.totalReceivables), 200, 36);

  autoTable(doc, {
    startY: 44,
    head: [params.headers],
    body: params.rows.map((r) => r.map((c) => String(c ?? ''))),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [16, 27, 53],
    },
    headStyles: {
      fillColor: [16, 27, 53],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { left: 14, right: 14 },
  });

  const fileName = `${sanitizeFileName(params.fileNameBase)}.pdf`;
  if (params.mode === 'print') {
    doc.autoPrint();
    triggerCleanPrint(
      'autosmart-printable-report',
      params.fileNameBase,
      'A4'
    );
  }
  doc.save(fileName);
  return fileName;
}

export function triggerCleanPrint(
  elementId: string,
  documentTitle: string,
  paperFormat: 'A4' | 'THERMAL_80MM' = 'A4'
): boolean {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) return false;

  const existingFrame = document.getElementById(
    'autosmart-print-iframe'
  ) as HTMLIFrameElement | null;
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'autosmart-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return false;

  const styleTags = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  )
    .map((el) => el.outerHTML)
    .join('\n');

  const pageSizeCss =
    paperFormat === 'THERMAL_80MM'
      ? `@page { size: 80mm auto; margin: 4mm; } body { width: 72mm; margin: 0 auto; background: #fff !important; }`
      : `@page { size: A4 portrait; margin: 12mm; } body { background: #fff !important; margin: 0; padding: 0; }`;

  doc.open();
  doc.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${documentTitle}</title>
  ${styleTags}
  <style>
    ${pageSizeCss}
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
  </style>
</head>
<body>
  ${sourceEl.outerHTML}
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  }, 350);

  return true;
}

export function exportDocumentAsPdf(
  elementId: string,
  fileNameBase: string,
  paperFormat: 'A4' | 'THERMAL_80MM' = 'A4'
): boolean {
  const cleanTitle = sanitizeFileName(fileNameBase);
  return triggerCleanPrint(elementId, cleanTitle, paperFormat);
}
