# ✅ Chat Realtime — Status Realisasi Backend (per 2026-05-29)

> Penanda untuk tim Frontend: chat realtime sudah berjalan via **Supabase Realtime**
> (rekomendasi G di `requirement_chat.md`). Tidak perlu polling 5 detik lagi —
> FE cukup subscribe ke perubahan tabel `chat_messages` & `chat_conversations`.
> Migration relevan: `database/migration_v4.sql` (chat_messages) +
> `database/migration_v5.sql` (chat_conversations).

---

## A. Ringkasan Status

| Kebutuhan FE | Status | Catatan |
|---|---|---|
| Realtime pesan masuk di `chat_screen` | ✅ Sudah | Subscribe INSERT `public.chat_messages`. |
| Realtime daftar percakapan di `conversations_list_screen` | ✅ Sudah | Subscribe UPDATE `public.chat_conversations` (publication ditambahkan v5). |
| `last_message_at` auto-update | ✅ Sudah | Trigger `chat_touch_conversation()` di v4. |
| Emit `message.new` di backend | ❌ Tidak perlu | Supabase Realtime broadcast otomatis dari DB. |
| Emit `conversation.updated` di backend | ❌ Tidak perlu | Sama — broadcast otomatis. |
| WebSocket / SSE custom | ❌ Tidak dibangun | Memakai Supabase Realtime. |
| RLS untuk subscribe aman | ✅ Sudah | Policy `chat_msg_read_own` & `chat_conv_read_own`. |
| REST endpoints chat (list/send/read) | ✅ Sudah | Tidak ada perubahan kontrak. |

---

## B. Yang Ditambah di v5

Hanya 1 hal kecil tapi penting untuk daftar percakapan realtime:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
```

Tanpa ini, trigger `chat_touch_conversation()` memang sudah meng-`UPDATE`
`chat_conversations.last_message_at` di DB — tapi event UPDATE tidak akan
ter-broadcast ke client karena tabel `chat_conversations` belum di-publish.
v5 menutup gap ini sehingga `conversations_list_screen` bisa langsung realtime.

> Migration di-bungkus pengecekan `pg_publication` → aman untuk database yang
> bukan Supabase (di Postgres polos blok ini di-skip).

---

## C. Setup Supabase yang Wajib Ada (verifikasi)

### 1. Publication

Setelah jalanin v4 + v5 di Supabase:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('chat_messages', 'chat_conversations', 'notifications');
```

Harus mengembalikan 3 baris.

### 2. RLS Policy

```sql
SELECT polname, tablename
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('chat_messages', 'chat_conversations', 'notifications');
```

Harus melihat: `chat_msg_read_own`, `chat_conv_read_own`, `notif_read_own`.

### 3. Supabase Auth ↔ users.id

Client Flutter harus login ke Supabase Auth dengan UUID **identik** dengan
`users.id` (atau JWT custom dengan claim `sub` = UUID user). Tanpa ini,
`auth.uid()` di policy akan tidak match → user tidak akan menerima event.

---

## D. Cara Subscribe di Flutter (ringkas)

### D.1 Pesan masuk di `chat_screen.dart`

```dart
_supabase
  .channel('chat:${widget.conversationId}')
  .onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'chat_messages',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'conversation_id',
      value: widget.conversationId,
    ),
    callback: (payload) => _appendMessage(payload.newRecord),
  )
  .subscribe();
```

### D.2 Daftar percakapan di `conversations_list_screen.dart`

```dart
_supabase
  .channel('conv:${currentUserId}')
  .onPostgresChanges(
    event: PostgresChangeEvent.update,
    schema: 'public',
    table: 'chat_conversations',
    callback: (payload) {
      final row = payload.newRecord;
      // Hanya proses kalau current user adalah salah satu peserta.
      if (row['user_a_id'] == currentUserId || row['user_b_id'] == currentUserId) {
        _updateConversationInList(row);
      }
    },
  )
  .subscribe();
```

> **Catatan filter:** karena `chat_conversations` punya 2 kolom user (`user_a_id`,
> `user_b_id`), filter Postgres-side `eq` tidak bisa langsung memilih
> "milik saya". Solusi simpel: subscribe tanpa filter, lalu filter di
> callback (RLS sudah mencegah row pihak lain sampai ke client).

### D.3 Mark as read (badge unread realtime)

Tetap pakai REST `PATCH /api/chats/:id/read` (sudah ada). Setelah update
`read_at` di `chat_messages`, trigger `chat_touch_conversation()` jalan saat
ada pesan baru — tapi mark-as-read sendiri tidak meng-`UPDATE` row conversation.
Agar badge unread tetap turun realtime, FE bisa:

1. Hitung `unread_count` di sisi client dengan data yang sudah ada (paling
   mudah), atau
2. Subscribe ke `UPDATE chat_messages` (event ini juga dibroadcast karena
   `chat_messages` ada di publication) dan kurangi badge ketika `read_at`
   sebuah row berubah ke nilai non-NULL.

> Opsi (2) tidak butuh perubahan backend; ini sudah otomatis dapat dari
> publication yang ada.

---

## E. Tidak Ada Perubahan Kontrak REST

Endpoint REST tetap persis seperti `API_DOCUMENTATION.md` bab Chat:

| Method | Endpoint |
|---|---|
| `GET` | `/api/chats` |
| `POST` | `/api/chats` |
| `GET` | `/api/chats/:id/messages` |
| `POST` | `/api/chats/:id/messages` |
| `PATCH` | `/api/chats/:id/read` |

Write tetap lewat Node.js (service role bypass RLS). Pembacaan
realtime lewat Supabase langsung di FE.

---

## F. Jika Database BUKAN Supabase

Migration v4 & v5 menggunakan guard `IF EXISTS (SELECT 1 FROM pg_publication
WHERE pubname = 'supabase_realtime')` — di Postgres polos blok ini di-skip
tanpa error. Untuk skenario itu, FE harus jatuh ke fallback polling, atau
backend harus dilengkapi SSE/WebSocket (bab C–F di `requirement_chat.md`).
Karena project ini sudah komitmen pakai Supabase di staging/production
(lihat `project_titik_baik.md` di memory), tidak ada rencana implementasi
fallback tersebut.

---

## G. File yang Disentuh

| File | Status |
|---|---|
| `database/migration_v5.sql` | Tambah `chat_conversations` ke publication |
| `database/schema.sql` | Tidak berubah untuk chat (sudah komplit di v4). |

> Tidak ada perubahan controller atau route untuk chat. Semua delivery
> realtime didelegasikan ke Supabase Realtime — backend Node hanya tetap
> menyediakan REST tulis (`sendMessage`, `markAsRead`).
