import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  CreditCard,
  BarChart3,
  Settings,
  Database,
  LogOut,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type {
  CompanySettingsMap,
  DatabaseStatus,
  User,
} from '../types/invoice';

export type NavTab =
  | 'dashboard'
  | 'invoices'
  | 'payments'
  | 'clients'
  | 'services'
  | 'reports'
  | 'settings'
  | 'database';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: User;
  settings: CompanySettingsMap;
  databaseStatus: DatabaseStatus;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  settings,
  databaseStatus,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdmin = currentUser.role === 'Administrator';

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'dashboard', label: 'Ringkasan Bisnis', icon: LayoutDashboard },
    { id: 'invoices', label: 'Manajemen Invoice', icon: FileText },
    { id: 'payments', label: 'Pembayaran & Kwitansi', icon: CreditCard },
    { id: 'clients', label: 'Data Pelanggan', icon: Users },
    { id: 'services', label: 'Katalog Layanan', icon: Briefcase },
    { id: 'reports', label: 'Laporan Keuangan', icon: BarChart3 },
    {
      id: 'settings',
      label: 'Pengaturan Perusahaan',
      icon: Settings,
      adminOnly: true,
    },
    {
      id: 'database',
      label: 'Koneksi Google Sheets',
      icon: Database,
      adminOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#101B35] text-white flex flex-col border-r border-white/10 transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <BrandLogo
              companyName={settings.company_name}
              tagline={settings.tagline}
              logoUrl={settings.logo_url}
              variant="light"
              size="md"
            />
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup menu navigasi"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          aria-label="Navigasi Utama"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#800020] text-white font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#C5A15B]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Clean Database Connection Indicator & User Footer */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-[#0B1326]">
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-slate-300 font-semibold">
                Penyimpanan Data
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  databaseStatus.connected
                    ? 'text-emerald-400'
                    : 'text-[#C5A15B]'
                }`}
              >
                {databaseStatus.connected ? 'GOOGLE SHEETS' : 'AKTIF'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {databaseStatus.connected
                ? 'Tersinkronisasi ke Google Sheets'
                : 'Database Persisten Autosmart'}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-[#C5A15B] truncate">
                {currentUser.role} · {currentUser.email}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Keluar dari sesi"
              aria-label="Keluar dari sesi"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
