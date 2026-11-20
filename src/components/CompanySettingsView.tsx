import React, { useEffect, useState } from 'react';
import {
  Save,
  Upload,
  Database,
  RefreshCw,
  Download,
  UserPlus,
  Copy,
  Check,
  FileCode2,
  ExternalLink,
  CheckCircle2,
  ArrowDownToLine,
  Wifi,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type {
  ActivityLog,
  CompanySettingsMap,
  DatabaseStatus,
  User,
  UserRole,
} from '../types/invoice';
import { formatDateId } from '../utils/invoiceLogic';
import { SETUP_GS_CODE, CODE_GS_CODE } from '../utils/gasTemplates';
import {
  loadLocalDb,
  loadLocalGasConfig,
} from '../utils/clientFallbackEngine';
import { DEFAULT_COMPANY_LOGO_URL } from './BrandLogo';

interface CompanySettingsViewProps {
  mode: 'settings' | 'database';
  settings: CompanySettingsMap;
  users: User[];
  activityLogs: ActivityLog[];
  databaseStatus: DatabaseStatus;
  onSaveSettings: (updates: Partial<CompanySettingsMap>) => Promise<void>;
  onCreateUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    status: 'Aktif' | 'Nonaktif';
  }) => Promise<void>;
  onUpdateUser: (
    id: string,
    payload: {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      status?: 'Aktif' | 'Nonaktif';
    }
  ) => Promise<void>;
  onSaveDatabaseConfig: (
    webAppUrl: string,
    apiSecret: string
  ) => Promise<void>;
  onTriggerDatabaseSync: () => Promise<void>;
  onPullDatabaseFromGas?: () => Promise<void>;
  onTestDatabaseConnection?: (
    webAppUrl: string,
    apiSecret: string
  ) => Promise<{
    ok: boolean;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    counts?: Record<string, number>;
    serverTime?: string;
  }>;
}

/**
 * Compresses an uploaded image file into a clean data URL guaranteed to stay well below
 * Google Sheets' 50,000-character cell limit (< 28,000 chars) while remaining sharp.
 */
function compressImageFile(
  file: File,
  maxDim: number = 260
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          let w = img.width || maxDim;
          let h = img.height || maxDim;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          // Try PNG first for transparency; if > 32,000 chars, use WebP/JPEG with white background
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.length <= 32000) {
            resolve(pngUrl);
            return;
          }

          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          const webpUrl = canvas.toDataURL('image/webp', 0.85);
          if (webpUrl.length <= 36000) {
            resolve(webpUrl);
            return;
          }
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({
  mode,
  settings = {} as CompanySettingsMap,
  users = [],
  activityLogs = [],
  databaseStatus = {
    connected: false,
    mode: 'LOCAL_STORAGE',
    spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
    gas_url_configured: false,
    gas_url_masked: '',
    last_sync: null,
    message: 'Data disimpan secara persisten di penyimpanan lokal.',
  },
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
  const [savingSettings, setSavingSettings] = useState(false);

  // Keep formState synchronized when settings prop updates from server/bootstrap
  useEffect(() => {
    setFormState({ ...settings });
  }, [settings]);

  // User Form State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('Staff');
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState('');

  // Database Config State (pre-filled from saved browser or VITE_GAS_WEB_APP_URL config)
  const [gasUrl, setGasUrl] = useState(() => loadLocalGasConfig().webAppUrl);
  const [gasSecret, setGasSecret] = useState(
    () => loadLocalGasConfig().apiSecret
  );
  const [savingGas, setSavingGas] = useState(false);
  const [syncingGas, setSyncingGas] = useState(false);
  const [pullingGas, setPullingGas] = useState(false);
  const [testingGas, setTestingGas] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    spreadsheetName?: string;
    spreadsheetUrl?: string;
    counts?: Record<string, number>;
    serverTime?: string;
  } | null>(null);
  const [activeGasFileTab, setActiveGasFileTab] = useState<'setup' | 'code'>(
    'setup'
  );
  const [copiedScript, setCopiedScript] = useState<'setup' | 'code' | null>(
    null
  );

  useEffect(() => {
    const cfg = loadLocalGasConfig();
    if (cfg.webAppUrl && !gasUrl) {
      setGasUrl(cfg.webAppUrl);
    }
  }, [databaseStatus.gas_url_configured, gasUrl]);

  const setField = (key: keyof CompanySettingsMap, val: string) => {
    setFormState((prev) => ({ ...prev, [key]: val }));
  };

  const handleFileUpload = async (
    key: 'logo_url' | 'qris_url',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(
        file,
        key === 'logo_url' ? 240 : 340
      );
      setField(key, compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setField(key, String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onSaveSettings(formState);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      setUserError('Nama, email, dan kata sandi wajib diisi.');
      return;
    }
    setSavingUser(true);
    try {
      await onCreateUser({
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword,
        role: userRole,
        status: 'Aktif',
      });
      setUserModalOpen(false);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : 'Gagal membuat akun pengguna.'
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem('autosmart_token') || '';
      const res = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AUTOSMART_INVOICE_DATABASE_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback to localStorage DB on GitHub Pages / offline mode
    }
    const localData = loadLocalDb();
    const blob = new Blob([JSON.stringify(localData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUTOSMART_INVOICE_DATABASE_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = async (type: 'setup' | 'code') => {
    const content = type === 'setup' ? SETUP_GS_CODE : CODE_GS_CODE;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedScript(type);
      setTimeout(() => setCopiedScript(null), 2500);
    } catch {
      // ignore
    }
  };

  if (mode === 'database') {
    const sheets = [
      {
        name: 'USERS',
        desc: 'Data pengguna, email, password hash, role (Administrator / Staff), dan status.',
      },
      {
        name: 'CLIENTS',
        desc: 'Profil pelanggan, contact person, nomor WhatsApp, email, dan alamat.',
      },
      {
        name: 'SERVICES',
        desc: '16 kategori katalog layanan digital, satuan, dan harga standar.',
      },
      {
        name: 'INVOICES',
        desc: 'Dokumen invoice utama, jatuh tempo, pajak, diskon, dan sisa piutang.',
      },
      {
        name: 'INVOICE_ITEMS',
        desc: 'Rincian baris item layanan yang terkait pada setiap invoice_id.',
      },
      {
        name: 'PAYMENTS',
        desc: 'Riwayat pencatatan pembayaran (Penuh, DP, Bertahap) & nomor bukti KW/ASM.',
      },
      {
        name: 'COMPANY_SETTINGS',
        desc: 'Konfigurasi identitas perusahaan, rekening bank, logo, QRIS, dan penomoran.',
      },
      {
        name: 'ACTIVITY_LOGS',
        desc: 'Jejak audit aktivitas operasional pengguna berdasarkan zona waktu Asia/Jakarta.',
      },
    ];

    return (
      <div className="space-y-5 sm:space-y-6">
        {/* Top Connection Status Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-xl bg-[#101B35] text-[#C5A15B] shrink-0">
                <Database className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#101B35]">
                    Database Spreadsheet: {databaseStatus.spreadsheet_name}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      databaseStatus.connected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {databaseStatus.connected
                      ? 'GOOGLE SHEETS TERHUBUNG & SINKRON OTOMATIS'
                      : 'BELUM TERHUBUNG KE GOOGLE SHEETS (MODE LOKAL)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {databaseStatus.message}
                </p>
                {databaseStatus.last_sync && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sinkronisasi terakhir:{' '}
                    {formatDateId(databaseStatus.last_sync)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
              {databaseStatus.gas_url_configured && (
                <>
                  <button
                    type="button"
                    disabled={syncingGas}
                    onClick={async () => {
                      setSyncingGas(true);
                      setTestResult(null);
                      try {
                        await onTriggerDatabaseSync();
                        setTestResult({
                          ok: true,
                          message:
                            'Seluruh data pelanggan, layanan, invoice, kwitansi, pengaturan & log aktivitas berhasil disimpan (Push) ke 8 Sheet Google Sheets!',
                        });
                      } catch (err) {
                        setTestResult({
                          ok: false,
                          message:
                            err instanceof Error
                              ? err.message
                              : 'Gagal menyimpan (Push) data ke Google Sheets.',
                        });
                      } finally {
                        setSyncingGas(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${syncingGas ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {syncingGas
                        ? 'Menyimpan...'
                        : 'Simpan (Push) ke Google Sheets'}
                    </span>
                  </button>

                  {onPullDatabaseFromGas && (
                    <button
                      type="button"
                      disabled={pullingGas}
                      onClick={async () => {
                        setPullingGas(true);
                        setTestResult(null);
                        try {
                          await onPullDatabaseFromGas();
                          setTestResult({
                            ok: true,
                            message:
                              'Data terbaru dari 8 Sheet Google Sheets berhasil ditarik (Pull) ke aplikasi!',
                          });
                        } catch (err) {
                          setTestResult({
                            ok: false,
                            message:
                              err instanceof Error
                                ? err.message
                                : 'Gagal menarik (Pull) data dari Google Sheets.',
                          });
                        } finally {
                          setPullingGas(false);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-[#101B35] bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowDownToLine
                        className={`w-3.5 h-3.5 ${pullingGas ? 'animate-bounce' : ''}`}
                      />
                      <span>
                        {pullingGas
                          ? 'Menarik Data...'
                          : 'Tarik Data (Pull) dari Sheets'}
                      </span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#800020]" />
                <span>Unduh Backup Database (.JSON)</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Guide & Form Connection */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 cols: Connection Form */}
            <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#101B35] mb-1">
                  Hubungkan URL Web App Google Apps Script
                </h3>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Setelah Anda memasang kode{' '}
                  <span className="font-mono font-semibold text-[#800020]">
                    Setup.gs
                  </span>{' '}
                  dan{' '}
                  <span className="font-mono font-semibold text-[#800020]">
                    Code.gs
                  </span>{' '}
                  di Google Sheets lalu melakukan <strong>Deploy Web App</strong>
                  , tempelkan URL Web App (berakhiran <code>/exec</code>) di
                  bawah ini:
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingGas(true);
                    setTestResult(null);
                    try {
                      await onSaveDatabaseConfig(
                        gasUrl.trim(),
                        gasSecret.trim()
                      );
                      let verifyInfo: {
                        spreadsheetName?: string;
                        spreadsheetUrl?: string;
                        counts?: Record<string, number>;
                      } = {};
                      if (gasUrl.trim() && onTestDatabaseConnection) {
                        try {
                          verifyInfo = await onTestDatabaseConnection(
                            gasUrl.trim(),
                            gasSecret.trim()
                          );
                        } catch {
                          // ignore secondary verify
                        }
                      }
                      setTestResult({
                        ok: true,
                        message: gasUrl.trim()
                          ? 'Terhubung! Seluruh data aplikasi (termasuk Pelanggan, Layanan, Invoice, Kwitansi & Activity Log) berhasil disimpan otomatis ke Google Sheets!'
                          : 'Koneksi Google Apps Script dinonaktifkan (kembali ke penyimpanan lokal/server).',
                        spreadsheetName: verifyInfo.spreadsheetName,
                        spreadsheetUrl: verifyInfo.spreadsheetUrl,
                        counts: verifyInfo.counts,
                      });
                    } catch (err) {
                      setTestResult({
                        ok: false,
                        message:
                          err instanceof Error
                            ? err.message
                            : 'Gagal menyimpan konfigurasi Google Apps Script.',
                      });
                    } finally {
                      setSavingGas(false);
                    }
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label
                      htmlFor="gas-webapp-url"
                      className="block text-xs font-semibold text-[#101B35] mb-1"
                    >
                      Google Apps Script Web App URL (Wajib diakhiri /exec)
                    </label>
                    <input
                      id="gas-webapp-url"
                      type="url"
                      value={gasUrl}
                      onChange={(e) => setGasUrl(e.target.value)}
                      placeholder={
                        databaseStatus.gas_url_masked ||
                        'https://script.google.com/macros/s/.../exec'
                      }
                      className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="gas-api-secret"
                      className="block text-xs font-semibold text-[#101B35] mb-1"
                    >
                      API Secret Key (Opsional — Biarkan kosong jika standar)
                    </label>
                    <input
                      id="gas-api-secret"
                      type="password"
                      value={gasSecret}
                      onChange={(e) => setGasSecret(e.target.value)}
                      placeholder="Kosongkan jika API_SECRET di Code.gs kosong"
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {onTestDatabaseConnection && (
                      <button
                        type="button"
                        disabled={testingGas || savingGas}
                        onClick={async () => {
                          setTestingGas(true);
                          setTestResult(null);
                          try {
                            const res = await onTestDatabaseConnection(
                              gasUrl.trim(),
                              gasSecret.trim()
                            );
                            // Automatically save and push all local data on successful test!
                            if (gasUrl.trim()) {
                              await onSaveDatabaseConfig(
                                gasUrl.trim(),
                                gasSecret.trim()
                              );
                            }
                            const refreshed = await onTestDatabaseConnection(
                              gasUrl.trim(),
                              gasSecret.trim()
                            ).catch(() => res);
                            setTestResult({
                              ok: true,
                              message:
                                'Koneksi berhasil diverifikasi & seluruh data aplikasi telah disinkronkan ke Google Sheets!',
                              spreadsheetName:
                                refreshed.spreadsheetName ||
                                res.spreadsheetName,
                              spreadsheetUrl:
                                refreshed.spreadsheetUrl || res.spreadsheetUrl,
                              counts: refreshed.counts || res.counts,
                              serverTime:
                                refreshed.serverTime || res.serverTime,
                            });
                          } catch (err) {
                            setTestResult({
                              ok: false,
                              message:
                                err instanceof Error
                                  ? err.message
                                  : 'Gagal menghubungi URL Web App.',
                            });
                          } finally {
                            setTestingGas(false);
                          }
                        }}
                        className="flex-1 py-2.5 px-3 bg-white hover:bg-slate-100 text-[#101B35] border border-slate-300 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wifi className="w-3.5 h-3.5 text-[#800020]" />
                        <span>
                          {testingGas ? 'Menguji & Sinkron...' : '1. Test Koneksi'}
                        </span>
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={savingGas || testingGas}
                      className="flex-1 py-2.5 px-4 bg-[#800020] hover:bg-[#670019] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {savingGas
                        ? 'Menyimpan & Sinkronisasi...'
                        : '2. Simpan & Hubungkan'}
                    </button>
                  </div>
                </form>

                {testResult && (
                  <div
                    className={`mt-3.5 p-3 rounded-lg border text-xs ${
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-2 font-semibold">
                      {testResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <span className="break-words">{testResult.message}</span>
                    </div>
                    {testResult.ok && (
                      <div className="mt-2 pl-6 space-y-1 text-[11px] text-emerald-800">
                        {testResult.spreadsheetName && (
                          <div>
                            Nama File:{' '}
                            <span className="font-mono font-bold">
                              {testResult.spreadsheetName}
                            </span>
                          </div>
                        )}
                        {testResult.counts && (
                          <div>
                            Data Tersimpan di Sheets:{' '}
                            <span className="font-semibold">
                              {testResult.counts.CLIENTS ?? 0} Pelanggan ·{' '}
                              {testResult.counts.SERVICES ?? 0} Layanan ·{' '}
                              {testResult.counts.INVOICES ?? 0} Invoice ·{' '}
                              {testResult.counts.PAYMENTS ?? 0} Kwitansi ·{' '}
                              {testResult.counts.ACTIVITY_LOGS ?? 0} Log
                            </span>
                          </div>
                        )}
                        {testResult.spreadsheetUrl && (
                          <a
                            href={testResult.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#800020] font-semibold underline mt-1"
                          >
                            <span>Buka Spreadsheet Sekarang</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                <div className="font-bold text-[#101B35] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Sinkronisasi Otomatis Langsung ke 8 Sheet & Log</span>
                </div>
                <p>
                  Setiap penambahan/perubahan Pelanggan, Katalog Layanan,
                  Invoice, Kwitansi, Pengaturan, maupun Akun Pengguna langsung
                  dikirim otomatis ke Google Sheets Anda beserta baris baru di{' '}
                  <code className="font-mono text-[#800020]">
                    ACTIVITY_LOGS
                  </code>
                  .
                </p>
              </div>
            </div>

            {/* Right 7 cols: Step-by-step installation guide */}
            <div className="lg:col-span-7 bg-[#101B35] text-white rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A15B]">
                    Panduan Integrasi Google Sheets & Apps Script (Anti-Gagal)
                  </span>
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  >
                    <span>Buka Google Sheets Baru</span>
                    <ExternalLink className="w-3 h-3 text-[#C5A15B]" />
                  </a>
                </div>

                <ol className="space-y-2.5 text-xs text-slate-200 list-decimal list-inside leading-relaxed">
                  <li>
                    Buka Google Sheets Anda (boleh bernama bebas seperti{' '}
                    <span className="font-mono text-[#C5A15B]">
                      Nota Invoiche Autosmart 2028 - 2027
                    </span>{' '}
                    atau{' '}
                    <span className="font-mono text-[#C5A15B]">
                      AUTOSMART_INVOICE_DATABASE
                    </span>
                    ).
                  </li>
                  <li>
                    Klik menu <strong>Extensions (Ekstensi)</strong> &rarr;{' '}
                    <strong>Apps Script</strong> di bagian atas Google Sheets.
                  </li>
                  <li>
                    Salin dan pasang kode terbaru dari kotak di bawah:
                    <ul className="pl-5 mt-1 space-y-1 list-disc text-slate-300">
                      <li>
                        <strong className="text-white font-mono">
                          Setup.gs
                        </strong>{' '}
                        — Salin dari tab <em>File 1: Setup.gs</em>, simpan (
                        <code>Ctrl+S</code>), lalu pilih fungsi{' '}
                        <code>setupAutosmartDatabase</code> dan klik{' '}
                        <strong className="text-[#C5A15B]">
                          Run (Jalankan)
                        </strong>
                        .
                      </li>
                      <li>
                        <strong className="text-white font-mono">
                          Code.gs
                        </strong>{' '}
                        — Salin dari tab <em>File 2: Code.gs</em> dan simpan (
                        <code>Ctrl+S</code>). Kode ini sudah mandiri (otomatis
                        mengenali Spreadsheet aktif Anda dan langsung melakukan{' '}
                        <code>SpreadsheetApp.flush()</code>).
                      </li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-[#C5A15B]">
                      PENTING Saat Deploy / Update Kode:
                    </strong>{' '}
                    Klik tombol biru <strong>Deploy</strong> &rarr;{' '}
                    <strong>New deployment</strong> (atau jika sudah pernah
                    deploy: klik <strong>Manage deployments</strong> &rarr; ikon
                    Pensil <em>Edit</em> &rarr; pada <em>Version</em> pilih{' '}
                    <strong className="text-[#C5A15B]">New version</strong>).
                  </li>
                  <li>
                    Pastikan <em>Execute as</em> ={' '}
                    <strong>Me (Email Anda)</strong> dan{' '}
                    <em>Who has access</em> ={' '}
                    <strong className="text-[#C5A15B]">
                      Anyone (Siapa saja)
                    </strong>{' '}
                    (Jangan pilih <em>Only myself</em> atau{' '}
                    <em>Anyone with Google Account</em> karena akan memblokir
                    pengiriman data otomatis dari aplikasi).
                  </li>
                  <li>
                    Salin <strong>Web app URL</strong> (wajib berakhiran{' '}
                    <code>/exec</code>), tempel di kolom sebelah kiri, lalu klik{' '}
                    <strong>2. Simpan & Hubungkan</strong>. Seluruh data yang
                    sudah Anda ketik di aplikasi (seperti{' '}
                    <em>Es Dawet Palembang</em>) akan langsung terkirim ke
                    Google Sheets!
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Tutorial Card: Environment GitHub Pages (github.io) & Vercel (vercel.app) */}
          <div className="mt-6 bg-amber-50/70 rounded-xl border border-amber-200 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#800020] text-white shrink-0 mt-0.5">
                <Wifi className="w-4 h-4" />
              </div>
              <div className="space-y-3 text-xs text-slate-700 leading-relaxed min-w-0 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-[#101B35]">
                    Panduan Khusus Deployment GitHub Pages (github.io) & Vercel
                    (vercel.app)
                  </h3>
                  <p className="text-slate-600 mt-0.5">
                    Mengapa sebelumnya di aplikasi lancar tetapi tidak masuk ke
                    Google Sheets saat di-share via{' '}
                    <code className="font-mono font-semibold text-[#800020]">
                      vercel.app
                    </code>{' '}
                    atau{' '}
                    <code className="font-mono font-semibold text-[#800020]">
                      github.io
                    </code>
                    ? Berikut penjelasan dan solusinya:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200/80 space-y-1.5">
                    <div className="font-bold text-[#101B35]">
                      1. Penyebab di Vercel (vercel.app) & GitHub (github.io)
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                      <li>
                        <strong>GitHub Pages (github.io)</strong> adalah hosting
                        statis (tanpa server Node.js), sehingga aplikasi
                        mengirim data langsung dari browser ke Google Apps
                        Script.
                      </li>
                      <li>
                        <strong>Vercel (vercel.app)</strong> menjalankan fungsi{' '}
                        <em>Serverless</em> yang bersifat sementara (folder{' '}
                        <code>/tmp</code> akan ter-reset setiap beberapa menit
                        ketika container tidur/cold-start).
                      </li>
                      <li>
                        <strong>Solusi yang Sudah Diterapkan di Kode:</strong>{' '}
                        Aplikasi ini sekarang dilengkapi{' '}
                        <strong>Direct Dual-Sync Engine</strong> — setiap kali
                        Anda atau Pemilik menambah Pelanggan, Layanan, Invoice,
                        atau Kwitansi, browser otomatis menyertakan header URL
                        Apps Script sekaligus mengirim langsung ke Google Sheets
                        dan mencatat ke <code>ACTIVITY_LOGS</code>.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-amber-200/80 space-y-1.5">
                    <div className="font-bold text-[#101B35]">
                      2. Agar Link Vercel Otomatis Terhubung di HP/Laptop
                      Pemilik (Tanpa Input Ulang URL)
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Jika Anda hanya menempelkan URL Web App di form atas, URL
                      tersebut tersimpan di browser perangkat Anda. Agar saat
                      link <code>vercel.app</code> dibuka oleh{' '}
                      <strong>Pemilik</strong> di HP/laptop lain langsung
                      terhubung permanen ke Google Sheets:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 font-medium">
                      <li>
                        Buka Dashboard <strong>Vercel</strong> proyek Anda
                        &rarr; klik <strong>Settings</strong> &rarr;{' '}
                        <strong>Environment Variables</strong>.
                      </li>
                      <li>
                        Tambahkan variabel ke-1: Key ={' '}
                        <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#800020] select-all">
                          VITE_GAS_WEB_APP_URL
                        </code>{' '}
                        dan Value = URL Web App <code>/exec</code> Anda.
                      </li>
                      <li>
                        Tambahkan variabel ke-2: Key ={' '}
                        <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#800020] select-all">
                          GAS_WEB_APP_URL
                        </code>{' '}
                        dan Value = URL Web App <code>/exec</code> Anda.
                      </li>
                      <li>
                        Klik <strong>Save</strong> lalu klik{' '}
                        <strong>Redeploy</strong> di tab Deployments Vercel.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Copy-Paste Google Apps Script Code Viewer (Setup.gs & Code.gs) */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#800020] shrink-0" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#101B35]">
                    Kode Google Apps Script Siap Pakai — Versi Terbaru (Setup.gs
                    & Code.gs)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pastikan Anda menyalin ulang Code.gs terbaru di bawah ini ke
                    Apps Script Anda lalu Deploy &rarr; Manage deployments &rarr;
                    Edit &rarr; New version.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveGasFileTab('setup')}
                  className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center ${
                    activeGasFileTab === 'setup'
                      ? 'bg-[#101B35] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  File 1: Setup.gs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGasFileTab('code')}
                  className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center ${
                    activeGasFileTab === 'code'
                      ? 'bg-[#101B35] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  File 2: Code.gs
                </button>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#0B1326] text-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                <div className="text-xs font-mono text-[#C5A15B]">
                  {activeGasFileTab === 'setup'
                    ? 'Setup.gs — Membuat 8 Sheet Tabel & Header Otomatis pada Spreadsheet Aktif (Jalankan setupAutosmartDatabase)'
                    : 'Code.gs — Server API Web App (doGet & doPost) Mandiri + Auto-Flush Penyimpanan Semua 8 Sheet & Activity Log'}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyScript(activeGasFileTab)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#800020] hover:bg-[#670019] text-white transition-colors cursor-pointer shrink-0"
                >
                  {copiedScript === activeGasFileTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>
                        Kode{' '}
                        {activeGasFileTab === 'setup' ? 'Setup.gs' : 'Code.gs'}{' '}
                        Tersalin!
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        Salin Kode{' '}
                        {activeGasFileTab === 'setup' ? 'Setup.gs' : 'Code.gs'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto max-h-80 p-3 rounded-lg bg-black/40 border border-white/10 text-slate-200 select-all">
                <code>
                  {activeGasFileTab === 'setup' ? SETUP_GS_CODE : CODE_GS_CODE}
                </code>
              </pre>
            </div>
          </div>

          {/* 8 Sheets Relational Schema Overview */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-[#101B35] mb-3">
              Struktur 8 Sheet Database Standar (Tersinkronisasi Otomatis)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {sheets.map((s, idx) => (
                <div
                  key={s.name}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-[#800020]">
                      {idx + 1}. {s.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Auto-Sync
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Logs Audit Trail */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-[#101B35]">
              Log Aktivitas Sistem Terbaru (ACTIVITY_LOGS)
            </h3>
            <p className="text-xs text-slate-500">
              Pencatatan otomatis aktivitas pembuatan invoice, pembayaran, dan
              perubahan pengaturan.
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {activityLogs.length === 0 ? (
              <div className="px-4 sm:px-6 py-8 text-center text-xs text-slate-500">
                Belum ada log aktivitas sistem yang tercatat.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#101B35] shrink-0">
                      {log.activity}
                    </span>
                    <span className="text-slate-700 font-medium break-words">
                      {log.description}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono shrink-0">
                    {log.user_name || log.user_id} · {formatDateId(log.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const activeLogoPreview =
    formState.logo_url && formState.logo_url.trim()
      ? formState.logo_url.trim()
      : DEFAULT_COMPANY_LOGO_URL;

  return (
    <div className="space-y-6">
      {/* Company Settings Form */}
      <form
        onSubmit={handleSettingsSubmit}
        className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6"
      >
        {/* 1. Identitas Resmi Perusahaan */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#101B35]">
              1. Identitas Resmi Perusahaan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Data identitas dan logo ini ditampilkan otomatis pada Sidebar,
              Invoice A4, Kwitansi, dan PDF.
            </p>
          </div>

          <div>
            <label
              htmlFor="set-company-name"
              className="block text-xs font-semibold text-[#101B35] mb-1"
            >
              Nama Perusahaan
            </label>
            <input
              id="set-company-name"
              type="text"
              value={formState.company_name || ''}
              onChange={(e) => setField('company_name', e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="set-tagline"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Tagline Perusahaan
              </label>
              <input
                id="set-tagline"
                type="text"
                value={formState.tagline || ''}
                onChange={(e) => setField('tagline', e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>
            <div>
              <label
                htmlFor="set-business-field"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Bidang Usaha
              </label>
              <input
                id="set-business-field"
                type="text"
                value={formState.business_field || ''}
                onChange={(e) => setField('business_field', e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="set-whatsapp"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Nomor WhatsApp Perusahaan
              </label>
              <input
                id="set-whatsapp"
                type="text"
                value={formState.whatsapp || ''}
                onChange={(e) => setField('whatsapp', e.target.value)}
                placeholder="085726686267"
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>
            <div>
              <label
                htmlFor="set-email"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Email Resmi
              </label>
              <input
                id="set-email"
                type="email"
                value={formState.email || ''}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="autosmart2025@gmail.com"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="set-website"
              className="block text-xs font-semibold text-[#101B35] mb-1"
            >
              Website Perusahaan
            </label>
            <input
              id="set-website"
              type="text"
              value={formState.website || ''}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="https://autosmart-abuhafsh.github.io/Autosmart/"
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>

          <div>
            <label
              htmlFor="set-address"
              className="block text-xs font-semibold text-[#101B35] mb-1"
            >
              Alamat Lengkap Perusahaan
            </label>
            <textarea
              id="set-address"
              rows={2}
              value={formState.address || ''}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Alamat lengkap kantor operasional..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
            />
          </div>

          {/* Logo Upload + Live Preview */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-[#101B35] mb-2">
              Logo Perusahaan (Ditampilkan pada Sistem & Dokumen Cetak)
            </label>
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <img
                src={activeLogoPreview}
                alt="Pratinjau Logo Perusahaan"
                className="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-slate-200 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-[160px]">
                <div className="text-xs font-semibold text-[#101B35]">
                  {formState.logo_url &&
                  formState.logo_url !== DEFAULT_COMPANY_LOGO_URL
                    ? 'Logo Kustom Aktif'
                    : 'Logo Resmi Autosmart Digital Solutions'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Otomatis dikompresi agar selalu tersinkronisasi dengan cepat.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-[#101B35] border border-slate-300 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#800020]" />
                  <span>Ganti File Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('logo_url', e)}
                    className="hidden"
                  />
                </label>
                {formState.logo_url &&
                  formState.logo_url !== DEFAULT_COMPANY_LOGO_URL && (
                    <button
                      type="button"
                      onClick={() =>
                        setField('logo_url', DEFAULT_COMPANY_LOGO_URL)
                      }
                      className="inline-flex items-center gap-1 text-xs text-[#800020] font-semibold hover:underline cursor-pointer px-2 py-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset ke Logo Resmi</span>
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Informasi Pembayaran & Penomoran */}
        <div className="space-y-5 sm:space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#101B35]">
                2. Informasi Rekening Bank & QRIS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekening tujuan pembayaran yang tertera otomatis pada Invoice &
                pesan WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-bank-name"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Nama Bank
                </label>
                <input
                  id="set-bank-name"
                  type="text"
                  value={formState.bank_name || ''}
                  onChange={(e) => setField('bank_name', e.target.value)}
                  placeholder="BCA / Mandiri / BRI / BSI"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label
                  htmlFor="set-bank-number"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Nomor Rekening
                </label>
                <input
                  id="set-bank-number"
                  type="text"
                  value={formState.bank_account_number || ''}
                  onChange={(e) =>
                    setField('bank_account_number', e.target.value)
                  }
                  placeholder="0113593935"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="set-bank-holder"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Nama Pemilik Rekening
              </label>
              <input
                id="set-bank-holder"
                type="text"
                value={formState.bank_account_name || ''}
                onChange={(e) => setField('bank_account_name', e.target.value)}
                placeholder="Muhammad"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#101B35] mb-1.5">
                Kode QRIS Pembayaran (Opsional)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {formState.qris_url && (
                  <img
                    src={formState.qris_url}
                    alt="Pratinjau QRIS"
                    className="w-12 h-12 rounded-lg object-contain bg-white p-1 border border-slate-200 shrink-0"
                  />
                )}
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#101B35] cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#800020]" />
                  <span>Upload Gambar QRIS</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('qris_url', e)}
                    className="hidden"
                  />
                </label>
                {formState.qris_url && (
                  <button
                    type="button"
                    onClick={() => setField('qris_url', '')}
                    className="text-xs text-red-600 font-semibold hover:underline cursor-pointer"
                  >
                    Hapus QRIS
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#101B35]">
                3. Pengaturan Penomoran Dokumen & Pajak Opsional
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format penomoran sekuensial otomatis dan penandatangan resmi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-inv-prefix"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Prefix Nomor Invoice
                </label>
                <input
                  id="set-inv-prefix"
                  type="text"
                  value={formState.invoice_prefix || 'INV/ASM'}
                  onChange={(e) => setField('invoice_prefix', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label
                  htmlFor="set-kw-prefix"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Prefix Bukti Pembayaran
                </label>
                <input
                  id="set-kw-prefix"
                  type="text"
                  value={formState.receipt_prefix || 'KW/ASM'}
                  onChange={(e) => setField('receipt_prefix', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label
                  htmlFor="set-doc-year"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Tahun Dokumen
                </label>
                <input
                  id="set-doc-year"
                  type="text"
                  value={formState.document_year || '2026'}
                  onChange={(e) => setField('document_year', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label
                  htmlFor="set-tax-enabled"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Status Pajak Default
                </label>
                <select
                  id="set-tax-enabled"
                  value={formState.tax_enabled || 'false'}
                  onChange={(e) => setField('tax_enabled', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#800020]"
                >
                  <option value="false">Nonaktif (Opsional)</option>
                  <option value="true">Aktif (PPN)</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="set-tax-rate"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Tarif Pajak Default (%)
                </label>
                <input
                  id="set-tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  value={formState.tax_rate || '11'}
                  onChange={(e) => setField('tax_rate', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label
                  htmlFor="set-signatory"
                  className="block text-xs font-semibold text-[#101B35] mb-1"
                >
                  Nama Penandatangan
                </label>
                <input
                  id="set-signatory"
                  type="text"
                  value={formState.signatory_name || ''}
                  onChange={(e) => setField('signatory_name', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="set-footer-note"
                className="block text-xs font-semibold text-[#101B35] mb-1"
              >
                Catatan Footer Dokumen
              </label>
              <input
                id="set-footer-note"
                type="text"
                value={formState.footer_note || ''}
                onChange={(e) => setField('footer_note', e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#800020]"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingSettings
                    ? 'Menyimpan Perubahan...'
                    : 'Simpan Pengaturan Perusahaan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Role-Based User Management (USERS Sheet) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#101B35]">
              Manajemen Pengguna & Hak Akses (Role-Based Access)
            </h2>
            <p className="text-xs text-slate-500">
              Kelola akun Administrator dan Staff pada sheet USERS. Kata sandi
              dienkripsi menggunakan SHA-256/scrypt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUserModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#101B35] hover:bg-[#1a2b52] transition-colors cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#C5A15B]" />
            <span>Tambah Pengguna Baru</span>
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">ID</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Email Login</th>
                <th className="py-3 px-4">Peran (Role)</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-5 font-mono text-slate-500">{u.id}</td>
                  <td className="py-3 px-4 font-semibold text-[#101B35]">
                    {u.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {u.email}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                        u.role === 'Administrator'
                          ? 'bg-[#800020]/10 text-[#800020]'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        u.status === 'Aktif'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateUser(u.id, {
                          status: u.status === 'Aktif' ? 'Nonaktif' : 'Aktif',
                        })
                      }
                      className="text-xs font-semibold text-[#800020] hover:underline cursor-pointer"
                    >
                      {u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-200">
          {users.map((u) => (
            <div key={u.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#101B35] truncate">
                    {u.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {u.email}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                    u.status === 'Aktif'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {u.status}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400">
                    {u.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      u.role === 'Administrator'
                        ? 'bg-[#800020]/10 text-[#800020]'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateUser(u.id, {
                      status: u.status === 'Aktif' ? 'Nonaktif' : 'Aktif',
                    })
                  }
                  className="text-xs font-semibold text-[#800020] hover:underline cursor-pointer"
                >
                  {u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-[#101B35] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Tambah Pengguna Sistem Baru</h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="text-slate-300 hover:text-white text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="p-5 space-y-4">
              {userError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {userError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Email Login
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Kata Sandi Awal
                </label>
                <input
                  type="password"
                  required
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#101B35] mb-1">
                  Hak Akses (Role)
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Staff">
                    Staff (Operasional Invoice & Pembayaran)
                  </option>
                  <option value="Administrator">
                    Administrator (Akses Penuh)
                  </option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] rounded-lg cursor-pointer"
                >
                  {savingUser ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
