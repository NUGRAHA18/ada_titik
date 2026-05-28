# 💬 Requirement Realtime Chat (WhatsApp-like)

---

## A. Kondisi Saat Ini & Permasalahan

### Masalah yang Ditemukan

| Layar | Kondisi Saat Ini | Dampak |
|-------|-----------------|--------|
| `chat_screen.dart` | Polling setiap 5 detik | Delay/latensi beberapa detik saat menerima pesan baru |
| `conversations_list_screen.dart` | Tidak realtime sama sekali | Perlu refresh manual untuk melihat pesan masuk |

### Penyebab Root

Backend saat ini **hanya REST** — tidak ada mekanisme push/stream ke client:

```
Tidak ada: SSE / WebSocket / Socket.io / stream endpoint
Yang ada:  Hanya polling REST → Flutter polling 5 detik sekali
```

---

## B. Endpoint Backend yang Tersedia Saat Ini

File: `be/ada_titik-backend/src/controllers/chatController.js`

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/chats` | `listConversations` |
| `POST` | `/api/chats` | `startConversation` |
| `GET` | `/api/chats/:id/messages` | `listMessages` |
| `POST` | `/api/chats/:id/messages` | `sendMessage` |
| `PATCH` | `/api/chats/:id/read` | `markAsRead` |

Mount di `be/ada_titik-backend/src/server.js`:
```js
app.use('/api/chats', chatRoutes);
```

> ❌ Tidak ditemukan implementasi **stream, SSE, WebSocket, atau Socket.io** di routes/controller yang ada.

---

## C. Solusi: Penambahan Backend Realtime

### 1. Endpoint Realtime untuk Pesan Baru

Tambahkan route baru (tidak menggantikan REST yang sudah ada):

#### Opsi A — Server-Sent Events (SSE)

```
GET /api/chats/:conversationId/stream
```

Event yang dialirkan:

```json
{ "type": "message.new", "payload": { ...data pesan baru } }
```

#### Opsi B — WebSocket

```
Channel/namespace: chat
Subscribe: conversationId
Event: message.new
```

**Titik implementasi:** Buat layer baru `chatStreamRoutes.js` atau tambahkan ke `chatRoutes.js` yang sudah ada.

---

### 2. Endpoint Realtime untuk Daftar Percakapan

Agar `conversations_list_screen.dart` menjadi realtime, backend harus mengirim event saat conversation berubah:

#### Event: `conversation.updated`

Payload minimal yang harus dikirim:

```json
{
  "conversationId": "uuid",
  "lastMessageBody": "Halo, apa kabar?",
  "lastActivityAt": "2025-01-01T10:00:00Z",
  "unreadCount": 3
}
```

#### Endpoint:

```
GET /api/chats/stream            → SSE per user yang sedang login
```

atau via WebSocket: user subscribe ke channel `"my_conversations"`.

---

### 3. Modifikasi `sendMessage` di Controller

**File:** `be/ada_titik-backend/src/controllers/chatController.js`

Setelah `INSERT INTO chat_messages ... RETURNING ...`, tambahkan emit:

```
sendMessage()
  ├── INSERT chat_messages (sudah ada)
  ├── [TAMBAH] emit → message.new       → ke penerima pesan
  └── [TAMBAH] emit → conversation.updated → ke kedua pihak (sender & receiver)
```

Tujuan: badge unread dan preview pesan terakhir berubah **tanpa refresh**.

---

### 4. Modifikasi `markAsRead` di Controller

**File:** `be/ada_titik-backend/src/controllers/chatController.js`

Setelah `UPDATE read_at`, tambahkan emit:

```
markAsRead()
  ├── UPDATE read_at (sudah ada)
  └── [TAMBAH] emit → conversation.updated → ke kedua pihak
```

Tujuan: unread badge turun menjadi `0` dan status baca tersinkron secara realtime.

---

### 5. (Fallback) Polling Incremental

Jika implementasi push/stream belum siap, tambahkan endpoint polling yang lebih efisien agar tidak memuat ulang semua data:

```
GET /api/chats/:id/messages/after?after_id=<lastId>&limit=...
```

atau:

```
GET /api/chats/:id/messages?since=<iso_timestamp>&limit=...
```

> ⚠️ **Catatan:** Ini tetap bukan realtime sehalus push — hanya mengurangi payload polling, bukan menghilangkan latensi.

---

## D. Ringkasan File yang Harus Disentuh

### `be/ada_titik-backend/src/controllers/chatController.js`

| Fungsi | Perubahan |
|--------|-----------|
| `sendMessage` | Tambah emit `message.new` + `conversation.updated` setelah INSERT |
| `markAsRead` | Tambah emit `conversation.updated` setelah UPDATE `read_at` |

---

### `be/ada_titik-backend/src/routes/chatRoutes.js`

Tambahkan route SSE/WebSocket baru:

| Route Baru | Fungsi |
|-----------|--------|
| `GET /api/chats/:conversationId/stream` | Stream pesan baru per percakapan |
| `GET /api/chats/stream` | Stream update daftar percakapan per user |

---

### `be/ada_titik-backend/src/server.js`

- Tambah **middleware/instans SSE atau WebSocket server** (tergantung framework yang dipakai).
- Contoh: inisiasi `socket.io` atau SSE handler global.

---

## E. Arsitektur Alur Realtime (Ringkas)

```
[Donatur A kirim pesan]
        │
        ▼
POST /api/chats/:id/messages
        │
        ├── INSERT chat_messages ──────────────────────────────┐
        │                                                       │
        ├── emit message.new ──────────► [Komunitas B]         │
        │       (chat_screen realtime)                          │
        │                                                       │
        └── emit conversation.updated ──► [Donatur A + B]      │
                (conversations_list realtime)                   │
                                                                │
[Komunitas B buka chat → markAsRead]                           │
        │                                                       │
        ▼                                                       │
PATCH /api/chats/:id/read                                      │
        │                                                       │
        └── emit conversation.updated ──► [Donatur A + B]      │
                (badge unread → 0 realtime)    ◄───────────────┘
```

---

## F. Ringkasan Gap Backend

| Kebutuhan | Status Saat Ini |
|-----------|----------------|
| `GET /api/chats/:id/stream` (SSE pesan) | ❌ Belum ada |
| `GET /api/chats/stream` (SSE conversation list) | ❌ Belum ada |
| Emit `message.new` di `sendMessage` | ❌ Belum ada |
| Emit `conversation.updated` di `sendMessage` | ❌ Belum ada |
| Emit `conversation.updated` di `markAsRead` | ❌ Belum ada |
| WebSocket/Socket.io server setup | ❌ Belum ada |
| Polling incremental `after_id` / `since` | ❌ Belum ada |
| REST endpoints chat (list, send, read) | ✅ Sudah ada |

---

> **Kesimpulan:** Untuk mencapai pengalaman chat realtime setara WhatsApp, backend perlu ditambahkan lapisan push (SSE atau WebSocket), emit event di dua fungsi controller (`sendMessage` dan `markAsRead`), serta route stream baru — tanpa mengganggu REST endpoint yang sudah berjalan.

---

## G. Solusi Rekomendasi: Supabase Realtime

Menggunakan **Supabase Realtime** adalah pendekatan paling efisien untuk mencapai chat realtime tanpa membangun infrastruktur WebSocket/SSE dari nol. Supabase Realtime bekerja dengan mendengarkan perubahan langsung pada tabel PostgreSQL melalui protokol WebSocket.

---

### G1. Cara Kerja Supabase Realtime

```
[Flutter Client]
      │
      │  subscribe via WebSocket
      ▼
[Supabase Realtime Server]
      │
      │  listen perubahan (INSERT/UPDATE/DELETE)
      ▼
[PostgreSQL: tabel chat_messages & conversations]
      ▲
      │  INSERT/UPDATE via REST API (backend Node.js tetap dipakai)
      │
[Node.js Backend /api/chats]
```

Flutter tidak perlu polling — Supabase Realtime **push langsung** ke client saat ada perubahan tabel.

---

### G2. Perubahan di Backend (Node.js)

Backend Node.js **tidak perlu ditambah SSE/WebSocket**. Cukup pastikan operasi tulis tetap melalui REST yang sudah ada:

| Fungsi | Yang Dilakukan | Catatan |
|--------|---------------|---------|
| `sendMessage` | INSERT ke `chat_messages` (sudah ada) | Supabase otomatis broadcast ke subscriber |
| `markAsRead` | UPDATE `read_at` (sudah ada) | Supabase otomatis broadcast ke subscriber |

> ✅ **Tidak perlu modifikasi controller** — Supabase Realtime mendengarkan perubahan database secara langsung.

**Satu-satunya syarat backend:** Pastikan database yang digunakan adalah **Supabase PostgreSQL** (atau koneksi PostgreSQL yang terhubung ke project Supabase).

---

### G3. Konfigurasi Supabase: Aktifkan Replication

Aktifkan **Realtime** untuk tabel yang diperlukan melalui Supabase Dashboard:

```
Supabase Dashboard
  └── Database
        └── Replication
              ├── ✅ chat_messages     → aktifkan
              └── ✅── conversations   → aktifkan
```

Atau via SQL:

```sql
-- Aktifkan realtime untuk tabel chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Aktifkan realtime untuk tabel conversations
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
```

---

### G4. Implementasi Flutter — `chat_screen.dart`

Ganti polling 5 detik dengan subscription Supabase Realtime:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class ChatScreen extends StatefulWidget { ... }

class _ChatScreenState extends State<ChatScreen> {
  final _supabase = Supabase.instance.client;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _loadInitialMessages(); // load awal via REST tetap dipakai
    _subscribeToMessages(); // subscribe realtime
  }

  void _subscribeToMessages() {
    _channel = _supabase
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
        callback: (payload) {
          final newMessage = payload.newRecord;
          setState(() {
            _messages.insert(0, newMessage); // tambah ke list tanpa reload
          });
        },
      )
      .subscribe();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}
```

**Efek:** Pesan baru muncul **instan** tanpa delay — tidak ada polling lagi.

---

### G5. Implementasi Flutter — `conversations_list_screen.dart`

Subscribe ke perubahan tabel `conversations` untuk update preview & badge unread:

```dart
class _ConversationsListScreenState extends State<ConversationsListScreen> {
  final _supabase = Supabase.instance.client;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _loadConversations(); // load awal
    _subscribeToConversations(); // subscribe realtime
  }

  void _subscribeToConversations() {
    _channel = _supabase
      .channel('conversations:${currentUserId}')
      .onPostgresChanges(
        event: PostgresChangeEvent.update,    // update: last_message, unread_count
        schema: 'public',
        table: 'conversations',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'participant_id',           // sesuaikan nama kolom
          value: currentUserId,
        ),
        callback: (payload) {
          final updated = payload.newRecord;
          setState(() {
            // update item conversation di list sesuai conversationId
            final idx = _conversations.indexWhere(
              (c) => c['id'] == updated['id']
            );
            if (idx != -1) _conversations[idx] = updated;
          });
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.insert,    // percakapan baru
        schema: 'public',
        table: 'conversations',
        callback: (payload) {
          setState(() {
            _conversations.insert(0, payload.newRecord);
          });
        },
      )
      .subscribe();
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}
```

**Efek:** Daftar percakapan update **otomatis** saat ada pesan masuk baru — tanpa refresh.

---

### G6. Setup Supabase di Flutter

Tambahkan dependency di `pubspec.yaml`:

```yaml
dependencies:
  supabase_flutter: ^2.x.x
```

Inisialisasi di `main.dart`:

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'https://<your-project>.supabase.co',
    anonKey: '<your-anon-key>',
  );

  runApp(MyApp());
}
```

---

### G7. Row Level Security (RLS) — Wajib Dikonfigurasi

Pastikan RLS diaktifkan agar user hanya bisa subscribe ke data miliknya sendiri:

```sql
-- Hanya boleh membaca pesan dari conversation yang diikuti
CREATE POLICY "read own messages"
ON chat_messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE participant_a = auth.uid()
    OR participant_b = auth.uid()
  )
);

-- Hanya boleh membaca conversation sendiri
CREATE POLICY "read own conversations"
ON conversations FOR SELECT
USING (
  participant_a = auth.uid() OR participant_b = auth.uid()
);
```

> ⚠️ **Tanpa RLS**, semua user bisa menerima event realtime dari seluruh percakapan — ini adalah **celah keamanan serius**.

---

### G8. Arsitektur Alur dengan Supabase Realtime

```
[Donatur A kirim pesan]
        │
        ▼
POST /api/chats/:id/messages  (Node.js REST — tetap dipakai)
        │
        ▼
INSERT INTO chat_messages  (PostgreSQL / Supabase DB)
        │
        ▼
[Supabase Realtime Server]  ← mendeteksi perubahan tabel otomatis
        │
        ├──── push event INSERT ──────► [Flutter Komunitas B]
        │                                chat_screen: pesan muncul instan
        │
        └──── push event UPDATE ──────► [Flutter Donatur A + B]
                                         conversations_list: preview & badge update
```

---

### G9. Perbandingan Pendekatan

| Aspek | SSE/WebSocket Custom | Supabase Realtime |
|-------|---------------------|-------------------|
| Kompleksitas backend | Tinggi (perlu bangun dari nol) | Rendah (tidak perlu ubah backend) |
| Kompleksitas Flutter | Sedang | Rendah (SDK siap pakai) |
| Latensi | ~100–300ms | ~50–150ms |
| Skalabilitas | Perlu kelola sendiri | Dikelola Supabase |
| Keamanan | Perlu implementasi manual | RLS PostgreSQL bawaan |
| Biaya | Infrastruktur sendiri | Free tier cukup untuk skala awal |
| **Rekomendasi** | Jika tidak pakai Supabase DB | ✅ **Direkomendasikan** |

---

## H. Ringkasan Gap — Update dengan Supabase Realtime

| Kebutuhan | Tanpa Supabase | Dengan Supabase Realtime |
|-----------|---------------|--------------------------|
| Realtime pesan baru di `chat_screen` | ❌ Perlu SSE/WS custom | ✅ Subscribe `chat_messages` INSERT |
| Realtime update `conversations_list` | ❌ Perlu SSE/WS custom | ✅ Subscribe `conversations` UPDATE |
| Modifikasi backend controller | ❌ Wajib ditambah emit | ✅ Tidak perlu (DB trigger otomatis) |
| Setup WebSocket server | ❌ Perlu dari nol | ✅ Tidak perlu |
| Keamanan akses data | ❌ Perlu middleware custom | ✅ RLS PostgreSQL |
| REST endpoints chat | ✅ Sudah ada | ✅ Tetap digunakan untuk write |

---

> **Kesimpulan Akhir:** Dengan Supabase Realtime, tidak diperlukan perubahan signifikan pada backend Node.js. Cukup aktifkan replication pada tabel `chat_messages` dan `conversations`, konfigurasikan RLS, lalu tambahkan subscription di sisi Flutter. Hasilnya adalah pengalaman chat realtime setara WhatsApp dengan effort implementasi yang jauh lebih kecil dibanding membangun SSE/WebSocket dari nol.
