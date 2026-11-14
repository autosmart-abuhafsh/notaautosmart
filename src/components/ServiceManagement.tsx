import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Tags,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { ServiceItem } from '../types/invoice';
import {
  DEFAULT_SERVICE_CATEGORIES,
  formatRupiah,
} from '../utils/invoiceLogic';

export const AUTOSMART_CATEGORIES = DEFAULT_SERVICE_CATEGORIES;

interface ServiceManagementProps {
  services: ServiceItem[];
  categories?: string[];
  onCreateService: (payload: Partial<ServiceItem>) => Promise<void>;
  onUpdateService: (id: string, payload: Partial<ServiceItem>) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onAddCategory?: (categoryName: string) => Promise<void>;
  onRenameCategory?: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory?: (
    categoryName: string,
    fallbackCategory?: string
  ) => Promise<void>;
  onResetCategories?: () => Promise<void>;
}

export const ServiceManagement: React.FC<ServiceManagementProps> = ({
  services,
  categories: propCategories,
  onCreateService,
  onUpdateService,
  onDeleteService,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onResetCategories,
}) => {
  const categories = useMemo(() => {
    if (propCategories && propCategories.length > 0) {
      return propCategories;
    }
    return DEFAULT_SERVICE_CATEGORIES;
  }, [propCategories]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Service Create / Edit Modal State
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(
    null
  );
  const [serviceName, setServiceName] = useState('');
  const [category, setCategory] = useState(categories[0] || '');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Paket');
  const [price, setPrice] = useState('5000000');
  const [status, setStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Inline Quick Add Category inside Service Form
  const [quickAddCatOpen, setQuickAddCatOpen] = useState(false);
  const [quickAddCatName, setQuickAddCatName] = useState('');
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  // Delete Service Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);

  // Category Management Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCatOriginal, setEditingCatOriginal] = useState<string | null>(
    null
  );
  const [editingCatValue, setEditingCatValue] = useState('');
  const [deletingCatTarget, setDeletingCatTarget] = useState<string | null>(
    null
  );
  const [deleteFallbackCat, setDeleteFallbackCat] = useState<string>('');
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState('');

  const categoryUsageCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const srv of services) {
      map[srv.category] = (map[srv.category] || 0) + 1;
    }
    return map;
  }, [services]);

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
    setCategory(
      selectedCategory !== 'ALL' && categories.includes(selectedCategory)
        ? selectedCategory
        : categories[0] || 'Layanan Digital Lainnya'
    );
    setDescription('');
    setUnit('Paket');
    setPrice('5000000');
    setStatus('Aktif');
    setFormError('');
    setQuickAddCatOpen(false);
    setQuickAddCatName('');
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
    setQuickAddCatOpen(false);
    setQuickAddCatName('');
    setFormOpen(true);
  };

  const openCategoryManagerModal = () => {
    setCatError('');
    setNewCategoryInput('');
    setEditingCatOriginal(null);
    setEditingCatValue('');
    setDeletingCatTarget(null);
    setCategoryModalOpen(true);
  };

  const handleQuickAddCategoryInForm = async () => {
    const trimmed = quickAddCatName.trim();
    if (!trimmed) {
      setFormError('Nama kategori baru tidak boleh kosong.');
      return;
    }
    setFormError('');
    setQuickAddBusy(true);
    try {
      if (onAddCategory) {
        await onAddCategory(trimmed);
      }
      setCategory(trimmed);
      setQuickAddCatName('');
      setQuickAddCatOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menambahkan kategori baru.'
      );
    } finally {
      setQuickAddBusy(false);
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      setCatError('Nama kategori layanan wajib diisi.');
      return;
    }
    setCatError('');
    setCatBusy(true);
    try {
      if (onAddCategory) {
        await onAddCategory(trimmed);
      }
      setNewCategoryInput('');
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal menambahkan kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleConfirmRenameCategory = async (oldName: string) => {
    const trimmed = editingCatValue.trim();
    if (!trimmed) {
      setCatError('Nama kategori baru tidak boleh kosong.');
      return;
    }
    if (trimmed === oldName) {
      setEditingCatOriginal(null);
      setEditingCatValue('');
      return;
    }
    setCatError('');
    setCatBusy(true);
    try {
      if (onRenameCategory) {
        await onRenameCategory(oldName, trimmed);
      }
      if (selectedCategory === oldName) {
        setSelectedCategory(trimmed);
      }
      if (category === oldName) {
        setCategory(trimmed);
      }
      setEditingCatOriginal(null);
      setEditingCatValue('');
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal mengubah nama kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const startDeleteCategory = (catName: string) => {
    setCatError('');
    setEditingCatOriginal(null);
    setDeletingCatTarget(catName);
    const remaining = categories.filter((c) => c !== catName);
    const defaultFallback = remaining.includes('Layanan Digital Lainnya')
      ? 'Layanan Digital Lainnya'
      : remaining[0] || '';
    setDeleteFallbackCat(defaultFallback);
  };

  const handleConfirmDeleteCategory = async (catName: string) => {
    setCatError('');
    setCatBusy(true);
    try {
      if (onDeleteCategory) {
        await onDeleteCategory(catName, deleteFallbackCat || undefined);
      }
      if (selectedCategory === catName) {
        setSelectedCategory('ALL');
      }
      if (category === catName) {
        const remaining = categories.filter((c) => c !== catName);
        setCategory(remaining[0] || 'Layanan Digital Lainnya');
      }
      setDeletingCatTarget(null);
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal menghapus kategori.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleResetDefaultCategories = async () => {
    setCatError('');
    setCatBusy(true);
    try {
      if (onResetCategories) {
        await onResetCategories();
      }
    } catch (err) {
      setCatError(
        err instanceof Error ? err.message : 'Gagal mereset kategori standar.'
      );
    } finally {
      setCatBusy(false);
    }
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
        category: category.trim() || categories[0] || 'Layanan Digital Lainnya',
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
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-base font-bold text-[#101B35]">
            Katalog Produk & Layanan Autosmart
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Harga di katalog merupakan harga acuan standar dan kategori layanan
            dapat ditambah, diedit, atau dihapus sesuai kebutuhan bisnis.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari layanan..."
              aria-label="Cari layanan"
              className="w-full sm:w-44 pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-[#101B35] focus:outline-none focus:bg-white focus:border-[#800020]"
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
            <option value="ALL">Semua Kategori ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openCategoryManagerModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Tags className="w-3.5 h-3.5 text-[#800020]" />
            <span>Kelola Kategori ({categories.length})</span>
          </button>

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
                className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
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
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="srv-cat-select"
                      className="block text-xs font-semibold text-[#101B35]"
                    >
                      Kategori Layanan
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuickAddCatOpen((v) => !v)}
                        className="text-[11px] font-semibold text-[#800020] hover:underline cursor-pointer"
                      >
                        {quickAddCatOpen
                          ? 'Batal Tambah Kategori'
                          : '+ Kategori Baru'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openCategoryManagerModal();
                        }}
                        className="text-[11px] font-semibold text-slate-600 hover:text-[#101B35] hover:underline cursor-pointer"
                      >
                        Kelola Semua Kategori
                      </button>
                    </div>
                  </div>

                  {quickAddCatOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={quickAddCatName}
                        onChange={(e) => setQuickAddCatName(e.target.value)}
                        placeholder="Ketik nama kategori baru..."
                        aria-label="Nama kategori baru"
                        className="flex-1 px-3 py-2 text-xs border border-[#800020] rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={quickAddBusy}
                        onClick={handleQuickAddCategoryInForm}
                        className="px-3 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {quickAddBusy ? 'Menyimpan...' : 'Simpan Kategori'}
                      </button>
                    </div>
                  ) : (
                    <select
                      id="srv-cat-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!categories.includes(category) && category && (
                        <option value={category}>{category}</option>
                      )}
                    </select>
                  )}
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

                <div className="sm:col-span-2">
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

      {/* Kelola Kategori Layanan Modal (Add, Edit, Delete Categories) */}
      {categoryModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kelola Kategori Layanan"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#101B35] text-white shrink-0">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Tags className="w-4 h-4 text-[#C5A15B]" />
                  <span>Kelola Kategori Layanan ({categories.length})</span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Tambah kategori baru, ubah nama kategori, atau hapus kategori
                  secara mandiri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                aria-label="Tutup kelola kategori"
                className="p-1 text-slate-300 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {catError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {catError}
                </div>
              )}

              {/* Add Category Form */}
              <form
                onSubmit={handleAddCategorySubmit}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4"
              >
                <label
                  htmlFor="new-category-input"
                  className="block text-xs font-bold text-[#101B35] mb-2"
                >
                  Tambah Kategori Layanan Baru
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="new-category-input"
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="Contoh: Konsultasi AI & Data, Desain UI/UX, Cloud Server..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020]"
                  />
                  <button
                    type="submit"
                    disabled={catBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kategori</span>
                  </button>
                </div>
              </form>

              {/* Category List */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold text-[#101B35]">
                    Daftar Kategori Layanan ({categories.length})
                  </h4>
                  {onResetCategories && (
                    <button
                      type="button"
                      disabled={catBusy}
                      onClick={handleResetDefaultCategories}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#101B35] cursor-pointer disabled:opacity-50"
                      title="Kembalikan kategori bawaan yang terhapus"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Pulihkan Kategori Standar</span>
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
                  {categories.map((cat, idx) => {
                    const count = categoryUsageCount[cat] || 0;
                    const isEditing = editingCatOriginal === cat;
                    const isDeleting = deletingCatTarget === cat;
                    const remainingCategories = categories.filter(
                      (c) => c !== cat
                    );

                    return (
                      <div
                        key={cat}
                        className="p-3 bg-white hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingCatValue}
                                  onChange={(e) =>
                                    setEditingCatValue(e.target.value)
                                  }
                                  aria-label={`Ubah nama kategori ${cat}`}
                                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#800020] rounded-lg text-[#101B35] focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  disabled={catBusy}
                                  onClick={() =>
                                    handleConfirmRenameCategory(cat)
                                  }
                                  aria-label={`Simpan nama kategori ${cat}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Simpan</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={catBusy}
                                  onClick={() => {
                                    setEditingCatOriginal(null);
                                    setEditingCatValue('');
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-[#101B35] truncate">
                                  {cat}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  ({count} layanan)
                                </span>
                              </div>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={catBusy}
                                onClick={() => {
                                  setDeletingCatTarget(null);
                                  setEditingCatOriginal(cat);
                                  setEditingCatValue(cat);
                                  setCatError('');
                                }}
                                aria-label={`Edit kategori ${cat}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-[#101B35] hover:bg-slate-100 rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={catBusy || categories.length <= 1}
                                onClick={() => startDeleteCategory(cat)}
                                aria-label={`Hapus kategori ${cat}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 rounded-md cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline Delete Confirmation */}
                        {isDeleting && (
                          <div className="mt-3 p-3 rounded-lg bg-rose-50/80 border border-rose-200 space-y-2.5">
                            {count > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs text-rose-900">
                                  Terdapat{' '}
                                  <span className="font-bold">
                                    {count} layanan
                                  </span>{' '}
                                  pada kategori{' '}
                                  <span className="font-bold">"{cat}"</span>.
                                  Pilih kategori pengganti untuk memindahkan
                                  layanan tersebut:
                                </p>
                                <select
                                  aria-label={`Kategori pengganti untuk ${cat}`}
                                  value={deleteFallbackCat}
                                  onChange={(e) =>
                                    setDeleteFallbackCat(e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg text-[#101B35]"
                                >
                                  {remainingCategories.map((rc) => (
                                    <option key={rc} value={rc}>
                                      {rc}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <p className="text-xs text-rose-900">
                                Apakah Anda yakin ingin menghapus kategori{' '}
                                <span className="font-bold">"{cat}"</span> dari
                                daftar kategori layanan?
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={catBusy}
                                onClick={() => setDeletingCatTarget(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={catBusy}
                                onClick={() => handleConfirmDeleteCategory(cat)}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
                              >
                                {catBusy
                                  ? 'Menghapus...'
                                  : 'Ya, Hapus Kategori'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#101B35] hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Service Confirmation */}
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

