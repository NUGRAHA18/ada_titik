# ✅ Flow Donasi — Status Realisasi Backend (per 2026-05-29)

> Penanda untuk tim Frontend: seluruh poin pada `requirment_flow_donation.md`
> sudah direalisasikan di backend kecuali yang ditandai khusus di bawah.
> Migration: `database/migration_v5.sql`. Versi dokumen API: **v3.2**.

---

## A. Ringkasan Perubahan

| Kebutuhan FE | Status | Catatan |
|---|---|---|
| Default urgency = **High** saat create titik | ✅ Sudah | Backend memaksa `Mendesak`, body `urgency` di-ignore. |
| Pilihan urgency dihilangkan dari form | ✅ Sudah | FE bebas hapus field; backend juga tidak lagi validasi nilai input. |
| Tabel relasi `donation_participants` | ✅ Sudah | Lihat skema di bawah. |
| Endpoint **Berangkat** (donatur) | ✅ Sudah | `POST /api/donations/:pointId/participants` |
| Endpoint **Accept** (komunitas, bulk) | ✅ Sudah | `PATCH /api/donations/:pointId/participants/accept` |
| Endpoint **Complete** (komunitas, bulk) + geo-fencing | ✅ Sudah | `PATCH /api/donations/:pointId/participants/complete` |
| Auto-kalkulasi progress (`collected_amount`) | ✅ Sudah | Backend recompute tiap accept/complete. |
| Auto-update urgency (High → Normal → Low) | ✅ Sudah | Formula di `src/utils/urgency.js`. |
| Auto-pemberian Poin Donatur saat complete | ✅ Sudah | +50 poin/donatur tiap di-complete. |
| Notifikasi event accept / complete / progress / urgency | ✅ Sudah | Lihat `notifications_done.md`. |

> Endpoint lama `PATCH /api/donations/:id/status` tetap dipertahankan untuk
> backward-compat (komunitas menutup titik secara manual). Status point juga
> akan otomatis berubah ke `On Progress` saat ada accepted/completed
> participant pertama.

---

## B. Skema Tabel Baru

### `donation_participants`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | SERIAL PK | — |
| `point_id` | INT FK → donation_points | ON DELETE CASCADE |
| `donator_id` | UUID FK → users | ON DELETE CASCADE |
| `state` | VARCHAR(20) | `requested` / `accepted` / `completed` / `cancelled` |
| `contribution_amount` | NUMERIC(15,2) | Diisi pada `complete` (opsional via body). |
| `accepted_at` | TIMESTAMP | Diisi saat accept. |
| `completed_at` | TIMESTAMP | Diisi saat complete. |
| `completed_user_lat` | DOUBLE PRECISION | Lokasi komunitas saat complete. |
| `completed_user_lng` | DOUBLE PRECISION | — |
| `created_at` | TIMESTAMP | — |

**Constraint:** `UNIQUE (point_id, donator_id)` — 1 donatur 1 row per titik.

### Kolom baru di `users`

| Kolom | Tipe | Default |
|---|---|---|
| `points` | INT NOT NULL | `0` — akumulasi Poin Donatur |

### Tabel audit `donator_points_log`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | SERIAL PK | — |
| `donator_id` | UUID FK | — |
| `point_id` | INT FK (nullable) | Titik sumber poin (boleh NULL jika sumber lain). |
| `delta` | INT | Bisa negatif jika butuh koreksi. |
| `reason` | VARCHAR(60) | `participant_completed` saat ini. |
| `created_at` | TIMESTAMP | — |

---

## C. Endpoint Baru

> Semua endpoint memerlukan `Authorization: Bearer <token>`.

### 1. Donatur tekan "Berangkat"

```http
POST /api/donations/:pointId/participants
```

**Role:** donatur · **Body (opsional):**

```json
{ "user_lat": -7.7956, "user_lng": 110.3695 }
```

**Behavior:**
- Insert `donation_participants` dengan `state='requested'`.
- Idempotent: jika sudah pernah Berangkat, response 200 dengan row yang sama.
- Notifikasi `donator_departed` dikirim ke owner komunitas (hanya saat row dibuat).

**Response 201:**

```json
{
  "message": "Sinyal 'Berangkat' terkirim",
  "data": {
    "id": 12,
    "point_id": 42,
    "donator_id": "uuid-donatur",
    "state": "requested",
    "accepted_at": null,
    "completed_at": null,
    "created_at": "2026-05-29T08:00:00.000Z"
  }
}
```

---

### 2. Donatur batalkan Berangkat

```http
DELETE /api/donations/:pointId/participants/me
```

**Role:** donatur · **Body:** —

- Boleh hanya saat state `requested` atau `accepted` (tidak boleh untuk `completed`).
- Trigger recompute aggregates + notifikasi `donator_departed` ke owner (state `cancelled`).

---

### 3. Donatur cek partisipasi sendiri

```http
GET /api/donations/:pointId/participants/me
```

**Role:** semua (token wajib).

**Response 200 jika belum berangkat:** `{ "data": null }`
**Response 200 jika sudah:** `{ "data": { ...row participant } }`

---

### 4. Komunitas lihat daftar donatur titik

```http
GET /api/donations/:pointId/participants?state=requested
```

**Role:** komunitas (owner titik) atau admin.
**Query opsional `state`:** `requested` / `accepted` / `completed` / `cancelled`.

**Response 200:**

```json
{
  "count": 2,
  "data": [
    {
      "id": 12,
      "donator_id": "uuid-donatur",
      "state": "requested",
      "contribution_amount": "0.00",
      "accepted_at": null,
      "completed_at": null,
      "created_at": "2026-05-29T08:00:00.000Z",
      "donator_name": "Budi Santoso",
      "donator_avatar": null
    }
  ]
}
```

Urutan: `requested` → `accepted` → `completed` → `cancelled`, kemudian per `created_at DESC`.

---

### 5. Komunitas Accept (bulk)

```http
PATCH /api/donations/:pointId/participants/accept
```

**Role:** komunitas (owner) atau admin. **Body:**

```json
{ "donator_ids": ["uuid1", "uuid2"] }
```

**Behavior:**
- Hanya row dengan `state='requested'` yang berubah ke `accepted`.
- Trigger recompute aggregates (`collected_amount`, `urgency`, `status`).
- Notifikasi `participant_accepted` dikirim ke tiap donatur.

**Response 200:**

```json
{
  "message": "2 donatur ditandai accepted",
  "accepted_count": 2,
  "aggregates": {
    "collected_amount": "0.00",
    "urgency": "Mendesak",
    "status": "On Progress",
    "urgency_changed": false,
    "previous_urgency": "Mendesak"
  }
}
```

---

### 6. Komunitas Complete (bulk) + Geo-Fencing

```http
PATCH /api/donations/:pointId/participants/complete
```

**Role:** komunitas (owner) atau admin. **Body:**

```json
{
  "donator_ids": ["uuid1", "uuid2"],
  "user_lat": -7.7956,
  "user_lng": 110.3695,
  "per_donator_amount": 250000
}
```

**Behavior:**
1. Validasi geo-fencing ≤ 100 m dari titik (`HTTP 403` jika gagal).
2. Hanya row dengan `state='accepted'` yang berubah ke `completed`.
3. `per_donator_amount` (opsional, ≥0) → mengisi `contribution_amount` baris yang baru di-complete.
4. **+50 Poin Donatur** per donatur, audit di `donator_points_log`.
5. Recompute `collected_amount`, `urgency`, `status` titik.
6. Notifikasi `participant_completed` ke tiap donatur (mencantumkan `points_awarded`).
7. Jika urgency berubah → notifikasi tambahan `urgency_changed` ke semua participant aktif.

**Response 200:**

```json
{
  "message": "2 donasi ditandai selesai",
  "completed_count": 2,
  "points_awarded_each": 50,
  "aggregates": {
    "collected_amount": "500000.00",
    "urgency": "Normal",
    "status": "On Progress",
    "urgency_changed": true,
    "previous_urgency": "Mendesak"
  }
}
```

---

### 7. Komunitas update progres manual

```http
PATCH /api/donations/:pointId/progress
```

**Role:** komunitas (owner) atau admin. **Body (minimal satu):**

```json
{ "goal_amount": 1000000, "collected_amount": 400000 }
```

**Behavior:**
- Update kolom `donation_points.goal_amount` / `collected_amount`.
- Recompute urgency dengan formula yang sama.
- Notifikasi `progress_updated` ke semua participant aktif; jika urgency berubah → `urgency_changed` juga.

---

## D. Aturan Urgency Otomatis

Formula di `src/utils/urgency.js`:

```
progress = collected_amount / goal_amount   (clamp 0..1)

progress <  0.33  → Mendesak  (High)
progress <  0.80  → Normal
progress >= 0.80  → Rendah    (Low)

goal_amount <= 0  → Mendesak  (default tanpa target)
```

Urgency di-recompute setiap kali:
- accept (mungkin hanya change status, tidak ubah collected — tapi recompute aman dipanggil)
- complete
- update progress manual

---

## E. Poin Donatur

- **+50 poin** per participant yang di-complete oleh komunitas.
- Akumulasi: kolom `users.points` (di-`UPDATE` di transaction yang sama dengan complete).
- Riwayat: `GET /api/users/points` (donatur sendiri).

**Response `GET /api/users/points`:**

```json
{
  "pagination": { "total": 3, "total_pages": 1, "current_page": 1, "limit": 20 },
  "data": {
    "total_points": 150,
    "history": [
      {
        "id": 5,
        "point_id": 42,
        "delta": 50,
        "reason": "participant_completed",
        "created_at": "2026-05-29T08:10:00.000Z",
        "point_title": "Bantuan Pangan Korban Banjir Code"
      }
    ]
  }
}
```

---

## F. Migration

```bash
psql -U postgres -d titik_baik -f database/migration_v5.sql
```

Migration **idempotent** — aman dijalankan ulang. Schema penuh tersedia di
`database/schema.sql` (untuk fresh install).

---

## G. File yang Disentuh

| File | Status |
|---|---|
| `database/migration_v5.sql` | **Baru** |
| `database/schema.sql` | Update (urgency default, tabel baru) |
| `src/utils/urgency.js` | **Baru** |
| `src/services/notificationService.js` | **Baru** |
| `src/controllers/participantController.js` | **Baru** |
| `src/controllers/donationController.js` | Update (`createDonationPoint` paksa `Mendesak`) |
| `src/controllers/userController.js` | Update (`getMyPoints`) |
| `src/routes/donationRoutes.js` | Update (7 route participants) |
| `src/routes/userRoutes.js` | Update (`/points`) |
| `src/middleware/validators.js` | Update (4 rules baru) |

---

> Konfirmasi siap dipakai oleh FE. Detail kontrak lengkap dengan contoh
> request/response juga tersedia di `API_DOCUMENTATION.md` bab **9.7 – 9.13**.
