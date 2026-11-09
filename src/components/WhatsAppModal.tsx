import React, { useEffect, useState } from 'react';
import { MessageSquare, Copy, Check, ExternalLink, X } from 'lucide-react';
import type {
  CompanySettingsMap,
  Invoice,
  Payment,
} from '../types/invoice';
import {
  buildWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../utils/invoiceLogic';

interface WhatsAppModalProps {
  invoice: Invoice;
  payment?: Payment | null;
  settings: CompanySettingsMap;
  initialTemplate?: 'invoice' | 'payment_info' | 'reminder' | 'receipt';
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  invoice,
  payment,
  settings,
  initialTemplate = 'invoice',
  onClose,
}) => {
  const [templateType, setTemplateType] = useState<
    'invoice' | 'payment_info' | 'reminder' | 'receipt'
  >(payment ? 'receipt' : initialTemplate);
  const [phoneInput, setPhoneInput] = useState(
    invoice.client?.whatsapp || invoice.client?.phone || ''
  );
  const [messageText, setMessageText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const generated = buildWhatsAppMessage({
      type: templateType,
      clientName:
        invoice.client?.contact_person ||
        invoice.client?.client_name ||
        'Pelanggan',
      invoiceNumber: invoice.invoice_number,
      grandTotal: invoice.grand_total,
      amountPaid: invoice.amount_paid,
      balance: invoice.balance,
      dueDate: invoice.due_date,
      receiptNumber: payment?.receipt_number,
      lastPaymentAmount: payment?.amount,
      paymentDate: payment?.payment_date,
      bankName: settings.bank_name,
      bankAccountName: settings.bank_account_name,
      bankAccountNumber: settings.bank_account_number,
      companyName: settings.company_name || 'Autosmart Digital Solutions',
    });
    setMessageText(generated);
  }, [templateType, invoice, payment, settings]);

  const normalizedPhone = normalizeWhatsAppNumber(phoneInput);
  const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
    messageText
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Komunikasi WhatsApp Pelanggan"
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#101B35] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C5A15B]" />
            <h3 className="text-sm font-bold">
              Kirim Pesan WhatsApp ke Pelanggan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal WhatsApp"
            className="p-1 text-slate-300 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 4 Template Buttons from PRD Section 12 */}
          <div>
            <div className="text-xs font-semibold text-[#101B35] mb-2">
              Pilih Jenis Pesan Komunikasi:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setTemplateType('invoice')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  templateType === 'invoice'
                    ? 'bg-[#800020] text-white border-[#800020]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Kirim Invoice
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('payment_info')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  templateType === 'payment_info'
                    ? 'bg-[#800020] text-white border-[#800020]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Info Rekening
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('reminder')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  templateType === 'reminder'
                    ? 'bg-[#800020] text-white border-[#800020]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Pengingat Tagihan
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('receipt')}
                className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  templateType === 'receipt'
                    ? 'bg-[#800020] text-white border-[#800020]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Bukti Pembayaran
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="wa-phone-input"
              className="block text-xs font-semibold text-[#101B35] mb-1"
            >
              Nomor WhatsApp Tujuan (Format Internasional 628...)
            </label>
            <input
              id="wa-phone-input"
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="6281234567890"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="wa-msg-textarea"
                className="text-xs font-semibold text-[#101B35]"
              >
                Pratinjau & Edit Pesan Otomatis
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-semibold text-[#800020] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Teks</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              id="wa-msg-textarea"
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg font-sans leading-relaxed focus:outline-none focus:border-[#800020]"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Catatan: Setelah WhatsApp terbuka, Anda dapat melampirkan file PDF
              Invoice atau Bukti Pembayaran yang telah diunduh secara manual.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Tutup
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <span>Buka WhatsApp Sekarang</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
