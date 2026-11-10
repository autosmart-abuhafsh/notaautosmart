import React, { useState } from 'react';
import { Menu, Plus, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
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
  onToggleDemoMode: (enabled: boolean) => Promise<void>;
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
  onToggleDemoMode,
}) => {
  const [togglingDemo, setTogglingDemo] = useState(false);
  const isDemoActive =
    databaseStatus.demo_mode !== false &&
    databaseStatus.mode !== 'LIVE_LOCAL';

  const handleToggleClick = async () => {
    if (togglingDemo) return;
    setTogglingDemo(true);
    try {
      await onToggleDemoMode(!isDemoActive);
    } finally {
      setTogglingDemo(false);
    }
  };

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
            <span aria-hidden="true">·</span>
            {isDemoActive ? (
              <button
                type="button"
                onClick={() => onNavigateTab('database')}
                className="text-amber-700 hover:underline font-medium truncate cursor-pointer"
              >
                <span className="sm:hidden">Mode DEMO Aktif</span>
                <span className="hidden sm:inline">
                  Mode DEMO Aktif (Data Contoh Simulasi)
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('database')}
                className="text-emerald-700 hover:underline font-semibold truncate cursor-pointer"
              >
                <span className="sm:hidden">Data Bersih (Fresh)</span>
                <span className="hidden sm:inline">
                  Mode Data Bersih / Fresh (Demo Dimatikan)
                </span>
              </button>
            )}
          </div>
          <h1 className="text-sm sm:text-lg font-bold text-[#101B35] truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Demo Mode Switch & Primary Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          data-testid="header-toggle-demo-btn"
          disabled={togglingDemo}
          onClick={handleToggleClick}
          title={
            isDemoActive
              ? 'Klik untuk mematikan Mode Demo agar data bersih/fresh (Rp 0)'
              : 'Klik untuk menghidupkan kembali data contoh Mode Demo'
          }
          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
            isDemoActive
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
          }`}
        >
          {isDemoActive ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="hidden md:inline">Mode Demo: ON</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900 font-bold">
                Matikan Demo
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="hidden md:inline">Data Bersih (Fresh)</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-900/10 text-emerald-900 font-bold">
                Hidupkan Demo
              </span>
            </>
          )}
        </button>

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
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Buat Invoice Baru</span>
          <span className="sm:hidden">Invoice</span>
        </button>
      </div>
    </header>
  );
};

