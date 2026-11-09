import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  History,
  X,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import type { Client, Invoice, Payment } from '../types/invoice';
import { formatDateId, formatRupiah } from '../utils/invoiceLogic';

interface ClientManagementProps {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  onCreateClient: (payload: Partial<Client>) => Promise<void>;
  onUpdateClient: (id: string, payload: Partial<Client>) => Promise<void>;
  onDeleteClient: (id: string) => Promise<void>;
  onPreviewInvoice: (invoice: Invoice) => void;
}

export const ClientManagement: React.FC<ClientManagementProps> = ({
  clients,
  invoices,
  payments,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  onPreviewInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Form Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // History Modal State
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const clientFinancialMap = useMemo(() => {
    const map: Record<
      string,
      {
        invoiceCount: number;
        totalTransaction: number;
        totalPaid: number;
        totalBalance: number;
      }
    > = {};

    for (const c of clients) {
      const clientInvs = invoices.filter(
        (inv) => inv.client_id === c.id && inv.status !== 'Cancelled'
      );
      const totalTransaction = clientInvs.reduce(
        (s, i) => s + i.grand_total,
        0
      );
      const totalPaid = clientInvs.reduce((s, i) => s + i.amount_paid, 0);
      const totalBalance = clientInvs.reduce((s, i) => s + i.balance, 0);

      map[c.id] = {
        invoiceCount: clientInvs.length,
        totalTransaction,
        totalPaid,
        totalBalance,
      };
    }
    return map;
  }, [clients, invoices]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.contact_person.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const openCreateModal = () => {
    setEditingClient(null);
    setClientName('');
    setContactPerson('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setAddress('');
    setNotes('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setClientName(client.client_name);
    setContactPerson(client.contact_person);
    setPhone(client.phone);
    setWhatsapp(client.whatsapp);
    setEmail(client.email);
    setAddress(client.address);
    setNotes(client.notes);
    setFormError('');
    setFormOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!clientName.trim()) {
      setFormError('Nama pelanggan / perusahaan wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_name: clientName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        whatsapp: (whatsapp.trim() || phone.trim()),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
      };
      if (editingClient) {
        await onUpdateClient(editingClient.id, payload);
      } else {
        await onCreateClient(payload);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan data pelanggan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await onDeleteClient(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Gagal menghapus pelanggan.'
      );
    }
  };

  const clientInvoices = useMemo(() => {
    if (!historyClient) return [];
    return invoices.filter((i) => i.client_id === historyClient.id);
  }, [historyClient, invoices]);

  const clientPayments = useMemo(() => {
    if (!historyClient) return [];
    const invIds = new Set(clientInvoices.map((i) => i.id));
    return payments.filter((p) => invIds.has(p.invoice_id));
  }, [historyClient, clientInvoices, payments]);

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#101B35]">
            Manajemen Pelanggan & Klien Korporat
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola informasi kontak, riwayat invoice, total pembayaran, dan sisa
            tagihan setiap klien.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama, kontak, atau ID klien..."
              aria-label="Cari pelanggan"
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:bg-white focus:border-[#800020]"
            />
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-4">ID Klien</th>
                <th className="py-3.5 px-4">Nama Pelanggan / Perusahaan</th>
                <th className="py-3.5 px-4">Kontak & WhatsApp</th>
                <th className="py-3.5 px-4 text-right">Total Transaksi</th>
                <th className="py-3.5 px-4 text-right">Total Dibayar</th>
                <th className="py-3.5 px-4 text-right">Sisa Tagihan</th>
                <th className="py-3.5 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedClients.map((client) => {
                const stats = clientFinancialMap[client.id] || {
                  invoiceCount: 0,
                  totalTransaction: 0,
                  totalPaid: 0,
                  totalBalance: 0,
                };
                return (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#101B35] whitespace-nowrap">
                      {client.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#101B35]">
                        {client.client_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {client.contact_person || '-'} · Terdaftar{' '}
                        {formatDateId(client.created_at)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-slate-700">
                        {client.whatsapp || client.phone || '-'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {client.email || '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-[#101B35] whitespace-nowrap">
                      {formatRupiah(stats.totalTransaction)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700 whitespace-nowrap">
                      {formatRupiah(stats.totalPaid)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#800020] whitespace-nowrap">
                      {formatRupiah(stats.totalBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryClient(client)}
                          title={`Riwayat transaksi ${client.client_name}`}
                          className="px-2.5 py-1.5 text-xs font-medium text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Riwayat ({stats.invoiceCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(client)}
                          aria-label={`Edit pelanggan ${client.client_name}`}
                          className="p-1.5 text-slate-600 hover:text-[#101B35] hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(client);
                          }}
                          aria-label={`Hapus pelanggan ${client.client_name}`}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedClients.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Belum ada data pelanggan yang sesuai dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan {paginatedClients.length} dari {filteredClients.length}{' '}
            pelanggan
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

      {/* Add / Edit Client Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#101B35] text-white">
              <h3 id="client-modal-title" className="text-sm font-bold">
                {editingClient
                  ? `Edit Pelanggan — ${editingClient.id}`
                  : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup form pelanggan"
                className="p-1 text-slate-300 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-name-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Nama Pelanggan / Perusahaan *
                  </label>
                  <input
                    id="client-name-input"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Contoh: PT Maju Digital Nusantara"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-contact-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Nama Kontak (PIC)
                  </label>
                  <input
                    id="client-contact-input"
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Nama penanggung jawab"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-email-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="client-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@perusahaan.co.id"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-phone-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Nomor Telepon
                  </label>
                  <input
                    id="client-phone-input"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-wa-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    id="client-wa-input"
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="62812xxxxxxxx"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-address-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Alamat Lengkap
                  </label>
                  <textarea
                    id="client-address-input"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Alamat lengkap perusahaan atau domisili klien"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-notes-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Catatan Tambahan
                  </label>
                  <input
                    id="client-notes-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan khusus kontrak atau preferensi klien"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Data Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Transaction History Modal */}
      {historyClient && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#101B35] text-white">
              <div>
                <h3 className="text-sm font-bold">
                  Riwayat Transaksi & Tagihan — {historyClient.client_name}
                </h3>
                <p className="text-[11px] text-[#C5A15B]">
                  ID Pelanggan: {historyClient.id} · PIC:{' '}
                  {historyClient.contact_person || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryClient(null)}
                aria-label="Tutup riwayat pelanggan"
                className="p-1 text-slate-300 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Contact & Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">
                    Total Nilai Transaksi
                  </div>
                  <div className="text-lg font-bold font-mono text-[#101B35] mt-1">
                    {formatRupiah(
                      clientFinancialMap[historyClient.id]?.totalTransaction ||
                        0
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">
                    Total Pembayaran Diterima
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                    {formatRupiah(
                      clientFinancialMap[historyClient.id]?.totalPaid || 0
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">
                    Sisa Tagihan Aktif
                  </div>
                  <div className="text-lg font-bold font-mono text-[#800020] mt-1">
                    {formatRupiah(
                      clientFinancialMap[historyClient.id]?.totalBalance || 0
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">
                    {historyClient.whatsapp || historyClient.phone || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{historyClient.email || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {historyClient.address || '-'}
                  </span>
                </div>
              </div>

              {/* Client Invoices Table */}
              <div>
                <h4 className="text-xs font-bold text-[#101B35] mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#800020]" />
                  <span>Daftar Invoice ({clientInvoices.length})</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                        <th className="py-2.5 px-3">No. Invoice</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3 text-right">Grand Total</th>
                        <th className="py-2.5 px-3 text-right">Dibayar</th>
                        <th className="py-2.5 px-3 text-right">Sisa</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {clientInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#101B35]">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {formatDateId(inv.issue_date)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {formatRupiah(inv.grand_total)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                            {formatRupiah(inv.amount_paid)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#800020]">
                            {formatRupiah(inv.balance)}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {inv.status}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryClient(null);
                                onPreviewInvoice(inv);
                              }}
                              className="text-[#800020] hover:underline font-semibold cursor-pointer"
                            >
                              Lihat Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                      {clientInvoices.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-6 text-center text-slate-400"
                          >
                            Belum ada invoice untuk pelanggan ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Client Payments History */}
              <div>
                <h4 className="text-xs font-bold text-[#101B35] mb-2.5">
                  Riwayat Pembayaran ({clientPayments.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                        <th className="py-2.5 px-3">No. Bukti</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Metode</th>
                        <th className="py-2.5 px-3">Catatan</th>
                        <th className="py-2.5 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {clientPayments.map((pay) => (
                        <tr key={pay.id}>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#101B35]">
                            {pay.receipt_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {formatDateId(pay.payment_date)}
                          </td>
                          <td className="py-2.5 px-3">{pay.payment_method}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {pay.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                            {formatRupiah(pay.amount)}
                          </td>
                        </tr>
                      ))}
                      {clientPayments.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-6 text-center text-slate-400"
                          >
                            Belum ada pembayaran tercatat.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-[#101B35]">
              Konfirmasi Hapus Pelanggan
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Apakah Anda yakin ingin menghapus data pelanggan{' '}
              <span className="font-semibold text-[#101B35]">
                {deleteTarget.client_name}
              </span>
              ?
            </p>
            {deleteError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {deleteError}
              </div>
            )}
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
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Hapus Pelanggan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
