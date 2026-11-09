import React, { useMemo, useState } from 'react';
import { Plus, Search, Edit3, Trash2, X } from 'lucide-react';
import type { ServiceItem } from '../types/invoice';
import { formatRupiah } from '../utils/invoiceLogic';

export const AUTOSMART_CATEGORIES = [
  'Website Profesional',
  'Landing Page',
  'Website Company Profile',
  'Website E-Commerce',
  'Website Travel & Umroh',
  'Digital Marketing',
  'Google Apps Script Application',
  'Business Dashboard',
  'CRM System',
  'Web Application',
  'Sistem Otomatisasi Bisnis',
  'Manajemen Keuangan',
  'Analisis Keuangan',
  'Maintenance Website',
  'Jasa Pengembangan Aplikasi',
  'Layanan Digital Lainnya',
];

interface ServiceManagementProps {
  services: ServiceItem[];
  onCreateService: (payload: Partial<ServiceItem>) => Promise<void>;
  onUpdateService: (id: string, payload: Partial<ServiceItem>) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
}

export const ServiceManagement: React.FC<ServiceManagementProps> = ({
  services,
  onCreateService,
  onUpdateService,
  onDeleteService,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [serviceName, setServiceName] = useState('');
  const [category, setCategory] = useState(AUTOSMART_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Paket');
  const [price, setPrice] = useState('5000000');
  const [status, setStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      if (selectedCategory !== 'ALL' && srv.category !== selectedCategory) {
        return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        srv.service_name.toLowerCase().includes(q) ||
        srv.category.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        srv.id.toLowerCase().includes(q)
      );
    });
  }, [services, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const openCreateModal = () => {
    setEditingService(null);
    setServiceName('');
    setCategory(AUTOSMART_CATEGORIES[0]);
    setDescription('');
    setUnit('Paket');
    setPrice('5000000');
    setStatus('Aktif');
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (srv: ServiceItem) => {
    setEditingService(srv);
    setServiceName(srv.service_name);
    setCategory(srv.category);
    setDescription(srv.description);
    setUnit(srv.unit);
    setPrice(String(srv.price));
    setStatus(srv.status);
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!serviceName.trim()) {
      setFormError('Nama produk / layanan wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<ServiceItem> = {
        service_name: serviceName.trim(),
        category,
        description: description.trim(),
        unit: unit.trim() || 'Paket',
        price: Math.max(0, Math.round(Number(price) || 0)),
        status,
      };
      if (editingService) {
        await onUpdateService(editingService.id, payload);
      } else {
        await onCreateService(payload);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan layanan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#101B35]">
            Katalog Produk & Layanan Autosmart
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Harga di katalog merupakan harga acuan standar dan tetap dapat
            disesuaikan secara fleksibel saat membuat invoice pelanggan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama atau kategori layanan..."
              aria-label="Cari layanan"
              className="w-full sm:w-56 pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:bg-white focus:border-[#800020]"
            />
          </div>

          <select
            aria-label="Filter Kategori Layanan"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020]"
          >
            <option value="ALL">Semua Kategori ({services.length})</option>
            {AUTOSMART_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Layanan</span>
          </button>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Nama Layanan & Deskripsi</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Satuan</th>
                <th className="py-3.5 px-4 text-right">Harga Standar</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedServices.map((srv) => (
                <tr
                  key={srv.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#101B35] whitespace-nowrap">
                    {srv.id}
                  </td>
                  <td className="py-3.5 px-4 max-w-md">
                    <div className="font-semibold text-[#101B35]">
                      {srv.service_name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {srv.description || '-'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                    {srv.category}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    {srv.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#101B35] whitespace-nowrap">
                    {formatRupiah(srv.price)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        srv.status === 'Aktif'
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {srv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(srv)}
                        aria-label={`Edit layanan ${srv.service_name}`}
                        className="p-1.5 text-slate-600 hover:text-[#101B35] hover:bg-slate-100 rounded-md cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(srv)}
                        aria-label={`Hapus layanan ${srv.service_name}`}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedServices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-slate-500"
                  >
                    Tidak ada layanan yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan {paginatedServices.length} dari{' '}
            {filteredServices.length} layanan
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

      {/* Create / Edit Service Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#101B35] text-white">
              <h3 className="text-sm font-bold">
                {editingService
                  ? `Edit Layanan — ${editingService.id}`
                  : 'Tambah Produk / Layanan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup form layanan"
                className="p-1 text-slate-300 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="srv-name-input"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Nama Produk / Layanan *
                </label>
                <input
                  id="srv-name-input"
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Contoh: Pembuatan Website Company Profile Korporat"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="srv-cat-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Kategori Layanan
                  </label>
                  <select
                    id="srv-cat-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  >
                    {AUTOSMART_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="srv-unit-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Satuan Layanan
                  </label>
                  <input
                    id="srv-unit-input"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Paket / Sistem / Bulan / Tahun"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="srv-price-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Harga Standar (Rp) *
                  </label>
                  <input
                    id="srv-price-input"
                    type="number"
                    min={0}
                    step={1000}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="srv-status-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Status Katalog
                  </label>
                  <select
                    id="srv-status-select"
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as 'Aktif' | 'Nonaktif')
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="srv-desc-input"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Deskripsi Ruang Lingkup Layanan
                </label>
                <textarea
                  id="srv-desc-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rincian spesifikasi layanan yang akan tampil otomatis saat dipilih pada invoice"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
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
                  {submitting ? 'Menyimpan...' : 'Simpan Layanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-[#101B35]">
              Hapus Layanan dari Katalog
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Hapus layanan{' '}
              <span className="font-semibold text-[#101B35]">
                {deleteTarget.service_name}
              </span>{' '}
              dari katalog? Invoice yang sudah diterbitkan sebelumnya tidak akan
              terpengaruh.
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
                  await onDeleteService(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Hapus Layanan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
