import React, { useMemo, useState } from 'react';
import {
  FileText,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Eye,
} from 'lucide-react';
import type { ActivityLog, Invoice, Payment } from '../types/invoice';
import {
  computeDashboardMetrics,
  formatDateId,
  formatRupiah,
  getJakartaDateString,
  resolveInvoiceStatus,
} from '../utils/invoiceLogic';

type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'custom';

interface DashboardViewProps {
  invoices: Invoice[];
  payments: Payment[];
  activityLogs: ActivityLog[];
  onPreviewInvoice: (invoice: Invoice) => void;
  onRecordPaymentForInvoice: (invoice: Invoice) => void;
  onNavigateInvoices: () => void;
}

const MONTH_LABELS = [
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

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  payments,
  activityLogs,
  onPreviewInvoice,
  onRecordPaymentForInvoice,
  onNavigateInvoices,
}) => {
  const todayStr = getJakartaDateString();
  const [period, setPeriod] = useState<PeriodFilter>('year');
  const [customStart, setCustomStart] = useState('2026-01-01');
  const [customEnd, setCustomEnd] = useState(todayStr);

  // Filter range calculation
  const dateRange = useMemo(() => {
    const today = new Date(`${todayStr}T00:00:00`);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    if (period === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const start = monday.toISOString().split('T')[0];
      return { start, end: '2099-12-31' };
    }
    if (period === 'month') {
      return { start: `${year}-${month}-01`, end: `${year}-${month}-31` };
    }
    if (period === 'custom') {
      return {
        start: customStart || '2000-01-01',
        end: customEnd || '2099-12-31',
      };
    }
    // Default: 'year'
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, [period, customStart, customEnd, todayStr]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        inv.issue_date >= dateRange.start && inv.issue_date <= dateRange.end
    );
  }, [invoices, dateRange]);

  const filteredPayments = useMemo(() => {
    return payments.filter(
      (pay) =>
        pay.payment_date >= dateRange.start && pay.payment_date <= dateRange.end
    );
  }, [payments, dateRange]);

  const metrics = useMemo(
    () => computeDashboardMetrics(filteredInvoices, filteredPayments, todayStr),
    [filteredInvoices, filteredPayments, todayStr]
  );

  // Monthly Revenue & Monthly Invoice Count (across current year)
  const monthlyStats = useMemo(() => {
    const currentYear = todayStr.slice(0, 4) || '2026';
    const data = MONTH_LABELS.map((label, index) => {
      const monthPrefix = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const monthPayments = payments.filter((p) =>
        p.payment_date.startsWith(monthPrefix)
      );
      const revenue = monthPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );

      const monthInvoices = invoices.filter(
        (i) =>
          i.status !== 'Cancelled' && i.issue_date.startsWith(monthPrefix)
      );
      return {
        label,
        revenue,
        invoiceCount: monthInvoices.length,
        invoiceValue: monthInvoices.reduce((s, i) => s + i.grand_total, 0),
      };
    });
    return data;
  }, [invoices, payments, todayStr]);

  const maxMonthlyRevenue = useMemo(() => {
    const max = Math.max(...monthlyStats.map((m) => m.revenue), 1);
    return max;
  }, [monthlyStats]);

  const maxMonthlyCount = useMemo(() => {
    return Math.max(...monthlyStats.map((m) => m.invoiceCount), 1);
  }, [monthlyStats]);

  const collectionRate =
    metrics.totalInvoiceValue > 0
      ? Math.min(
          100,
          Math.round(
            (metrics.totalPaidReceived / metrics.totalInvoiceValue) * 100
          )
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#101B35]">
            Ikhtisar Kinerja Keuangan & Piutang
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Seluruh metrik dihitung secara langsung dari transaksi database
            Autosmart Invoice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Filter Periode"
          >
            {(
              [
                { id: 'today', label: 'Hari ini' },
                { id: 'week', label: 'Minggu ini' },
                { id: 'month', label: 'Bulan ini' },
                { id: 'year', label: 'Tahun ini' },
                { id: 'custom', label: 'Rentang Khusus' },
              ] as Array<{ id: PeriodFilter; label: string }>
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPeriod(btn.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  period === btn.id
                    ? 'bg-[#101B35] text-white'
                    : 'text-slate-600 hover:text-[#101B35]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  aria-label="Tanggal Mulai"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <span className="text-slate-400">s/d</span>
              <input
                type="date"
                aria-label="Tanggal Selesai"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary 4 Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Nilai Invoice</span>
            <FileText className="w-4 h-4 text-[#101B35]" />
          </div>
          <div
            className="text-2xl font-bold text-[#101B35] font-mono tabular-nums"
            data-testid="metric-total-invoice-value"
          >
            {formatRupiah(metrics.totalInvoiceValue)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono font-semibold text-[#101B35]">
              {metrics.totalInvoices}
            </span>
            <span>dokumen invoice diterbitkan</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Pembayaran Diterima</span>
            <Wallet className="w-4 h-4 text-emerald-700" />
          </div>
          <div
            className="text-2xl font-bold text-emerald-700 font-mono tabular-nums"
            data-testid="metric-total-paid"
          >
            {formatRupiah(metrics.totalPaidReceived)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>Rasio realisasi kas</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-semibold text-emerald-700">
              {collectionRate}%
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Piutang / Belum Dibayar</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div
            className="text-2xl font-bold text-[#800020] font-mono tabular-nums"
            data-testid="metric-total-receivables"
          >
            {formatRupiah(metrics.totalReceivables)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono font-semibold text-[#800020]">
              {metrics.unpaidInvoicesCount}
            </span>
            <span>invoice memiliki sisa tagihan</span>
          </div>
        </div>

        <div className="bg-[#101B35] text-white rounded-xl border border-[#101B35] p-5">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span>Status Dokumen Invoice</span>
            <CheckCircle2 className="w-4 h-4 text-[#C5A15B]" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <div className="text-[11px] text-slate-300">Lunas</div>
              <div
                className="text-xl font-bold text-emerald-400 font-mono tabular-nums"
                data-testid="metric-paid-count"
              >
                {metrics.paidInvoicesCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">Belum Lunas</div>
              <div
                className="text-xl font-bold text-[#C5A15B] font-mono tabular-nums"
                data-testid="metric-unpaid-count"
              >
                {metrics.unpaidInvoicesCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">Jatuh Tempo</div>
              <div
                className="text-xl font-bold text-rose-400 font-mono tabular-nums"
                data-testid="metric-overdue-count"
              >
                {metrics.overdueInvoicesCount}
              </div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-slate-300 flex items-center justify-between">
            <span>Total Invoice Aktif</span>
            <span className="font-mono font-semibold text-white">
              {metrics.totalInvoices} Dokumen
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row: Monthly Revenue, Monthly Invoices, and Payment Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-sm font-bold text-[#101B35]">
                Grafik Pendapatan Bulanan & Volume Invoice (2026)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pendapatan dihitung berdasarkan pembayaran riil yang telah
                diterima setiap bulan.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#800020] inline-block" />
                <span>Pendapatan Kas</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#101B35] inline-block" />
                <span>Jumlah Invoice</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-end h-48 pt-6 pb-2 border-b border-slate-200">
            {monthlyStats.map((m) => {
              const revHeightPct =
                m.revenue > 0
                  ? Math.max(10, Math.round((m.revenue / maxMonthlyRevenue) * 100))
                  : 3;
              const cntHeightPct =
                m.invoiceCount > 0
                  ? Math.max(
                      10,
                      Math.round((m.invoiceCount / maxMonthlyCount) * 70)
                    )
                  : 3;
              return (
                <div
                  key={m.label}
                  className="flex flex-col items-center h-full justify-end group relative"
                >
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div
                      style={{ height: `${revHeightPct}%` }}
                      title={`${m.label}: ${formatRupiah(m.revenue)}`}
                      className={`w-2.5 sm:w-3.5 rounded-t transition-all ${
                        m.revenue > 0 ? 'bg-[#800020]' : 'bg-slate-100'
                      }`}
                    />
                    <div
                      style={{ height: `${cntHeightPct}%` }}
                      title={`${m.label}: ${m.invoiceCount} Invoice`}
                      className={`w-2 sm:w-2.5 rounded-t transition-all ${
                        m.invoiceCount > 0 ? 'bg-[#101B35]' : 'bg-slate-100'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 mt-2">
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Pendapatan Bulan Berjalan</div>
              <div className="font-mono font-bold text-[#101B35] mt-0.5">
                {formatRupiah(
                  monthlyStats[
                    Math.max(0, Number(todayStr.split('-')[1]) - 1)
                  ]?.revenue || 0
                )}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Total Kas Masuk Tahun 2026</div>
              <div className="font-mono font-bold text-emerald-700 mt-0.5">
                {formatRupiah(
                  monthlyStats.reduce((s, m) => s + m.revenue, 0)
                )}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-slate-500">Total Dokumen 2026</div>
              <div className="font-mono font-bold text-[#101B35] mt-0.5">
                {monthlyStats.reduce((s, m) => s + m.invoiceCount, 0)} Invoice
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Paid vs Unpaid */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
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
                  <span className="font-medium text-slate-700">
                    Pembayaran Diterima (Lunas / DP)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {collectionRate}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  {formatRupiah(metrics.totalPaidReceived)} dari{' '}
                  {formatRupiah(metrics.totalInvoiceValue)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700">
                    Sisa Piutang Belum Dibayar
                  </span>
                  <span className="font-mono font-bold text-[#800020]">
                    {metrics.totalInvoiceValue > 0 ? 100 - collectionRate : 0}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#800020] rounded-full transition-all"
                    style={{
                      width: `${
                        metrics.totalInvoiceValue > 0 ? 100 - collectionRate : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  {formatRupiah(metrics.totalReceivables)} belum tertagih
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Invoice Lunas</span>
              <span className="font-mono font-semibold text-emerald-700">
                {metrics.paidInvoicesCount} dokumen
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Invoice Belum Lunas / DP</span>
              <span className="font-mono font-semibold text-amber-700">
                {metrics.unpaidInvoicesCount} dokumen
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Melewati Jatuh Tempo</span>
              </span>
              <span className="font-mono font-semibold text-rose-600">
                {metrics.overdueInvoicesCount} dokumen
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Invoices & Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoice Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#101B35]">
                Transaksi Invoice Terbaru
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar tagihan terkini beserta status pembayaran dan sisa
                tagihan.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateInvoices}
              className="text-xs font-semibold text-[#800020] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Jatuh Tempo</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredInvoices.slice(0, 6).map((inv) => {
                  const status = resolveInvoiceStatus({
                    currentStatus: inv.status,
                    grandTotal: inv.grand_total,
                    amountPaid: inv.amount_paid,
                    dueDate: inv.due_date,
                    todayDate: todayStr,
                  });
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#101B35] whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#101B35]">
                        {inv.client?.client_name || inv.client_id}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateId(inv.due_date)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#101B35] whitespace-nowrap">
                        {formatRupiah(inv.grand_total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#800020] whitespace-nowrap">
                        {formatRupiah(inv.balance)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            status === 'Paid'
                              ? 'text-emerald-700'
                              : status === 'Partially Paid'
                                ? 'text-amber-700'
                                : status === 'Overdue'
                                  ? 'text-rose-700'
                                  : 'text-slate-700'
                          }`}
                        >
                          {status === 'Paid'
                            ? 'Lunas'
                            : status === 'Partially Paid'
                              ? 'Dibayar Sebagian'
                              : status === 'Overdue'
                                ? 'Jatuh Tempo'
                                : status === 'Draft'
                                  ? 'Draft'
                                  : 'Belum Dibayar'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPreviewInvoice(inv)}
                            className="text-slate-600 hover:text-[#101B35] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Dokumen</span>
                          </button>
                          {inv.balance > 0 && inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => onRecordPaymentForInvoice(inv)}
                              className="text-[#800020] hover:underline font-semibold cursor-pointer"
                            >
                              Bayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-xs text-slate-500"
                    >
                      Tidak ada transaksi invoice pada periode tanggal yang
                      dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit & Activity Logs */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101B35] mb-1">
              Aktivitas Transaksi Terbaru
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Catatan audit aktivitas pengguna secara real-time.
            </p>

            <div className="divide-y divide-slate-100">
              {activityLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-xs font-medium text-[#101B35] leading-snug">
                    {log.description}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <span>{log.user_name || log.user_id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {formatDateId(log.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada log aktivitas tercatat.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
