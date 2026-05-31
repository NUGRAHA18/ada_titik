# ✅ Forgot / Reset Password — Status Realisasi Backend (per 2026-05-31)

> Penanda untuk tim Frontend: end-to-end reset password sudah tersedia.
> Migration: `database/migration_v6.sql`. Versi dokumen API: **v3.3**.

---

## A. Ringkasan

| Kebutuhan FE | Status | Catatan |
|---|---|---|
| `POST /api/auth/forgot-password` | ✅ Sudah | Selalu return 200 (anti email-enumeration). |
| `POST /api/auth/reset-password` | ✅ Sudah | Pakai token dari step 1. |
| Token disimpan di DB | ✅ Sudah | Tabel `password_reset_tokens`. |
| Response success/fail eksplisit | ✅ Sudah | Field `success: true/false` di semua response endpoint ini. |
| Email pengiriman token | ⏳ Belum | Belum ada email service di project. Token dilog di server console. Untuk dev/QA: set env `RESET_TOKEN_IN_RESPONSE=true` untuk dapatkan token di response. |

---

## B. Skema Tabel `password_reset_tokens`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | SERIAL PK | — |
| `user_id` | UUID FK → users | ON DELETE CASCADE |
| `token_hash` | CHAR(64) | sha256(plaintext) hex. **Plaintext tidak disimpan.** |
| `expires_at` | TIMESTAMPTZ | 60 menit dari pembuatan. |
| `used_at` | TIMESTAMPTZ (nullable) | Diisi saat reset berhasil atau token di-invalidate. |
| `created_at` | TIMESTAMPTZ | — |

**Index:**
- `UNIQUE (token_hash)` — anti collision.
- partial `idx_password_reset_tokens_user_active (user_id) WHERE used_at IS NULL` — cepat cari token aktif user.

---

## C. Endpoint

### C.1 Request reset (kirim instruksi)

```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "budi@example.com" }
```

**Auth:** tidak diperlukan.

**Validasi:** `email` wajib & format valid.

**Behavior (penting):**
- Selalu return 200 dengan pesan generik. **Tidak membocorkan apakah email terdaftar atau tidak.**
- Jika email ada di DB:
  - Invalidate semua token aktif user (set `used_at = NOW()`).
  - Generate token plaintext (48 byte → base64url) → simpan sha256-nya.
  - TTL: 60 menit.
  - Log token di server console.
  - Jika env `RESET_TOKEN_IN_RESPONSE=true`, **token plaintext juga ikut di response** (untuk dev/QA).
- Jika email tidak ada: sleep singkat (~80ms) supaya timing-attack lebih sulit, lalu return generic 200.

**Response 200 (produksi):**

```json
{
  "success": true,
  "message": "Jika email terdaftar, instruksi reset password telah dikirim"
}
```

**Response 200 (dev, `RESET_TOKEN_IN_RESPONSE=true`):**

```json
{
  "success": true,
  "message": "Jika email terdaftar, instruksi reset password telah dikirim",
  "dev_reset_token": "TJaImTeYx-VRJxRZ...xhEoQQk",
  "expires_at": "2026-05-31T09:00:00.000Z"
}
```

**Response Error:**

| Kode | Kondisi |
|---|---|
| `400` | `email` kosong atau format tidak valid |
| `500` | Kesalahan server (DB down dll.) |

---

### C.2 Reset password (pakai token)

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "TJaImTeYx-VRJxRZ...xhEoQQk",
  "new_password": "passwordBaru123"
}
```

**Auth:** tidak diperlukan (token sebagai authentication).

**Validasi:**
- `token` string non-empty (16–200 char).
- `new_password` string min 8 karakter.

**Behavior:**
- Lookup token via sha256 hash.
- Tolak jika tidak ditemukan / sudah digunakan / sudah expired.
- bcrypt rehash password baru → update `users.password_hash`.
- Mark token `used_at`, plus invalidate semua token aktif lain milik user yang sama (defensive).
- Transaksional (SERIALIZABLE via `FOR UPDATE` row token).

**Response 200:**

```json
{ "success": true, "message": "Password berhasil direset" }
```

**Response Error:**

| Kode | Body | Kondisi |
|---|---|---|
| `400` | `{ "success": false, "error": "Token tidak valid" }` | Token tidak ditemukan |
| `400` | `{ "success": false, "error": "Token sudah digunakan" }` | `used_at IS NOT NULL` |
| `400` | `{ "success": false, "error": "Token sudah kadaluarsa" }` | `expires_at < NOW()` |
| `400` | Validasi gagal (`Validasi gagal`) | `token` / `new_password` tidak memenuhi rules |
| `500` | Kesalahan server | DB error |

---

## D. Alur End-to-End (test manual)

```bash
# 1) Minta reset (asumsikan dev mode aktif supaya token di-return)
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{ "email": "donatur@test.com" }'
# → { "success": true, "message": "...", "dev_reset_token": "AAA...", "expires_at": "..." }

# 2) Reset pakai token tersebut
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{ "token": "AAA...", "new_password": "passwordBaru123" }'
# → { "success": true, "message": "Password berhasil direset" }

# 3) Verifikasi login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "donatur@test.com", "password": "passwordBaru123" }'
```

---

## E. Catatan Implementasi Penting

- **Token plaintext tidak pernah disimpan di DB** — hanya sha256-nya. Jadi kalau
  DB bocor, attacker tidak bisa langsung pakai token.
- **Anti email-enumeration**: response `/forgot-password` selalu generik. Backend
  juga melakukan `setTimeout(80ms)` untuk path "email tidak ada" supaya timing
  attack lebih sulit (tidak sempurna, tapi cukup untuk UI mobile).
- **One-active-token-per-user**: setiap kali user meminta reset baru, token
  lama yang masih aktif langsung di-invalidate. Setelah reset berhasil, semua
  token aktif user juga di-invalidate (defensive).
- **TTL 60 menit** (`RESET_TOKEN_TTL_MIN` di `authController.js`).
- **Belum ada email integration.** Token saat ini hanya bisa diambil dari:
  - Log server (`console.log [password-reset] user=... token=... expires=...`).
  - Response endpoint jika `RESET_TOKEN_IN_RESPONSE=true` (jangan diaktifkan di production).

---

## F. Env Tambahan

Tambahkan di Railway / `.env` jika perlu:

```env
# Untuk dev/QA: token reset ikut di response /forgot-password.
# JANGAN aktifkan di production (akan membocorkan token via response API).
RESET_TOKEN_IN_RESPONSE=true
```

---

## G. File yang Disentuh

| File | Status |
|---|---|
| `database/migration_v6.sql` | **Baru** — tabel `password_reset_tokens` |
| `database/schema.sql` | Tambah `password_reset_tokens` |
| `src/controllers/authController.js` | Tambah `requestPasswordReset` + `resetPassword` |
| `src/routes/authRoutes.js` | Tambah 2 route + import validators |
| `src/middleware/validators.js` | Tambah `forgotPasswordRules` + `resetPasswordRules` |

---

> Detail kontrak juga tersedia di `API_DOCUMENTATION.md` bab **8.4 & 8.5**.
