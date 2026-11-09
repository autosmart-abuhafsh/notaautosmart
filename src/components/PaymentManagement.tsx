import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  MessageSquare,
  X,
} from 'lucide-react';
import type {
  Invoice,
  Payment,
  PaymentMethod,
  User,
} from '../types/invoice';
import {
  formatDateId,
  formatRupiah,
  getJakartaDateString,
} from '../utils/invoiceLogic';

const PAYMENT_METHODS: PaymentMethod[] = [
  'Transfer Bank',
  'Tunai',
  'QRIS',
  'E-Wallet',
  'Metode lainnya',
];

interface PaymentManagementProps {
  payments: Payment[];
  invoices: Invoice[];
  currentUser: User;
  preselectedInvoice?: Invoice | null;
  onClearPreselectedInvoice?: () => void;
  onRecordPayment: (payload: Record<string, unknown>) => Promise<Payment>;
  onUpdatePayment: (
    id: string,
    payload: Record<string, unknown>
  ) => Promise<Payment>;
  onDeletePayment: (id: string) => Promise<void>;
  onPreviewReceipt: (payment: Payment, invoice?: Invoice) => void;
  onSendReceiptWhatsApp: (payment: Payment, invoice?: Invoice) => void;
}

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  payments,
  invoices,
  currentUser,
  preselectedInvoice,
  onClearPreselectedInvoice,
  onRecordPayment,
  onUpdatePayment,
  onDeletePayment,
  onPreviewReceipt,
  onSendReceiptWhatsApp,
}) => {
  const todayStr = getJakartaDateString();
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Record / Edit Payment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentScheme, setPaymentScheme] = useState<
    'FULL' | 'DP_50' | 'INSTALLMENT'
  >('FULL');
  const [amount, setAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Transfer Bank');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const invoiceMap = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoices) {
      map[inv.id] = inv;
    }
    return map;
  }, [invoices]);

  // Payable invoices (active & has remaining balance, or currently selected)
  const payableInvoices = useMemo(() => {
    return invoices.filter(
      (i) => i.status !== 'Cancelled' && (i.balance > 0 || i.id === selectedInvoiceId)
    );
  }, [invoices, selectedInvoiceId]);

  const targetInvoice = useMemo(
    () => (selectedInvoiceId ? invoiceMap[selectedInvoiceId] : undefined),
    [selectedInvoiceId, invoiceMap]
  );

  // Open automatically when triggered from Invoice row or Header
  useEffect(() => {
    if (preselectedInvoice) {
      openRecordModal(preselectedInvoice);
      onClearPreselectedInvoice?.();
    }
  }, [preselectedInvoice]);

  const openRecordModal = (inv?: Invoice) => {
    setEditingPayment(null);
    const initialInv =
      inv ||
      invoices.find((i) => i.balance > 0 && i.status !== 'Cancelled') ||
      invoices[0];

    setSelectedInvoiceId(initialInv?.id || '');
    setPaymentDate(todayStr);
    setPaymentScheme('FULL');
    setAmount(String(initialInv?.balance || 0));
    setPaymentMethod('Transfer Bank');
    setReferenceNumber(`TRF-${todayStr.replace(/-/g, '')}`);
    setNotes('Pelunasan tagihan invoice');
    setAllowOverpayment(false);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (pay: Payment) => {
    setEditingPayment(pay);
    setSelectedInvoiceId(pay.invoice_id);
    setPaymentDate(pay.payment_date);
    setAmount(String(pay.amount));
    setPaymentMethod(pay.payment_method);
    setReferenceNumber(pay.reference_number);
    setNotes(pay.notes);
    setAllowOverpayment(false);
    setFormError('');
    setModalOpen(true);
  };

  const applyPaymentScheme = (
    scheme: 'FULL' | 'DP_50' | 'INSTALLMENT',
    inv?: Invoice
  ) => {
    setPaymentScheme(scheme);
    const activeInv = inv || targetInvoice;
    if (!activeInv) return;

    if (scheme === 'FULL') {
      setAmount(String(activeInv.balance));
      setNotes(
        activeInv.amount_paid > 0
          ? 'Pelunasan sisa tagihan invoice'
          : 'Pembayaran penuh (100%)'
      );
    } else if (scheme === 'DP_50') {
      const dpAmount = Math.round(activeInv.balance * 0.5);
      setAmount(String(dpAmount));
      setNotes('Pembayaran Down Payment (DP 50%)');
    } else {
      setNotes('Pembayaran termin bertahap');
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numAmount = Math.round(Number(amount) || 0);
    if (numAmount <= 0) {
      setFormError('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    if (!editingPayment && targetInvoice) {
      if (numAmount > targetInvoice.balance && !allowOverpayment) {
        setFormError(
          `Nominal pembayaran (${formatRupiah(numAmount)}) melebihi sisa tagihan (${formatRupiah(targetInvoice.balance)}). Centang konfirmasi jika ingin tetap melanjutkan.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingPayment) {
        await onUpdatePayment(editingPayment.id, {
          payment_date: paymentDate,
          amount: numAmount,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim(),
          notes: notes.trim(),
          allow_overpayment: allowOverpayment,
        });
        setModalOpen(false);
      } else {
        const created = await onRecordPayment({
          invoice_id: selectedInvoiceId,
          payment_date: paymentDate,
          amount: numAmount,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim(),
          notes: notes.trim(),
          allow_overpayment: allowOverpayment,
        });
        setModalOpen(false);
        onPreviewReceipt(created, targetInvoice);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan pembayaran.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (methodFilter !== 'ALL' && pay.payment_method !== methodFilter) {
        return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const inv = invoiceMap[pay.invoice_id];
      const invNum = inv?.invoice_number.toLowerCase() || '';
      const clientName = inv?.client?.client_name.toLowerCase() || '';
      return (
        pay.receipt_number.toLowerCase().includes(q) ||
        invNum.includes(q) ||
        clientName.includes(q) ||
        pay.reference_number.toLowerCase().includes(q) ||
        pay.notes.toLowerCase().includes(q)
      );
    });
  }, [payments, methodFilter, searchQuery, invoiceMap]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#101B35]">
            Manajemen Pembayaran & Bukti Pembayaran (Kwitansi)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catat pembayaran penuh, DP, maupun termin bertahap. Setiap transaksi
            menghasilkan dokumen Bukti Pembayaran tersendiri.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <div className="relative w-full sm:w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari no. bukti atau klien..."
              aria-label="Cari pembayaran"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:bg-white focus:border-[#800020]"
            />
          </div>

          <select
            aria-label="Filter Metode Pembayaran"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020] shrink-0"
          >
            <option value="ALL">Semua Metode</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => openRecordModal()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pembayaran</span>
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-3.5">No. Bukti Pembayaran</th>
                <th className="py-3.5 px-3.5">Invoice & Pelanggan</th>
                <th className="py-3.5 px-3.5">Tanggal</th>
                <th className="py-3.5 px-3.5">Metode & Referensi</th>
                <th className="py-3.5 px-3.5">Catatan</th>
                <th className="py-3.5 px-3.5 text-right">Nominal Diterima</th>
                <th className="py-3.5 px-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedPayments.map((pay) => {
                const inv = invoiceMap[pay.invoice_id];
                return (
                  <tr
                    key={pay.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onPreviewReceipt(pay, inv)}
                        className="font-mono font-bold text-[#101B35] hover:text-[#800020] hover:underline cursor-pointer"
                      >
                        {pay.receipt_number}
                      </button>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-semibold text-[#800020]">
                        {inv?.invoice_number || pay.invoice_id}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-[150px]">
                        {inv?.client?.client_name || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                      {formatDateId(pay.payment_date)}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-medium text-[#101B35]">
                        {pay.payment_method}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {pay.reference_number || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 max-w-[145px] truncate">
                      {pay.notes || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                      {formatRupiah(pay.amount)}
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewReceipt(pay, inv)}
                          title={`Bukti Pembayaran ${pay.receipt_number}`}
                          className="px-2 py-1.5 text-xs font-medium text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Kwitansi</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSendReceiptWhatsApp(pay, inv)}
                          aria-label={`Kirim bukti pembayaran ${pay.receipt_number} via WhatsApp`}
                          title="Kirim Bukti Pembayaran via WhatsApp"
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(pay)}
                          aria-label={`Edit pembayaran ${pay.receipt_number}`}
                          className="p-1.5 text-slate-600 hover:text-[#101B35] hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {currentUser.role === 'Administrator' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(pay)}
                            aria-label={`Hapus pembayaran ${pay.receipt_number}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedPayments.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Belum ada catatan pembayaran yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan {paginatedPayments.length} dari{' '}
            {filteredPayments.length} transaksi pembayaran
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Sebelumnya
            </button>
            <span className="font-mono">
              Halaman {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#101B35] text-white">
              <h3 className="text-sm font-bold">
                {editingPayment
                  ? `Edit Catatan Pembayaran — ${editingPayment.receipt_number}`
                  : 'Catat Pembayaran & Terbitkan Kwitansi'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup form pembayaran"
                className="p-1 text-slate-300 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
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
                  disabled={Boolean(editingPayment)}
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    const invId = e.target.value;
                    setSelectedInvoiceId(invId);
                    const found = invoiceMap[invId];
                    if (found) {
                      setAmount(String(found.balance));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Invoice --</option>
                  {payableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.client?.client_name} (Sisa:{' '}
                      {formatRupiah(inv.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {targetInvoice && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-slate-500">Grand Total</div>
                    <div className="font-mono font-semibold text-[#101B35]">
                      {formatRupiah(targetInvoice.grand_total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sudah Dibayar</div>
                    <div className="font-mono font-semibold text-emerald-700">
                      {formatRupiah(targetInvoice.amount_paid)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Sisa Tagihan</div>
                    <div className="font-mono font-bold text-[#800020]">
                      {formatRupiah(targetInvoice.balance)}
                    </div>
                  </div>
                </div>
              )}

              {!editingPayment && targetInvoice && (
                <div>
                  <div className="text-xs font-semibold text-[#101B35] mb-1.5">
                    Skema Pembayaran Cepat:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPaymentScheme('FULL')}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        paymentScheme === 'FULL'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Bayar Penuh
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPaymentScheme('DP_50')}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        paymentScheme === 'DP_50'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      DP 50%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPaymentScheme('INSTALLMENT')}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        paymentScheme === 'INSTALLMENT'
                          ? 'bg-[#101B35] text-white border-[#101B35]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
                    min={1}
                    step={1000}
                    required
                    disabled={
                      Boolean(editingPayment) &&
                      currentUser.role !== 'Administrator'
                    }
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg disabled:bg-slate-100"
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
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pay-method-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Metode Pembayaran
                  </label>
                  <select
                    id="pay-method-select"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
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
                    Nomor Referensi Transaksi
                  </label>
                  <input
                    id="pay-ref-input"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Contoh: TRF-BCA-00123"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
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
                  placeholder="Contoh: Pembayaran Termin 1 / DP 50%"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              {targetInvoice &&
                Number(amount) > targetInvoice.balance &&
                !editingPayment && (
                  <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowOverpayment}
                      onChange={(e) => setAllowOverpayment(e.target.checked)}
                    />
                    <span>
                      Konfirmasi penanganan khusus: izinkan pembayaran melebihi
                      sisa tagihan.
                    </span>
                  </label>
                )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {submitting
                    ? 'Memproses...'
                    : editingPayment
                      ? 'Simpan Perubahan'
                      : 'Simpan & Terbitkan Bukti Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-[#101B35]">
              Hapus Catatan Pembayaran
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Hapus bukti pembayaran{' '}
              <span className="font-mono font-bold text-[#101B35]">
                {deleteTarget.receipt_number}
              </span>
              ? Status dan sisa tagihan invoice terkait akan diperbarui kembali
              secara otomatis.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeletePayment(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Hapus Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
