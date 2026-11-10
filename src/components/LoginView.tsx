import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { User } from '../types/invoice';
import { authenticateLocalUser } from '../utils/clientFallbackEngine';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@autosmart.id');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Gagal masuk ke sistem.');
        } else {
          onLoginSuccess(data.token, data.user);
        }
        return;
      }
      // Fallback if server returned non-JSON (e.g., static Vercel deployment)
      const fallback = authenticateLocalUser(email.trim(), password);
      if ('error' in fallback) {
        setError(fallback.error);
      } else {
        onLoginSuccess(fallback.token, fallback.user);
      }
    } catch {
      // Fallback when backend server is unreachable or cold-starting
      const fallback = authenticateLocalUser(email.trim(), password);
      if ('error' in fallback) {
        setError(fallback.error);
      } else {
        onLoginSuccess(fallback.token, fallback.user);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectPresetRole = (role: 'Administrator' | 'Staff') => {
    setError('');
    if (role === 'Administrator') {
      setEmail('admin@autosmart.id');
      setPassword('admin123');
    } else {
      setEmail('staff@autosmart.id');
      setPassword('staff123');
    }
  };

  return (
    <div className="min-h-screen bg-[#101B35] flex flex-col lg:flex-row">
      {/* Left Brand Showcase Panel */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-white/10">
        <div>
          <BrandLogo
            companyName="Autosmart Digital Solutions"
            tagline="Skill Up For Digital Collaboration"
            variant="light"
            size="lg"
          />
        </div>

        <div className="my-12 lg:my-0 max-w-xl">
          <div className="text-xs font-medium tracking-wider text-[#C5A15B] mb-3">
            Sistem Administrasi & Billing Terpadu
          </div>
          <h1
            className="text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-4"
            style={{ textWrap: 'balance' }}
          >
            Manajemen Invoice, Nota Transaksi, dan Pembayaran Korporat
          </h1>
          <p className="text-slate-300 text-sm lg:text-base leading-relaxed mb-8">
            Platform resmi Autosmart Digital Solutions untuk menerbitkan dokumen
            invoice otomatis, mengelola portofolio klien, memantau arus piutang,
            mencatat pembayaran bertahap, serta mengekspor bukti pembayaran resmi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-white/10 text-xs text-slate-300">
            <div>
              <div className="font-semibold text-white mb-1">
                Otomatisasi Dokumen Resmi
              </div>
              <p className="text-slate-400">
                Penomoran sekuensial otomatis INV/ASM/2026 & KW/ASM/2026 dengan
                cetak A4 maupun Thermal 80mm.
              </p>
            </div>
            <div>
              <div className="font-semibold text-white mb-1">
                Integrasi Google Sheets
              </div>
              <p className="text-slate-400">
                Sinkronisasi 8 tabel relasional dengan proteksi LockService dan
                server-side proxy.
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Autosmart Digital Solutions</span>
          <span aria-hidden="true">·</span>
          <span>Zona Waktu Asia/Jakarta (WIB)</span>
          <span aria-hidden="true">·</span>
          <span>Mata Uang IDR</span>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:w-1/2 bg-[#F5F6FA] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#101B35]">
              Masuk ke Autosmart Invoice
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan akun Administrator atau Staff untuk mengakses dashboard.
            </p>
          </div>

          {/* Role Preset Switcher */}
          <div className="mb-6">
            <div className="text-xs font-medium text-slate-600 mb-2">
              Pilih Akun Akses Cepat:
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => selectPresetRole('Administrator')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  email === 'admin@autosmart.id'
                    ? 'bg-white text-[#800020] shadow-xs'
                    : 'text-slate-600 hover:text-[#101B35]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Administrator</span>
              </button>
              <button
                type="button"
                onClick={() => selectPresetRole('Staff')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  email === 'staff@autosmart.id'
                    ? 'bg-white text-[#101B35] shadow-xs'
                    : 'text-slate-600 hover:text-[#101B35]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Staff Billing</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#101B35] mb-1.5"
              >
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@autosmart.id"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#101B35] mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-[#101B35] focus:outline-none focus:border-[#800020]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#800020] hover:bg-[#670019] disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Memverifikasi Sesi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">
              Informasi Akun Standar:
            </div>
            <div>
              Administrator: <span className="font-mono">admin@autosmart.id</span>{' '}
              / <span className="font-mono">admin123</span>
            </div>
            <div>
              Staff: <span className="font-mono">staff@autosmart.id</span> /{' '}
              <span className="font-mono">staff123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
