# Titik Baik - Backend API 📍🤝

Titik Baik adalah backend sistem berbasis LBS (*Location-Based Service*) yang menjembatani donatur dan penerima bantuan sosial. Sistem ini dirancang untuk menyelesaikan masalah *Information Asymmetry* dengan memvisualisasikan data suplai dan permintaan bantuan pada peta interaktif.

## 🚀 Teknologi Utama
* **Runtime:** Node.js
* **Framework:** Express.js (ES6 Modules)
* **Database:** PostgreSQL dengan ekstensi **PostGIS** untuk kalkulasi geospasial.
* **Keamanan:** JSON Web Token (JWT) & bcrypt.
* **Storage:** Multer (Local File System untuk unggah foto).

## ✨ Fitur Utama
1. **User Management:** Autentikasi JWT dengan pemisahan peran (Donatur & Komunitas).
2. **Core Mapping:** Pembuatan titik kebutuhan bantuan dengan koordinat Latitude & Longitude (PostGIS Point).
3. **Radius Search:** Pencarian titik bantuan terdekat (Nearby) menggunakan `ST_DWithin`.
4. **Geo-Fencing Validation:** Validasi pembaruan status (`Completed`) hanya bisa dilakukan jika *user* berada dalam radius maksimal 100 meter dari titik bantuan.
5. **Dokumentasi Transparan:** Sistem unggah foto bukti setelah bantuan disalurkan.
6. **Reputation System:** Pemberian rating (1-5) dan ulasan untuk menjaga kepercayaan (Trust) antar pengguna.

## 🛠️ Prasyarat Instalasi
Sebelum menjalankan proyek ini, pastikan Anda telah menginstal:
* [Node.js](https://nodejs.org/) (v18 atau lebih baru)
* [PostgreSQL](https://www.postgresql.org/)
* **PostGIS Extension** diaktifkan pada database Anda.

## 📦 Cara Menjalankan Secara Lokal

**1. Clone repositori ini**
```bash
git clone [https://github.com/NUGRAHA18/titik_baik_backend.git](https://github.com/NUGRAHA18/titik_baik_backend.git)
cd titik_baik_backend
```
**2. Jalankan server**
````bash 
npm run dev
````

## 📂 Struktur Direktori Utama
````bash
src/
├── config/        # Koneksi database (pg Pool)
├── controllers/   # Logika bisnis utama (Auth, Donations, Ratings)
├── middleware/    # Filter keamanan (JWT verify, Multer upload)
├── routes/        # Definisi endpoint (API Router)
└── server.js      # Titik masuk aplikasi (Entry point)
````

## ✍️ Tim Pengembang
Agung Nugraha - Backend & System Architecture