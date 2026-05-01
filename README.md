# 📍 ada titik?

**Bantuan tepat, sampai ke yang membutuhkan**

---

## 📌 Deskripsi Singkat

**ada titik?** adalah aplikasi *social donation mapping* berbasis lokasi yang bertujuan untuk menjembatani **donatur** dan **komunitas penyalur bantuan** secara transparan, akurat, dan efisien.

Berbeda dengan platform donasi konvensional, aplikasi ini tidak hanya menghubungkan pemberi dan penerima bantuan, tetapi menghadirkan **sistem berbasis peta (map-based system)** yang memungkinkan distribusi bantuan dilakukan secara **tepat sasaran**.

---


## 🎯 Latar Belakang (Studi Kasus)

Dalam praktik di masyarakat, terdapat beberapa permasalahan utama:

* ❗ **Information Asymmetry**
  Donatur tidak mengetahui lokasi kebutuhan bantuan terdekat

* ❗ **Logistics Mismatch**
  Bantuan sering menumpuk di lembaga besar, sementara wilayah kecil terabaikan

* ❗ **Kurangnya Validitas Informasi**
  Banyak permintaan bantuan tidak jelas atau fiktif

* ❗ **Minim Transparansi**
  Donatur tidak mengetahui apakah bantuan benar-benar sampai

---

## 💡 Solusi yang Ditawarkan

Aplikasi **ada titik?** menghadirkan solusi melalui:

* 📍 Visualisasi kebutuhan bantuan berbasis **peta interaktif**
* 📡 Sistem **notifikasi berbasis lokasi**
* 📏 Validasi lokasi menggunakan **Geo-Fencing**
* 📸 Transparansi melalui **dokumentasi bantuan**
* ⭐ Sistem **rating & pelaporan**

---

## 👥 Aktor dalam Sistem

### 1. Donatur

Pengguna yang memberikan bantuan

### 2. Komunitas

Pihak yang:

* membuat permintaan bantuan
* menerima bantuan dari donatur
* mendistribusikan ke target

### 3. Admin

Pihak yang:

* memverifikasi laporan
* menjaga validitas sistem

---

## 🔄 Konsep Alur Sistem

```text
Donatur → Komunitas → Target Penerima
```

* Donatur memberikan bantuan
* Komunitas menyalurkan bantuan
* Target menerima bantuan

---

## ⚙️ Fitur Utama

### 📍 1. Map-Based Donation System

* Menampilkan titik bantuan dalam bentuk marker
* Warna berdasarkan urgensi:

  * 🔴 Mendesak
  * 🟡 Normal
  * 🟢 Rendah

---

### 📡 2. Smart Notification (Location-Based)

* Notifikasi bantuan dalam radius tertentu (misal 5km)

---

### 📏 3. Geo-Fencing Validation

* Validasi lokasi distribusi bantuan
* Menggunakan GPS dan perhitungan jarak
* Threshold: ≤ 100 meter

---

### 📊 4. Status Bantuan

| Status       | Deskripsi        |
| ------------ | ---------------- |
| Open Request | Menunggu bantuan |
| On Progress  | Sedang diproses  |
| Completed    | Selesai          |

---

### 📸 5. Dokumentasi Bantuan

* Upload foto bukti distribusi
* Transparansi kepada donatur

---

### ⭐ 6. Rating System

* Donatur memberi penilaian
* Meningkatkan kepercayaan sistem

---

### 🚨 7. Sistem Pelaporan

* Melaporkan bantuan fiktif
* Verifikasi oleh admin

---

### 🔍 8. Filter & Search

* Berdasarkan:

  * jarak
  * kategori
  * urgensi

---

## 🧩 Fitur Berdasarkan Role

### 👤 Donatur

* Melihat peta bantuan
* Mencari bantuan terdekat
* Melihat detail bantuan
* Menyalurkan bantuan
* Memberi rating
* Melaporkan bantuan

---

### 🏘 Komunitas

* Membuat permintaan bantuan
* Menentukan lokasi & urgensi
* Menerima bantuan dari donatur
* Menyalurkan bantuan ke target
* Upload dokumentasi
* Update status bantuan

---

### 🛠 Admin

* Verifikasi laporan
* Moderasi sistem
* Menghapus data tidak valid

---

## 🧠 Arsitektur Sistem

### Teknologi yang digunakan:

* **Frontend**: Flutter (Dart)
* **Backend**: Firebase
* **Database**: Cloud Firestore
* **Authentication**: Firebase Auth
* **Maps API**: Google Maps Platform
* **Location**: GPS / Geo-Fencing

---

## 🗂 Struktur Data (Entity)

* User
* Request Bantuan
* Distribusi Bantuan
* Dokumentasi
* Rating
* Laporan

---

## 🔄 Alur Utama Sistem

1. Komunitas membuat permintaan bantuan
2. Sistem broadcast ke donatur
3. Donatur menerima dan memilih bantuan
4. Donatur menyalurkan bantuan ke komunitas
5. Komunitas mendistribusikan ke target
6. Sistem validasi lokasi (geo-fencing)
7. Komunitas upload dokumentasi
8. Status menjadi **Completed**
9. Donatur memberikan rating

---

## 🎨 Struktur Antarmuka

### Halaman utama:

* Home (Dashboard)
* Maps (Peta Bantuan)
* Tambah (+)
* Notifikasi
* Profile

---

## 🔐 Kebutuhan Non-Fungsional

* 🔒 Keamanan data (enkripsi)
* ⚡ Performa real-time
* 📱 UI/UX sederhana & intuitif
* 📈 Skalabilitas tinggi
* 🔍 Akurasi lokasi tinggi

---

## 🚀 Keunggulan Aplikasi

* ✔ Berbasis lokasi (LBS)
* ✔ Distribusi bantuan lebih merata
* ✔ Transparansi tinggi
* ✔ Sistem anti-fraud (geo-fencing + laporan)
* ✔ Cocok untuk komunitas kecil

---

## 📈 Potensi Pengembangan

* Heatmap distribusi bantuan
* AI rekomendasi lokasi bantuan
* Integrasi pembayaran digital
* Sistem reputasi lanjutan
* Dashboard analitik admin

---

## 🎯 Tujuan Akhir

Mewujudkan platform yang:

> “Tidak hanya mempermudah memberi, tetapi memastikan setiap bantuan sampai ke tempat yang tepat.”

---

## 👨‍💻 Tim Pengembang

Kelompok 4 – Informatika
UIN Sunan Kalijaga Yogyakarta

* Agung Nugraha
* Ibnu Zaki
* Ahmad Zamroni Trikarta
* Ahmad Mustofa Aslam

---

## 📌 Penutup

Aplikasi **ada titik?** bukan hanya solusi teknologi, tetapi juga upaya untuk membangun ekosistem kebaikan yang:

* transparan
* terukur
* dan berdampak nyata

---

✨ *“Kebaikan itu ada, tinggal kita temukan titiknya.”*
