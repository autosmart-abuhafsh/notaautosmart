import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X,
} from 'lucide-react';
import type { Client, Invoice } from '../types/invoice';
import { formatRupiah } from '../utils/invoiceLogic';

interface ClientManagementProps {
  clients: Client[];
  invoices: Invoice[];
  onCreateClient: (payload: Omit<Client, 'id' | 'created_at'>) => Promise<void>;
  onUpdateClient: (
    id: string,
    payload: Omit<Client, 'id' | 'created_at'>
  ) => Promise<void>;
  onDeleteClient: (id: string) => Promise<void>;
}

const EMPTY_FORM = {
  client_name: '',
  contact_person: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  notes: '',
};

export const ClientManagement: React.FC<ClientManagementProps> = ({
  clients,
  invoices,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.contact_person.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const clientStats = useMemo(() => {
    const map: Record<string, { count: number; totalBilled: number }> = {};
    for (const inv of invoices) {
      if (inv.status === 'Cancelled') continue;
      if (!map[inv.client_id]) {
        map[inv.client_id] = { count: 0, totalBilled: 0 };
      }
      map[inv.client_id].count += 1;
      map[inv.client_id].totalBilled += Number(inv.grand_total) || 0;
    }
    return map;
  }, [invoices]);

  const openAddModal = () => {
    setEditingClient(null);
    setFormData(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name,
      contact_person: client.contact_person,
      phone: client.phone,
      whatsapp: client.whatsapp,
      email: client.email,
      address: client.address,
      notes: client.notes,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.client_name.trim()) {
      setError('Nama pelanggan / perusahaan wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await onUpdateClient(editingClient.id, formData);
      } else {
        await onCreateClient(formData);
      }
      setModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan data pelanggan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setError('');
    try {
      await onDeleteClient(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menghapus pelanggan.'
      );
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-sm font-bold text-[#101B35]">
            Daftar Pelanggan & Mitra Korporat
          </h2>
          <p className="text-xs text-slate-500">
            Kelola profil perusahaan klien, kontak PIC, alamat penagihan, dan
            nomor WhatsApp.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama klien, PIC, telepon..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pelanggan Baru</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Client Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500">
            Tidak ada data pelanggan yang sesuai dengan pencarian.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">ID</th>
                    <th className="py-3 px-4">Nama Pelanggan / Perusahaan</th>
                    <th className="py-3 px-4">Contact Person (PIC)</th>
                    <th className="py-3 px-4">Kontak & WhatsApp</th>
                    <th className="py-3 px-4">Alamat</th>
                    <th className="py-3 px-4 text-right">Riwayat Transaksi</th>
                    <th className="py-3 px-5 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {paginated.map((client) => {
                    const stats = clientStats[client.id] || {
                      count: 0,
                      totalBilled: 0,
                    };
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap">
                          {client.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#101B35]">
                            {client.client_name}
                          </div>
                          {client.notes && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {client.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {client.contact_person || '-'}
                        </td>
                        <td className="py-3.5 px-4 space-y-0.5">
                          {client.whatsapp && (
                            <div className="flex items-center gap-1.5 font-mono text-slate-700">
                              <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span>{client.whatsapp}</span>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{client.email}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              {client.address || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-semibold text-[#101B35] tabular-nums">
                            {formatRupiah(stats.totalBilled)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {stats.count} invoice
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          {confirmDeleteId === client.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(client.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(client)}
                                title="Edit Pelanggan"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-[#101B35] hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(client.id)}
                                title="Hapus Pelanggan"
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
              {paginated.map((client) => {
                const stats = clientStats[client.id] || {
                  count: 0,
                  totalBilled: 0,
                };
                return (
                  <div key={client.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-slate-400">
                          {client.id}
                        </span>
                        <div className="text-sm font-bold text-[#101B35] break-words">
                          {client.client_name}
                        </div>
                        {client.contact_person && (
                          <div className="text-xs text-slate-600">
                            PIC: {client.contact_person}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-bold text-[#101B35] tabular-nums">
                          {formatRupiah(stats.totalBilled)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {stats.count} invoice
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600">
                      {(client.whatsapp || client.phone) && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{client.whatsapp || client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1.5 break-all">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {client.address && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{client.address}</span>
                        </div>
                      )}
                    </div>

                    {confirmDeleteId === client.id ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-xs text-red-700 font-semibold">
                          Hapus pelanggan ini?
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(client.id)}
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
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(client)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#101B35] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(client.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan {paginated.length} dari {filtered.length} pelanggan
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

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={
            editingClient ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'
          }
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 bg-[#101B35] text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold">
                {editingClient
                  ? `Edit Pelanggan — ${editingClient.id}`
                  : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup modal"
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
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, client_name: e.target.value })
                    }
                    placeholder="Contoh: PT Nusantara Logistik Mandiri"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-pic-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Contact Person (PIC)
                  </label>
                  <input
                    id="client-pic-input"
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_person: e.target.value,
                      })
                    }
                    placeholder="Nama penanggung jawab"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-email-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Alamat Email
                  </label>
                  <input
                    id="client-email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="billing@perusahaan.co.id"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
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
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="081234567890"
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
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
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp: e.target.value })
                    }
                    placeholder="6281234567890"
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-address-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Alamat Lengkap Penagihan
                  </label>
                  <textarea
                    id="client-address-input"
                    rows={2}
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Jalan, Gedung, Kota, Provinsi"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-notes-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Catatan Pelanggan
                  </label>
                  <input
                    id="client-notes-input"
                    type="text"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Catatan proyek atau preferensi penagihan"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
