# Autosmart Invoice & Billing Management System

**Nama Produk:** Autosmart Invoice  
**Pengembang:** Autosmart Digital Solutions  
**Tagline:** *Skill Up For Digital Collaboration*  
**Zona Waktu:** Asia/Jakarta (WIB) · **Mata Uang:** Rupiah (IDR)

Sistem manajemen invoice, nota transaksi, katalog layanan, pencatatan pembayaran (Penuh, DP, Bertahap), kwitansi pembayaran (`KW/ASM/2026/xxxx`), laporan keuangan, dan ekspor PDF (A4 & Thermal 80mm) yang terintegrasi dengan **Google Sheets (`AUTOSMART_INVOICE_DATABASE`)** melalui **Google Apps Script** serta siap di-deploy ke **GitHub** dan **Vercel (`*.vercel.app`)**.

---

## 1. Struktur Arsitektur & Fitur Utama

- **Frontend (Desktop & Mobile First):** React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons + `jsPDF` (unduh & cetak PDF asli di PC maupun HP Android/iPhone).
- **Backend / API Proxy:** Express (`server.ts` & Vercel Serverless `/api/index.ts`) dengan autentikasi session, hashing password `scrypt`, proteksi konkurensi (`withLock`), dan sanitasi formula injection.
- **Database Google Sheets (`gas/Setup.gs`):** Otomatis membuat spreadsheet `AUTOSMART_INVOICE_DATABASE` dengan 8 sheet utama:
  1. `USERS`
  2. `CLIENTS`
  3. `SERVICES`
  4. `INVOICES`
  5. `INVOICE_ITEMS`
  6. `PAYMENTS`
  7. `COMPANY_SETTINGS`
  8. `ACTIVITY_LOGS`

---

## 2. Panduan Integrasi ke Repository GitHub

Jalankan perintah berikut pada terminal proyek Anda untuk mengunggah source code ke repository GitHub:

```bash
git init
git add .
git commit -m "feat: initial release Autosmart Invoice & Billing System"
git branch -M main
git remote add origin https://github.com/USERNAME_ANDA/autosmart-invoice.git
git push -u origin main
```

Repository ini sudah dilengkapi dengan:
- `.gitignore` standar produksi (mengecualikan `.env`, `node_modules`, `dist`, `.vercel`, dan file sesi).
- `.github/workflows/ci.yml` untuk pengujian otomatis TypeScript, unit test logika perhitungan invoice, dan build produksi setiap kali ada `git push`.

---

## 3. Panduan Publish / Deploy ke Vercel (`*.vercel.app`)

Proyek ini telah dikonfigurasi dengan **`vercel.json`** dan Serverless Function **`api/index.ts`** sehingga dapat langsung dipublikasikan ke Vercel:

### Cara 1: Melalui Dashboard Vercel (Direkomendasikan)
1. Buka [https://vercel.com/new](https://vercel.com/new) dan login menggunakan akun GitHub Anda.
2. Pilih repository **`autosmart-invoice`** yang telah Anda push ke GitHub.
3. Pada bagian **Framework Preset**, pilih **Vite** (otomatis terdeteksi dari `vercel.json`).
4. Buka bagian **Environment Variables**, lalu tambahkan variabel berikut (opsional jika ingin langsung terhubung ke Google Sheets):
   - `GAS_WEB_APP_URL` = URL deployment Web App Google Apps Script Anda (`https://script.google.com/macros/s/.../exec`)
   - `GAS_API_SECRET` = Kunci rahasia opsional untuk komunikasi proxy server
5. Klik **Deploy**. Dalam ~1 menit aplikasi Anda akan aktif di `https://nama-project-anda.vercel.app`.

### Cara 2: Melalui Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## 4. Akun Akses Standar (Demo / Inisialisasi Awal)

- **Administrator:** `admin@autosmart.id` / `admin123`
- **Staff Billing:** `staff@autosmart.id` / `staff123`
