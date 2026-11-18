import React, { useMemo, useState } from 'react';
import {
  FileText,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  CreditCard,
  MessageSquare,
  Plus,
} from 'lucide-react';
import type { Invoice, Payment } from '../types/invoice';
import {
  computeDashboardMetrics,
  formatDateId,
  formatRupiah,
  resolveInvoiceStatus,
} from '../utils/invoiceLogic';

interface DashboardViewProps {
  invoices: Invoice[];
  payments: Payment[];
  onViewInvoice: (invoice: Invoice) => void;
  onRecordPaymentForInvoice: (invoice: Invoice) => void;
  onOpenWhatsAppForInvoice: (invoice: Invoice) => void;
  onNavigateToInvoices: () => void;
  onCreateNewInvoice: () => void;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'custom';

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  payments,
  onViewInvoice,
  onRecordPaymentForInvoice,
  onOpenWhatsAppForInvoice,
  onNavigateToInvoices,
  onCreateNewInvoice,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('year');
  const [customStart, setCustomStart] = useState('2026-01-01');
  const [customEnd, setCustomEnd] = useState('2026-12-31');

  const dateRange = useMemo(() => {
    const now = new Date();
    const year = 2026;
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (period === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: todayStr,
      };
    }
    if (period === 'month') {
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      return {
        startDate: `${year}-${monthStr}-01`,
        endDate: `${year}-${monthStr}-31`,
      };
    }
    if (period === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }, [period, customStart, customEnd]);

  const metrics = useMemo(
    () => computeDashboardMetrics(invoices, payments, dateRange),
    [invoices, payments, dateRange]
  );

  // Monthly Revenue & Invoice Volume (12 months of 2026)
  const monthlySeries = useMemo(() => {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    const data = months.map((label, idx) => {
      const mPrefix = `2026-${String(idx + 1).padStart(2, '0')}`;
      const monthPayments = payments.filter((p) =>
        p.payment_date.startsWith(mPrefix)
      );
      const monthInvoices = invoices.filter(
        (inv) =>
          inv.issue_date.startsWith(mPrefix) && inv.status !== 'Cancelled'
      );
      const revenue = monthPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      return {
        label,
        revenue: Math.round(revenue),
        invoiceCount: monthInvoices.length,
      };
    });

    const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
    return { data, maxRevenue };
  }, [invoices, payments]);

  const currentMonthRevenue = useMemo(() => {
    const nowMonth = `2026-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return payments
      .filter((p) => p.payment_date.startsWith(nowMonth))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
      .slice(0, 6);
  }, [invoices]);

  const paidRatio =
    metrics.totalInvoicedAmount > 0
      ? Math.round(
          (metrics.totalPaidAmount / metrics.totalInvoicedAmount) * 100
        )
      : 0;
  const unpaidRatio =
    metrics.totalInvoicedAmount > 0 ? Math.max(0, 100 - paidRatio) : 0;

  const renderStatusBadge = (inv: Invoice) => {
    const effective = resolveInvoiceStatus({
      currentStatus: inv.status,
      grandTotal: inv.grand_total,
      amountPaid: inv.amount_paid,
      dueDate: inv.due_date,
    });
    const badgeConfig: Record<string, { label: string; classes: string }> = {
      Paid: {
        label: 'Lunas',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      'Partially Paid': {
        label: 'Dibayar Sebagian',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      Overdue: {
        label: 'Jatuh Tempo',
        classes: 'bg-red-50 text-red-700 border-red-200',
      },
      Unpaid: {
        label: 'Belum Dibayar',
        classes: 'bg-slate-100 text-slate-700 border-slate-200',
      },
      Sent: {
        label: 'Terkirim',
        classes: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      Draft: {
        label: 'Draft',
        classes: 'bg-slate-100 text-slate-600 border-slate-200',
      },
      Cancelled: {
        label: 'Dibatalkan',
        classes: 'bg-slate-100 text-slate-400 border-slate-200',
      },
    };
    const cfg = badgeConfig[effective] || badgeConfig.Unpaid;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border whitespace-nowrap ${cfg.classes}`}
      >
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Period Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-sm font-bold text-[#101B35]">
            Ikhtisar Kinerja Keuangan & Piutang
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seluruh metrik dihitung secara langsung dari transaksi database
            Autosmart Invoice.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'today', label: 'Hari ini' },
                { id: 'week', label: 'Minggu ini' },
                { id: 'month', label: 'Bulan ini' },
                { id: 'year', label: 'Tahun ini' },
                { id: 'custom', label: 'Rentang Khusus' },
              ] as Array<{ id: PeriodFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-center ${
                  opt.id === 'custom' ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  period === opt.id
                    ? 'bg-[#101B35] text-white'
                    : 'text-slate-600 hover:text-[#101B35]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
              <input
                type="date"
                aria-label="Tanggal Mulai"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-[#101B35]"
              />
              <span className="text-slate-400 text-center">s/d</span>
              <input
                type="date"
                aria-label="Tanggal Akhir"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-[#101B35]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary Financial KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Nilai Invoice */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">
              Total Nilai Invoice
            </span>
            <FileText className="w-4 h-4 text-[#101B35] shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#101B35] break-words">
              {formatRupiah(metrics.totalInvoicedAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              <span className="font-semibold text-[#101B35] tabular-nums">
                {metrics.totalInvoicesCount}
              </span>{' '}
              dokumen invoice diterbitkan
            </div>
          </div>
        </div>

        {/* Card 2: Total Pembayaran Diterima */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">
              Total Pembayaran Diterima
            </span>
            <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 break-words">
              {formatRupiah(metrics.totalPaidAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Rasio realisasi kas{' '}
              <span className="font-semibold text-emerald-700 tabular-nums">
                {paidRatio}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Piutang / Belum Dibayar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">
              Total Piutang / Belum Dibayar
            </span>
            <Clock className="w-4 h-4 text-[#800020] shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#800020] break-words">
              {formatRupiah(metrics.totalReceivables)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              <span className="font-semibold text-[#800020] tabular-nums">
                {metrics.unpaidCount + metrics.overdueCount}
              </span>{' '}
              invoice memiliki sisa tagihan
            </div>
          </div>
        </div>

        {/* Card 4: Ringkasan Status Dokumen */}
        <div className="bg-[#101B35] text-white rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300">
              Status Dokumen Invoice
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#C5A15B] shrink-0" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <div className="text-[11px] text-slate-300">Lunas</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                {metrics.paidCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">Belum Lunas</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#C5A15B]">
                {metrics.unpaidCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">Jatuh Tempo</div>
              <div className="text-lg font-bold font-mono tabular-nums text-rose-400">
                {metrics.overdueCount}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
            <span>Total Invoice Aktif</span>
            <span className="font-mono font-semibold text-white tabular-nums">
              {metrics.totalInvoicesCount} Dokumen
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section: Monthly Revenue Bar Chart + Receivable Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Monthly Revenue & Invoice Volume */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-sm font-bold text-[#101B35]">
                Grafik Pendapatan Bulanan & Volume Invoice (2026)
              </h3>
              <p className="text-xs text-slate-500">
                Pendapatan dihitung berdasarkan pembayaran riil yang telah
                diterima setiap bulan.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#800020] shrink-0" />
                <span className="text-slate-600 font-medium">
                  Pendapatan Kas
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#101B35] shrink-0" />
                <span className="text-slate-600 font-medium">
                  Jumlah Invoice
                </span>
              </div>
            </div>
          </div>

          <div className="h-44 sm:h-52 grid grid-cols-12 gap-1 sm:gap-2 items-end pt-4 border-b border-slate-200 pb-2">
            {monthlySeries.data.map((m) => {
              const heightPct =
                m.revenue > 0
                  ? Math.max(
                      12,
                      Math.round((m.revenue / monthlySeries.maxRevenue) * 100)
                    )
                  : 4;
              const invHeightPct =
                m.invoiceCount > 0 ? Math.min(100, m.invoiceCount * 22) : 4;

              return (
                <div
                  key={m.label}
                  className="flex flex-col items-center h-full justify-end group relative min-w-0"
                >
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-12 z-20 bg-[#101B35] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-sm">
                    <div className="font-semibold">
                      {m.label}: {formatRupiah(m.revenue)}
                    </div>
                    <div className="text-[#C5A15B]">
                      {m.invoiceCount} Invoice diterbitkan
                    </div>
                  </div>

                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-32 sm:h-40">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-2 sm:w-3 rounded-t transition-all ${
                        m.revenue > 0 ? 'bg-[#800020]' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      style={{ height: `${invHeightPct}%` }}
                      className={`w-1.5 sm:w-2 rounded-t transition-all ${
                        m.invoiceCount > 0 ? 'bg-[#101B35]' : 'bg-slate-100'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[11px] font-medium text-slate-500 mt-1.5 sm:mt-2 truncate">
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg">
              <span className="text-slate-500 block">
                Pendapatan Bulan Berjalan
              </span>
              <span className="font-mono font-bold text-[#101B35] tabular-nums">
                {formatRupiah(currentMonthRevenue)}
              </span>
            </div>
            <div className="p-2.5 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg">
              <span className="text-slate-500 block">
                Total Kas Masuk Tahun 2026
              </span>
              <span className="font-mono font-bold text-emerald-700 tabular-nums">
                {formatRupiah(
                  payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
                )}
              </span>
            </div>
            <div className="p-2.5 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg">
              <span className="text-slate-500 block">Total Dokumen 2026</span>
              <span className="font-mono font-bold text-[#101B35] tabular-nums">
                {invoices.length} Invoice
              </span>
            </div>
          </div>
        </div>

        {/* Paid vs Unpaid Receivable Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101B35]">
              Perbandingan Pembayaran Lunas & Piutang
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Proporsi realisasi pembayaran terhadap total tagihan diterbitkan.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">
                    Pembayaran Diterima (Lunas / DP)
                  </span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {paidRatio}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${paidRatio}%` }}
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                  {formatRupiah(metrics.totalPaidAmount)} dari{' '}
                  {formatRupiah(metrics.totalInvoicedAmount)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-700">
                    Sisa Piutang Belum Dibayar
                  </span>
                  <span className="font-mono font-bold text-[#800020] tabular-nums">
                    {unpaidRatio}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#800020] rounded-full transition-all"
                    style={{ width: `${unpaidRatio}%` }}
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                  {formatRupiah(metrics.totalReceivables)} belum tertagih
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Invoice Lunas</span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                {metrics.paidCount} dokumen
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Invoice Belum Lunas / DP</span>
              <span className="font-mono font-semibold text-amber-700 tabular-nums">
                {metrics.unpaidCount} dokumen
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Melewati Jatuh Tempo</span>
              </span>
              <span className="font-mono font-semibold text-red-700 tabular-nums">
                {metrics.overdueCount} dokumen
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices Table & Mobile Card List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#101B35]">
              Transaksi Invoice Terbaru
            </h3>
            <p className="text-xs text-slate-500">
              Daftar dokumen invoice terakhir beserta status pelunasan dan aksi
              cepat.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToInvoices}
            className="text-xs font-semibold text-[#800020] hover:underline cursor-pointer shrink-0"
          >
            Lihat Semua &rarr;
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Belum ada dokumen invoice yang diterbitkan.
            </p>
            <button
              type="button"
              onClick={onCreateNewInvoice}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#800020] hover:bg-[#670019] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Invoice Pertama</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">No. Invoice</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Jatuh Tempo</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Tindakan Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-6 font-mono font-semibold text-[#101B35] whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#101B35]">
                          {inv.client?.client_name || inv.client_id}
                        </div>
                        {inv.client?.contact_person && (
                          <div className="text-[11px] text-slate-500">
                            {inv.client.contact_person}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateId(inv.due_date)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#101B35] tabular-nums whitespace-nowrap">
                        {formatRupiah(inv.grand_total)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#800020] tabular-nums whitespace-nowrap">
                        {formatRupiah(inv.balance)}
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(inv)}</td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv)}
                            title="Pratinjau & Cetak Invoice"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#101B35] hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {inv.balance > 0 && inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => onRecordPaymentForInvoice(inv)}
                              title="Catat Pembayaran"
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenWhatsAppForInvoice(inv)}
                            title="Kirim Pesan WhatsApp"
                            className="p-1.5 rounded-lg text-[#800020] hover:bg-red-50 cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-200">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-[#800020]">
                        {inv.invoice_number}
                      </div>
                      <div className="text-sm font-bold text-[#101B35] truncate mt-0.5">
                        {inv.client?.client_name || inv.client_id}
                      </div>
                    </div>
                    {renderStatusBadge(inv)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">
                        Grand Total
                      </span>
                      <span className="font-mono font-bold text-[#101B35] tabular-nums">
                        {formatRupiah(inv.grand_total)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">
                        Sisa Tagihan
                      </span>
                      <span className="font-mono font-bold text-[#800020] tabular-nums">
                        {formatRupiah(inv.balance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[11px] text-slate-500">
                      Tempo: {formatDateId(inv.due_date)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(inv)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>
                      {inv.balance > 0 && inv.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => onRecordPaymentForInvoice(inv)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Bayar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenWhatsAppForInvoice(inv)}
                        className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-pointer"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
