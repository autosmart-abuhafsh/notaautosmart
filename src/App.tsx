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
  handleClientFallbackApi,
  loadLocalGasConfig,
  mirrorBootstrapToLocalDb,
  saveLocalGasConfig,
} from './utils/clientFallbackEngine';

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
  mode: 'DEMO_LOCAL',
  connected: false,
  spreadsheet_name: 'AUTOSMART_INVOICE_DATABASE',
  gas_url_configured: false,
  gas_url_masked: '',
  last_sync: null,
  message: 'Mode DEMO / Database Persisten Lokal Aktif',
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
      }, 3500);
    },
    []
  );

  const apiRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const activeToken =
        token || localStorage.getItem('autosmart_token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
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
        // Server returned non-JSON (e.g. static deployment): use client fallback engine
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
      mirrorBootstrapToLocalDb(boot);
      setClients(boot.clients || []);
      setServices(boot.services || []);
      setInvoices(boot.invoices || []);
      setPayments(boot.payments || []);
      setSettings({ ...DEFAULT_SETTINGS, ...(boot.settings || {}) });
      setUsers(boot.users || []);
      setActivityLogs(boot.activityLogs || []);
      if (boot.databaseStatus) {
        setDatabaseStatus(boot.databaseStatus);
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
  const handleCreateClient = async (payload: Partial<Client>) => {
    const res = await apiRequest('/api/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Pelanggan ${res.client.client_name} berhasil ditambahkan.`);
  };

  const handleUpdateClient = async (id: string, payload: Partial<Client>) => {
    const res = await apiRequest(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Data pelanggan ${res.client.client_name} berhasil diperbarui.`);
  };

  const handleDeleteClient = async (id: string) => {
    await apiRequest(`/api/clients/${id}`, { method: 'DELETE' });
    await loadBootstrapData();
    showToast('Data pelanggan berhasil dihapus.');
  };

  const handleCreateService = async (payload: Partial<ServiceItem>) => {
    const res = await apiRequest('/api/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Layanan ${res.service.service_name} berhasil ditambahkan.`);
  };

  const handleUpdateService = async (
    id: string,
    payload: Partial<ServiceItem>
  ) => {
    const res = await apiRequest(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Layanan ${res.service.service_name} berhasil diperbarui.`);
  };

  const handleDeleteService = async (id: string) => {
    await apiRequest(`/api/services/${id}`, { method: 'DELETE' });
    await loadBootstrapData();
    showToast('Layanan berhasil dihapus dari katalog.');
  };

  const handleCreateInvoice = async (
    payload: Record<string, unknown>
  ): Promise<Invoice> => {
    const res = await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Invoice ${res.invoice.invoice_number} berhasil diterbitkan.`);
    return res.invoice;
  };

  const handleUpdateInvoice = async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<Invoice> => {
    const res = await apiRequest(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(`Invoice ${res.invoice.invoice_number} berhasil diperbarui.`);
    return res.invoice;
  };

  const handleDeleteInvoice = async (id: string) => {
    await apiRequest(`/api/invoices/${id}`, { method: 'DELETE' });
    await loadBootstrapData();
    showToast('Dokumen invoice berhasil dihapus.');
  };

  const handleRecordPayment = async (
    payload: Record<string, unknown>
  ): Promise<Payment> => {
    const res = await apiRequest('/api/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(
      `Pembayaran ${res.payment.receipt_number} berhasil dicatat dan status invoice diperbarui.`
    );
    return res.payment;
  };

  const handleUpdatePayment = async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<Payment> => {
    const res = await apiRequest(`/api/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast(
      `Catatan pembayaran ${res.payment.receipt_number} berhasil diperbarui.`
    );
    return res.payment;
  };

  const handleDeletePayment = async (id: string) => {
    await apiRequest(`/api/payments/${id}`, { method: 'DELETE' });
    await loadBootstrapData();
    showToast('Catatan pembayaran berhasil dihapus.');
  };

  const handleSaveSettings = async (updates: Partial<CompanySettingsMap>) => {
    const res = await apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSettings((prev) => ({ ...prev, ...(res.settings || {}) }));
    await loadBootstrapData();
    showToast('Pengaturan identitas perusahaan berhasil disimpan.');
  };

  const handleCreateUser = async (payload: Record<string, unknown>) => {
    await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
    showToast('Pengguna baru berhasil ditambahkan.');
  };

  const handleUpdateUser = async (
    id: string,
    payload: Record<string, unknown>
  ) => {
    await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadBootstrapData();
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
    const res = await apiRequest('/api/database/config', {
      method: 'POST',
      body: JSON.stringify({ webAppUrl, apiSecret }),
    });
    if (res.databaseStatus) {
      setDatabaseStatus(res.databaseStatus);
    }
    await loadBootstrapData();
    showToast(
      res.autoSynced
        ? 'Terhubung! Data nota & invoice berhasil disinkronkan ke Google Sheets.'
        : 'Konfigurasi koneksi Google Apps Script berhasil disimpan.'
    );
  };

  const handleTriggerDatabaseSync = async () => {
    await apiRequest('/api/database/sync', { method: 'POST' });
    await loadBootstrapData();
    showToast('Sinkronisasi (Push) seluruh nota ke Google Sheets berhasil.');
  };

  const handlePullDatabaseFromGas = async () => {
    await apiRequest('/api/database/pull', { method: 'POST' });
    await loadBootstrapData();
    showToast(
      'Data nota, invoice, pembayaran, dan klien berhasil ditarik dari Google Sheets.'
    );
  };

  const handleTestDatabaseConnection = async (
    webAppUrl: string,
    apiSecret: string
  ) => {
    return apiRequest('/api/database/test', {
      method: 'POST',
      body: JSON.stringify({ webAppUrl, apiSecret }),
    });
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
        onSelectTab={setActiveTab}
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
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickCreateInvoice={() => {
            setTriggerCreateInvoice(true);
            setActiveTab('invoices');
          }}
          onQuickRecordPayment={() => {
            const firstUnpaid = invoices.find(
              (i) => i.balance > 0 && i.status !== 'Cancelled'
            );
            setPreselectedPaymentInvoice(firstUnpaid || invoices[0] || null);
            setActiveTab('payments');
          }}
          onNavigateTab={setActiveTab}
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
              activityLogs={activityLogs}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
              onRecordPaymentForInvoice={(inv) => {
                setPreselectedPaymentInvoice(inv);
                setActiveTab('payments');
              }}
              onNavigateInvoices={() => setActiveTab('invoices')}
            />
          )}

          {activeTab === 'clients' && (
            <ClientManagement
              clients={clients}
              invoices={invoices}
              payments={payments}
              onCreateClient={handleCreateClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
            />
          )}

          {activeTab === 'services' && (
            <ServiceManagement
              services={services}
              onCreateService={handleCreateService}
              onUpdateService={handleUpdateService}
              onDeleteService={handleDeleteService}
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
              currentUser={currentUser}
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
              onSendReceiptWhatsApp={(pay, inv) => {
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
              currentUser={currentUser}
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
