import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  CreditCard,
  MessageSquare,
  FileText,
  ArrowLeft,
  Save,
  Download,
  Check,
} from 'lucide-react';
import type {
  Client,
  CompanySettingsMap,
  Invoice,
  InvoiceStatus,
  ServiceItem,
  User,
} from '../types/invoice';
import {
  calculateInvoiceTotals,
  calculateLineItemTotal,
  formatDateId,
  formatRupiah,
  getJakartaDateString,
  resolveInvoiceStatus,
} from '../utils/invoiceLogic';
import { generateInvoicePdf } from '../utils/printDocument';

interface EditableLineItem {
  id: string;
  service_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
}

interface InvoiceManagementProps {
  invoices: Invoice[];
  clients: Client[];
  services: ServiceItem[];
  settings: CompanySettingsMap;
  currentUser: User;
  initialOpenCreate?: boolean;
  onClearInitialCreate?: () => void;
  onCreateInvoice: (payload: Record<string, unknown>) => Promise<Invoice>;
  onUpdateInvoice: (
    id: string,
    payload: Record<string, unknown>
  ) => Promise<Invoice>;
  onDeleteInvoice: (id: string) => Promise<void>;
  onPreviewInvoice: (invoice: Invoice) => void;
  onRecordPaymentForInvoice: (invoice: Invoice) => void;
  onOpenWhatsAppForInvoice: (invoice: Invoice) => void;
}

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'Unpaid', label: 'Belum Dibayar (Unpaid)' },
  { value: 'Partially Paid', label: 'Dibayar Sebagian (DP)' },
  { value: 'Paid', label: 'Lunas (Paid)' },
  { value: 'Overdue', label: 'Jatuh Tempo (Overdue)' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Terkirim (Sent)' },
  { value: 'Cancelled', label: 'Dibatalkan' },
];

export const InvoiceManagement: React.FC<InvoiceManagementProps> = ({
  invoices,
  clients,
  services,
  settings,
  currentUser,
  initialOpenCreate,
  onClearInitialCreate,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onPreviewInvoice,
  onRecordPaymentForInvoice,
  onOpenWhatsAppForInvoice,
}) => {
  const todayStr = getJakartaDateString();
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Form State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(todayStr);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('Unpaid');
  const [notes, setNotes] = useState('');
  const [showNotesField, setShowNotesField] = useState(true);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [additionalCost, setAdditionalCost] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(
    settings.tax_enabled === 'true'
  );
  const [taxRate, setTaxRate] = useState(Number(settings.tax_rate) || 11);
  const [items, setItems] = useState<EditableLineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pdfFeedback, setPdfFeedback] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const handleDirectPdfDownload = (inv: Invoice) => {
    const fileName = generateInvoicePdf(inv, settings, 'download');
    setPdfFeedback(
      `PDF Invoice ${inv.invoice_number} (${fileName}) berhasil diunduh.`
    );
    setTimeout(() => setPdfFeedback(''), 4000);
  };

  // Trigger create form if opened from Header CTA
  useEffect(() => {
    if (initialOpenCreate) {
      openNewInvoiceForm();
      onClearInitialCreate?.();
    }
  }, [initialOpenCreate]);

  const fetchNextInvoiceNumber = async () => {
    try {
      const token =
        localStorage.getItem('autosmart_token') || 'demo-autostart-admin';
      const res = await fetch('/api/invoices/next-number', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoiceNumber(data.nextNumber);
      }
    } catch {
      // fallback
    }
  };

  const openNewInvoiceForm = () => {
    setEditingInvoice(null);
    const defaultClient = clients[0]?.id || '';
    setClientId(defaultClient);
    setIssueDate(todayStr);
    // Default due date +14 days
    const d = new Date(`${todayStr}T00:00:00`);
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
    setInvoiceStatus('Unpaid');
    setNotes(settings.terms_and_conditions || '');
    setShowNotesField(true);
    setOverallDiscount(0);
    setAdditionalCost(0);
    setTaxEnabled(settings.tax_enabled === 'true');
    setTaxRate(Number(settings.tax_rate) || 11);

    const firstService = services.find((s) => s.status === 'Aktif') || services[0];
    setItems([
      {
        id: `row-${Date.now()}`,
        service_id: firstService?.id || '',
        description: firstService
          ? `${firstService.service_name} — ${firstService.description}`
          : 'Layanan Digital Autosmart',
        quantity: 1,
        unit: firstService?.unit || 'Paket',
        unit_price: firstService?.price || 5000000,
        discount: 0,
      },
    ]);
    setFormError('');
    fetchNextInvoiceNumber();
    setViewMode('form');
  };

  const openEditInvoiceForm = (inv: Invoice) => {
    setEditingInvoice(inv);
    setInvoiceNumber(inv.invoice_number);
    setClientId(inv.client_id);
    setIssueDate(inv.issue_date);
    setDueDate(inv.due_date);
    setInvoiceStatus(inv.status);
    setNotes(inv.notes || '');
    setShowNotesField(true);
    setOverallDiscount(inv.discount || 0);
    setAdditionalCost(inv.additional_cost || 0);
    setTaxEnabled((inv.tax_rate || 0) > 0);
    setTaxRate(inv.tax_rate > 0 ? inv.tax_rate : Number(settings.tax_rate) || 11);

    const existingItems: EditableLineItem[] =
      inv.items && inv.items.length > 0
        ? inv.items.map((it) => ({
            id: it.id,
            service_id: it.service_id,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            discount: it.discount || 0,
          }))
        : [
            {
              id: `row-${Date.now()}`,
              service_id: '',
              description: 'Layanan Digital',
              quantity: 1,
              unit: 'Paket',
              unit_price: inv.subtotal || 0,
              discount: 0,
            },
          ];

    setItems(existingItems);
    setFormError('');
    setViewMode('form');
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const calculation = useMemo(() => {
    return calculateInvoiceTotals({
      items,
      overallDiscount,
      additionalCost,
      taxEnabled,
      taxRate,
      amountPaid: editingInvoice?.amount_paid || 0,
    });
  }, [
    items,
    overallDiscount,
    additionalCost,
    taxEnabled,
    taxRate,
    editingInvoice,
  ]);

  const handleAddItem = () => {
    const firstActive =
      services.find((s) => s.status === 'Aktif') || services[0];
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${prev.length + 1}`,
        service_id: firstActive?.id || '',
        description: firstActive
          ? `${firstActive.service_name} — ${firstActive.description}`
          : '',
        quantity: 1,
        unit: firstActive?.unit || 'Paket',
        unit_price: firstActive?.price || 0,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (rowId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== rowId));
  };

  const handleSelectServiceForRow = (rowId: string, srvId: string) => {
    const found = services.find((s) => s.id === srvId);
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (!found) {
          return { ...row, service_id: '' };
        }
        return {
          ...row,
          service_id: found.id,
          description: found.description
            ? `${found.service_name} — ${found.description}`
            : found.service_name,
          unit: found.unit,
          unit_price: found.price,
        };
      })
    );
  };

  const handleUpdateRowField = (
    rowId: string,
    field: keyof EditableLineItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const saveInvoiceAction = async (
    mode: 'draft' | 'save' | 'preview'
  ) => {
    setFormError('');
    if (!clientId) {
      setFormError('Pilih pelanggan terlebih dahulu.');
      return;
    }
    if (items.length === 0 || items.some((i) => !i.description.trim())) {
      setFormError('Setiap baris item harus memiliki deskripsi layanan.');
      return;
    }

    setSubmitting(true);
    try {
      const targetStatus: InvoiceStatus =
        mode === 'draft'
          ? 'Draft'
          : invoiceStatus === 'Draft'
            ? 'Unpaid'
            : invoiceStatus;

      const payload = {
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate,
        status: targetStatus,
        notes,
        discount: calculation.discount,
        additional_cost: calculation.additional_cost,
        tax_rate: taxEnabled ? calculation.tax_rate : 0,
        items: items.map((it) => ({
          id: it.id,
          service_id: it.service_id,
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unit: it.unit.trim() || 'Paket',
          unit_price: Math.round(Number(it.unit_price) || 0),
          discount: Math.round(Number(it.discount) || 0),
        })),
      };

      let saved: Invoice;
      if (editingInvoice) {
        saved = await onUpdateInvoice(editingInvoice.id, payload);
      } else {
        saved = await onCreateInvoice(payload);
      }

      setViewMode('list');
      if (mode === 'preview') {
        onPreviewInvoice(saved);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan invoice.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Invoices for List View
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const effectiveStatus = resolveInvoiceStatus({
        currentStatus: inv.status,
        grandTotal: inv.grand_total,
        amountPaid: inv.amount_paid,
        dueDate: inv.due_date,
        todayDate: todayStr,
      });

      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const clientName = inv.client?.client_name?.toLowerCase() || '';
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        clientName.includes(q) ||
        inv.notes.toLowerCase().includes(q)
      );
    });
  }, [invoices, statusFilter, searchQuery, todayStr]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (viewMode === 'form') {
    return (
      <div className="space-y-6">
        {/* Form Top Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2 text-slate-600 hover:text-[#101B35] hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Kembali ke daftar invoice"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-bold text-[#101B35]">
                {editingInvoice
                  ? `Edit Dokumen Invoice — ${editingInvoice.invoice_number}`
                  : 'Formulir Penerbitan Invoice Baru'}
              </h2>
              <p className="text-xs text-slate-500">
                Nomor dokumen sekuensial dibuat otomatis dan terkunci saat
                diedit.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => saveInvoiceAction('draft')}
              className="px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => saveInvoiceAction('preview')}
              className="px-3.5 py-2 text-xs font-semibold text-[#101B35] border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Simpan & Preview Invoice</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => saveInvoiceAction('save')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Menyimpan...' : 'Simpan Invoice'}</span>
            </button>
          </div>
        </div>

        {formError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {formError}
          </div>
        )}

        {/* Section 1: Informasi Invoice & Pelanggan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informasi Invoice */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
              1. Informasi Dokumen Invoice
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Nomor Invoice Otomatis
                </label>
                <input
                  type="text"
                  readOnly
                  value={invoiceNumber || 'INV/ASM/2026/AUTO'}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-100 border border-slate-200 rounded-lg text-[#101B35]"
                />
              </div>

              <div>
                <label
                  htmlFor="inv-status-select"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Status Dokumen
                </label>
                <select
                  id="inv-status-select"
                  value={invoiceStatus}
                  onChange={(e) =>
                    setInvoiceStatus(e.target.value as InvoiceStatus)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent / Terkirim</option>
                  <option value="Unpaid">Unpaid / Belum Dibayar</option>
                  <option value="Partially Paid">
                    Partially Paid / Dibayar Sebagian
                  </option>
                  <option value="Paid">Paid / Lunas</option>
                  <option value="Overdue">Overdue / Jatuh Tempo</option>
                  <option value="Cancelled">Cancelled / Dibatalkan</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="inv-issue-date"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Tanggal Penerbitan
                </label>
                <input
                  id="inv-issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div>
                <label
                  htmlFor="inv-due-date"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Tanggal Jatuh Tempo
                </label>
                <input
                  id="inv-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
            </div>
          </div>

          {/* Informasi Pelanggan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
              2. Informasi Pelanggan (Bill To)
            </h3>

            <div>
              <label
                htmlFor="inv-client-select"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Pilih Pelanggan dari Database *
              </label>
              <select
                id="inv-client-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              >
                <option value="">-- Pilih Pelanggan --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {selectedClient ? (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-[#101B35]">
                  {selectedClient.client_name}
                </div>
                <div className="text-slate-600">
                  PIC: {selectedClient.contact_person || '-'} · Telp/WA:{' '}
                  <span className="font-mono">
                    {selectedClient.whatsapp || selectedClient.phone || '-'}
                  </span>
                </div>
                <div className="text-slate-600">
                  Email: {selectedClient.email || '-'}
                </div>
                <div className="text-slate-600">
                  Alamat: {selectedClient.address || '-'}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400">
                Silakan pilih pelanggan untuk menampilkan detail kontak dan
                alamat penagihan.
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Daftar Produk / Jasa */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#101B35]">
                3. Rincian Produk & Layanan Digital
              </h3>
              <p className="text-xs text-slate-500">
                Pilih layanan dari katalog atau sesuaikan deskripsi dan harga
                khusus untuk pelanggan ini.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1c2d54] rounded-lg cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A15B]" />
              <span>Tambah Item Layanan</span>
            </button>
          </div>

          {/* Desktop Line-Item Table (lg and up) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-2 w-52">Katalog Layanan</th>
                  <th className="py-2.5 px-2">Deskripsi Layanan</th>
                  <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                  <th className="py-2.5 px-2 w-24">Satuan</th>
                  <th className="py-2.5 px-2 w-36 text-right">
                    Harga Satuan (Rp)
                  </th>
                  <th className="py-2.5 px-2 w-32 text-right">
                    Diskon Item (Rp)
                  </th>
                  <th className="py-2.5 px-2 w-36 text-right">Total Item</th>
                  <th className="py-2.5 px-2 w-12 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {items.map((item, idx) => {
                  const rowTotal = calculateLineItemTotal(
                    item.quantity,
                    item.unit_price,
                    item.discount
                  );
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-3 px-2">
                        <select
                          aria-label={`Pilih layanan baris ${idx + 1}`}
                          value={item.service_id}
                          onChange={(e) =>
                            handleSelectServiceForRow(item.id, e.target.value)
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        >
                          <option value="">-- Kustom / Manual --</option>
                          {services.map((srv) => (
                            <option key={srv.id} value={srv.id}>
                              {srv.service_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          aria-label={`Deskripsi layanan baris ${idx + 1}`}
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateRowField(
                              item.id,
                              'description',
                              e.target.value
                            )
                          }
                          placeholder="Deskripsi rincian pekerjaan"
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quantity baris ${idx + 1}`}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateRowField(
                              item.id,
                              'quantity',
                              Math.max(1, Number(e.target.value) || 1)
                            )
                          }
                          className="w-full px-2 py-2 text-xs font-mono text-center border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          aria-label={`Satuan baris ${idx + 1}`}
                          value={item.unit}
                          onChange={(e) =>
                            handleUpdateRowField(
                              item.id,
                              'unit',
                              e.target.value
                            )
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={`Harga satuan baris ${idx + 1}`}
                          value={item.unit_price}
                          onChange={(e) =>
                            handleUpdateRowField(
                              item.id,
                              'unit_price',
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono text-right border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={`Diskon item baris ${idx + 1}`}
                          value={item.discount}
                          onChange={(e) =>
                            handleUpdateRowField(
                              item.id,
                              'discount',
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="w-full px-2.5 py-2 text-xs font-mono text-right border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                        />
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-semibold text-[#101B35] pt-5 whitespace-nowrap">
                        {formatRupiah(rowTotal)}
                      </td>
                      <td className="py-3 px-2 text-center pt-3.5">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Hapus item baris ${idx + 1}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Stacked Line-Item Cards (below lg) */}
          <div className="lg:hidden space-y-3">
            {items.map((item, idx) => {
              const rowTotal = calculateLineItemTotal(
                item.quantity,
                item.unit_price,
                item.discount
              );
              return (
                <div
                  key={`mobile-${item.id}`}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-mono font-bold text-[#101B35]">
                      Item Layanan #{idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(item.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-30 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Katalog Layanan
                    </label>
                    <select
                      value={item.service_id}
                      onChange={(e) =>
                        handleSelectServiceForRow(item.id, e.target.value)
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                    >
                      <option value="">-- Kustom / Manual --</option>
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.service_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Deskripsi Layanan
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        handleUpdateRowField(
                          item.id,
                          'description',
                          e.target.value
                        )
                      }
                      placeholder="Deskripsi rincian pekerjaan"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jumlah (Qty)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateRowField(
                            item.id,
                            'quantity',
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Satuan
                      </label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) =>
                          handleUpdateRowField(item.id, 'unit', e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Harga Satuan (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleUpdateRowField(
                            item.id,
                            'unit_price',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Diskon Item (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.discount}
                        onChange={(e) =>
                          handleUpdateRowField(
                            item.id,
                            'discount',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">
                      Subtotal Item #{idx + 1}
                    </span>
                    <span className="font-mono font-bold text-sm text-[#101B35]">
                      {formatRupiah(rowTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Catatan & Perhitungan Otomatis */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#101B35]">
                Catatan & Ketentuan Invoice
              </h3>
              <button
                type="button"
                onClick={() => setShowNotesField((v) => !v)}
                className="text-xs font-semibold text-[#800020] hover:underline cursor-pointer"
              >
                {showNotesField ? 'Sembunyikan Catatan' : '+ Tambah Catatan'}
              </button>
            </div>
            {showNotesField && (
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahkan catatan pembayaran, rincian termin DP, atau syarat & ketentuan proyek..."
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            )}
          </div>

          {/* Automatic Calculation Box */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
              Ringkasan Perhitungan Otomatis
            </h3>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">
                Subtotal (Setelah Diskon Item)
              </span>
              <span
                className="font-mono font-semibold text-[#101B35]"
                data-testid="calc-subtotal"
              >
                {formatRupiah(calculation.subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-1">
              <label
                htmlFor="calc-overall-discount"
                className="text-slate-600"
              >
                Diskon Keseluruhan (Rp)
              </label>
              <input
                id="calc-overall-discount"
                type="number"
                min={0}
                step="any"
                value={overallDiscount}
                onChange={(e) =>
                  setOverallDiscount(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-36 px-2.5 py-1.5 text-right font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-1">
              <label htmlFor="calc-additional-cost" className="text-slate-600">
                Biaya Tambahan (Rp)
              </label>
              <input
                id="calc-additional-cost"
                type="number"
                min={0}
                step="any"
                value={additionalCost}
                onChange={(e) =>
                  setAdditionalCost(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-36 px-2.5 py-1.5 text-right font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div className="py-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 font-medium text-[#101B35] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-[#800020] focus:ring-[#800020]"
                  />
                  <span>Aktifkan Pajak (Opsional)</span>
                </label>
                {taxEnabled && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      aria-label="Persentase Pajak"
                      value={taxRate}
                      onChange={(e) =>
                        setTaxRate(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-16 px-2 py-1 text-right font-mono border border-slate-300 rounded"
                    />
                    <span className="font-mono text-slate-600">%</span>
                  </div>
                )}
              </div>

              {taxEnabled && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Nominal Pajak ({taxRate}%)</span>
                  <span className="font-mono font-medium text-[#101B35]">
                    {formatRupiah(calculation.tax_amount)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-[#101B35]">
              <span>Grand Total</span>
              <span
                className="font-mono text-base text-[#101B35]"
                data-testid="calc-grand-total"
              >
                {formatRupiah(calculation.grand_total)}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-700">
              <span>Total Pembayaran Diterima</span>
              <span className="font-mono font-semibold">
                {formatRupiah(calculation.amount_paid)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#800020]">
              <span>Sisa Tagihan</span>
              <span
                className="font-mono text-base"
                data-testid="calc-balance"
              >
                {formatRupiah(calculation.balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Submit Bar (sm:hidden) */}
        <div className="sm:hidden bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => saveInvoiceAction('draft')}
            className="flex-1 py-2.5 px-3 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Simpan Draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => saveInvoiceAction('preview')}
            className="flex-1 py-2.5 px-3 text-xs font-semibold text-[#101B35] border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Preview PDF
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => saveInvoiceAction('save')}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{submitting ? 'Menyimpan...' : 'Simpan Invoice Sekarang'}</span>
          </button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#101B35]">
            Daftar Dokumen Invoice
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola penerbitan invoice, pantau jatuh tempo, cetak PDF A4, dan
            kirim tagihan melalui WhatsApp.
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
              placeholder="Cari nomor invoice atau klien..."
              aria-label="Cari invoice"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:bg-white focus:border-[#800020]"
            />
          </div>

          <select
            aria-label="Filter Status Invoice"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020] shrink-0"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openNewInvoiceForm}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Invoice Baru</span>
          </button>
        </div>
      </div>

      {pdfFeedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-800 text-white text-xs font-medium flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#C5A15B] shrink-0" />
            <span>{pdfFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfFeedback('')}
            className="text-emerald-200 hover:text-white underline text-[11px] cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Invoices Table (Desktop) & Card List (Mobile) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-2.5">Nomor Invoice</th>
                <th className="py-3.5 px-2.5">Pelanggan</th>
                <th className="py-3.5 px-2.5">Tgl Terbit / Tempo</th>
                <th className="py-3.5 px-2.5 text-right">Grand Total</th>
                <th className="py-3.5 px-2.5 text-right">Sudah Dibayar</th>
                <th className="py-3.5 px-2.5 text-right">Sisa Tagihan</th>
                <th className="py-3.5 px-2.5">Status</th>
                <th className="py-3.5 px-2.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedInvoices.map((inv) => {
                const effectiveStatus = resolveInvoiceStatus({
                  currentStatus: inv.status,
                  grandTotal: inv.grand_total,
                  amountPaid: inv.amount_paid,
                  dueDate: inv.due_date,
                  todayDate: todayStr,
                });

                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onPreviewInvoice(inv)}
                        className="font-mono font-bold text-[#101B35] hover:text-[#800020] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#800020] shrink-0" />
                        <span>{inv.invoice_number}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-2.5">
                      <div className="font-semibold text-[#101B35] truncate max-w-[148px]">
                        {inv.client?.client_name || inv.client_id}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[148px]">
                        {inv.client?.contact_person || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-2.5 whitespace-nowrap">
                      <div className="text-slate-700">
                        {formatDateId(inv.issue_date)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Tempo: {formatDateId(inv.due_date)}
                      </div>
                    </td>
                    <td className="py-3.5 px-2.5 text-right font-mono tabular-nums font-semibold text-[#101B35] whitespace-nowrap">
                      {formatRupiah(inv.grand_total)}
                    </td>
                    <td className="py-3.5 px-2.5 text-right font-mono tabular-nums text-emerald-700 font-medium whitespace-nowrap">
                      {formatRupiah(inv.amount_paid)}
                    </td>
                    <td className="py-3.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#800020] whitespace-nowrap">
                      {formatRupiah(inv.balance)}
                    </td>
                    <td className="py-3.5 px-2.5 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          effectiveStatus === 'Paid'
                            ? 'text-emerald-700'
                            : effectiveStatus === 'Partially Paid'
                              ? 'text-amber-700'
                              : effectiveStatus === 'Overdue'
                                ? 'text-rose-700'
                                : effectiveStatus === 'Cancelled'
                                  ? 'text-slate-400'
                                  : 'text-[#101B35]'
                        }`}
                      >
                        {effectiveStatus === 'Paid'
                          ? 'Lunas'
                          : effectiveStatus === 'Partially Paid'
                            ? 'Dibayar Sebagian'
                            : effectiveStatus === 'Overdue'
                              ? 'Jatuh Tempo'
                              : effectiveStatus === 'Draft'
                                ? 'Draft'
                                : effectiveStatus === 'Sent'
                                  ? 'Terkirim'
                                  : effectiveStatus === 'Cancelled'
                                    ? 'Dibatalkan'
                                    : 'Belum Dibayar'}
                      </span>
                    </td>
                    <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(inv)}
                          title={`Preview & Cetak ${inv.invoice_number}`}
                          className="px-2 py-1.5 text-xs font-medium text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDirectPdfDownload(inv)}
                          title={`Download PDF ${inv.invoice_number}`}
                          className="px-2 py-1.5 text-xs font-semibold text-[#101B35] border border-slate-200 hover:bg-slate-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#800020]" />
                          <span>PDF</span>
                        </button>

                        {inv.balance > 0 && inv.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => onRecordPaymentForInvoice(inv)}
                            title={`Catat pembayaran ${inv.invoice_number}`}
                            className="px-2 py-1.5 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-md inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Bayar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenWhatsAppForInvoice(inv)}
                          aria-label={`Kirim WhatsApp ${inv.invoice_number}`}
                          title="Kirim pesan WhatsApp ke pelanggan"
                          className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditInvoiceForm(inv)}
                          aria-label={`Edit invoice ${inv.invoice_number}`}
                          title="Edit Invoice"
                          className="p-1.5 text-slate-600 hover:text-[#101B35] hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {currentUser.role === 'Administrator' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(inv)}
                            aria-label={`Hapus invoice ${inv.invoice_number}`}
                            title="Hapus Invoice"
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

              {paginatedInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Tidak ada dokumen invoice yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Invoice Card View (HP / Smartphone) */}
        <div className="md:hidden divide-y divide-slate-200">
          {paginatedInvoices.map((inv) => {
            const effectiveStatus = resolveInvoiceStatus({
              currentStatus: inv.status,
              grandTotal: inv.grand_total,
              amountPaid: inv.amount_paid,
              dueDate: inv.due_date,
              todayDate: todayStr,
            });

            return (
              <div key={`m-card-${inv.id}`} className="p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => onPreviewInvoice(inv)}
                      className="font-mono font-bold text-sm text-[#101B35] hover:text-[#800020] flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-[#800020] shrink-0" />
                      <span>{inv.invoice_number}</span>
                    </button>
                    <div className="font-semibold text-[#101B35] mt-1">
                      {inv.client?.client_name || inv.client_id}
                    </div>
                  </div>

                  <span
                    className={`font-bold text-[11px] uppercase tracking-wider shrink-0 ${
                      effectiveStatus === 'Paid'
                        ? 'text-emerald-700'
                        : effectiveStatus === 'Partially Paid'
                          ? 'text-amber-700'
                          : effectiveStatus === 'Overdue'
                            ? 'text-rose-700'
                            : 'text-[#101B35]'
                    }`}
                  >
                    {effectiveStatus === 'Paid'
                      ? 'LUNAS'
                      : effectiveStatus === 'Partially Paid'
                        ? 'SEBAGIAN (DP)'
                        : effectiveStatus === 'Overdue'
                          ? 'JATUH TEMPO'
                          : 'BELUM DIBAYAR'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Terbit: {formatDateId(inv.issue_date)}</span>
                  <span>Tempo: {formatDateId(inv.due_date)}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div>
                    <div className="text-[10px] text-slate-500">Grand Total</div>
                    <div className="font-mono font-semibold text-[#101B35] mt-0.5">
                      {formatRupiah(inv.grand_total)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Dibayar</div>
                    <div className="font-mono font-medium text-emerald-700 mt-0.5">
                      {formatRupiah(inv.amount_paid)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Sisa</div>
                    <div className="font-mono font-bold text-[#800020] mt-0.5">
                      {formatRupiah(inv.balance)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onPreviewInvoice(inv)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectPdfDownload(inv)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-[#101B35] border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#800020]" />
                    <span>Cetak PDF</span>
                  </button>

                  {inv.balance > 0 && inv.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => onRecordPaymentForInvoice(inv)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Bayar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenWhatsAppForInvoice(inv)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditInvoiceForm(inv)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })}

          {paginatedInvoices.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada dokumen invoice yang ditemukan.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan {paginatedInvoices.length} dari{' '}
            {filteredInvoices.length} invoice
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

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-[#101B35]">
              Hapus Dokumen Invoice
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Apakah Anda yakin ingin menghapus invoice{' '}
              <span className="font-mono font-bold text-[#101B35]">
                {deleteTarget.invoice_number}
              </span>{' '}
              beserta catatan item dan pembayarannya?
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
                  await onDeleteInvoice(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Hapus Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
