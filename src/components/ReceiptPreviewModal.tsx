import React, { useState } from 'react';
import { Printer, Download, MessageSquare, Check, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type {
  CompanySettingsMap,
  Invoice,
  Payment,
} from '../types/invoice';
import { formatDateId, formatRupiah } from '../utils/invoiceLogic';
import { generateReceiptPdf } from '../utils/printDocument';

interface ReceiptPreviewModalProps {
  payment: Payment;
  invoice?: Invoice;
  settings: CompanySettingsMap;
  onClose: () => void;
  onSendWhatsApp: (payment: Payment, invoice?: Invoice) => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  payment,
  invoice,
  settings,
  onClose,
  onSendWhatsApp,
}) => {
  const [paperMode, setPaperMode] = useState<'A4' | 'THERMAL_80MM'>('A4');
  const [pdfNotice, setPdfNotice] = useState<string>('');

  const remainingBalance = invoice ? invoice.balance : 0;
  const paymentStatusLabel =
    remainingBalance <= 0 ? 'LUNAS (PAID)' : 'DIBAYAR SEBAGIAN (PARTIAL / DP)';

  const handlePrint = () => {
    const fileName = generateReceiptPdf(
      payment,
      invoice,
      settings,
      paperMode,
      'print'
    );
    setPdfNotice(`Siap cetak & file PDF (${fileName}) berhasil diunduh.`);
    setTimeout(() => setPdfNotice(''), 4000);
  };

  const handleDownloadPdf = () => {
    const fileName = generateReceiptPdf(
      payment,
      invoice,
      settings,
      paperMode,
      'download'
    );
    setPdfNotice(`File PDF (${fileName}) berhasil diunduh ke perangkat Anda.`);
    setTimeout(() => setPdfNotice(''), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Bukti Pembayaran ${payment.receipt_number}`}
    >
      <div className="bg-slate-100 rounded-xl border border-slate-300 w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Top Action Bar */}
        <div className="bg-[#101B35] text-white px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Format Cetak:</span>
              <div className="flex items-center gap-1 p-0.5 bg-white/10 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaperMode('A4')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    paperMode === 'A4'
                      ? 'bg-[#800020] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Dokumen A4
                </button>
                <button
                  type="button"
                  onClick={() => setPaperMode('THERMAL_80MM')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    paperMode === 'THERMAL_80MM'
                      ? 'bg-[#800020] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Thermal 80mm
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup bukti pembayaran"
              className="sm:hidden p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onSendWhatsApp(payment, invoice)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Kirim WhatsApp</span>
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
              <span>
                Cetak {paperMode === 'THERMAL_80MM' ? '80mm' : 'A4'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup bukti pembayaran"
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

        {/* Document Preview Area */}
        <div className="p-3 sm:p-8 overflow-y-auto flex-1">
          {paperMode === 'A4' ? (
            <div
              id="autosmart-receipt-document"
              className="bg-white text-[#101B35] max-w-[210mm] mx-auto rounded-lg border border-slate-200 p-4 sm:p-10 print-container"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-[#101B35]">
                <div>
                  <BrandLogo
                    logoUrl={settings.logo_url}
                    companyName={
                      settings.company_name || 'Autosmart Digital Solutions'
                    }
                    tagline={
                      settings.tagline || 'Skill Up For Digital Collaboration'
                    }
                    variant="dark"
                    size="md"
                  />
                  {settings.address && (
                    <div className="text-xs text-slate-600 mt-2">
                      {settings.address}
                    </div>
                  )}
                </div>

                <div className="sm:text-right">
                  <div className="text-2xl font-extrabold tracking-tight text-[#800020]">
                    BUKTI PEMBAYARAN
                  </div>
                  <div className="text-xs font-mono font-bold text-[#101B35] mt-1">
                    No: {payment.receipt_number}
                  </div>
                  <div className="text-xs text-slate-600">
                    Tanggal: {formatDateId(payment.payment_date)}
                  </div>
                </div>
              </div>

              {/* Receipt Body Details */}
              <div className="py-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">
                    Telah Diterima Dari (Pelanggan)
                  </span>
                  <span className="sm:col-span-2 font-bold text-sm text-[#101B35]">
                    {invoice?.client?.client_name || '-'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">
                    Nomor Invoice Terkait
                  </span>
                  <span className="sm:col-span-2 font-mono font-bold text-[#101B35]">
                    {invoice?.invoice_number || payment.invoice_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">
                    Metode Pembayaran
                  </span>
                  <span className="sm:col-span-2 font-semibold text-[#101B35]">
                    {payment.payment_method}{' '}
                    {payment.reference_number
                      ? `(Ref: ${payment.reference_number})`
                      : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">
                    Keterangan / Catatan Pembayaran
                  </span>
                  <span className="sm:col-span-2 text-slate-700">
                    {payment.notes ||
                      'Pembayaran layanan Autosmart Digital Solutions'}
                  </span>
                </div>

                {/* Amount Highlight Box */}
                <div className="my-6 p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                      Nominal Pembayaran Diterima
                    </div>
                    <div className="text-2xl font-extrabold font-mono text-[#800020] mt-1">
                      {formatRupiah(payment.amount)}
                    </div>
                  </div>

                  <div className="sm:text-right space-y-1">
                    <div>
                      <span className="text-slate-500">
                        Sisa Tagihan Invoice:{' '}
                      </span>
                      <span className="font-mono font-bold text-[#101B35]">
                        {formatRupiah(remainingBalance)}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-700">
                      Status: {paymentStatusLabel}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer & Signature */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 text-xs">
                <div className="text-slate-500 max-w-sm">
                  {settings.footer_note ||
                    'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.'}
                </div>

                <div className="text-center sm:text-right min-w-[180px]">
                  <div className="text-slate-500 mb-12">
                    Petugas Administrasi,
                  </div>
                  <div className="font-bold text-[#101B35] border-t border-slate-300 pt-1.5">
                    {settings.signatory_name || 'Administrator Autosmart'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {settings.company_name || 'Autosmart Digital Solutions'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Thermal 80mm Receipt Layout */
            <div
              id="autosmart-receipt-document"
              className="bg-white text-[#101B35] w-[302px] mx-auto rounded border border-slate-300 p-4 font-mono text-[11px] space-y-3 print-container"
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-3">
                <div className="font-bold text-sm uppercase">
                  {settings.company_name || 'AUTOSMART DIGITAL SOLUTIONS'}
                </div>
                <div className="text-[10px] text-slate-600">
                  {settings.tagline || 'Skill Up For Digital Collaboration'}
                </div>
                {settings.whatsapp && (
                  <div className="text-[10px] mt-0.5">
                    WA: {settings.whatsapp}
                  </div>
                )}
                <div className="mt-2 font-bold text-xs text-[#800020]">
                  BUKTI PEMBAYARAN
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-400 pb-3">
                <div className="flex justify-between">
                  <span>No. Kwitansi:</span>
                  <span className="font-bold">{payment.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{formatDateId(payment.payment_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>No. Invoice:</span>
                  <span>{invoice?.invoice_number || payment.invoice_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="text-right font-bold max-w-[160px] truncate">
                    {invoice?.client?.client_name || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Metode:</span>
                  <span>{payment.payment_method}</span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-3">
                <div>
                  <div className="text-slate-500">Keterangan:</div>
                  <div>{payment.notes || 'Pembayaran Invoice'}</div>
                </div>
                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>NOMINAL BAYAR:</span>
                  <span>{formatRupiah(payment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sisa Tagihan:</span>
                  <span>{formatRupiah(remainingBalance)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Status:</span>
                  <span>
                    {remainingBalance <= 0 ? 'LUNAS' : 'DIBAYAR SEBAGIAN'}
                  </span>
                </div>
              </div>

              <div className="text-center pt-1 space-y-1 text-[10px] text-slate-600">
                <div>Petugas: {settings.signatory_name || 'Admin'}</div>
                <div>Terima kasih atas kepercayaan Anda.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
