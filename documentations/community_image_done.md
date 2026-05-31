# ✅ Upload Gambar Community Feed — Status Realisasi Backend (per 2026-05-31)

> Penanda untuk tim Frontend: upload gambar postingan komunitas sudah tersedia.
> Migration relevan: tidak ada (kolom `community_posts.image_url` sudah ada sejak v3).
> Versi dokumen API: **v3.3**.

---

## A. Ringkasan

| Kebutuhan FE | Status | Catatan |
|---|---|---|
| Endpoint upload gambar → return `image_url` | ✅ Sudah | `POST /api/community/posts/image` (multipart). |
| Field `image_url` ada di response `GET /api/community/posts` | ✅ Sudah | Sudah sejak v3 (tidak ada perubahan kontrak). |
| Field `image_url` ikut di response `POST /api/community/posts` | ✅ Sudah | Sudah sejak v3 (kolom di-RETURNING). |
| `community_posts` realtime (FE bisa subscribe INSERT) | ✅ Sudah | Migration v6 — `community_posts` ditambahkan ke `supabase_realtime` publication + RLS SELECT publik. |

---

## B. Alur yang Disarankan FE (2 langkah)

Pisahkan upload & publish supaya FE bisa preview gambar dulu sebelum konfirmasi
"Posting". Pattern ini juga konsisten dengan upload avatar (`POST /api/users/avatar`)
dan dokumentasi (`POST /api/documentation`).

### Langkah 1 — Upload file → dapat `image_url`

```http
POST /api/community/posts/image
Authorization: Bearer <token-komunitas>
Content-Type: multipart/form-data

image=@/path/to/foto.jpg
```

**Konfigurasi:**

| Field | Tipe | Wajib | Keterangan |
|---|---|:---:|---|
| `image` | file | Ya | `image/*`, maks 5 MB (multer config). |

**Auth/role:** Bearer Token, role **komunitas** (atau admin).

**Response 201 Created:**

```json
{
  "message": "Gambar berhasil diunggah",
  "image_url": "https://<project>.supabase.co/storage/v1/object/public/community-posts/<user_id>/<timestamp>-<rand>.jpg"
}
```

**Response Error:**

| Kode | Kondisi |
|---|---|
| `400` | File tidak ada / bukan image. |
| `403` | Role bukan komunitas/admin. |
| `500` | Bucket `community-posts` belum dibuat di Supabase, atau gagal upload. |

### Langkah 2 — Buat post (JSON murni, sama seperti sebelumnya)

```http
POST /api/community/posts
Authorization: Bearer <token-komunitas>
Content-Type: application/json

{
  "content": "Distribusi paket pangan tahap 3...",
  "post_type": "updateKomunitas",
  "image_url": "https://<project>.supabase.co/storage/v1/object/public/community-posts/.../foto.jpg"
}
```

**Response 201 Created:**

```json
{
  "message": "Postingan berhasil dibuat",
  "data": {
    "id": 17,
    "content": "...",
    "post_type": "updateKomunitas",
    "image_url": "https://<project>.supabase.co/storage/v1/object/public/community-posts/.../foto.jpg",
    "likes_count": 0,
    "created_at": "2026-05-31T08:00:00.000Z"
  }
}
```

`image_url` boleh dikirim `null` atau di-omit (post tanpa gambar).

---

## C. Setup Supabase Storage yang Wajib

Bucket baru di Supabase dengan visibilitas publik:

```
Storage → New bucket
  name: community-posts
  public: ✅ (supaya URL publik bisa diakses langsung)
```

Atau via SQL (kalau pakai dashboard SQL):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-posts', 'community-posts', true)
ON CONFLICT (id) DO NOTHING;
```

Tanpa bucket ini, response upload akan `500` dengan message
`Gagal mengunggah gambar postingan` dan log server akan menampilkan error
asli dari Supabase Storage.

---

## D. Realtime Feed Community

Migration v6 menambahkan `community_posts` ke publication `supabase_realtime`
+ policy SELECT publik (`USING (true)`). FE bisa subscribe ke event INSERT
agar timeline auto-update:

```dart
_supabase
  .channel('community_posts')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'community_posts',
    callback: (payload) {
      // payload.newRecord berisi row community_posts
      // Lakukan re-fetch detail untuk dapat author_name/avatar/comments_count
      // (kolom join tidak ikut di payload).
    },
  )
  .subscribe();
```

> Payload realtime hanya berisi kolom **mentah** `community_posts`. Untuk dapat
> `author_name`, `author_avatar`, `comments_count` (yang dihitung via JOIN/COUNT),
> FE perlu fetch ulang via `GET /api/community/posts` saat event masuk —
> atau merge data ke item yang sudah ada.

---

## E. File yang Disentuh

| File | Status |
|---|---|
| `src/controllers/communityController.js` | Tambah `uploadPostImage` |
| `src/routes/communityRoutes.js` | Tambah route `POST /posts/image` (multer.single('image')) |
| `database/migration_v6.sql` | Tambah `community_posts` ke publication + RLS publik |
| `database/schema.sql` | (tidak berubah untuk community_posts — kolom `image_url` sudah ada) |

---

> Detail kontrak lengkap juga tersedia di `API_DOCUMENTATION.md` bab **17. Community**.
