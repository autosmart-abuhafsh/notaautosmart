import React, { useMemo, useState } from 'react';
import { Download, Printer, Calendar } from 'lucide-react';
import type {
  Client,
  CompanySettingsMap,
  Invoice,
  Payment,
  ServiceItem,
} from '../types/invoice';
import {
  formatDateId,
  formatRupiah,
  getJakartaDateString,
  resolveInvoiceStatus,
  sanitizeSpreadsheetInput,
} from '../utils/invoiceLogic';
import {
  generateReportPdf,
  triggerCleanPrint,
} from '../utils/printDocument';

type ReportType =
  | 'all_invoices'
  | 'paid_invoices'
  | 'unpaid_invoices'
  | 'receivables'
  | 'payments'
  | 'monthly_revenue'
  | 'by_client'
  | 'by_service';

const REPORT_TABS: Array<{ id: ReportType; label: string }> = [
  { id: 'all_invoices', label: 'Seluruh Invoice' },
  { id: 'paid_invoices', label: 'Invoice Lunas' },
  { id: 'unpaid_invoices', label: 'Invoice Belum Lunas' },
  { id: 'receivables', label: 'Laporan Piutang' },
  { id: 'payments', label: 'Laporan Pembayaran' },
  { id: 'monthly_revenue', label: 'Pendapatan Bulanan' },
  { id: 'by_client', label: 'Per Pelanggan' },
  { id: 'by_service', label: 'Per Layanan' },
];

interface ReportsViewProps {
  invoices: Invoice[];
  payments: Payment[];
  clients: Client[];
  services: ServiceItem[];
  settings: CompanySettingsMap;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  invoices,
  payments,
  clients,
  services,
  settings,
}) => {
  const todayStr = getJakartaDateString();
  const [reportType, setReportType] = useState<ReportType>('all_invoices');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const invoiceMap = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoices) map[inv.id] = inv;
    return map;
  }, [invoices]);

  // Filtered base invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.issue_date < startDate || inv.issue_date > endDate) return false;
      if (clientFilter !== 'ALL' && inv.client_id !== clientFilter)
        return false;

      const effectiveStatus = resolveInvoiceStatus({
        currentStatus: inv.status,
        grandTotal: inv.grand_total,
        amountPaid: inv.amount_paid,
        dueDate: inv.due_date,
        todayDate: todayStr,
      });

      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter)
        return false;

      if (reportType === 'paid_invoices') return effectiveStatus === 'Paid';
      if (reportType === 'unpaid_invoices' || reportType === 'receivables') {
        return (
          effectiveStatus !== 'Paid' &&
          effectiveStatus !== 'Cancelled' &&
          inv.balance > 0
        );
      }
      return true;
    });
  }, [invoices, startDate, endDate, clientFilter, statusFilter, reportType, todayStr]);

  // Filtered payments (actual cash received)
  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (pay.payment_date < startDate || pay.payment_date > endDate)
        return false;
      const inv = invoiceMap[pay.invoice_id];
      if (clientFilter !== 'ALL' && inv?.client_id !== clientFilter)
        return false;
      return true;
    });
  }, [payments, startDate, endDate, clientFilter, invoiceMap]);

  // Monthly Revenue strictly from payments received (PRD Section 13)
  const monthlyRevenueRows = useMemo(() => {
    const groups: Record<
      string,
      { monthKey: string; count: number; totalReceived: number }
    > = {};
    for (const pay of filteredPayments) {
      const monthKey = pay.payment_date.slice(0, 7); // YYYY-MM
      if (!groups[monthKey]) {
        groups[monthKey] = { monthKey, count: 0, totalReceived: 0 };
      }
      groups[monthKey].count += 1;
      groups[monthKey].totalReceived += Number(pay.amount) || 0;
    }
    return Object.values(groups).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );
  }, [filteredPayments]);

  // Report by Client
  const clientReportRows = useMemo(() => {
    return clients
      .filter((c) => clientFilter === 'ALL' || c.id === clientFilter)
      .map((client) => {
        const clientInvs = invoices.filter(
          (i) =>
            i.client_id === client.id &&
            i.status !== 'Cancelled' &&
            i.issue_date >= startDate &&
            i.issue_date <= endDate
        );
        const invIds = new Set(clientInvs.map((i) => i.id));
        const received = payments
          .filter(
            (p) =>
              invIds.has(p.invoice_id) &&
              p.payment_date >= startDate &&
              p.payment_date <= endDate
          )
          .reduce((s, p) => s + p.amount, 0);

        return {
          client,
          invoiceCount: clientInvs.length,
          totalBilled: clientInvs.reduce((s, i) => s + i.grand_total, 0),
          totalPaid: received,
          totalBalance: clientInvs.reduce((s, i) => s + i.balance, 0),
        };
      });
  }, [clients, clientFilter, invoices, payments, startDate, endDate]);

  // Report by Service
  const serviceReportRows = useMemo(() => {
    const map: Record<
      string,
      {
        serviceName: string;
        category: string;
        qtySold: number;
        totalRevenueValue: number;
      }
    > = {};

    for (const srv of services) {
      map[srv.id] = {
        serviceName: srv.service_name,
        category: srv.category,
        qtySold: 0,
        totalRevenueValue: 0,
      };
    }

    for (const inv of filteredInvoices) {
      if (inv.status === 'Cancelled') continue;
      for (const item of inv.items || []) {
        const key = item.service_id || 'CUSTOM';
        if (!map[key]) {
          map[key] = {
            serviceName: item.description || 'Layanan Kustom',
            category: 'Layanan Digital Lainnya',
            qtySold: 0,
            totalRevenueValue: 0,
          };
        }
        map[key].qtySold += Number(item.quantity) || 0;
        map[key].totalRevenueValue += Number(item.total) || 0;
      }
    }

    return Object.values(map).filter((r) => r.qtySold > 0);
  }, [services, filteredInvoices]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    const totalBilled = filteredInvoices
      .filter((i) => i.status !== 'Cancelled')
      .reduce((s, i) => s + i.grand_total, 0);
    const totalActualRevenue = filteredPayments.reduce(
      (s, p) => s + p.amount,
      0
    );
    const totalReceivables = filteredInvoices
      .filter((i) => i.status !== 'Cancelled')
      .reduce((s, i) => s + i.balance, 0);

    return { totalBilled, totalActualRevenue, totalReceivables };
  }, [filteredInvoices, filteredPayments]);

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (reportType === 'payments') {
      headers = [
        'No. Bukti',
        'No. Invoice',
        'Pelanggan',
        'Tanggal Pembayaran',
        'Metode',
        'Referensi',
        'Nominal Diterima (IDR)',
      ];
      rows = filteredPayments.map((p) => {
        const inv = invoiceMap[p.invoice_id];
        return [
          p.receipt_number,
          inv?.invoice_number || p.invoice_id,
          sanitizeSpreadsheetInput(inv?.client?.client_name || '-'),
          p.payment_date,
          p.payment_method,
          sanitizeSpreadsheetInput(p.reference_number || '-'),
          p.amount,
        ];
      });
    } else if (reportType === 'monthly_revenue') {
      headers = ['Periode Bulan', 'Jumlah Transaksi Pembayaran', 'Pendapatan Riil Diterima (IDR)'];
      rows = monthlyRevenueRows.map((r) => [
        r.monthKey,
        r.count,
        r.totalReceived,
      ]);
    } else if (reportType === 'by_client') {
      headers = [
        'ID Klien',
        'Nama Pelanggan',
        'Jumlah Invoice',
        'Total Nilai Tagihan (IDR)',
        'Total Pembayaran Diterima (IDR)',
        'Sisa Piutang (IDR)',
      ];
      rows = clientReportRows.map((r) => [
        r.client.id,
        sanitizeSpreadsheetInput(r.client.client_name),
        r.invoiceCount,
        r.totalBilled,
        r.totalPaid,
        r.totalBalance,
      ]);
    } else if (reportType === 'by_service') {
      headers = [
        'Nama Layanan',
        'Kategori',
        'Total Kuantitas',
        'Total Nilai Transaksi (IDR)',
      ];
      rows = serviceReportRows.map((r) => [
        sanitizeSpreadsheetInput(r.serviceName),
        r.category,
        r.qtySold,
        r.totalRevenueValue,
      ]);
    } else {
      headers = [
        'Nomor Invoice',
        'Pelanggan',
        'Tanggal Terbit',
        'Jatuh Tempo',
        'Grand Total (IDR)',
        'Sudah Dibayar (IDR)',
        'Sisa Tagihan (IDR)',
        'Status',
      ];
      rows = filteredInvoices.map((inv) => [
        inv.invoice_number,
        sanitizeSpreadsheetInput(inv.client?.client_name || inv.client_id),
        inv.issue_date,
        inv.due_date,
        inv.grand_total,
        inv.amount_paid,
        inv.balance,
        inv.status,
      ]);
    }

    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        r
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Autosmart_${reportType}_${todayStr}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildReportTableData = () => {
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (reportType === 'payments') {
      headers = [
        'No. Bukti',
        'No. Invoice',
        'Pelanggan',
        'Tanggal Bayar',
        'Metode',
        'Nominal Diterima',
      ];
      rows = filteredPayments.map((p) => {
        const inv = invoiceMap[p.invoice_id];
        return [
          p.receipt_number,
          inv?.invoice_number || p.invoice_id,
          inv?.client?.client_name || '-',
          formatDateId(p.payment_date),
          p.payment_method,
          formatRupiah(p.amount),
        ];
      });
    } else if (reportType === 'monthly_revenue') {
      headers = [
        'Bulan (YYYY-MM)',
        'Jumlah Transaksi Pembayaran',
        'Pendapatan Riil Diterima',
      ];
      rows = monthlyRevenueRows.map((r) => [
        r.monthKey,
        `${r.count} transaksi`,
        formatRupiah(r.totalReceived),
      ]);
    } else if (reportType === 'by_client') {
      headers = [
        'ID Klien',
        'Nama Pelanggan',
        'Jml Invoice',
        'Total Tagihan',
        'Pembayaran Diterima',
        'Sisa Piutang',
      ];
      rows = clientReportRows.map((r) => [
        r.client.id,
        r.client.client_name,
        r.invoiceCount,
        formatRupiah(r.totalBilled),
        formatRupiah(r.totalPaid),
        formatRupiah(r.totalBalance),
      ]);
    } else if (reportType === 'by_service') {
      headers = [
        'Nama Layanan Digital',
        'Kategori',
        'Kuantitas Terjual',
        'Total Nilai Layanan',
      ];
      rows = serviceReportRows.map((r) => [
        r.serviceName,
        r.category,
        r.qtySold,
        formatRupiah(r.totalRevenueValue),
      ]);
    } else {
      headers = [
        'No. Invoice',
        'Pelanggan',
        'Tgl Terbit',
        'Jatuh Tempo',
        'Grand Total',
        'Sudah Dibayar',
        'Sisa Tagihan',
        'Status',
      ];
      rows = filteredInvoices.map((inv) => [
        inv.invoice_number,
        inv.client?.client_name || inv.client_id,
        formatDateId(inv.issue_date),
        formatDateId(inv.due_date),
        formatRupiah(inv.grand_total),
        formatRupiah(inv.amount_paid),
        formatRupiah(inv.balance),
        inv.status,
      ]);
    }
    return { headers, rows };
  };

  const handleExportPdf = (mode: 'download' | 'print' = 'download') => {
    const { headers, rows } = buildReportTableData();
    const tabTitle =
      REPORT_TABS.find((t) => t.id === reportType)?.label || 'Laporan';
    generateReportPdf({
      reportTitle: tabTitle,
      periodLabel: `${formatDateId(startDate)} s/d ${formatDateId(endDate)}`,
      printDateLabel: formatDateId(todayStr),
      companyName: settings.company_name || 'Autosmart Digital Solutions',
      summary: summaryTotals,
      headers,
      rows,
      fileNameBase: `Laporan_Autosmart_${reportType}_${todayStr}`,
      mode,
    });
  };

  const handlePrintReport = () => {
    triggerCleanPrint(
      'autosmart-printable-report',
      `Laporan_Keuangan_${reportType}`,
      'A4'
    );
    handleExportPdf('print');
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selector & Export Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#101B35]">
              Laporan Keuangan & Rekapitulasi Bisnis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Laporan pendapatan dihitung dari pembayaran riil yang telah
              diterima di kas perusahaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-semibold text-[#101B35] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#800020]" />
              <span>Export Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportPdf('download')}
              className="px-3.5 py-2 text-xs font-semibold text-[#101B35] border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#101B35]" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#800020] hover:bg-[#660019] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                reportType === tab.id
                  ? 'bg-[#101B35] text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-[#101B35]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Dari Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Sampai Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter Pelanggan
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Pelanggan</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Filter Status Invoice
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            >
              <option value="ALL">Semua Status</option>
              <option value="Paid">Lunas (Paid)</option>
              <option value="Partially Paid">Dibayar Sebagian (DP)</option>
              <option value="Unpaid">Belum Dibayar (Unpaid)</option>
              <option value="Overdue">Jatuh Tempo (Overdue)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div
        id="autosmart-printable-report"
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <div className="text-xs font-bold text-[#800020] uppercase">
              {settings.company_name || 'Autosmart Digital Solutions'}
            </div>
            <h3 className="text-lg font-bold text-[#101B35]">
              Laporan:{' '}
              {REPORT_TABS.find((t) => t.id === reportType)?.label}
            </h3>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <div>
              Periode: {formatDateId(startDate)} s/d {formatDateId(endDate)}
            </div>
            <div>Dicetak pada: {formatDateId(todayStr)}</div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Total Nilai Invoice Diterbitkan
            </div>
            <div className="text-lg font-bold font-mono text-[#101B35] mt-1">
              {formatRupiah(summaryTotals.totalBilled)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Total Pendapatan Riil Diterima (Kas Masuk)
            </div>
            <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
              {formatRupiah(summaryTotals.totalActualRevenue)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">
              Total Sisa Piutang Belum Tertagih
            </div>
            <div className="text-lg font-bold font-mono text-[#800020] mt-1">
              {formatRupiah(summaryTotals.totalReceivables)}
            </div>
          </div>
        </div>

        {/* Dynamic Report Table */}
        <div className="overflow-x-auto">
          {reportType === 'payments' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">No. Bukti</th>
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Tanggal Bayar</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4 text-right">Nominal Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPayments.map((p) => {
                  const inv = invoiceMap[p.invoice_id];
                  return (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-mono font-bold">
                        {p.receipt_number}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {inv?.invoice_number || p.invoice_id}
                      </td>
                      <td className="py-3 px-4">
                        {inv?.client?.client_name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {formatDateId(p.payment_date)}
                      </td>
                      <td className="py-3 px-4">{p.payment_method}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : reportType === 'monthly_revenue' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Bulan (YYYY-MM)</th>
                  <th className="py-3 px-4 text-right">
                    Jumlah Transaksi Pembayaran
                  </th>
                  <th className="py-3 px-4 text-right">
                    Pendapatan Riil Diterima
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlyRevenueRows.map((row) => (
                  <tr key={row.monthKey}>
                    <td className="py-3 px-4 font-mono font-bold text-[#101B35]">
                      {row.monthKey}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {row.count} transaksi
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatRupiah(row.totalReceived)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'by_client' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">ID Klien</th>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-4 text-center">Jml Invoice</th>
                  <th className="py-3 px-4 text-right">Total Tagihan</th>
                  <th className="py-3 px-4 text-right">Pembayaran Diterima</th>
                  <th className="py-3 px-4 text-right">Sisa Piutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clientReportRows.map((row) => (
                  <tr key={row.client.id}>
                    <td className="py-3 px-4 font-mono">{row.client.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#101B35]">
                      {row.client.client_name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {row.invoiceCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatRupiah(row.totalBilled)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {formatRupiah(row.totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#800020] font-bold">
                      {formatRupiah(row.totalBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'by_service' ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Nama Layanan Digital</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-center">Kuantitas Terjual</th>
                  <th className="py-3 px-4 text-right">Total Nilai Layanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {serviceReportRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-4 font-semibold text-[#101B35]">
                      {row.serviceName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.category}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      {row.qtySold}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#101B35]">
                      {formatRupiah(row.totalRevenueValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Tgl Terbit</th>
                  <th className="py-3 px-4">Jatuh Tempo</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                  <th className="py-3 px-4 text-right">Sisa Tagihan</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 px-4 font-mono font-bold text-[#101B35]">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {inv.client?.client_name || inv.client_id}
                    </td>
                    <td className="py-3 px-4">
                      {formatDateId(inv.issue_date)}
                    </td>
                    <td className="py-3 px-4">{formatDateId(inv.due_date)}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatRupiah(inv.grand_total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatRupiah(inv.amount_paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#800020]">
                      {formatRupiah(inv.balance)}
                    </td>
                    <td className="py-3 px-4 font-semibold">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
