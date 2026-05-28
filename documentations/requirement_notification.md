# 📢 Requirement Sistem Notifikasi Aplikasi

---

## A. Sisi Donatur (Donator Side)

### 1. Notifikasi Berbasis Lokasi & Titik Baru

| # | Jenis Notifikasi | Deskripsi | Contoh |
|---|-----------------|-----------|--------|
| 1.1 | **Titik Donasi Terdekat** | Menampilkan notifikasi jika ada komunitas yang membuat titik donasi baru dalam radius terdekat dari lokasi GPS donatur saat ini. | *"Ada titik donasi baru di dekat Anda: 'Bantuan Logistik Longsor'"* |

---

### 2. Notifikasi Alur Donasi (Status Hub)

| # | Jenis Notifikasi | Deskripsi | Contoh |
|---|-----------------|-----------|--------|
| 2.1 | **Konfirmasi Pendaftaran ("Accept")** | Notifikasi saat komunitas menyetujui (meng-accept) sinyal "Berangkat" yang dikirimkan oleh donatur. | — |
| 2.2 | **Donasi Selesai & Poin** | Notifikasi bahwa donasi telah diverifikasi selesai oleh komunitas, disertai informasi perolehan poin. | *"Donasi Anda telah selesai dikonfirmasi. Selamat, Anda mendapatkan +50 Poin Donatur!"* |
| 2.3 | **Update Progres Titik** | Notifikasi berkala ketika komunitas memperbarui progres target pada titik yang sedang diikuti oleh donatur (sudah menekan "Berangkat"). | *Misal: progres berubah dari 100/1000 ke 500/1000* |
| 2.4 | **Perubahan Status Urgensi** | Pemberitahuan jika tingkat urgensi titik donasi berubah. | *Misal: dari High ke Normal karena kuota bantuan mulai terpenuhi* |

---

### 3. Notifikasi Komunitas & Interaksi Sosial (Community Feed)

| # | Jenis Notifikasi | Deskripsi |
|---|-----------------|-----------|
| 3.1 | **Balasan Komentar** | Notifikasi ketika ada pengguna lain (donatur lain atau komunitas) yang membalas (reply) komentar donatur di feed atau memberikan komentar di utas (thread) yang sama. |
| 3.2 | **Feed Baru dari Komunitas Diikuti** | Notifikasi jika komunitas yang pernah dibantu oleh donatur mengunggah kabar/postingan baru di Community Feed. |

---

### 4. Tambahan Notifikasi Baru *(Rekomendasi untuk Donatur)*

| # | Jenis Notifikasi | Deskripsi | Contoh |
|---|-----------------|-----------|--------|
| 4.1 | **Titik Darurat/Kritis (High Urgency)** | Notifikasi khusus jika ada titik donasi di sekitar kota donatur yang statusnya masih High Urgency dan sangat membutuhkan bantuan dalam waktu cepat. | — |
| 4.2 | **Pencapaian Peringkat (Milestone Badge)** | Pemberitahuan ketika akumulasi poin donatur mencapai target tertentu dan mendapatkan badge baru. | *"Selamat! Anda naik level menjadi Donatur Emas"* |

---

## B. Sisi Komunitas (Community Side)

### 1. Notifikasi Alur Donasi (Manajemen Bantuan)

| # | Jenis Notifikasi | Deskripsi | Contoh |
|---|-----------------|-----------|--------|
| 1.1 | **Sinyal Donatur Baru ("Berangkat")** | Notifikasi instan ketika ada donatur yang menekan tombol "Berangkat" pada titik donasi milik komunitas. | *"Donatur @ahmad_zamroni menekan 'Berangkat' ke titik Anda"* |
| 1.2 | **Pembatalan Donatur** | Notifikasi jika donatur yang sudah berkomitmen mendadak membatalkan aksi "Berangkat" mereka, sehingga komunitas dapat memperbarui manajemen logistik. | — |

---

### 2. Notifikasi Komunitas & Interaksi Sosial (Community Feed)

| # | Jenis Notifikasi | Deskripsi |
|---|-----------------|-----------|
| 2.1 | **Interaksi pada Feed Sendiri** | Notifikasi setiap kali ada donatur yang memberikan like, komentar, atau membagikan postingan yang diunggah oleh komunitas di Community Feed. |
| 2.2 | **Diskusi di Feed Lain** | Notifikasi jika komunitas terlibat dalam komentar di feed komunitas lain dan ada yang membalas komentar tersebut. |

---

### 3. Notifikasi Berbasis Lokasi & Titik Baru

| # | Jenis Notifikasi | Deskripsi |
|---|-----------------|-----------|
| 3.1 | **Titik Kolaborasi** | Sama seperti donatur, komunitas juga menerima notifikasi jika ada komunitas lain yang membuka titik bantuan di dekat wilayah mereka, guna membuka peluang kolaborasi atau pembagian posko. |

---

### 4. Tambahan Notifikasi Baru *(Rekomendasi untuk Komunitas)*

| # | Jenis Notifikasi | Deskripsi |
|---|-----------------|-----------|
| 4.1 | **Evaluasi & Penutupan Titik Otomatis** | Notifikasi pengingat jika target titik donasi sudah terpenuhi (1000/1000) atau status sudah otomatis berubah menjadi Low Urgency, menyarankan komunitas untuk meninjau dan menutup titik tersebut jika sudah selesai sepenuhnya. |
| 4.2 | **Laporan Mingguan/Bulanan (Insight)** | Notifikasi rangkuman performa komunitas, seperti jumlah total donatur yang berhasil diverifikasi dan total logistik yang terkumpul selama satu bulan. |

---

## C. Penyempurnaan Backend

### 1. Kondisi Notifikasi Saat Ini (Implementasi yang Ada)

Backend saat ini **hanya memiliki satu endpoint** untuk notifikasi:

```
GET /api/notifications/nearby  [Protected JWT]
```

**File terkait:**
- `be/ada_titik-backend/src/routes/notificationRoutes.js`
- `be/ada_titik-backend/src/controllers/notificationController.js`

**Implementasi:** Mengambil donation points dengan `status='Open'` dalam radius tertentu dan mengembalikan shape notifikasi berikut:

```json
{
  "title": "Bantuan baru di dekat Anda",
  "subtitle": "<judul titik>",
  "type": "nearby_donation",
  "urgency": "...",
  "category": "...",
  "distance_meters": 0,
  "point_id": "..."
}
```

---

### 2. Requirement Event-Notification yang Diperlukan

Requirement yang diminta **tidak dapat dipenuhi** tanpa tambahan backend. Berikut daftar requirement yang belum terpenuhi:

| Event | Notifikasi yang Dibutuhkan | Status |
|-------|--------------------------|--------|
| Donatur tekan "Berangkat" | Notifikasi ke owner komunitas | ❌ Belum ada |
| Komunitas accept / complete donasi | Notifikasi ke donatur terkait | ❌ Belum ada |
| Progress update / urgency berubah | Notifikasi ke donatur terkait | ❌ Belum ada |
| Like / comment / report | Notifikasi sosial ke user terkait | ❌ Belum ada |
| Feed komunitas diperbarui | Notifikasi ke followers/donatur | ❌ Belum ada |
| Milestone badge / weekly digest | Notifikasi periodik ke donatur/komunitas | ❌ Belum ada |

---

### 3. Temuan Tambahan: Endpoint Tanpa Asosiasi Notifikasi

#### Sisi Donasi
- **File:** `be/ada_titik-backend/src/controllers/donationController.js`
- **Fungsi:** `updateDonationStatus` — mengubah status titik: `Open → On Progress → Completed`
- **Masalah:** Tidak ada logika untuk membuat **notification record** ke user tertentu.

#### Sisi Komunitas
- **Fungsi:** `likePost` dan `createComment` — tersedia, namun **tidak ada bagian yang membuat notification**.

---

### 4. Yang Perlu Ditambahkan di Backend

Untuk memenuhi requirement *event-driven notification*, backend perlu ditambah komponen berikut:

```
1. Tabel/record notification di database
2. Service: createNotification(userId, type, payload)
3. Hook/trigger dari:
   - updateDonationStatus
   - likePost
   - createComment
   - createReport (fraud/report)
   - trigger lain yang diperlukan
4. Endpoint generik untuk FE:
   - GET    /api/notifications
   - PATCH  /api/notifications/:id/read
   - PATCH  /api/notifications/read-all
   - DELETE /api/notifications/:id
```

---

### 5. Dampak ke Frontend

Frontend (`notification_repository.dart`) saat ini mencoba memanggil:

| Endpoint yang Dipanggil FE | Status di Backend |
|---------------------------|------------------|
| `GET /api/notifications` | ❌ Tidak tersedia |
| `PATCH /api/notifications/:id/read` | ❌ Tidak tersedia |
| `PATCH /api/notifications/read-all` | ❌ Tidak tersedia |
| `DELETE /api/notifications/:id` | ❌ Tidak tersedia |
| `GET /api/notifications/nearby` | ✅ Tersedia |

---

## D. Kesimpulan

| Jenis Notifikasi | Status |
|-----------------|--------|
| Notifikasi berbasis lokasi untuk titik Open terdekat | ✅ **Sudah bisa** (endpoint tersedia) |
| Notifikasi alur donasi: Berangkat / accept / complete / progress / urgency berubah | ❌ **Belum bisa** (modul/endpoint tidak tersedia) |
| Notifikasi sosial: like / comment / report | ❌ **Belum bisa** (tidak ada trigger notifikasi) |
| Notifikasi feed, milestone badge, weekly/monthly digest | ❌ **Belum bisa** (modul belum dibangun) |

> **Kesimpulan:** Backend perlu penambahan modul notifikasi event-driven secara menyeluruh — meliputi skema database, service layer, hook pada controller yang ada, serta endpoint CRUD notifikasi — agar seluruh requirement di atas dapat terpenuhi.
