import React from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
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
  onToggleDemoMode: (enabled: boolean) => Promise<void>;
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
  onToggleDemoMode,
}) => {
  const isDemoActive =
    databaseStatus.demo_mode !== false &&
    databaseStatus.mode !== 'LIVE_LOCAL';
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
    },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || currentUser.role === 'Administrator'
  );

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden no-print"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50 w-68 bg-[#101B35] text-white flex flex-col justify-between shrink-0 transition-transform duration-200 ease-out no-print ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Top Brand Lockup */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-2">
            <BrandLogo
              logoUrl={settings.logo_url}
              companyName={
                settings.company_name || 'Autosmart Digital Solutions'
              }
              tagline={
                settings.tagline || 'Skill Up For Digital Collaboration'
              }
              variant="light"
              size="sm"
            />
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup navigasi"
              className="lg:hidden p-1.5 text-slate-300 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3 space-y-1" aria-label="Menu Utama">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#800020] text-white'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#C5A15B]' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Database Status & User Profile */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
            <button
              type="button"
              onClick={() => handleNavClick('database')}
              className="w-full text-left cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white mb-0.5">
                <span>Status Database</span>
                <span
                  className={
                    databaseStatus.mode === 'GOOGLE_SHEETS'
                      ? 'text-emerald-400'
                      : isDemoActive
                        ? 'text-[#C5A15B]'
                        : 'text-emerald-400'
                  }
                >
                  {databaseStatus.mode === 'GOOGLE_SHEETS'
                    ? 'SHEETS'
                    : isDemoActive
                      ? 'DEMO: ON'
                      : 'FRESH / BERSIH'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {databaseStatus.mode === 'GOOGLE_SHEETS'
                  ? 'Google Sheets Terhubung'
                  : isDemoActive
                    ? 'Menampilkan Data Simulasi Demo'
                    : 'Mode Data Bersih (Demo OFF)'}
              </div>
            </button>

            <button
              type="button"
              data-testid="sidebar-toggle-demo-btn"
              onClick={() => onToggleDemoMode(!isDemoActive)}
              className={`w-full py-1.5 px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                isDemoActive
                  ? 'bg-[#800020] hover:bg-[#660019] text-white'
                  : 'bg-emerald-800/70 hover:bg-emerald-700 text-emerald-100'
              }`}
            >
              <span>
                {isDemoActive
                  ? 'Matikan Mode Demo'
                  : 'Hidupkan Mode Demo'}
              </span>
              <span className="font-mono text-[10px] opacity-90">
                {isDemoActive ? 'BERSIHKAN' : 'SIMULASI'}
              </span>
            </button>
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
              aria-label="Keluar dari sistem"
              title="Keluar dari sistem"
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
