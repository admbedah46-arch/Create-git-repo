# Panduan Integrasi Google Sheets (Gratis)

Ikuti langkah-langkah di bawah ini untuk menghubungkan aplikasi ini ke Google Sheets secara gratis menggunakan **Google Apps Script**.

## Langkah 1: Siapkan Google Spreadsheet
1. Buka [Google Sheets](https://sheets.new).
2. Beri nama Spreadsheet Anda (contoh: `SurgiHub Database`).
3. Pada sheet pertama, ganti nama (Rename) tab di bawah menjadi `DB`.

## Langkah 2: Pasang Apps Script
1. Klik menu **Extensions** > **Apps Script**.
2. Hapus semua kode default yang ada di editor.
3. Salin dan tempel kode dari file `GOOGLE_APPS_SCRIPT.js` yang ada di aplikasi ini ke dalam editor Apps Script.
4. Klik tombol simpan (ikon disket) dan beri nama proyek (contoh: `SurgiHub Backend`).

## Langkah 3: Deploy sebagai Web App
1. Klik tombol **Deploy** di kanan atas, pilih **New deployment**.
2. Klik ikon gerigi (Select type), pilih **Web app**.
3. Isi kolom:
   - **Description**: `SurgiHub API`
   - **Execute as**: `Me` (Akun Google Anda)
   - **Who has access**: `Anyone` (Penting agar aplikasi bisa mengaksesnya)
4. Klik **Deploy**.
5. Anda akan diminta **Authorize Access**. Klik **Authorize access**, pilih akun Google Anda.
6. Mungkin muncul peringatan "Google hasn't verified this app". Klik **Advanced** > **Go to SurgiHub Backend (unsafe)**.
7. Klik **Allow**.
8. Setelah berhasil, salin **Web App URL** yang muncul (berakhiran `/exec`).

## Langkah 4: Konfigurasi di Aplikasi
1. Kembali ke aplikasi ini.
2. Buka Menu **Settings** (dari platform AI Studio).
3. Cari variabel lingkungan (Environment Variable) bernama `VITE_APPS_SCRIPT_URL`.
4. Tempelkan URL yang Anda salin tadi ke kolom tersebut.
5. Selesai! Aplikasi Anda sekarang akan menyimpan dan mengambil data langsung dari Google Sheet.

---

### Tips Penggunaan
- **Sinkronisasi**: Data akan otomatis tersimpan setiap kali Anda menambah pasien atau mengisi laporan.
- **Tombol Sinkron**: Jika Anda membuka aplikasi di perangkat lain, gunakan tombol "Sinkron" di menu Laporan Keperawatan untuk memperbarui data dari Google Sheets.
- **Batas Kapasitas**: Metode "Simple DB" ini menyimpan data dalam satu sel (A1). Google Sheets memiliki batas karakter per sel sekitar 50.000 karakter. Jika data Anda sangat besar, Anda perlu mempertimbangkan integrasi database yang lebih profesional atau membagi data ke beberapa sheet.
