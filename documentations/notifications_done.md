# ✅ Notifikasi Event-Driven — Status Realisasi Backend (per 2026-05-29)

> Penanda untuk tim Frontend: modul notifikasi event-driven sudah dibangun
> di backend. Migration: `database/migration_v5.sql`. Versi dokumen API: **v3.2**.

---

## A. Ringkasan Status

| Kebutuhan FE | Status | Catatan |
|---|---|---|
| Tabel/record notification di DB | ✅ Sudah | Tabel `notifications` (jsonb payload). |
| Service `createNotification(userId, type, payload)` | ✅ Sudah | `src/services/notificationService.js`. |
| Hook di `likePost` | ✅ Sudah | Notif `post_liked` ke author. |
| Hook di `createComment` | ✅ Sudah | Notif `post_commented` ke author. |
| Hook di event participant (Berangkat/Accept/Complete) | ✅ Sudah | Detail di bawah. |
| Hook di update progress / urgency change | ✅ Sudah | `progress_updated` & `urgency_changed`. |
| `GET /api/notifications` | ✅ Sudah | Pagination + filter `?unread=true`. |
| `PATCH /api/notifications/:id/read` | ✅ Sudah | — |
| `PATCH /api/notifications/read-all` | ✅ Sudah | — |
| `DELETE /api/notifications/:id` | ✅ Sudah | — |
| Realtime push ke FE | ✅ Sudah | Tabel `notifications` ditambahkan ke `supabase_realtime` publication; RLS aktif. |
| `GET /api/notifications/nearby` (lama) | ✅ Tetap | Tidak diubah, masih berfungsi. |
| Notifikasi feed komunitas baru | ⏳ Belum dibangun | Belum ada konsep "follow komunitas" di DB. |
| Milestone badge / weekly digest | ⏳ Belum dibangun | Butuh sistem badge & scheduled job — bukan prioritas v5. |

---

## B. Skema Tabel `notifications`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | SERIAL PK | — |
| `user_id` | UUID NOT NULL FK → users | Penerima notifikasi. |
| `actor_id` | UUID FK → users (nullable) | Pelaku (boleh NULL untuk notifikasi sistem). |
| `type` | VARCHAR(40) | Salah satu dari **C. Tipe Notifikasi** di bawah. |
| `title` | VARCHAR(200) | Judul siap ditampilkan FE. |
| `body` | TEXT (nullable) | Subjudul / preview. |
| `payload` | JSONB DEFAULT `{}` | Data tambahan (`point_id`, `post_id`, dst.). |
| `read_at` | TIMESTAMPTZ (nullable) | NULL = belum dibaca. |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | — |

Index:
- `idx_notifications_user_created (user_id, created_at DESC)`
- partial `idx_notifications_user_unread (user_id) WHERE read_at IS NULL`

---

## C. Tipe Notifikasi (kontrak `type` ↔ FE)

Konstanta tersedia di `src/services/notificationService.js → NOTIF_TYPE`.

| `type` | Trigger | Penerima | `payload` minimal |
|---|---|---|---|
| `donator_departed` | Donatur tekan / batal Berangkat | Owner komunitas titik | `{ point_id, donator_id, state }` |
| `participant_accepted` | Komunitas accept seorang donatur | Donatur ybs. | `{ point_id, participant_id, state: "accepted" }` |
| `participant_completed` | Komunitas complete seorang donatur | Donatur ybs. | `{ point_id, participant_id, state: "completed", points_awarded }` |
| `progress_updated` | Komunitas update goal/collected | Semua participant aktif | `{ point_id, goal_amount, collected_amount }` |
| `urgency_changed` | Urgency titik berubah otomatis | Semua participant aktif | `{ point_id, from_urgency, to_urgency }` |
| `post_liked` | User like postingan komunitas | Author post | `{ post_id }` |
| `post_commented` | User komentari postingan | Author post | `{ post_id, comment_id }` |

> **Aturan umum:** notifikasi tidak dikirim ke diri sendiri
> (`actor_id === user_id` di-skip oleh service).

---

## D. Endpoint

> Semua endpoint memerlukan `Authorization: Bearer <token>`.

### D.1 List Notifikasi Saya

```http
GET /api/notifications?page=1&limit=20&unread=true
```

**Query:**
| Param | Default | Keterangan |
|---|---|---|
| `page` | `1` | — |
| `limit` | `20` (maks `50`) | — |
| `unread` | — | Jika `true`, hanya tampilkan yang belum dibaca. |

**Response 200:**

```json
{
  "pagination": { "total": 12, "total_pages": 1, "current_page": 1, "limit": 20 },
  "unread_count": 3,
  "data": [
    {
      "id": 102,
      "user_id": "uuid-penerima",
      "actor_id": "uuid-pelaku",
      "type": "participant_accepted",
      "title": "Komunitas menerima keberangkatan Anda",
      "body": "Titik \"Bantuan Pangan Korban Banjir Code\" — Anda di-accept oleh komunitas",
      "payload": { "point_id": 42, "participant_id": 7, "state": "accepted" },
      "read_at": null,
      "created_at": "2026-05-29T08:05:00.000Z"
    }
  ]
}
```

`unread_count` selalu mencerminkan jumlah belum-dibaca user (terlepas dari filter).

---

### D.2 Mark satu sebagai dibaca

```http
PATCH /api/notifications/:id/read
```

**Response 200:**

```json
{ "message": "Notifikasi ditandai dibaca", "data": { "id": 102, "read_at": "…" } }
```

`404` jika id bukan milik user.

---

### D.3 Mark semua sebagai dibaca

```http
PATCH /api/notifications/read-all
```

**Response 200:**

```json
{ "message": "Semua notifikasi ditandai dibaca", "marked_count": 3 }
```

---

### D.4 Hapus notifikasi

```http
DELETE /api/notifications/:id
```

**Response 200:**

```json
{ "message": "Notifikasi dihapus" }
```

---

## E. Realtime Push (Supabase Realtime)

Migration v5 menambahkan tabel `notifications` ke publication `supabase_realtime` +
RLS policy `notif_read_own` (`auth.uid() = user_id`).

**Cara FE subscribe (Flutter):**

```dart
_supabase
  .channel('notifications:${currentUserId}')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'notifications',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'user_id',
      value: currentUserId,
    ),
    callback: (payload) {
      final notif = payload.newRecord;
      // tampilkan badge / popup
    },
  )
  .subscribe();
```

> Tanpa user login ke Supabase Auth dengan UUID yang sama dengan `users.id`,
> RLS akan memblokir push. Pastikan tahap Supabase Auth sudah disiapkan
> sebelum mengandalkan realtime di sisi client.

---

## F. Catatan Implementasi Penting

- **Kegagalan notifikasi tidak meng-rollback aksi utama.** Service `createNotification`
  menelan error & hanya `console.error` — supaya like / accept / complete tidak
  ikut gagal hanya karena INSERT notifikasi error.
- **Bulk insert** dipakai saat ada banyak penerima (accept/complete/progress) lewat
  `createNotificationsBulk` — 1 query untuk N row.
- **Notifikasi nearby** (`GET /api/notifications/nearby`) tidak dipindah ke tabel
  `notifications`; tetap dihitung on-the-fly dari `donation_points`. Dengan begitu
  endpoint lama tetap kompatibel.

---

## G. File yang Disentuh

| File | Status |
|---|---|
| `database/migration_v5.sql` | **Baru** — tabel `notifications` + publication + RLS |
| `database/schema.sql` | Update |
| `src/services/notificationService.js` | **Baru** |
| `src/controllers/notificationController.js` | Update (4 handler baru + `getNearbyNotifications` lama) |
| `src/routes/notificationRoutes.js` | Update (4 route baru) |
| `src/controllers/communityController.js` | Hook notifikasi `post_liked` & `post_commented` |
| `src/controllers/participantController.js` | **Baru** — sumber notif `donator_departed`, `participant_accepted`, `participant_completed`, `progress_updated`, `urgency_changed` |

---

> Detail kontrak lengkap juga tersedia di `API_DOCUMENTATION.md` bab **15. Notifications**.
