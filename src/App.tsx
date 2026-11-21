/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { LoginView } from './components/LoginView';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ClientManagement } from './components/ClientManagement';
import { ServiceManagement } from './components/ServiceManagement';
import { InvoiceManagement } from './components/InvoiceManagement';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { PaymentManagement } from './components/PaymentManagement';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ReportsView } from './components/ReportsView';
import { CompanySettingsView } from './components/CompanySettingsView';
import type {
  ActivityLog,
  Client,
  CompanySettingsMap,
  DatabaseStatus,
  Invoice,
  Payment,
  ServiceItem,
  User,
} from './types/invoice';
import {
  appendLocalActivityLog,
  handleClientFallbackApi,
  loadLocalDb,
  loadLocalGasConfig,
  markEntityDeleted,
  mirrorBootstrapToLocalDb,
  pullFromGasDirectToLocalDb,
  saveLocalDb,
  saveLocalGasConfig,
  syncLocalDbToGasIfConfigured,
  validateGasWebAppUrl,
} from './utils/clientFallbackEngine';
import { parseServiceCategories } from './utils/invoiceLogic';

const DEFAULT_SETTINGS: CompanySettingsMap = {
  company_name: 'Autosmart Digital Solutions',
  tagline: 'Skill Up For Digital Collaboration',
  business_field: 'Digital Learning & Business Solution',
  address: '',
  whatsapp: '',
  email: '',
  website: '',
  logo_url: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  qris_url: '',
  invoice_prefix: 'INV/ASM',
  receipt_prefix: 'KW/ASM',
  document_year: '2026',
  footer_note:
    'Terima kasih telah mempercayakan kebutuhan digital bisnis Anda kepada Autosmart Digital Solutions.',
  terms_and_conditions: '',
  tax_enabled: 'false',
  tax_rate: '11',
  currency: 'IDR',
  date_format: 'DD MMMM YYYY',
  signatory_name: 'Administrator Autosmart',
  signatory_role: 'Finance & Administration',
};

const DEFAULT_DB_STATUS: DatabaseStatus = {
  mode: 'LOCAL_STORAGE',
  connected: false,
  spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
  gas_url_configured: false,
  gas_url_masked: '',
  last_sync: null,
  message: 'Database Persisten Aktif (Siap disinkronkan ke Google Sheets)',
};

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      localStorage.setItem('autosmart_token', 'demo-autostart-admin');
      return 'demo-autostart-admin';
    }
    return localStorage.getItem('autosmart_token');
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState<boolean>(
    Boolean(token)
  );
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Core Application State
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] =
    useState<CompanySettingsMap>(DEFAULT_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [databaseStatus, setDatabaseStatus] =
    useState<DatabaseStatus>(DEFAULT_DB_STATUS);

  // Cross-Module Modals & Triggers
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<{
    payment: Payment;
    invoice?: Invoice;
  } | null>(null);
  const [whatsAppContext, setWhatsAppContext] = useState<{
    invoice: Invoice;
    payment?: Payment | null;
  } | null>(null);
  const [triggerCreateInvoice, setTriggerCreateInvoice] = useState(false);
  const [preselectedPaymentInvoice, setPreselectedPaymentInvoice] =
    useState<Invoice | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    },
    []
  );

  // Adopt ?gas_url=... magic sync link automatically on any device (HP or PC)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = (params.get('gas_url') || '').trim();
      const secretParam = (params.get('gas_secret') || '').trim();
      if (urlParam && validateGasWebAppUrl(urlParam) === null) {
        const currentCfg = loadLocalGasConfig();
        saveLocalGasConfig({
          webAppUrl: urlParam,
          apiSecret: secretParam || currentCfg.apiSecret,
          lastSync: currentCfg.lastSync,
        });
        params.delete('gas_url');
        params.delete('gas_secret');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
        showToast(
          'Perangkat ini otomatis terhubung ke Google Sheets! Menyinkronkan data HP & PC...'
        );
      }
    } catch {
      // ignore URL parse issues
    }
  }, [showToast]);

  const applyLocalDbToReactState = useCallback(() => {
    const db = loadLocalDb();
    const gasCfg = loadLocalGasConfig();
    const hydratedInvoices: Invoice[] = db.INVOICES.map((inv) => ({
      ...inv,
      items: db.INVOICE_ITEMS.filter((it) => it.invoice_id === inv.id),
      client: db.CLIENTS.find((c) => c.id === inv.client_id),
    }));
    const settingsMap: CompanySettingsMap = {
      ...DEFAULT_SETTINGS,
      ...db.SETTINGS,
    };
    setClients([...db.CLIENTS]);
    setServices([...db.SERVICES]);
    setInvoices(hydratedInvoices);
    setPayments([...db.PAYMENTS]);
    setSettings(settingsMap);
    setUsers([...db.USERS]);
    setActivityLogs([...db.ACTIVITY_LOGS]);
    if (gasCfg.webAppUrl) {
      setDatabaseStatus({
        mode: 'GOOGLE_SHEETS',
        connected: true,
        spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
        gas_url_configured: true,
        gas_url: gasCfg.webAppUrl,
        gas_url_masked: `${gasCfg.webAppUrl.slice(0, 42)}...`,
        last_sync: gasCfg.lastSync,
        message:
          'Terhubung & tersinkronisasi 2 arah ke Google Sheets (HP & PC Sinkron)',
      });
    }
  }, []);

  const apiRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const activeToken =
        token || localStorage.getItem('autosmart_token') || '';
      const localGas = loadLocalGasConfig();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      if (localGas.webAppUrl) {
        headers['X-Gas-Web-App-Url'] = localGas.webAppUrl;
        if (localGas.apiSecret) {
          headers['X-Gas-Api-Secret'] = localGas.apiSecret;
        }
      }

      try {
        const res = await fetch(url, { ...options, headers });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (res.status === 401) {
              return await handleClientFallbackApi(url, options, activeToken);
            }
            throw new Error(data.error || `Permintaan gagal (${res.status})`);
          }
          return data;
        }
        // Server returned non-JSON (e.g. GitHub Pages static deployment): use client fallback engine
        return await handleClientFallbackApi(url, options, activeToken);
      } catch (err) {
        // Network error or cold-start failure: use client fallback engine
        if (
          err instanceof Error &&
          !err.message.includes('Failed to fetch') &&
          !err.message.includes('NetworkError') &&
          !err.message.includes('Load failed')
        ) {
          throw err;
        }
        return await handleClientFallbackApi(url, options, activeToken);
      }
    },
    [token]
  );

  const syncWithGoogleSheetsNow = useCallback(
    async (silent: boolean = false) => {
      const gasCfg = loadLocalGasConfig();
      if (!gasCfg.webAppUrl) return;
      if (!silent) setIsSyncingCloud(true);
      try {
        const boot = (await apiRequest('/api/bootstrap?sync=1')) as {
          clients?: Client[];
          services?: ServiceItem[];
          invoices?: Invoice[];
          payments?: Payment[];
          settings?: CompanySettingsMap;
          users?: User[];
          activityLogs?: ActivityLog[];
          databaseStatus?: DatabaseStatus;
        };
        const mirrored = mirrorBootstrapToLocalDb(boot);
        setClients(mirrored.mergedDb.CLIENTS);
        setServices(mirrored.mergedDb.SERVICES);
        setInvoices(mirrored.mergedDb.INVOICES);
        setPayments(mirrored.mergedDb.PAYMENTS);
        setSettings({ ...DEFAULT_SETTINGS, ...mirrored.mergedSettings });
        setUsers(mirrored.mergedDb.USERS);
        setActivityLogs(mirrored.mergedDb.ACTIVITY_LOGS);
        if (boot.databaseStatus) {
          setDatabaseStatus(boot.databaseStatus);
        }

        if (mirrored.localHadMoreData) {
          await apiRequest('/api/database/sync', {
            method: 'POST',
            body: JSON.stringify({ localDb: mirrored.mergedDb }),
          }).catch(() => {});
        }

        if (!silent) {
          showToast(
            'Data berhasil disinkronkan 2 arah dengan Google Sheets (HP & PC Sinkron).'
          );
        }
      } catch (err) {
        if (!silent) {
          showToast(
            `Gagal sinkronisasi: ${err instanceof Error ? err.message : String(err)}`,
            'error'
          );
        }
      } finally {
        if (!silent) setIsSyncingCloud(false);
      }
    },
    [apiRequest, showToast]
  );

  const loadBootstrapData = useCallback(async () => {
    if (!token) return;
    setLoadingBootstrap(true);
    try {
      const meRes = (await apiRequest('/api/auth/me')) as { user: User };
      setCurrentUser(meRes.user);

      const boot = (await apiRequest('/api/bootstrap')) as {
        clients?: Client[];
        services?: ServiceItem[];
        invoices?: Invoice[];
        payments?: Payment[];
        settings?: CompanySettingsMap;
        users?: User[];
        activityLogs?: ActivityLog[];
        databaseStatus?: DatabaseStatus;
      };
      const mirrored = mirrorBootstrapToLocalDb(boot);
      const effectiveClients = mirrored.mergedDb.CLIENTS;
      const effectiveServices = mirrored.mergedDb.SERVICES;
      const effectiveInvoices = mirrored.mergedDb.INVOICES;
      const effectivePayments = mirrored.mergedDb.PAYMENTS;
      const effectiveUsers = mirrored.mergedDb.USERS;
      const effectiveLogs = mirrored.mergedDb.ACTIVITY_LOGS;

      setClients(effectiveClients);
      setServices(effectiveServices);
      setInvoices(effectiveInvoices);
      setPayments(effectivePayments);
      setSettings({ ...DEFAULT_SETTINGS, ...mirrored.mergedSettings });
      setUsers(effectiveUsers);
      setActivityLogs(effectiveLogs);

      const localGasCfg = loadLocalGasConfig();
      if (boot.databaseStatus) {
        if (
          !boot.databaseStatus.gas_url_configured &&
          localGasCfg.webAppUrl
        ) {
          setDatabaseStatus({
            mode: 'GOOGLE_SHEETS',
            connected: true,
            spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
            gas_url_configured: true,
            gas_url: localGasCfg.webAppUrl,
            gas_url_masked: `${localGasCfg.webAppUrl.slice(0, 42)}...`,
            last_sync: localGasCfg.lastSync || boot.databaseStatus.last_sync,
            message:
              'Terhubung ke Google Sheets melalui Google Apps Script Proxy',
          });
        } else {
          setDatabaseStatus(boot.databaseStatus);
        }
      }

      // Release initial loading screen immediately so UI is responsive
      setLoadingBootstrap(false);

      // If this device had unsynced local additions (e.g. SRV-0015 & SRV-0016 on PC or CLT-0001 on HP), push merged state to GAS in background
      const activeGasCfg = loadLocalGasConfig();
      if (mirrored.localHadMoreData && activeGasCfg.webAppUrl) {
        void apiRequest('/api/database/sync', {
          method: 'POST',
          body: JSON.stringify({ localDb: mirrored.mergedDb }),
        }).catch(() => {
          void syncLocalDbToGasIfConfigured(mirrored.mergedDb);
        });
      }
    } catch {
      localStorage.removeItem('autosmart_token');
      setToken(null);
      setCurrentUser(null);
    } finally {
      setLoadingBootstrap(false);
    }
  }, [token, apiRequest]);

  useEffect(() => {
    if (token) {
      loadBootstrapData();
    }
  }, [token, loadBootstrapData]);

  // Continuous background 2-way sync across HP & PC (on tab focus, visibilitychange, and 15s polling)
  useEffect(() => {
    if (!token) return;

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncWithGoogleSheetsNow(true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncWithGoogleSheetsNow(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.clearInterval(intervalId);
    };
  }, [token, syncWithGoogleSheetsNow]);

  const handleSelectTab = useCallback(
    (nextTab: NavTab) => {
      setActiveTab(nextTab);
      void syncWithGoogleSheetsNow(true);
    },
    [syncWithGoogleSheetsNow]
  );

  /**
   * Ensures every mutation in the application:
   * 1. Is recorded in ACTIVITY_LOGS (both local and state)
   * 2. Is pushed to Google Apps Script if a GAS Web App URL is configured
   */
  const ensureGasSyncAfterMutation = useCallback(
    async (
      serverRes: { gasSynced?: boolean; gasError?: string } | undefined,
      activityCode: string,
      description: string
    ): Promise<{ gasSynced: boolean; gasError?: string }> => {
      const localDb = loadLocalDb();
      const topLog = localDb.ACTIVITY_LOGS[0];
      let latestLog = topLog;
      if (
        !topLog ||
        topLog.activity !== activityCode ||
        topLog.description !== description
      ) {
        latestLog = appendLocalActivityLog(
          localDb,
          currentUser,
          activityCode,
          description
        );
        saveLocalDb(localDb);
        setActivityLogs([...localDb.ACTIVITY_LOGS]);
      }

      const localGas = loadLocalGasConfig();
      if (!localGas.webAppUrl) {
        return { gasSynced: false };
      }

      if (serverRes?.gasSynced) {
        setDatabaseStatus((prev) => ({
          ...prev,
          mode: 'GOOGLE_SHEETS',
          connected: true,
          gas_url_configured: true,
          gas_url: localGas.webAppUrl,
          last_sync: new Date().toISOString(),
          message:
            'Terhubung & tersinkronisasi 2 arah ke Google Sheets (Semua 8 Sheet & Activity Log)',
        }));
        return { gasSynced: true };
      }

      // Direct fallback for static hosting (github.io) or cold-start instances
      const directSync = await syncLocalDbToGasIfConfigured(localDb, latestLog);
      if (directSync.synced) {
        setDatabaseStatus((prev) => ({
          ...prev,
          mode: 'GOOGLE_SHEETS',
          connected: true,
          gas_url_configured: true,
          gas_url: localGas.webAppUrl,
          last_sync: new Date().toISOString(),
          message:
            'Terhubung & tersinkronisasi 2 arah ke Google Sheets (Semua 8 Sheet & Activity Log)',
        }));
        return { gasSynced: true };
      }

      return {
        gasSynced: false,
        gasError: directSync.error || serverRes?.gasError,
      };
    },
    [currentUser]
  );

  const handleLoginSuccess = (newToken: string, user: User) => {
    localStorage.setItem('autosmart_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    showToast(`Selamat datang kembali, ${user.name}.`);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('autosmart_token');
    setToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // --- CRUD Handlers ---
  const handleCreateClient = async (
    payload: Omit<Client, 'id' | 'created_at'>
  ) => {
    const res = (await apiRequest('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as { client: Client; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    const syncInfo = await ensureGasSyncAfterMutation(
      res,
      'CREATE_CLIENT',
      `Menambahkan pelanggan baru ${res.client.client_name} (${res.client.id})`
    );
    if (syncInfo.gasError) {
      showToast(
        `Pelanggan ${res.client.client_name} tersimpan di aplikasi, namun gagal kirim ke Google Sheets: ${syncInfo.gasError}`,
        'error'
      );
    } else {
      showToast(
        syncInfo.gasSynced
          ? `Pelanggan ${res.client.client_name} berhasil ditambahkan & tersimpan otomatis ke Google Sheets.`
          : `Pelanggan ${res.client.client_name} berhasil ditambahkan.`
      );
    }
  };

  const handleUpdateClient = async (
    id: string,
    payload: Omit<Client, 'id' | 'created_at'>
  ) => {
    const res = (await apiRequest(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })) as { client: Client; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    const syncInfo = await ensureGasSyncAfterMutation(
      res,
      'UPDATE_CLIENT',
      `Memperbarui data pelanggan ${res.client.client_name} (${id})`
    );
    if (syncInfo.gasError) {
      showToast(
        `Data pelanggan diperbarui, namun gagal sinkron ke Google Sheets: ${syncInfo.gasError}`,
        'error'
      );
    } else {
      showToast(`Data pelanggan ${res.client.client_name} berhasil diperbarui.`);
    }
  };

  const handleDeleteClient = async (id: string) => {
    markEntityDeleted(id);
    const res = (await apiRequest(`/api/clients/${id}`, {
      method: 'DELETE',
    })) as { gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'DELETE_CLIENT',
      `Menghapus pelanggan (${id})`
    );
    showToast('Data pelanggan berhasil dihapus.');
  };

  const handleCreateService = async (
    payload: Omit<ServiceItem, 'id' | 'created_at'>
  ) => {
    const res = (await apiRequest('/api/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as { service: ServiceItem; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    const syncInfo = await ensureGasSyncAfterMutation(
      res,
      'CREATE_SERVICE',
      `Menambahkan layanan ${res.service.service_name} (${res.service.id})`
    );
    if (syncInfo.gasError) {
      showToast(
        `Layanan ditambahkan, namun gagal sinkron ke Google Sheets: ${syncInfo.gasError}`,
        'error'
      );
    } else {
      showToast(`Layanan ${res.service.service_name} berhasil ditambahkan.`);
    }
  };

  const handleUpdateService = async (
    id: string,
    payload: Omit<ServiceItem, 'id' | 'created_at'>
  ) => {
    const res = (await apiRequest(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })) as { service: ServiceItem; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'UPDATE_SERVICE',
      `Memperbarui layanan ${res.service.service_name} (${id})`
    );
    showToast(`Layanan ${res.service.service_name} berhasil diperbarui.`);
  };

  const handleDeleteService = async (id: string) => {
    markEntityDeleted(id);
    const res = (await apiRequest(`/api/services/${id}`, {
      method: 'DELETE',
    })) as { gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'DELETE_SERVICE',
      `Menghapus layanan (${id})`
    );
    showToast('Layanan berhasil dihapus dari katalog.');
  };

  const handleAddCategory = async (categoryName: string) => {
    const res = (await apiRequest('/api/services/categories', {
      method: 'POST',
      body: JSON.stringify({ category: categoryName }),
    })) as {
      settings?: CompanySettingsMap;
      added?: string;
      gasSynced?: boolean;
      gasError?: string;
    };
    if (res.settings) {
      setSettings((prev) => ({ ...prev, ...res.settings }));
    }
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'CREATE_CATEGORY',
      `Menambahkan kategori layanan baru "${res.added || categoryName}"`
    );
    showToast(`Kategori "${res.added || categoryName}" berhasil ditambahkan.`);
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const res = (await apiRequest('/api/services/categories', {
      method: 'PUT',
      body: JSON.stringify({ oldCategory: oldName, newCategory: newName }),
    })) as {
      settings?: CompanySettingsMap;
      gasSynced?: boolean;
      gasError?: string;
    };
    if (res.settings) {
      setSettings((prev) => ({ ...prev, ...res.settings }));
    }
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'RENAME_CATEGORY',
      `Mengubah nama kategori layanan "${oldName}" menjadi "${newName}"`
    );
    showToast(
      `Kategori "${oldName}" berhasil diubah menjadi "${newName}".`
    );
  };

  const handleDeleteCategory = async (
    categoryName: string,
    fallbackCategory?: string
  ) => {
    const res = (await apiRequest('/api/services/categories', {
      method: 'DELETE',
      body: JSON.stringify({ category: categoryName, fallbackCategory }),
    })) as {
      settings?: CompanySettingsMap;
      reassignedCount?: number;
      fallbackUsed?: string;
      gasSynced?: boolean;
      gasError?: string;
    };
    if (res.settings) {
      setSettings((prev) => ({ ...prev, ...res.settings }));
    }
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'DELETE_CATEGORY',
      `Menghapus kategori layanan "${categoryName}"`
    );
    showToast(
      (res.reassignedCount || 0) > 0
        ? `Kategori "${categoryName}" dihapus (${res.reassignedCount} layanan dipindahkan ke "${res.fallbackUsed}").`
        : `Kategori "${categoryName}" berhasil dihapus.`
    );
  };

  const handleResetCategories = async () => {
    const res = (await apiRequest('/api/services/categories/reset', {
      method: 'POST',
    })) as {
      settings?: CompanySettingsMap;
      gasSynced?: boolean;
      gasError?: string;
    };
    if (res.settings) {
      setSettings((prev) => ({ ...prev, ...res.settings }));
    }
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'RESET_CATEGORIES',
      'Memulihkan daftar kategori layanan ke 16 kategori standar'
    );
    showToast('Daftar kategori layanan standar berhasil dipulihkan.');
  };

  const serviceCategories = React.useMemo(
    () => parseServiceCategories(settings.service_categories, services),
    [settings.service_categories, services]
  );

  const handleCreateInvoice = async (
    payload: Record<string, unknown>
  ): Promise<Invoice> => {
    const res = (await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as { invoice: Invoice; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    const syncInfo = await ensureGasSyncAfterMutation(
      res,
      'CREATE_INVOICE',
      `Membuat invoice ${res.invoice.invoice_number} untuk ${res.invoice.client?.client_name || res.invoice.client_id}`
    );
    if (syncInfo.gasError) {
      showToast(
        `Invoice ${res.invoice.invoice_number} diterbitkan, namun gagal sinkron ke Google Sheets: ${syncInfo.gasError}`,
        'error'
      );
    } else {
      showToast(`Invoice ${res.invoice.invoice_number} berhasil diterbitkan.`);
    }
    return res.invoice;
  };

  const handleUpdateInvoice = async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<Invoice> => {
    const res = (await apiRequest(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })) as { invoice: Invoice; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'UPDATE_INVOICE',
      `Memperbarui invoice ${res.invoice.invoice_number} (${id})`
    );
    showToast(`Invoice ${res.invoice.invoice_number} berhasil diperbarui.`);
    return res.invoice;
  };

  const handleDeleteInvoice = async (id: string) => {
    markEntityDeleted(id);
    const res = (await apiRequest(`/api/invoices/${id}`, {
      method: 'DELETE',
    })) as { gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'DELETE_INVOICE',
      `Menghapus invoice (${id})`
    );
    showToast('Dokumen invoice berhasil dihapus.');
  };

  const handleRecordPayment = async (
    payload: Record<string, unknown>
  ): Promise<Payment> => {
    const res = (await apiRequest('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as { payment: Payment; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    const syncInfo = await ensureGasSyncAfterMutation(
      res,
      'RECORD_PAYMENT',
      `Mencatat pembayaran ${res.payment.receipt_number} sebesar Rp ${Number(res.payment.amount || 0).toLocaleString('id-ID')}`
    );
    if (syncInfo.gasError) {
      showToast(
        `Pembayaran ${res.payment.receipt_number} dicatat, namun gagal sinkron ke Google Sheets: ${syncInfo.gasError}`,
        'error'
      );
    } else {
      showToast(
        `Pembayaran ${res.payment.receipt_number} berhasil dicatat dan status invoice diperbarui.`
      );
    }
    return res.payment;
  };

  const handleUpdatePayment = async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<Payment> => {
    const res = (await apiRequest(`/api/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })) as { payment: Payment; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'UPDATE_PAYMENT',
      `Memperbarui pembayaran ${res.payment.receipt_number}`
    );
    showToast(
      `Catatan pembayaran ${res.payment.receipt_number} berhasil diperbarui.`
    );
    return res.payment;
  };

  const handleDeletePayment = async (id: string) => {
    markEntityDeleted(id);
    const res = (await apiRequest(`/api/payments/${id}`, {
      method: 'DELETE',
    })) as { gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'DELETE_PAYMENT',
      `Menghapus pembayaran (${id})`
    );
    showToast('Catatan pembayaran berhasil dihapus.');
  };

  const handleSaveSettings = async (updates: Partial<CompanySettingsMap>) => {
    const res = (await apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })) as {
      settings?: CompanySettingsMap;
      gasSynced?: boolean;
      gasError?: string;
    };
    setSettings((prev) => ({ ...prev, ...(res.settings || {}) }));
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'UPDATE_SETTINGS',
      'Memperbarui pengaturan profil & konfigurasi perusahaan'
    );
    showToast('Pengaturan identitas perusahaan berhasil disimpan.');
  };

  const handleCreateUser = async (payload: Record<string, unknown>) => {
    const res = (await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })) as { user?: User; gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'CREATE_USER',
      `Menambahkan akun pengguna ${String(payload.email || '')} (${String(payload.role || 'Staff')})`
    );
    showToast('Pengguna baru berhasil ditambahkan.');
  };

  const handleUpdateUser = async (
    id: string,
    payload: Record<string, unknown>
  ) => {
    const res = (await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })) as { gasSynced?: boolean; gasError?: string };
    await loadBootstrapData();
    await ensureGasSyncAfterMutation(
      res,
      'UPDATE_USER',
      `Memperbarui akun pengguna (${id})`
    );
    showToast('Data pengguna berhasil diperbarui.');
  };

  const handleSaveDatabaseConfig = async (
    webAppUrl: string,
    apiSecret: string
  ) => {
    const existingCfg = loadLocalGasConfig();
    saveLocalGasConfig({
      webAppUrl: webAppUrl.trim(),
      apiSecret: apiSecret.trim(),
      lastSync: existingCfg.lastSync,
    });
    const res = (await apiRequest('/api/database/config', {
      method: 'POST',
      body: JSON.stringify({ webAppUrl, apiSecret }),
    })) as {
      databaseStatus?: DatabaseStatus;
      autoSynced?: boolean;
      autoSyncError?: string;
    };
    if (res.databaseStatus) {
      setDatabaseStatus(res.databaseStatus);
    }

    // Guarantee direct push of all local data (including existing clients like Es Dawet Palembang)
    let directSynced = Boolean(res.autoSynced);
    let directError = res.autoSyncError || '';
    if (webAppUrl.trim() && !directSynced) {
      const syncCheck = await syncLocalDbToGasIfConfigured(loadLocalDb());
      directSynced = syncCheck.synced;
      if (!syncCheck.synced && syncCheck.error) {
        directError = syncCheck.error;
      }
    }

    await loadBootstrapData();
    if (webAppUrl.trim() && !directSynced && directError) {
      throw new Error(directError);
    }
    showToast(
      directSynced
        ? 'Terhubung! Seluruh data pelanggan, layanan, invoice, kwitansi & log berhasil disinkronkan ke Google Sheets.'
        : 'Konfigurasi koneksi Google Apps Script berhasil disimpan.'
    );
  };

  const handleTriggerDatabaseSync = async () => {
    await pullFromGasDirectToLocalDb();
    await apiRequest('/api/database/sync', { method: 'POST' });
    await syncLocalDbToGasIfConfigured(loadLocalDb());
    await loadBootstrapData();
    showToast(
      'Sinkronisasi 2 arah (Merge & Push) seluruh data & log aktivitas ke Google Sheets berhasil.'
    );
  };

  const handlePullDatabaseFromGas = async () => {
    await pullFromGasDirectToLocalDb();
    await apiRequest('/api/database/pull', { method: 'POST' });
    await loadBootstrapData();
    showToast(
      'Data nota, invoice, pembayaran, pelanggan, layanan, dan log terbaru berhasil ditarik dari Google Sheets.'
    );
  };

  const handleTestDatabaseConnection = async (
    webAppUrl: string,
    apiSecret: string
  ) => {
    return (await apiRequest('/api/database/test', {
      method: 'POST',
      body: JSON.stringify({ webAppUrl, apiSecret }),
    })) as {
      ok: boolean;
      spreadsheetName?: string;
      spreadsheetUrl?: string;
      counts?: Record<string, number>;
      serverTime?: string;
    };
  };

  // Unauthenticated View
  if (!token || !currentUser) {
    if (loadingBootstrap) {
      return (
        <div className="min-h-screen bg-[#101B35] flex items-center justify-center text-white text-sm font-medium">
          Memuat Sistem Autosmart Invoice...
        </div>
      );
    }
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-[#101B35] flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        settings={settings}
        databaseStatus={databaseStatus}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          currentUser={currentUser}
          databaseStatus={databaseStatus}
          isSyncingCloud={isSyncingCloud}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickSyncCloud={() => void syncWithGoogleSheetsNow(false)}
          onOpenDatabaseTab={() => handleSelectTab('database')}
          onQuickCreateInvoice={() => {
            setTriggerCreateInvoice(true);
            handleSelectTab('invoices');
          }}
          onQuickRecordPayment={() => {
            const firstUnpaid = invoices.find(
              (i) => i.balance > 0 && i.status !== 'Cancelled'
            );
            setPreselectedPaymentInvoice(firstUnpaid || invoices[0] || null);
            handleSelectTab('payments');
          }}
        />

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold no-print ${
              toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-[#101B35] text-white border-[#C5A15B]/40'
            }`}
          >
            {toast.message}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              invoices={invoices}
              payments={payments}
              onViewInvoice={(inv) => setPreviewInvoice(inv)}
              onRecordPaymentForInvoice={(inv) => {
                setPreselectedPaymentInvoice(inv);
                setActiveTab('payments');
              }}
              onOpenWhatsAppForInvoice={(inv) =>
                setWhatsAppContext({ invoice: inv, payment: null })
              }
              onNavigateToInvoices={() => setActiveTab('invoices')}
              onCreateNewInvoice={() => {
                setTriggerCreateInvoice(true);
                setActiveTab('invoices');
              }}
            />
          )}

          {activeTab === 'clients' && (
            <ClientManagement
              clients={clients}
              invoices={invoices}
              onCreateClient={handleCreateClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
            />
          )}

          {activeTab === 'services' && (
            <ServiceManagement
              services={services}
              categories={serviceCategories}
              onCreateService={handleCreateService}
              onUpdateService={handleUpdateService}
              onDeleteService={handleDeleteService}
              onAddCategory={handleAddCategory}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
              onResetCategories={handleResetCategories}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoiceManagement
              invoices={invoices}
              clients={clients}
              services={services}
              settings={settings}
              currentUser={currentUser}
              initialOpenCreate={triggerCreateInvoice}
              onClearInitialCreate={() => setTriggerCreateInvoice(false)}
              onCreateInvoice={handleCreateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
              onRecordPaymentForInvoice={(inv) => {
                setPreselectedPaymentInvoice(inv);
                setActiveTab('payments');
              }}
              onOpenWhatsAppForInvoice={(inv) =>
                setWhatsAppContext({ invoice: inv, payment: null })
              }
            />
          )}

          {activeTab === 'payments' && (
            <PaymentManagement
              payments={payments}
              invoices={invoices}
              settings={settings}
              preselectedInvoice={preselectedPaymentInvoice}
              onClearPreselectedInvoice={() =>
                setPreselectedPaymentInvoice(null)
              }
              onRecordPayment={handleRecordPayment}
              onUpdatePayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
              onPreviewReceipt={(pay, inv) => {
                const matchedInv =
                  inv || invoices.find((i) => i.id === pay.invoice_id);
                setPreviewReceipt({ payment: pay, invoice: matchedInv });
              }}
              onOpenWhatsAppReceipt={(pay, inv) => {
                const matchedInv =
                  inv || invoices.find((i) => i.id === pay.invoice_id);
                if (matchedInv) {
                  setWhatsAppContext({ invoice: matchedInv, payment: pay });
                }
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              invoices={invoices}
              payments={payments}
              clients={clients}
              services={services}
              settings={settings}
            />
          )}

          {(activeTab === 'settings' || activeTab === 'database') && (
            <CompanySettingsView
              mode={activeTab}
              settings={settings}
              users={users}
              activityLogs={activityLogs}
              databaseStatus={databaseStatus}
              onSaveSettings={handleSaveSettings}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onSaveDatabaseConfig={handleSaveDatabaseConfig}
              onTriggerDatabaseSync={handleTriggerDatabaseSync}
              onPullDatabaseFromGas={handlePullDatabaseFromGas}
              onTestDatabaseConnection={handleTestDatabaseConnection}
            />
          )}
        </main>
      </div>

      {/* Document & Communication Modals */}
      {previewInvoice && (
        <InvoicePreviewModal
          invoice={
            invoices.find((i) => i.id === previewInvoice.id) || previewInvoice
          }
          settings={settings}
          onClose={() => setPreviewInvoice(null)}
          onOpenWhatsApp={(inv) => {
            setPreviewInvoice(null);
            setWhatsAppContext({ invoice: inv, payment: null });
          }}
          onRecordPayment={(inv) => {
            setPreviewInvoice(null);
            setPreselectedPaymentInvoice(inv);
            setActiveTab('payments');
          }}
        />
      )}

      {previewReceipt && (
        <ReceiptPreviewModal
          payment={previewReceipt.payment}
          invoice={
            invoices.find((i) => i.id === previewReceipt.payment.invoice_id) ||
            previewReceipt.invoice
          }
          settings={settings}
          onClose={() => setPreviewReceipt(null)}
          onSendWhatsApp={(pay, inv) => {
            setPreviewReceipt(null);
            if (inv) {
              setWhatsAppContext({ invoice: inv, payment: pay });
            }
          }}
        />
      )}

      {whatsAppContext && (
        <WhatsAppModal
          invoice={whatsAppContext.invoice}
          payment={whatsAppContext.payment}
          settings={settings}
          onClose={() => setWhatsAppContext(null)}
        />
      )}
    </div>
  );
}
