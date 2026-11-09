import React from 'react';
import { Menu, Plus, CreditCard } from 'lucide-react';
import type { NavTab } from './Sidebar';
import type { DatabaseStatus, User } from '../types/invoice';

interface HeaderProps {
  activeTab: NavTab;
  currentUser: User;
  databaseStatus: DatabaseStatus;
  onOpenMobileMenu: () => void;
  onQuickCreateInvoice: () => void;
  onQuickRecordPayment: () => void;
  onNavigateTab: (tab: NavTab) => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard Ringkasan Bisnis',
  invoices: 'Manajemen Dokumen Invoice',
  payments: 'Manajemen Pembayaran & Bukti Kwitansi',
  clients: 'Database Pelanggan & Klien',
  services: 'Katalog Produk & Layanan Digital',
  reports: 'Laporan Keuangan & Rekapitulasi',
  settings: 'Pengaturan Identitas Perusahaan & Pengguna',
  database: 'Integrasi Google Sheets & Apps Script API',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentUser,
  databaseStatus,
  onOpenMobileMenu,
  onQuickCreateInvoice,
  onQuickRecordPayment,
  onNavigateTab,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 no-print sticky top-0 z-30">
      {/* Zone 1: Context / Breadcrumb Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="lg:hidden p-2 -ml-2 text-[#101B35] hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap overflow-hidden">
            <span className="hidden sm:inline">Autosmart Invoice</span>
            <span className="hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-[#800020] font-medium">
              {currentUser.role}
            </span>
            {databaseStatus.mode === 'DEMO_LOCAL' && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('database')}
                  className="text-amber-700 hover:underline font-medium truncate cursor-pointer"
                >
                  <span className="sm:hidden">Mode DEMO</span>
                  <span className="hidden sm:inline">
                    Mode DEMO (Konfigurasi Google Sheets)
                  </span>
                </button>
              </>
            )}
          </div>
          <h1 className="text-sm sm:text-lg font-bold text-[#101B35] truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Primary Action Buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onQuickRecordPayment}
          className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5 text-[#800020]" />
          <span>Catat Pembayaran</span>
        </button>

        <button
          type="button"
          onClick={onQuickCreateInvoice}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Invoice Baru</span>
        </button>
      </div>
    </header>
  );
};
