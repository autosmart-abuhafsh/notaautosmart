import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Tag,
  FolderCog,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { ServiceCategory, ServiceItem } from '../types/invoice';
import { formatRupiah } from '../utils/invoiceLogic';

interface ServiceManagementProps {
  services: ServiceItem[];
  categories: ServiceCategory[];
  onCreateService: (
    payload: Omit<ServiceItem, 'id' | 'created_at'>
  ) => Promise<void>;
  onUpdateService: (
    id: string,
    payload: Omit<ServiceItem, 'id' | 'created_at'>
  ) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onAddCategory: (categoryName: string) => Promise<void>;
  onRenameCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (
    categoryName: string,
    fallbackCategory?: string
  ) => Promise<void>;
  onResetCategories: () => Promise<void>;
}

const UNIT_OPTIONS = [
  'Paket',
  'Proyek',
  'Sistem',
  'Halaman',
  'Bulan',
  'Tahun',
  'Laporan',
  'Sesi',
  'Item',
  'Jam',
];

export const ServiceManagement: React.FC<ServiceManagementProps> = ({
  services,
  categories,
  onCreateService,
  onUpdateService,
  onDeleteService,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onResetCategories,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const defaultCategory = categories[0] || 'Website Profesional';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [formData, setFormData] = useState({
    service_name: '',
    category: defaultCategory,
    description: '',
    unit: 'Paket',
    price: 0,
    status: 'Aktif' as 'Aktif' | 'Nonaktif',
  });
  const [isAddingCustomCategoryInForm, setIsAddingCustomCategoryInForm] =
    useState(false);
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Category Management Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editingCatValue, setEditingCatValue] = useState('');
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState('');

  const categoryUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of categories) counts[c] = 0;
    for (const s of services) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [categories, services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const matchCat =
        selectedCategory === 'ALL' || s.category === selectedCategory;
      const matchSearch =
        !q ||
        s.service_name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [services, search, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAddModal = () => {
    setEditingService(null);
    setFormData({
      service_name: '',
      category:
        selectedCategory !== 'ALL' && categories.includes(selectedCategory)
          ? selectedCategory
          : categories[0] || 'Website Profesional',
      description: '',
      unit: 'Paket',
      price: 2500000,
      status: 'Aktif',
    });
    setIsAddingCustomCategoryInForm(false);
    setCustomCategoryDraft('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (srv: ServiceItem) => {
    setEditingService(srv);
    setFormData({
      service_name: srv.service_name,
      category: srv.category,
      description: srv.description,
      unit: srv.unit,
      price: srv.price,
      status: srv.status,
    });
    setIsAddingCustomCategoryInForm(false);
    setCustomCategoryDraft('');
    setError('');
    setModalOpen(true);
  };

  const handleQuickAddCategoryInForm = async () => {
    const clean = customCategoryDraft.trim();
    if (!clean) return;
    setSaving(true);
    setError('');
    try {
      await onAddCategory(clean);
      setFormData((prev) => ({ ...prev, category: clean }));
      setIsAddingCustomCategoryInForm(false);
      setCustomCategoryDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menambahkan kategori baru.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.service_name.trim()) {
      setError('Nama layanan digital wajib diisi.');
      return;
    }
    if (formData.price < 0) {
      setError('Harga layanan tidak boleh bernilai negatif.');
      return;
    }

    setSaving(true);
    try {
      if (editingService) {
        await onUpdateService(editingService.id, formData);
      } else {
        await onCreateService(formData);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan layanan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim();
    if (!clean) {
      setCatError('Nama kategori tidak boleh kosong.');
      return;
    }
    setCatBusy(true);
    setCatError('');
    try {
      await onAddCategory(clean);
      setNewCategoryInput('');
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal menambah kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleSaveRenameCategory = async (oldName: string) => {
    const clean = editingCatValue.trim();
    if (!clean || clean === oldName) {
      setEditingCatName(null);
      return;
    }
    setCatBusy(true);
    setCatError('');
    try {
      await onRenameCategory(oldName, clean);
      if (selectedCategory === oldName) {
        setSelectedCategory(clean);
      }
      setEditingCatName(null);
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal mengubah nama kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleConfirmDeleteCategory = async (catName: string) => {
    setCatBusy(true);
    setCatError('');
    try {
      const fallback =
        categories.find((c) => c !== catName) || 'Layanan Digital Lainnya';
      await onDeleteCategory(catName, fallback);
      if (selectedCategory === catName) {
        setSelectedCategory('ALL');
      }
      setConfirmDeleteCat(null);
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal menghapus kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-sm font-bold text-[#101B35]">
            Katalog Produk & Layanan Digital ({categories.length} Kategori)
          </h2>
          <p className="text-xs text-slate-500">
            Kelola daftar layanan, kategori fleksibel, deskripsi standar,
            satuan, dan tarif referensi untuk pembuatan invoice otomatis.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama atau kategori..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>

          <select
            aria-label="Filter kategori layanan"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-[#101B35] focus:outline-none focus:border-[#800020]"
          >
            <option value="ALL">Semua Kategori ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCatError('');
                setEditingCatName(null);
                setConfirmDeleteCat(null);
                setCategoryModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              <FolderCog className="w-4 h-4 text-[#800020]" />
              <span>Kelola Kategori</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Layanan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Services Table & Mobile Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-slate-500">
            Tidak ada layanan yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-5">ID</th>
                    <th className="py-3 px-4">Nama Layanan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Deskripsi Standar</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4 text-right">Harga Standar</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {paginated.map((srv) => (
                    <tr
                      key={srv.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap">
                        {srv.id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#101B35]">
                        {srv.service_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-100 text-[#101B35] text-[11px] font-medium whitespace-nowrap">
                          <Tag className="w-3 h-3 text-[#800020]" />
                          <span>{srv.category}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                        <span className="line-clamp-2">
                          {srv.description || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {srv.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#101B35] tabular-nums whitespace-nowrap">
                        {formatRupiah(srv.price)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            srv.status === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {srv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {confirmDeleteId === srv.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteService(srv.id);
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
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(srv)}
                              title="Edit Layanan"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-[#101B35] hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(srv.id)}
                              title="Hapus Layanan"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {paginated.map((srv) => (
                <div key={srv.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-slate-400">
                        {srv.id}
                      </span>
                      <div className="text-sm font-bold text-[#101B35] break-words">
                        {srv.service_name}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        srv.status === 'Aktif'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {srv.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[#101B35] text-[11px] font-medium">
                      <Tag className="w-3 h-3 text-[#800020] shrink-0" />
                      <span className="truncate">{srv.category}</span>
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-[#101B35] tabular-nums">
                        {formatRupiah(srv.price)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {' '}
                        / {srv.unit}
                      </span>
                    </div>
                  </div>

                  {srv.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {srv.description}
                    </p>
                  )}

                  {confirmDeleteId === srv.id ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-red-700 font-semibold">
                        Hapus layanan ini?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteService(srv.id);
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
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(srv)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#101B35] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(srv.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan {paginated.length} dari {filtered.length} layanan
            digital
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

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={
            editingService ? 'Edit Layanan Digital' : 'Tambah Layanan Baru'
          }
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 bg-[#101B35] text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold">
                {editingService
                  ? `Edit Layanan — ${editingService.id}`
                  : 'Tambah Layanan Digital Baru'}
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

              <div>
                <label
                  htmlFor="srv-name-input"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Nama Layanan Digital *
                </label>
                <input
                  id="srv-name-input"
                  type="text"
                  required
                  value={formData.service_name}
                  onChange={(e) =>
                    setFormData({ ...formData, service_name: e.target.value })
                  }
                  placeholder="Contoh: Website Profesional Korporasi"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="srv-category-select"
                      className="block text-xs font-semibold text-[#101B35]"
                    >
                      Kategori Layanan *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setIsAddingCustomCategoryInForm((prev) => !prev)
                      }
                      className="text-[11px] font-semibold text-[#800020] hover:underline cursor-pointer"
                    >
                      {isAddingCustomCategoryInForm
                        ? 'Pilih dari Daftar'
                        : '+ Kategori Baru'}
                    </button>
                  </div>

                  {isAddingCustomCategoryInForm ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customCategoryDraft}
                        onChange={(e) => setCustomCategoryDraft(e.target.value)}
                        placeholder="Ketik nama kategori..."
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCategoryInForm}
                        className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1a2b52] cursor-pointer"
                      >
                        Simpan
                      </button>
                    </div>
                  ) : (
                    <select
                      id="srv-category-select"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as ServiceCategory,
                        })
                      }
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="srv-unit-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Satuan (Unit) *
                  </label>
                  <select
                    id="srv-unit-select"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="srv-price-input"
                      className="block text-xs font-semibold text-[#101B35]"
                    >
                      Harga Standar (Rp) *
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-[#800020]">
                      {formatRupiah(formData.price || 0)}
                    </span>
                  </div>
                  <input
                    id="srv-price-input"
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Contoh: 35000"
                    value={formData.price === 0 ? '' : formData.price}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setFormData({
                        ...formData,
                        price: raw === '' ? 0 : Math.max(0, Number(raw)),
                      });
                    }}
                    className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="srv-status-select"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    Status Layanan
                  </label>
                  <select
                    id="srv-status-select"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'Aktif' | 'Nonaktif',
                      })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
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
                  Deskripsi Standar Layanan
                </label>
                <textarea
                  id="srv-desc-input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Rincian ruang lingkup layanan yang akan otomatis tampil pada baris invoice..."
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Layanan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {categoryModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Kelola Kategori Layanan"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-4 sm:px-6 py-4 bg-[#101B35] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FolderCog className="w-4 h-4 text-[#C5A15B]" />
                <h3 className="text-sm font-bold">
                  Kelola Kategori Layanan ({categories.length} Kategori)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                aria-label="Tutup modal kategori"
                className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {catError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {catError}
                </div>
              )}

              {/* Add New Category Form */}
              <form
                onSubmit={handleAddCategorySubmit}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <label
                  htmlFor="new-category-input"
                  className="block text-xs font-bold text-[#101B35]"
                >
                  Tambah Kategori Layanan Baru
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="new-category-input"
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="Contoh: Konsultasi AI & Otomatisasi Data"
                    className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                  <button
                    type="submit"
                    disabled={catBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kategori</span>
                  </button>
                </div>
              </form>

              {/* Category List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#101B35]">
                    Daftar Kategori Aktif
                  </span>
                  <button
                    type="button"
                    disabled={catBusy}
                    onClick={async () => {
                      setCatBusy(true);
                      try {
                        await onResetCategories();
                      } finally {
                        setCatBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#101B35] cursor-pointer"
                    title="Pulihkan 16 kategori bawaan jika ada yang terhapus"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Pulihkan Kategori Standar</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-80 overflow-y-auto">
                  {categories.map((cat, idx) => {
                    const usedCount = categoryUsageCount[cat] || 0;
                    const isEditing = editingCatName === cat;
                    const isConfirmDelete = confirmDeleteCat === cat;

                    return (
                      <div
                        key={cat}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono text-[11px] text-slate-400 w-5 shrink-0">
                            {idx + 1}.
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingCatValue}
                                onChange={(e) =>
                                  setEditingCatValue(e.target.value)
                                }
                                aria-label="Edit nama kategori"
                                className="flex-1 px-2.5 py-1 text-xs border border-[#800020] rounded-md focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={catBusy}
                                onClick={() => handleSaveRenameCategory(cat)}
                                className="px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-semibold hover:bg-emerald-800 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Simpan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatName(null)}
                                className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-[#101B35] truncate">
                                {cat}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono shrink-0">
                                {usedCount} layanan
                              </span>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            {isConfirmDelete ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={catBusy}
                                  onClick={() =>
                                    handleConfirmDeleteCategory(cat)
                                  }
                                  className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCat(null)}
                                  className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCatName(cat);
                                    setEditingCatValue(cat);
                                    setConfirmDeleteCat(null);
                                  }}
                                  title={`Ubah nama kategori ${cat}`}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-[#101B35] hover:bg-slate-100 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={categories.length <= 1}
                                  onClick={() => {
                                    setConfirmDeleteCat(cat);
                                    setEditingCatName(null);
                                  }}
                                  title={`Hapus kategori ${cat}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Catatan: Mengubah nama kategori akan otomatis memperbarui
                  seluruh layanan pada kategori tersebut. Menghapus kategori
                  akan memindahkan layanan di dalamnya ke kategori cadangan agar
                  data tetap aman.
                </p>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1a2b52] cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
