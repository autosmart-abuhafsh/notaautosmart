import React, { useState } from 'react';
import {
  Save,
  Upload,
  Users,
  Database,
  RefreshCw,
  Copy,
  Check,
  Download,
  Plus,
} from 'lucide-react';
import type {
  CompanySettingsMap,
  DatabaseStatus,
  User,
} from '../types/invoice';
import { SETUP_GS_CODE } from '../utils/gasTemplates';

interface CompanySettingsViewProps {
  mode: 'settings' | 'database';
  settings: CompanySettingsMap;
  users: User[];
  currentUser: User;
  databaseStatus: DatabaseStatus;
  onSaveSettings: (updates: Partial<CompanySettingsMap>) => Promise<void>;
  onCreateUser: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateUser: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onSaveDatabaseConfig: (
    webAppUrl: string,
    apiSecret: string
  ) => Promise<void>;
  onTriggerDatabaseSync: () => Promise<void>;
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({
  mode,
  settings,
  users,
  currentUser,
  databaseStatus,
  onSaveSettings,
  onCreateUser,
  onUpdateUser,
  onSaveDatabaseConfig,
  onTriggerDatabaseSync,
}) => {
  const [formState, setFormState] = useState<CompanySettingsMap>({
    ...settings,
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // User Management Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Administrator' | 'Staff'>(
    'Staff'
  );
  const [userError, setUserError] = useState('');

  // Database Connection State
  const [gasUrlInput, setGasUrlInput] = useState('');
  const [gasSecretInput, setGasSecretInput] = useState('');
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [dbFeedback, setDbFeedback] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleFieldChange = (
    key: keyof CompanySettingsMap,
    value: string
  ) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (
    key: 'logo_url' | 'qris_url',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleFieldChange(key, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    try {
      await onSaveSettings(formState);
      setSaveMessage(
        'Pengaturan identitas perusahaan & invoice berhasil disimpan.'
      );
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    try {
      await onCreateUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        status: 'Aktif',
      });
      setUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Gagal menambahkan pengguna.'
      );
    }
  };

  const handleSaveGasConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbSaving(true);
    setDbFeedback('');
    try {
      await onSaveDatabaseConfig(gasUrlInput, gasSecretInput);
      setDbFeedback('Konfigurasi koneksi Google Apps Script berhasil disimpan.');
    } catch (err) {
      setDbFeedback(
        err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.'
      );
    } finally {
      setDbSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setDbSyncing(true);
    setDbFeedback('');
    try {
      await onTriggerDatabaseSync();
      setDbFeedback(
        'Sinkronisasi 8 sheet ke AUTOSMART_INVOICE_DATABASE berhasil!'
      );
    } catch (err) {
      setDbFeedback(
        err instanceof Error ? err.message : 'Gagal sinkronisasi ke Google Sheets.'
      );
    } finally {
      setDbSyncing(false);
    }
  };

  const handleDownloadBackupJson = async () => {
    try {
      const token =
        localStorage.getItem('autosmart_token') || 'demo-autostart-admin';
      const res = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AUTOSMART_INVOICE_DATABASE_BACKUP.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleDownloadSetupGs = () => {
    const blob = new Blob([SETUP_GS_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Setup.gs';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (mode === 'database') {
    return (
      <div className="space-y-6">
        {/* Database Status Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#800020] uppercase">
              <Database className="w-4 h-4" />
              <span>
                Status Database:{' '}
                {databaseStatus.mode === 'GOOGLE_SHEETS'
                  ? 'TERHUBUNG KE GOOGLE SHEETS'
                  : 'MODE DEMO / PERSISTEN LOKAL'}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#101B35] mt-1">
              Spreadsheet: {databaseStatus.spreadsheet_name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {databaseStatus.message}
              {databaseStatus.last_sync
                ? ` · Sinkronisasi terakhir: ${databaseStatus.last_sync}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentUser.role === 'Administrator' && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup JSON</span>
                </button>

                <button
                  type="button"
                  disabled={dbSyncing}
                  onClick={handleSyncNow}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${dbSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {dbSyncing
                      ? 'Menyinkronkan...'
                      : 'Sinkronkan ke Google Sheets'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {dbFeedback && (
          <div className="p-4 rounded-xl bg-slate-900 text-white text-xs font-medium">
            {dbFeedback}
          </div>
        )}

        {/* Server-Side Proxy Configuration & Setup.gs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#101B35]">
              Konfigurasi Server-Side Proxy Google Apps Script
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Kredensial URL Web App dan Secret Key disimpan secara aman di sisi
              server (Server-Side Proxy) agar tidak terekspos pada kode
              frontend.
            </p>

            {currentUser.role === 'Administrator' ? (
              <form onSubmit={handleSaveGasConfig} className="space-y-4">
                <div>
                  <label
                    htmlFor="gas-url-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    URL Web App Google Apps Script
                  </label>
                  <input
                    id="gas-url-input"
                    type="url"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    placeholder={
                      databaseStatus.gas_url_masked ||
                      'https://script.google.com/macros/s/.../exec'
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gas-secret-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    API Secret Key (Opsional)
                  </label>
                  <input
                    id="gas-secret-input"
                    type="password"
                    value={gasSecretInput}
                    onChange={(e) => setGasSecretInput(e.target.value)}
                    placeholder="Masukkan secret key server-side"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={dbSaving}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1a2b52] rounded-lg cursor-pointer"
                >
                  {dbSaving
                    ? 'Menyimpan...'
                    : 'Simpan Konfigurasi Koneksi Proxy'}
                </button>
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 text-xs text-slate-600">
                Hanya Administrator yang dapat mengubah konfigurasi koneksi
                Google Apps Script.
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="font-bold text-[#101B35]">
                8 Tabel Sheet Terdaftar:
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-600">
                <div>1. USERS</div>
                <div>2. CLIENTS</div>
                <div>3. SERVICES</div>
                <div>4. INVOICES</div>
                <div>5. INVOICE_ITEMS</div>
                <div>6. PAYMENTS</div>
                <div>7. COMPANY_SETTINGS</div>
                <div>8. ACTIVITY_LOGS</div>
              </div>
            </div>
          </div>

          {/* Setup.gs Code Viewer */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#101B35]">
                  Kode Otomatisasi Spreadsheet (Setup.gs)
                </h3>
                <p className="text-xs text-slate-500">
                  Salin atau unduh file Setup.gs ke Google Apps Script untuk
                  membuat AUTOSMART_INVOICE_DATABASE secara otomatis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(SETUP_GS_CODE);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Setup.gs</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSetupGs}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Setup.gs</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-[#101B35] text-slate-100 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
              {SETUP_GS_CODE}
            </pre>
          </div>
        </div>

        {/* GitHub Repository & Vercel Deployment Integration Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#800020]">
                CI/CD & Cloud Deployment Ready
              </div>
              <h3 className="text-base font-bold text-[#101B35] mt-0.5">
                Integrasi Repository GitHub & Publish ke Vercel (vercel.app)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Proyek ini telah dikonfigurasi penuh dengan Serverless API
                Adapter (/api/index.ts), routing SPA (vercel.json), dan GitHub
                Actions CI (.github/workflows/ci.yml).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] font-bold">
                vercel.json: READY
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[#101B35] font-mono text-[11px] font-bold">
                /api/index.ts: READY
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Step 1: Push ke Repository GitHub */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#101B35]">
                  1. Push Source Code ke Repository GitHub
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Git + GitHub Actions CI
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Jalankan perintah Git berikut pada terminal proyek Anda untuk
                mengunggah seluruh aplikasi ke repository GitHub:
              </p>
              <pre className="p-3 rounded-lg bg-[#101B35] text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">{`git init
git add .
git commit -m "feat: release Autosmart Invoice & Billing System"
git branch -M main
git remote add origin https://github.com/USERNAME/autosmart-invoice.git
git push -u origin main`}</pre>
            </div>

            {/* Step 2: Publish Otomatis ke Vercel.app */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#101B35]">
                  2. Publish & Deploy ke Domain *.vercel.app
                </span>
                <span className="font-mono text-[11px] text-[#800020] font-semibold">
                  Serverless Express + Vite
                </span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                <li>
                  Buka dashboard <strong className="text-[#101B35]">Vercel</strong> (vercel.com/new) dan pilih{' '}
                  <strong className="text-[#101B35]">Import Git Repository</strong> dari GitHub Anda.
                </li>
                <li>
                  Framework Preset otomatis terdeteksi sebagai{' '}
                  <span className="font-mono font-semibold text-[#101B35]">Vite</span>{' '}
                  (Build: <span className="font-mono">npm run build</span>, Output:{' '}
                  <span className="font-mono">dist</span>).
                </li>
                <li>
                  Tambahkan <strong className="text-[#101B35]">Environment Variables</strong> opsional di Vercel untuk sinkronisasi Google Sheets permanen:
                  <div className="mt-1.5 p-2.5 rounded bg-white border border-slate-200 font-mono text-[11px] text-[#101B35] space-y-1">
                    <div>GAS_WEB_APP_URL = https://script.google.com/macros/s/.../exec</div>
                    <div>GAS_API_SECRET = autosmart-secret-key</div>
                  </div>
                </li>
                <li>
                  Klik <strong className="text-[#800020]">Deploy</strong> — aplikasi langsung aktif di{' '}
                  <span className="font-mono font-semibold text-[#101B35]">
                    https://nama-project-anda.vercel.app
                  </span>
                  .
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COMPANY SETTINGS & USER MANAGEMENT VIEW
  return (
    <div className="space-y-6">
      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
          {saveMessage}
        </div>
      )}

      <form onSubmit={handleSubmitSettings} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Identitas Perusahaan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
              1. Identitas Resmi Perusahaan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Nama Perusahaan
                </label>
                <input
                  type="text"
                  value={formState.company_name}
                  onChange={(e) =>
                    handleFieldChange('company_name', e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Tagline Perusahaan
                </label>
                <input
                  type="text"
                  value={formState.tagline}
                  onChange={(e) => handleFieldChange('tagline', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Bidang Usaha
                </label>
                <input
                  type="text"
                  value={formState.business_field}
                  onChange={(e) =>
                    handleFieldChange('business_field', e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Nomor WhatsApp Perusahaan
                </label>
                <input
                  type="text"
                  value={formState.whatsapp}
                  onChange={(e) =>
                    handleFieldChange('whatsapp', e.target.value)
                  }
                  placeholder="Isi nomor WhatsApp resmi"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Email Resmi
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  placeholder="Isi alamat email resmi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Website Perusahaan
                </label>
                <input
                  type="text"
                  value={formState.website}
                  onChange={(e) => handleFieldChange('website', e.target.value)}
                  placeholder="Isi alamat website resmi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Alamat Lengkap Perusahaan
                </label>
                <textarea
                  rows={2}
                  value={formState.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="Isi alamat kantor Autosmart Digital Solutions"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Logo Perusahaan (Upload Gambar)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih File Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload('logo_url', e)}
                      className="hidden"
                    />
                  </label>
                  {formState.logo_url && (
                    <button
                      type="button"
                      onClick={() => handleFieldChange('logo_url', '')}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Hapus Logo Kustom
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Informasi Rekening Bank & Konfigurasi Invoice */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
                2. Informasi Rekening Bank & QRIS
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    value={formState.bank_name}
                    onChange={(e) =>
                      handleFieldChange('bank_name', e.target.value)
                    }
                    placeholder="Contoh: Bank Mandiri / BCA / BSI"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    value={formState.bank_account_number}
                    onChange={(e) =>
                      handleFieldChange('bank_account_number', e.target.value)
                    }
                    placeholder="Masukkan nomor rekening resmi"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Nama Pemilik Rekening
                  </label>
                  <input
                    type="text"
                    value={formState.bank_account_name}
                    onChange={(e) =>
                      handleFieldChange('bank_account_name', e.target.value)
                    }
                    placeholder="Atas nama rekening perusahaan"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Kode QRIS Pembayaran (Opsional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Gambar QRIS</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('qris_url', e)}
                        className="hidden"
                      />
                    </label>
                    {formState.qris_url && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('qris_url', '')}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Hapus QRIS
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#101B35] border-b border-slate-100 pb-2.5">
                3. Pengaturan Penomoran Dokumen & Pajak Opsional
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Prefix Nomor Invoice
                  </label>
                  <input
                    type="text"
                    value={formState.invoice_prefix}
                    onChange={(e) =>
                      handleFieldChange('invoice_prefix', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Prefix Bukti Pembayaran
                  </label>
                  <input
                    type="text"
                    value={formState.receipt_prefix}
                    onChange={(e) =>
                      handleFieldChange('receipt_prefix', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Tahun Dokumen
                  </label>
                  <input
                    type="text"
                    value={formState.document_year}
                    onChange={(e) =>
                      handleFieldChange('document_year', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Status Pajak Default
                  </label>
                  <select
                    value={formState.tax_enabled}
                    onChange={(e) =>
                      handleFieldChange('tax_enabled', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="false">Nonaktif (Opsional)</option>
                    <option value="true">Aktif</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Tarif Pajak Default (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={formState.tax_rate}
                    onChange={(e) =>
                      handleFieldChange('tax_rate', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101B35] mb-1">
                    Nama Penandatangan
                  </label>
                  <input
                    type="text"
                    value={formState.signatory_name}
                    onChange={(e) =>
                      handleFieldChange('signatory_name', e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Catatan Footer Dokumen
                </label>
                <input
                  type="text"
                  value={formState.footer_note}
                  onChange={(e) =>
                    handleFieldChange('footer_note', e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Menyimpan Pengaturan...'
                      : 'Simpan Pengaturan Perusahaan'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* User & Role Management Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101B35] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#800020]" />
              <span>Manajemen Pengguna & Hak Akses (Role-Based Access)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola akun Administrator dan Staff beserta pembatasan hak akses.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUserModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1b2d55] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#C5A15B]" />
            <span>Tambah Pengguna</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Tingkat Akses (Role)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ubah Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-mono">{u.id}</td>
                  <td className="py-3 px-4 font-semibold text-[#101B35]">
                    {u.name}
                  </td>
                  <td className="py-3 px-4 font-mono">{u.email}</td>
                  <td className="py-3 px-4 font-semibold text-[#800020]">
                    {u.role}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold ${
                        u.status === 'Aktif'
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateUser(u.id, {
                            status:
                              u.status === 'Aktif' ? 'Nonaktif' : 'Aktif',
                          })
                        }
                        className="text-xs font-semibold text-[#101B35] hover:underline cursor-pointer"
                      >
                        {u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-[#101B35] mb-4">
              Tambah Pengguna Baru
            </h3>
            {userError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {userError}
              </div>
            )}
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Role Akses
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) =>
                    setNewUserRole(
                      e.target.value as 'Administrator' | 'Staff'
                    )
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="Staff">Staff</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg cursor-pointer"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
