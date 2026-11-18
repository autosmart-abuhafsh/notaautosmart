import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Edit3,
  Trash2,
  X,
  MessageSquare,
  Download,
} from 'lucide-react';
import type {
  CompanySettingsMap,
  Invoice,
  Payment,
  PaymentMethod,
} from '../types/invoice';
import {
  formatDateId,
  formatRupiah,
  generateNextDocumentNumber,
} from '../utils/invoiceLogic';
import { generateReceiptPdf } from '../utils/printDocument';

interface PaymentManagementProps {
  payments: Payment[];
  invoices: Invoice[];
  settings: CompanySettingsMap;
  preselectedInvoice?: Invoice | null;
  onClearPreselectedInvoice?: () => void;
  onRecordPayment: (payload: {
    invoice_id: string;
    payment_date: string;
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string;
    notes: string;
  }) => Promise<Payment>;
  onUpdatePayment: (
    id: string,
    payload: {
      payment_date: string;
      amount: number;
      payment_method: PaymentMethod;
      reference_number: string;
      notes: string;
    }
  ) => Promise<Payment>;
  onDeletePayment: (id: string) => Promise<void>;
  onPreviewReceipt: (payment: Payment, invoice?: Invoice) => void;
  onOpenWhatsAppReceipt: (payment: Payment, invoice: Invoice) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'Transfer Bank',
  'Tunai',
  'QRIS',
  'E-Wallet',
  'Metode lainnya',
];

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  payments,
  invoices,
  settings,
  preselectedInvoice,
  onClearPreselectedInvoice,
  onRecordPayment,
  onUpdatePayment,
  onDeletePayment,
  onPreviewReceipt,
  onOpenWhatsAppReceipt,
}) => {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [paymentTypePreset, setPaymentTypePreset] = useState<
    'FULL' | 'DP50' | 'CUSTOM'
  >('FULL');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Transfer Bank');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedInvoice) {
      openCreateModal(preselectedInvoice);
      onClearPreselectedInvoice?.();
    }
  }, [preselectedInvoice]);

  const invoiceMap = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoices) {
      map[inv.id] = inv;
    }
    return map;
  }, [invoices]);

  const selectedInvoice = useMemo(
    () => invoiceMap[selectedInvoiceId],
    [invoiceMap, selectedInvoiceId]
  );

  const nextReceiptNumberPreview = useMemo(() => {
    return generateNextDocumentNumber(
      payments.map((p) => p.receipt_number),
      settings.receipt_prefix || 'KW/ASM',
      settings.document_year || '2026'
    );
  }, [payments, settings.receipt_prefix, settings.document_year]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const inv = invoiceMap[p.invoice_id];
      const matchesMethod =
        methodFilter === 'ALL' || p.payment_method === methodFilter;
      const matchesQuery =
        !q ||
        p.receipt_number.toLowerCase().includes(q) ||
        p.reference_number.toLowerCase().includes(q) ||
        (inv?.invoice_number || '').toLowerCase().includes(q) ||
        (inv?.client?.client_name || '').toLowerCase().includes(q);
      return matchesMethod && matchesQuery;
    });
  }, [payments, invoiceMap, search, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = (targetInv?: Invoice) => {
    setEditingPayment(null);
    setError('');
    const candidate =
      targetInv ||
      invoices.find((i) => i.balance > 0 && i.status !== 'Cancelled') ||
      invoices[0];
    const invId = candidate?.id || '';
    setSelectedInvoiceId(invId);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentTypePreset('FULL');
    setAmount(candidate ? candidate.balance : 0);
    setPaymentMethod('Transfer Bank');
    setReferenceNumber('');
    setNotes(
      candidate && candidate.amount_paid === 0
        ? 'Pembayaran penuh (100%)'
        : 'Pelunasan sisa tagihan invoice'
    );
    setModalOpen(true);
  };

  const openEditModal = (pay: Payment) => {
    setEditingPayment(pay);
    setError('');
    setSelectedInvoiceId(pay.invoice_id);
    setPaymentDate(pay.payment_date);
    setPaymentTypePreset('CUSTOM');
    setAmount(pay.amount);
    setPaymentMethod(pay.payment_method);
    setReferenceNumber(pay.reference_number);
    setNotes(pay.notes);
    setModalOpen(true);
  };

  const handleSelectInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = invoiceMap[invId];
    if (inv) {
      setPaymentTypePreset('FULL');
      setAmount(inv.balance);
      setNotes(
        inv.amount_paid === 0
          ? 'Pembayaran penuh (100%)'
          : 'Pelunasan sisa tagihan invoice'
      );
    }
  };

  const applyPreset = (preset: 'FULL' | 'DP50' | 'CUSTOM') => {
    setPaymentTypePreset(preset);
    if (!selectedInvoice) return;
    if (preset === 'FULL') {
      setAmount(selectedInvoice.balance);
      setNotes(
        selectedInvoice.amount_paid === 0
          ? 'Pembayaran penuh (100%)'
          : 'Pelunasan sisa tagihan invoice'
      );
    } else if (preset === 'DP50') {
      const dpVal = Math.round(selectedInvoice.grand_total * 0.5);
      setAmount(Math.min(dpVal, selectedInvoice.balance));
      setNotes('Pembayaran Down Payment (DP 50%)');
    } else {
      setNotes('Pembayaran bertahap (Termin)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedInvoiceId) {
      setError('Silakan pilih dokumen invoice yang akan dibayar.');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    setSaving(true);
    try {
      if (editingPayment) {
        const updated = await onUpdatePayment(editingPayment.id, {
          payment_date: paymentDate,
          amount,
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          notes,
        });
        setModalOpen(false);
        onPreviewReceipt(updated, invoiceMap[updated.invoice_id]);
      } else {
        const created = await onRecordPayment({
          invoice_id: selectedInvoiceId,
          payment_date: paymentDate,
          amount,
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          notes,
        });
        setModalOpen(false);
        onPreviewReceipt(created, invoiceMap[created.invoice_id]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan data pembayaran.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-sm font-bold text-[#101B35]">
            Manajemen Pembayaran & Bukti Pembayaran (Kwitansi)
          </h2>
          <p className="text-xs text-slate-500">
            Catat pembayaran penuh, Down Payment (DP), maupun pembayaran
            bertahap. Setiap transaksi menerbitkan nomor bukti pembayaran
            tersendiri.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pembayaran Baru</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nomor bukti KW/ASM, nomor invoice, nama klien, atau referensi..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
          />
        </div>
        <select
          aria-label="Filter metode pembayaran"
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-auto px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-[#101B35] focus:outline-none focus:border-[#800020]"
        >
          <option value="ALL">Semua Metode Pembayaran</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Payments Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500">
            Tidak ada catatan pembayaran yang sesuai dengan filter.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">No. Bukti Pembayaran</th>
                    <th className="py-3 px-4">Tanggal Bayar</th>
                    <th className="py-3 px-4">Invoice & Pelanggan</th>
                    <th className="py-3 px-4">Metode & Referensi</th>
                    <th className="py-3 px-4 text-right">Nominal Dibayar</th>
                    <th className="py-3 px-4">Catatan</th>
                    <th className="py-3 px-5 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {paginated.map((pay) => {
                    const inv = invoiceMap[pay.invoice_id];
                    return (
                      <tr
                        key={pay.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-[#101B35] whitespace-nowrap">
                          {pay.receipt_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDateId(pay.payment_date)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-semibold text-[#800020]">
                            {inv?.invoice_number || pay.invoice_id}
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium">
                            {inv?.client?.client_name || '-'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-[#101B35]">
                            {pay.payment_method}
                          </span>
                          {pay.reference_number && (
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              Ref: {pay.reference_number}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                          {formatRupiah(pay.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {pay.notes || '-'}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          {confirmDeleteId === pay.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeletePayment(pay.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onPreviewReceipt(pay, inv)}
                                title="Pratinjau & Cetak Bukti Pembayaran"
                                className="px-2.5 py-1 rounded-lg bg-[#101B35] text-white text-[11px] font-semibold hover:bg-[#1a2b52] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3 text-[#C5A15B]" />
                                <span>Kwitansi</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  generateReceiptPdf(
                                    pay,
                                    inv,
                                    settings,
                                    'A4',
                                    'download'
                                  )
                                }
                                title="Download PDF Kwitansi A4"
                                className="px-2 py-1 rounded-lg bg-[#800020] text-white text-[11px] font-semibold hover:bg-[#670019] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>
                              {inv && (
                                <button
                                  type="button"
                                  onClick={() => onOpenWhatsAppReceipt(pay, inv)}
                                  title="Kirim Bukti Pembayaran via WhatsApp"
                                  className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditModal(pay)}
                                title="Edit Pembayaran"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-[#101B35] hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(pay.id)}
                                title="Hapus Pembayaran"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {paginated.map((pay) => {
                const inv = invoiceMap[pay.invoice_id];
                return (
                  <div key={pay.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-[#101B35]">
                          {pay.receipt_number}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatDateId(pay.payment_date)}
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-[#101B35] shrink-0">
                        {pay.payment_method}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono font-semibold text-[#800020] truncate">
                          {inv?.invoice_number || pay.invoice_id}
                        </div>
                        <div className="text-xs font-semibold text-[#101B35] truncate">
                          {inv?.client?.client_name || '-'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 block">
                          Nominal Dibayar
                        </span>
                        <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                          {formatRupiah(pay.amount)}
                        </span>
                      </div>
                    </div>

                    {pay.notes && (
                      <div className="text-[11px] text-slate-600">
                        {pay.notes}
                      </div>
                    )}

                    {confirmDeleteId === pay.id ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-xs text-red-700 font-semibold">
                          Hapus pembayaran ini?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeletePayment(pay.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPreviewReceipt(pay, inv)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#101B35] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#C5A15B]" />
                            <span>Kwitansi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              generateReceiptPdf(
                                pay,
                                inv,
                                settings,
                                'A4',
                                'download'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#800020] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {inv && (
                            <button
                              type="button"
                              onClick={() => onOpenWhatsAppReceipt(pay, inv)}
                              className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-pointer"
                              title="Kirim WA"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(pay)}
                            className="p-1.5 rounded-lg text-slate-600 bg-slate-100 cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(pay.id)}
                            className="p-1.5 rounded-lg text-red-600 bg-red-50 cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan {paginated.length} dari {filtered.length} riwayat
            pembayaran
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Sebelumnya
            </button>
            <span className="px-2 font-semibold text-[#101B35]">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Formulir Pencatatan Pembayaran"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#101B35] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold">
                  {editingPayment
                    ? `Edit Pembayaran — ${editingPayment.receipt_number}`
                    : 'Catat Pembayaran & Terbitkan Kwitansi'}
                </h3>
                {!editingPayment && (
                  <p className="text-[11px] text-[#C5A15B] font-mono">
                    No. Bukti Berikutnya: {nextReceiptNumberPreview}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup modal pembayaran"
                className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1"
            >
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="pay-invoice-select"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Pilih Nomor Invoice Terkait *
                </label>
                <select
                  id="pay-invoice-select"
                  required
                  disabled={Boolean(editingPayment)}
                  value={selectedInvoiceId}
                  onChange={(e) => handleSelectInvoiceChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020] disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Invoice --</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} —{' '}
                      {inv.client?.client_name || inv.client_id} (Sisa:{' '}
                      {formatRupiah(inv.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Grand Total
                    </span>
                    <span className="font-mono font-bold text-[#101B35] tabular-nums">
                      {formatRupiah(selectedInvoice.grand_total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Sudah Dibayar
                    </span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      {formatRupiah(selectedInvoice.amount_paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Sisa Tagihan
                    </span>
                    <span className="font-mono font-bold text-[#800020] tabular-nums">
                      {formatRupiah(selectedInvoice.balance)}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Scheme Quick Presets */}
              {!editingPayment && selectedInvoice && (
                <div>
                  <span className="block text-xs font-semibold text-[#101B35] mb-1.5">
                    Skema Pembayaran Cepat:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('FULL')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        paymentTypePreset === 'FULL'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Bayar Penuh
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('DP50')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        paymentTypePreset === 'DP50'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('CUSTOM')}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        paymentTypePreset === 'CUSTOM'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Bertahap
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pay-amount-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Jumlah Pembayaran (Rp) *
                  </label>
                  <input
                    id="pay-amount-input"
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setPaymentTypePreset('CUSTOM');
                      setAmount(Math.max(0, Number(e.target.value)));
                    }}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pay-date-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Tanggal Pembayaran *
                  </label>
                  <input
                    id="pay-date-input"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pay-method-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Metode Pembayaran *
                  </label>
                  <select
                    id="pay-method-select"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="pay-ref-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Nomor Referensi / Bukti Transaksi
                  </label>
                  <input
                    id="pay-ref-input"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Contoh: TRF-20261114"
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pay-notes-input"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Catatan Pembayaran
                </label>
                <input
                  id="pay-notes-input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Pembayaran DP 50% / Pelunasan Tahap Akhir"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingPayment
                      ? 'Simpan Perubahan'
                      : 'Simpan & Terbitkan Bukti Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
