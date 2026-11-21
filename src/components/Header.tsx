import React from 'react';
import { Menu, Plus, CreditCard, RefreshCw, Database } from 'lucide-react';
import type { NavTab } from './Sidebar';
import type { DatabaseStatus, User } from '../types/invoice';

interface HeaderProps {
  activeTab: NavTab;
  currentUser: User;
  databaseStatus?: DatabaseStatus;
  isSyncingCloud?: boolean;
  onOpenMobileMenu: () => void;
  onQuickCreateInvoice: () => void;
  onQuickRecordPayment: () => void;
  onQuickSyncCloud?: () => void;
  onOpenDatabaseTab?: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard Ringkasan Bisnis',
  invoices: 'Manajemen Dokumen Invoice',
  payments: 'Manajemen Pembayaran & Bukti Pembayaran',
  clients: 'Database Pelanggan',
  services: 'Katalog Layanan Digital',
  reports: 'Laporan Keuangan & Piutang',
  settings: 'Pengaturan Identitas Perusahaan & Pengguna',
  database: 'Integrasi Database Google Sheets',
};

const MOBILE_TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Ringkasan Bisnis',
  invoices: 'Manajemen Invoice',
  payments: 'Pembayaran & Kwitansi',
  clients: 'Data Pelanggan',
  services: 'Katalog Layanan',
  reports: 'Laporan Keuangan',
  settings: 'Pengaturan Perusahaan',
  database: 'Koneksi Google Sheets',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentUser,
  databaseStatus,
  isSyncingCloud = false,
  onOpenMobileMenu,
  onQuickCreateInvoice,
  onQuickRecordPayment,
  onQuickSyncCloud,
  onOpenDatabaseTab,
}) => {
  const isCloudConnected = Boolean(
    databaseStatus?.connected || databaseStatus?.gas_url_configured
  );

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#101B35] shrink-0 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
            <span>Autosmart Invoice</span>
            <span aria-hidden="true">/</span>
            <span className="text-[#800020] font-semibold">
              {currentUser.role}
            </span>
          </div>
          <h1 className="text-sm sm:text-lg font-bold text-[#101B35] tracking-tight truncate">
            <span className="sm:hidden">{MOBILE_TAB_TITLES[activeTab]}</span>
            <span className="hidden sm:inline">{TAB_TITLES[activeTab]}</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {isCloudConnected && onQuickSyncCloud ? (
          <button
            type="button"
            disabled={isSyncingCloud}
            onClick={onQuickSyncCloud}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            title="Sinkronkan Data HP & PC Sekarang (Google Sheets)"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-700 shrink-0 ${
                isSyncingCloud ? 'animate-spin' : ''
              }`}
            />
            <span className="hidden xl:inline">
              {isSyncingCloud ? 'Menyinkronkan...' : 'Sinkron HP & PC'}
            </span>
            <span className="xl:hidden">
              {isSyncingCloud ? 'Sinkron...' : 'Sinkron'}
            </span>
          </button>
        ) : onOpenDatabaseTab ? (
          <button
            type="button"
            onClick={onOpenDatabaseTab}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer whitespace-nowrap"
            title="Hubungkan Google Sheets agar Sinkron HP & PC"
          >
            <Database className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="hidden xl:inline">Hubungkan Sheets</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onQuickRecordPayment}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          title="Catat Pembayaran"
        >
          <CreditCard className="w-3.5 h-3.5 text-[#800020] shrink-0" />
          <span className="hidden md:inline">Catat Pembayaran</span>
          <span className="md:hidden">Bayar</span>
        </button>

        <button
          type="button"
          onClick={onQuickCreateInvoice}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] transition-colors cursor-pointer whitespace-nowrap"
          title="Buat Invoice Baru"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Buat Invoice Baru</span>
          <span className="sm:hidden">Invoice</span>
        </button>
      </div>
    </header>
  );
};
