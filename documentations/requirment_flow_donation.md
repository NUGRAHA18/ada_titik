# 📋 Requirement Flow Donasi (Donatur ↔ Komunitas)

---

## A. Sisi Komunitas (Manajemen Titik & Donasi)

### 1. Pembuatan Titik Donasi

- Komunitas dapat menambahkan titik donasi baru di Maps.
- Status urgensi titik secara **default** adalah **High Urgency**.
- Pilihan tingkat urgensi **dihilangkan** dari form input (tidak perlu dipilih manual).

---

### 2. Kelola Bantuan

Setiap titik yang dibuat akan masuk ke menu **"Kelola Bantuan"**. Di menu ini, komunitas dapat melakukan:

#### 2a. Mengelola Donatur

- Menerima **daftar (list) akun donatur** yang telah menekan tombol **"Berangkat"**.
- Komunitas dapat melakukan aksi berikut untuk masing-masing donatur secara **individual**:

| Aksi | Deskripsi |
|------|-----------|
| **Accept** | Menerima/menyetujui donatur yang akan datang |
| **Complete** | Menandai donasi dari donatur spesifik sebagai selesai |

> ⚠️ **Catatan:** Tombol "Tandai Selesai" berfungsi untuk menyelesaikan proses donasi dari **donatur spesifik**, bukan untuk menutup titik donasi di Maps.

#### 2b. Update Progres Target

- Komunitas dapat memperbarui nominal progres kapan saja.
- Contoh: dari `0/1000` → `100/1000`

#### 2c. Perubahan Status Urgensi Otomatis

Tingkat urgensi berubah **otomatis** berdasarkan persentase progres menuju target:

| Kondisi Progres | Status Urgensi |
|----------------|----------------|
| Masih jauh dari target | 🔴 **High Urgency** |
| Sudah berjalan / tengah-tengah | 🟡 **Normal** |
| Semakin mendekati target | 🟢 **Low Urgency** |

---

## B. Sisi Donatur

### 1. Detail Titik Donasi

- Donatur dapat melihat **penjelasan lengkap dan detail** dari titik donasi yang dibuat oleh komunitas pada peta.

### 2. Fitur "Berangkat"

- Donatur dapat menekan tombol **"Berangkat"** sebagai sinyal/notifikasi kepada komunitas bahwa mereka akan memberikan bantuan ke titik tersebut.

### 3. Reward Poin

- Setelah donasi dinyatakan **Complete** oleh pihak komunitas, donatur akan **otomatis mendapatkan Poin Donatur**.

---

## C. Detail Penambahan Backend yang Dibutuhkan

### 1. Tabel Relasi `donation_participants`

Buat tabel baru untuk menyimpan relasi donatur ↔ titik donasi, agar komunitas dapat menerima/menyelesaikan daftar akun donatur per individu.

```sql
donation_participants
├── point_id          FK → donation_points
├── donator_id        FK → users
├── state             ENUM: requested | accepted | completed
├── accepted_at       TIMESTAMP (nullable)
├── completed_at      TIMESTAMP (nullable)
├── completed_user_lat  FLOAT (opsional, untuk geo-fencing)
└── completed_user_lng  FLOAT (opsional, untuk geo-fencing)
```

---

### 2. Endpoint: Donatur Sinyal Berangkat

Menggantikan makna "Berangkat" (yang sebelumnya hanya mengubah `status=On Progress`) menjadi pencatatan participant.

```
POST /api/donations/:pointId/participants
```

| Atribut | Nilai |
|---------|-------|
| **Role** | Donatur |
| **Efek** | Membuat baris participant dengan state awal `requested` |
| **Payload** | Minimal (lat/lng opsional, jika ingin validasi jarak saat berangkat) |

---

### 3. Endpoint: Komunitas Accept per Donatur

```
PATCH /api/donations/:pointId/participants/accept
```

| Atribut | Nilai |
|---------|-------|
| **Role** | Komunitas (owner point) |
| **Body** | `{ "donator_ids": ["uuid1", "uuid2"] }` |
| **Efek** | State participant → `accepted` |

> Mendukung **bulk accept** (banyak donatur sekaligus).

---

### 4. Endpoint: Komunitas Complete per Donatur (+ Geo-Fencing)

```
PATCH /api/donations/:pointId/participants/complete
```

| Atribut | Nilai |
|---------|-------|
| **Role** | Komunitas (owner point) |
| **Body** | `{ "donator_ids": [...], "user_lat": ..., "user_lng": ... }` |
| **Efek** | Lihat tabel di bawah |

**Efek yang terjadi saat complete:**

| # | Efek |
|---|------|
| 1 | Validasi geo-fencing ≤ 100 meter |
| 2 | State participant → `completed` |
| 3 | Trigger **progress update** |
| 4 | Trigger **pembaruan urgency** otomatis |
| 5 | Trigger **pemberian poin** untuk tiap donatur yang diselesaikan |

---

### 5. Aturan Progress & Urgency

Urgency dihitung secara konsisten di backend berdasarkan progress participant:

```
progress = collected_amount / goal_amount
```

**Alur kalkulasi backend:**

```
1. Hitung collected_amount dari jumlah donasi participant (accepted/completed)
2. Hitung progress = collected_amount / goal_amount
3. Petakan progress ke urgency:
   - Jauh dari target  → High Urgency
   - Tengah-tengah     → Normal
   - Mendekati target  → Low Urgency
4. Simpan/update donations.urgency setelah setiap accept/complete
```

> ⚠️ **Penting:** Backend harus meng-override `donations.urgency` setelah setiap event accept/complete agar FE selalu konsisten membaca field yang sama.

---

### 6. Modul Notifikasi Event (Baru)

Endpoint saat ini (`GET /api/notifications/nearby`) hanya menyediakan notifikasi bantuan terdekat — **bukan** notifikasi event per participant. Perlu ditambahkan modul notifikasi event berikut:

#### Trigger Pembuatan Record Notifikasi

| Event | Penerima Notifikasi |
|-------|-------------------|
| Donatur menekan "Berangkat" | Owner komunitas (point owner) |
| Komunitas melakukan **Accept** | Donatur yang bersangkutan |
| Komunitas melakukan **Complete** | Donatur yang bersangkutan |
| Like / Comment / Report di feed | User terkait (di luar donation points) |

#### Endpoint Notifikasi yang Diperlukan

```
GET    /api/notifications              → List notifikasi user
PATCH  /api/notifications/:id/read    → Tandai satu notifikasi sebagai dibaca
PATCH  /api/notifications/read-all    → Tandai semua sebagai dibaca
DELETE /api/notifications/:id         → Hapus notifikasi
```

---

## D. Ringkasan Gap Backend

| Kebutuhan | Status Saat Ini |
|-----------|----------------|
| Tabel `donation_participants` | ❌ Belum ada |
| `POST /participants` (sinyal berangkat) | ❌ Belum ada |
| `PATCH /participants/accept` | ❌ Belum ada |
| `PATCH /participants/complete` + geo-fencing | ❌ Belum ada |
| Auto-kalkulasi progress & urgency | ❌ Belum ada |
| Auto-pemberian poin donatur | ❌ Belum ada |
| Notifikasi event accept/complete | ❌ Belum ada |
| `GET /api/notifications/nearby` | ✅ Sudah ada |

---

> **Kesimpulan:** Seluruh alur donasi end-to-end (Berangkat → Accept → Complete → Poin) membutuhkan penambahan tabel, endpoint, business logic urgency, dan modul notifikasi event yang saat ini belum tersedia di backend.
