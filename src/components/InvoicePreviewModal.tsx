import React, { useState } from 'react';
import {
  Printer,
  Download,
  MessageSquare,
  CreditCard,
  Check,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { CompanySettingsMap, Invoice } from '../types/invoice';
import {
  formatDateId,
  formatRupiah,
  resolveInvoiceStatus,
} from '../utils/invoiceLogic';
import { generateInvoicePdf } from '../utils/printDocument';

interface InvoicePreviewModalProps {
  invoice: Invoice;
  settings: CompanySettingsMap;
  onClose: () => void;
  onOpenWhatsApp: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  settings,
  onClose,
  onOpenWhatsApp,
  onRecordPayment,
}) => {
  const [pdfNotice, setPdfNotice] = useState<string>('');

  const effectiveStatus = resolveInvoiceStatus({
    currentStatus: invoice.status,
    grandTotal: invoice.grand_total,
    amountPaid: invoice.amount_paid,
    dueDate: invoice.due_date,
  });

  const handlePrint = () => {
    const fileName = generateInvoicePdf(invoice, settings, 'print');
    setPdfNotice(`Siap cetak & file PDF (${fileName}) berhasil diunduh.`);
    setTimeout(() => setPdfNotice(''), 4000);
  };

  const handleDownloadPdf = () => {
    const fileName = generateInvoicePdf(invoice, settings, 'download');
    setPdfNotice(`File PDF (${fileName}) berhasil diunduh ke perangkat Anda.`);
    setTimeout(() => setPdfNotice(''), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Dokumen Invoice ${invoice.invoice_number}`}
    >
      <div className="bg-slate-100 rounded-xl border border-slate-300 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Action Bar (Hidden on Print) */}
        <div className="bg-[#101B35] text-white px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs truncate">
              <span className="text-slate-300 hidden sm:inline">
                Pratinjau Dokumen Resmi A4:{' '}
              </span>
              <span className="font-mono font-bold text-[#C5A15B]">
                {invoice.invoice_number}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau invoice"
              className="sm:hidden p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {invoice.balance > 0 && invoice.status !== 'Cancelled' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRecordPayment(invoice);
                }}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-[#C5A15B] text-[#101B35] hover:bg-[#b5914b] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Bayar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenWhatsApp(invoice)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A15B]" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold bg-[#800020] hover:bg-[#660019] text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau invoice"
              className="hidden sm:inline-flex p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div
            role="status"
            className="bg-emerald-800 text-white px-4 py-2 text-xs font-medium flex items-center justify-between gap-2 no-print"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#C5A15B] shrink-0" />
              <span>{pdfNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfNotice('')}
              className="text-emerald-200 hover:text-white text-[11px] underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Printable A4 Sheet Canvas */}
        <div className="p-2.5 sm:p-8 overflow-y-auto flex-1">
          <div
            id="autosmart-invoice-document"
            className="bg-white text-[#101B35] max-w-[210mm] mx-auto rounded-lg border border-slate-200 p-4 sm:p-10 print-container"
          >
            {/* Top Header Band */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 pb-5 sm:pb-6 border-b-2 border-[#101B35]">
              <div className="space-y-2 max-w-md">
                <BrandLogo
                  logoUrl={settings.logo_url}
                  companyName={
                    settings.company_name || 'Autosmart Digital Solutions'
                  }
                  tagline={
                    settings.tagline || 'Skill Up For Digital Collaboration'
                  }
                  variant="dark"
                  size="lg"
                />
                <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                  <div className="font-medium text-[#101B35]">
                    {settings.business_field ||
                      'Digital Learning & Business Solution'}
                  </div>
                  {settings.address && <div>{settings.address}</div>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                    {settings.whatsapp && (
                      <span>WA: {settings.whatsapp}</span>
                    )}
                    {settings.email && <span>Email: {settings.email}</span>}
                    {settings.website && (
                      <span>Web: {settings.website}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#800020]">
                  INVOICE
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">Nomor Invoice: </span>
                    <span className="font-mono font-bold text-[#101B35]">
                      {invoice.invoice_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tanggal Invoice: </span>
                    <span className="font-medium text-[#101B35]">
                      {formatDateId(invoice.issue_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Jatuh Tempo: </span>
                    <span className="font-semibold text-[#800020]">
                      {formatDateId(invoice.due_date)}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#101B35]">
                      Status:{' '}
                      {effectiveStatus === 'Paid'
                        ? 'LUNAS (PAID)'
                        : effectiveStatus === 'Partially Paid'
                          ? 'DIBAYAR SEBAGIAN'
                          : effectiveStatus === 'Overdue'
                            ? 'JATUH TEMPO'
                            : 'BELUM DIBAYAR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BILL TO Section */}
            <div className="py-5 sm:py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 border-b border-slate-200">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#800020] mb-1.5">
                  DITAGIHKAN KEPADA (BILL TO)
                </div>
                <div className="text-sm font-bold text-[#101B35]">
                  {invoice.client?.client_name || invoice.client_id}
                </div>
                {invoice.client?.contact_person && (
                  <div className="text-xs text-slate-700 mt-0.5">
                    U.p. {invoice.client.contact_person}
                  </div>
                )}
                {invoice.client?.address && (
                  <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {invoice.client.address}
                  </div>
                )}
                <div className="text-xs text-slate-600 mt-1 font-mono break-all">
                  {invoice.client?.whatsapp || invoice.client?.phone || ''}
                  {invoice.client?.email ? ` · ${invoice.client.email}` : ''}
                </div>
              </div>

              <div className="sm:text-right flex flex-col justify-end">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 inline-block sm:ml-auto text-left sm:text-right">
                  <div className="text-[11px] text-slate-500">
                    Sisa Tagihan Saat Ini
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono text-[#800020] mt-0.5">
                    {formatRupiah(invoice.balance)}
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL RINCIAN */}
            <div className="py-5 sm:py-6 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[460px]">
                <thead>
                  <tr className="bg-[#101B35] text-white text-xs">
                    <th className="py-3 px-2.5 w-10 text-center rounded-tl-md">
                      No
                    </th>
                    <th className="py-3 px-3">Deskripsi Layanan</th>
                    <th className="py-3 px-2.5 text-center w-20">Qty</th>
                    <th className="py-3 px-3 text-right w-32">Harga</th>
                    <th className="py-3 px-3 text-right w-36 rounded-tr-md">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {(invoice.items || []).map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-3 px-2.5 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#101B35]">
                          {item.description}
                        </div>
                        {item.discount > 0 && (
                          <div className="text-[11px] text-[#800020] mt-0.5">
                            Potongan diskon item: -{formatRupiah(item.discount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2.5 text-center font-mono whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRupiah(item.unit_price)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#101B35] whitespace-nowrap">
                        {formatRupiah(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RINGKASAN PEMBAYARAN & INFORMASI REKENING */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 sm:gap-8 pt-4 border-t border-slate-200">
              {/* Left: Informasi Pembayaran & Catatan */}
              <div className="sm:col-span-7 space-y-4 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#101B35]">
                    INFORMASI PEMBAYARAN RESMI
                  </div>
                  {settings.bank_name ||
                  settings.bank_account_number ||
                  settings.bank_account_name ? (
                    <div className="space-y-1 text-slate-700">
                      <div>
                        <span className="text-slate-500">Nama Bank: </span>
                        <span className="font-semibold text-[#101B35]">
                          {settings.bank_name || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">No. Rekening: </span>
                        <span className="font-mono font-bold text-[#800020]">
                          {settings.bank_account_number || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Atas Nama: </span>
                        <span className="font-semibold text-[#101B35]">
                          {settings.bank_account_name || '-'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      Informasi rekening bank dapat dilengkapi oleh
                      Administrator melalui menu Pengaturan Perusahaan.
                    </div>
                  )}

                  {settings.qris_url && (
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">
                        Pembayaran melalui QRIS:
                      </div>
                      <img
                        src={settings.qris_url}
                        alt="QRIS Autosmart"
                        referrerPolicy="no-referrer"
                        className="w-28 h-28 object-contain border border-slate-200 rounded bg-white p-1"
                      />
                    </div>
                  )}
                </div>

                {invoice.notes && (
                  <div>
                    <div className="font-bold text-[#101B35] mb-1">
                      Catatan & Ketentuan:
                    </div>
                    <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Ringkasan Pembayaran */}
              <div className="sm:col-span-5 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-mono tabular-nums font-medium text-[#101B35]">
                    {formatRupiah(invoice.subtotal)}
                  </span>
                </div>

                {invoice.discount > 0 && (
                  <div className="flex items-center justify-between py-1 text-slate-600">
                    <span>Diskon</span>
                    <span className="font-mono tabular-nums text-[#800020]">
                      -{formatRupiah(invoice.discount)}
                    </span>
                  </div>
                )}

                {invoice.additional_cost > 0 && (
                  <div className="flex items-center justify-between py-1 text-slate-600">
                    <span>Biaya Tambahan</span>
                    <span className="font-mono tabular-nums text-[#101B35]">
                      {formatRupiah(invoice.additional_cost)}
                    </span>
                  </div>
                )}

                {invoice.tax_amount > 0 && (
                  <div className="flex items-center justify-between py-1 text-slate-600">
                    <span>Pajak ({invoice.tax_rate}%)</span>
                    <span className="font-mono tabular-nums text-[#101B35]">
                      {formatRupiah(invoice.tax_amount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-2.5 border-y border-slate-300 text-sm font-bold text-[#101B35]">
                  <span>Grand Total</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(invoice.grand_total)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 text-emerald-700 font-medium">
                  <span>Sudah Dibayar</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(invoice.amount_paid)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#800020] text-white font-bold text-sm">
                  <span>Sisa Tagihan</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(invoice.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* FOOTER & SIGNATURE */}
            <div className="mt-8 sm:mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 text-xs">
              <div className="max-w-md space-y-1">
                <p className="font-semibold text-[#101B35]">
                  {settings.footer_note ||
                    'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Dokumen ini diterbitkan secara resmi melalui Sistem Autosmart
                  Invoice.
                </p>
              </div>

              <div className="text-center sm:text-right min-w-[180px]">
                <div className="text-slate-500 mb-12">Hormat Kami,</div>
                <div className="font-bold text-[#101B35] border-t border-slate-300 pt-1.5">
                  {settings.signatory_name ||
                    settings.company_name ||
                    'Autosmart Digital Solutions'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {settings.signatory_role || 'Finance & Administration'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
