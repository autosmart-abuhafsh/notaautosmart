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
  FileCode,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import type {
  CompanySettingsMap,
  DatabaseStatus,
  User,
} from '../types/invoice';
import { CODE_GS_CODE, SETUP_GS_CODE } from '../utils/gasTemplates';

interface GasPingResult {
  ok: boolean;
  spreadsheetName?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  counts?: Record<string, number>;
  serverTime?: string;
}

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
  onPullDatabaseFromGas?: () => Promise<void>;
  onTestDatabaseConnection?: (
    webAppUrl: string,
    apiSecret: string
  ) => Promise<GasPingResult>;
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
  onPullDatabaseFromGas,
  onTestDatabaseConnection,
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
  const [dbPulling, setDbPulling] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbFeedback, setDbFeedback] = useState('');
  const [dbFeedbackType, setDbFeedbackType] = useState<'success' | 'error'>(
    'success'
  );
  const [pingResult, setPingResult] = useState<GasPingResult | null>(null);

  // Script Viewer Tab State ('setup' = Setup.gs, 'code' = Code.gs)
  const [activeScriptTab, setActiveScriptTab] = useState<'setup' | 'code'>(
    'setup'
  );
  const [copiedSetup, setCopiedSetup] = useState(false);
  const [copiedCodeGs, setCopiedCodeGs] = useState(false);

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
      setDbFeedbackType('success');
      setDbFeedback(
        'Konfigurasi server Google Apps Script berhasil disimpan & seluruh nota mulai disinkronkan secara otomatis.'
      );
    } catch (err) {
      setDbFeedbackType('error');
      setDbFeedback(
        err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.'
      );
    } finally {
      setDbSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!onTestDatabaseConnection) return;
    setDbTesting(true);
    setDbFeedback('');
    try {
      const res = await onTestDatabaseConnection(gasUrlInput, gasSecretInput);
      setPingResult(res);
      setDbFeedbackType('success');
      setDbFeedback(
        `Berhasil terhubung ke Server Apps Script! Spreadsheet: ${res.spreadsheetName || 'AUTOSMART_INVOICE_DATABASE'} (Waktu Server: ${res.serverTime || 'WIB'})`
      );
    } catch (err) {
      setPingResult(null);
      setDbFeedbackType('error');
      setDbFeedback(
        err instanceof Error
          ? err.message
          : 'Gagal menguji koneksi ke Google Apps Script.'
      );
    } finally {
      setDbTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setDbSyncing(true);
    setDbFeedback('');
    try {
      await onTriggerDatabaseSync();
      setDbFeedbackType('success');
      setDbFeedback(
        'Berhasil! Seluruh 8 sheet (Nota Invoice, Item, Kwitansi Pembayaran, Klien, & Layanan) telah disimpan ke Google Sheets.'
      );
    } catch (err) {
      setDbFeedbackType('error');
      setDbFeedback(
        err instanceof Error
          ? err.message
          : 'Gagal sinkronisasi ke Google Sheets.'
      );
    } finally {
      setDbSyncing(false);
    }
  };

  const handlePullNow = async () => {
    if (!onPullDatabaseFromGas) return;
    setDbPulling(true);
    setDbFeedback('');
    try {
      await onPullDatabaseFromGas();
      setDbFeedbackType('success');
      setDbFeedback(
        'Berhasil menarik (Pull) seluruh data nota, invoice, pembayaran, dan klien dari Google Sheets ke aplikasi!'
      );
    } catch (err) {
      setDbFeedbackType('error');
      setDbFeedback(
        err instanceof Error
          ? err.message
          : 'Gagal menarik data dari Google Sheets.'
      );
    } finally {
      setDbPulling(false);
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

  const handleDownloadScriptFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (mode === 'database') {
    const currentScriptCode =
      activeScriptTab === 'setup' ? SETUP_GS_CODE : CODE_GS_CODE;

    return (
      <div className="space-y-6">
        {/* Database Status Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#800020] uppercase">
              <Database className="w-4 h-4" />
              <span>
                Status Server Database:{' '}
                {databaseStatus.mode === 'GOOGLE_SHEETS'
                  ? 'TERHUBUNG KE GOOGLE APPS SCRIPT & SHEETS'
                  : 'MODE PERSISTEN LOKAL (SIAP DIHUBUNGKAN KE APPS SCRIPT)'}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#101B35] mt-1">
              Spreadsheet Database: {databaseStatus.spreadsheet_name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {databaseStatus.message}
              {databaseStatus.last_sync
                ? ` · Sinkronisasi terakhir: ${databaseStatus.last_sync}`
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser.role === 'Administrator' && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="px-3 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup JSON</span>
                </button>

                <button
                  type="button"
                  disabled={dbPulling}
                  onClick={handlePullNow}
                  className="px-3.5 py-2 text-xs font-semibold text-[#101B35] border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${dbPulling ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {dbPulling
                      ? 'Menarik Data...'
                      : 'Tarik dari Google Sheets (Pull)'}
                  </span>
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
                      : 'Simpan ke Google Sheets (Push)'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {dbFeedback && (
          <div
            role="status"
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
              dbFeedbackType === 'error'
                ? 'bg-rose-900 text-white border border-rose-700'
                : 'bg-emerald-900 text-white border border-emerald-700'
            }`}
          >
            <span>{dbFeedback}</span>
            <button
              type="button"
              onClick={() => setDbFeedback('')}
              className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Row 1: Server-Side Proxy Configuration & Dual Script Viewer (Setup.gs & Code.gs) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Form Koneksi URL Web App Google Apps Script */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#800020]">
                Koneksi Server Penyimpanan Nota
              </div>
              <h3 className="text-sm font-bold text-[#101B35] mt-0.5">
                Hubungkan URL Web App Google Apps Script
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tempelkan URL Web App (<span className="font-mono">.../exec</span>) dari hasil Deploy{' '}
                <strong className="text-[#101B35]">Code.gs</strong> &{' '}
                <strong className="text-[#101B35]">Setup.gs</strong>. Setiap kali Anda membuat invoice atau mencatat pembayaran nota, data otomatis tersimpan ke Google Sheets.
              </p>
            </div>

            {currentUser.role === 'Administrator' ? (
              <form onSubmit={handleSaveGasConfig} className="space-y-4">
                <div>
                  <label
                    htmlFor="gas-url-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    URL Web App Google Apps Script (Berakhiran /exec) *
                  </label>
                  <input
                    id="gas-url-input"
                    type="url"
                    value={gasUrlInput}
                    onChange={(e) => setGasUrlInput(e.target.value)}
                    placeholder={
                      databaseStatus.gas_url_masked ||
                      'https://script.google.com/macros/s/AKfycb.../exec'
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gas-secret-input"
                    className="block text-xs font-semibold text-[#101B35] mb-1"
                  >
                    API Secret Key (Opsional — Kosongkan jika default)
                  </label>
                  <input
                    id="gas-secret-input"
                    type="password"
                    value={gasSecretInput}
                    onChange={(e) => setGasSecretInput(e.target.value)}
                    placeholder="Kosongkan jika API_SECRET di Code.gs tidak diisi"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={dbTesting}
                    onClick={handleTestConnection}
                    className="py-2.5 px-3 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {dbTesting ? 'Menguji...' : '1. Uji Koneksi (Ping)'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={dbSaving}
                    className="py-2.5 px-3 text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1a2b52] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#C5A15B]" />
                    <span>
                      {dbSaving ? 'Menyimpan...' : '2. Simpan & Hubungkan'}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 text-xs text-slate-600">
                Hanya Administrator yang dapat mengubah konfigurasi koneksi
                Google Apps Script.
              </div>
            )}

            {/* Live Ping Result Box */}
            {pingResult && pingResult.ok && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                <div className="font-bold text-emerald-900 flex items-center justify-between">
                  <span>Spreadsheet Terdeteksi: {pingResult.spreadsheetName}</span>
                  <span className="font-mono text-[10px] text-emerald-700">
                    ONLINE
                  </span>
                </div>
                {pingResult.counts && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[11px] text-emerald-800">
                    <div>INVOICES: {pingResult.counts.INVOICES ?? 0} baris</div>
                    <div>PAYMENTS: {pingResult.counts.PAYMENTS ?? 0} baris</div>
                    <div>CLIENTS: {pingResult.counts.CLIENTS ?? 0} baris</div>
                    <div>SERVICES: {pingResult.counts.SERVICES ?? 0} baris</div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="font-bold text-[#101B35]">
                8 Tabel Sheet Penyimpanan Nota & Transaksi:
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-600">
                <div>1. USERS (Akun & Role)</div>
                <div>2. CLIENTS (Pelanggan)</div>
                <div>3. SERVICES (Layanan)</div>
                <div>4. INVOICES (Nota Tagihan)</div>
                <div>5. INVOICE_ITEMS (Rincian)</div>
                <div>6. PAYMENTS (Kwitansi Bayar)</div>
                <div>7. COMPANY_SETTINGS</div>
                <div>8. ACTIVITY_LOGS (Audit)</div>
              </div>
            </div>
          </div>

          {/* Right: Dual-Tab Script Viewer (Setup.gs & Code.gs) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#800020]">
                  2 File Script Siap Copas
                </div>
                <h3 className="text-sm font-bold text-[#101B35] mt-0.5">
                  Kode Google Apps Script: Setup.gs & Code.gs
                </h3>
                <p className="text-xs text-slate-500">
                  Klik tab di bawah ini untuk menyalin (Copas) masing-masing file ke proyek Google Apps Script Anda.
                </p>
              </div>

              {/* File Switcher Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveScriptTab('setup')}
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
                    activeScriptTab === 'setup'
                      ? 'bg-[#101B35] text-white'
                      : 'text-slate-600 hover:text-[#101B35]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C5A15B]" />
                  <span>1. Setup.gs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScriptTab('code')}
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
                    activeScriptTab === 'code'
                      ? 'bg-[#800020] text-white'
                      : 'text-slate-600 hover:text-[#101B35]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-[#C5A15B]" />
                  <span>2. Code.gs</span>
                </button>
              </div>
            </div>

            {/* Active Script Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                {activeScriptTab === 'setup' ? (
                  <span>
                    <strong className="font-mono text-[#101B35]">Setup.gs</strong>:{' '}
                    Berisi fungsi <code className="font-mono font-semibold text-[#800020]">setupAutosmartDatabase()</code> untuk membuat 8 tabel sheet secara otomatis.
                  </span>
                ) : (
                  <span>
                    <strong className="font-mono text-[#101B35]">Code.gs</strong>:{' '}
                    Berisi server Web App (<code className="font-mono font-semibold text-[#800020]">doGet</code> & <code className="font-mono font-semibold text-[#800020]">doPost</code>) untuk menyimpan nota, invoice, dan kwitansi.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeScriptTab === 'setup' ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(SETUP_GS_CODE);
                        setCopiedSetup(true);
                        setTimeout(() => setCopiedSetup(false), 2500);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#101B35] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedSetup ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Setup.gs Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copas Setup.gs</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadScriptFile('Setup.gs', SETUP_GS_CODE)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1c2d54] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Setup.gs</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(CODE_GS_CODE);
                        setCopiedCodeGs(true);
                        setTimeout(() => setCopiedCodeGs(false), 2500);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#101B35] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCodeGs ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Code.gs Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copas Code.gs</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadScriptFile('Code.gs', CODE_GS_CODE)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Code.gs</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-[#101B35] text-slate-100 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
              {currentScriptCode}
            </pre>
          </div>
        </div>

        {/* Row 2: Step-by-Step Tutorial Copas Setup.gs & Code.gs */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#800020]">
              <BookOpen className="w-4 h-4" />
              <span>Panduan Lengkap Langkah Demi Langkah</span>
            </div>
            <h3 className="text-base font-bold text-[#101B35] mt-1">
              Tutorial Cara Copas & Pasang Setup.gs + Code.gs di Google Apps Script
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ikuti 6 langkah berurutan di bawah ini untuk menjadikan Google Sheets Anda sebagai server & database penyimpanan nota Autosmart Invoice secara permanen:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Langkah 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-[#101B35] text-[#C5A15B] font-mono font-bold text-[11px]">
                  LANGKAH 1
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Google Sheets
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Buat Spreadsheet & Buka Apps Script
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Buka <span className="font-mono font-semibold text-[#101B35]">sheets.new</span> di browser untuk membuat Google Spreadsheet baru, lalu beri nama{' '}
                <strong className="font-mono text-[#800020]">AUTOSMART_INVOICE_DATABASE</strong>.
                <br />
                2. Klik menu atas <strong>Extensions (Ekstensi)</strong> &rarr;{' '}
                <strong>Apps Script</strong>.
              </p>
            </div>

            {/* Langkah 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-[#101B35] text-[#C5A15B] font-mono font-bold text-[11px]">
                  LANGKAH 2
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  File 1: Setup.gs
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Buat File Setup.gs & Copas Kodenya
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Di panel kiri Apps Script (bagian <strong>Files</strong>), klik ikon{' '}
                <strong>+ (Tambah File)</strong> &rarr; pilih <strong>Script</strong>.
                <br />
                2. Ketik nama file <strong className="font-mono text-[#101B35]">Setup</strong> (otomatis menjadi <span className="font-mono">Setup.gs</span>).
                <br />
                3. Hapus isi bawaannya, klik tombol <strong>&ldquo;Copas Setup.gs&rdquo;</strong> di atas, lalu tempel (<strong>Ctrl+V</strong>) ke dalam <span className="font-mono">Setup.gs</span>.
              </p>
            </div>

            {/* Langkah 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-[#101B35] text-[#C5A15B] font-mono font-bold text-[11px]">
                  LANGKAH 3
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  File 2: Code.gs
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Buka File Code.gs & Copas Kodenya
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Klik file bawaan <strong className="font-mono text-[#101B35]">Code.gs</strong> (atau <span className="font-mono">Kode.gs</span>) di panel kiri Apps Script.
                <br />
                2. Hapus seluruh tulisan <span className="font-mono">function myFunction() &#123;&#125;</span>.
                <br />
                3. Pilih tab <strong>&ldquo;2. Code.gs&rdquo;</strong> di atas, klik <strong>&ldquo;Copas Code.gs&rdquo;</strong>, lalu tempel (<strong>Ctrl+V</strong>) dan tekan <strong>Ctrl+S</strong> (Simpan).
              </p>
            </div>

            {/* Langkah 4 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-[#800020] text-white font-mono font-bold text-[11px]">
                  LANGKAH 4
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Inisialisasi 8 Sheet
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Jalankan setupAutosmartDatabase()
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Klik kembali file <span className="font-mono font-semibold">Setup.gs</span>, pastikan dropdown fungsi di toolbar atas terpilih{' '}
                <strong className="font-mono text-[#800020]">setupAutosmartDatabase</strong>, lalu klik tombol <strong>&#9655; Run (Jalankan)</strong>.
                <br />
                2. Saat muncul izin akses: klik <strong>Review permissions</strong> &rarr; pilih akun Google Anda &rarr; klik <strong>Advanced</strong> &rarr; <strong>Go to project (unsafe)</strong> &rarr; <strong>Allow</strong>.
              </p>
            </div>

            {/* Langkah 5 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-[#800020] text-white font-mono font-bold text-[11px]">
                  LANGKAH 5
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Publish Server API
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Deploy sebagai Web App
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Klik tombol biru <strong>Deploy (Terapkan)</strong> di kanan atas &rarr; pilih <strong>New deployment</strong>.
                <br />
                2. Klik ikon roda gigi (Select type) &rarr; pilih <strong>Web app</strong>.
                <br />
                3. Atur <strong>Execute as:</strong> <span className="font-mono font-semibold">Me (Email Anda)</span> dan <strong>Who has access:</strong>{' '}
                <strong className="text-[#800020]">Anyone (Siapa saja)</strong>, lalu klik <strong>Deploy</strong>.
              </p>
            </div>

            {/* Langkah 6 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded bg-emerald-800 text-white font-mono font-bold text-[11px]">
                  LANGKAH 6
                </span>
                <span className="font-mono text-[11px] text-emerald-800 font-semibold">
                  Selesai & Aktif!
                </span>
              </div>
              <div className="font-bold text-[#101B35]">
                Tempel URL Web App ke Aplikasi Ini
              </div>
              <p className="text-slate-600 leading-relaxed">
                1. Salin <strong>Web app URL</strong> yang berakhiran <span className="font-mono font-semibold text-[#101B35]">/exec</span>.
                <br />
                2. Tempelkan pada kolom <strong>&ldquo;URL Web App Google Apps Script&rdquo;</strong> di sebelah kiri atas halaman ini.
                <br />
                3. Klik <strong>&ldquo;1. Uji Koneksi (Ping)&rdquo;</strong> lalu klik <strong>&ldquo;2. Simpan & Hubungkan&rdquo;</strong>. Semua nota otomatis masuk ke Google Sheets!
              </p>
            </div>
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
