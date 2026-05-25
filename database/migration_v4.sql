-- ============================================================
-- Migration v4: Modul Chat 1-on-1 (donatur <-> komunitas)
-- Jalankan pada database existing:
--   psql -U postgres -d titik_baik -f database/migration_v4.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. CHAT CONVERSATIONS
--    Satu percakapan per pasangan user (1-on-1).
--    user_a_id < user_b_id (lexicographic UUID order) →
--    mencegah duplikat (A,B) vs (B,A).
--    context_type / context_id menyimpan "asal" chat
--    (post community atau donation point), opsional.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_conversations (
    id              SERIAL PRIMARY KEY,
    user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type    VARCHAR(20) CHECK (context_type IN ('post', 'donation_point')),
    context_id      INT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chat_conversations_user_order_chk CHECK (user_a_id < user_b_id),
    CONSTRAINT chat_conversations_pair_unique    UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_user_a
    ON chat_conversations(user_a_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user_b
    ON chat_conversations(user_b_id, last_message_at DESC NULLS LAST);

-- ------------------------------------------------------------
-- 2. CHAT MESSAGES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INT  NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    read_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
    ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
    ON chat_messages(conversation_id, sender_id) WHERE read_at IS NULL;

-- ------------------------------------------------------------
-- 3. TRIGGER: update last_message_at pada conversation
--    saat pesan baru masuk.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION chat_touch_conversation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
        SET last_message_at = NEW.created_at
        WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_messages_touch_conv ON chat_messages;
CREATE TRIGGER trg_chat_messages_touch_conv
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION chat_touch_conversation();

-- ------------------------------------------------------------
-- 4. SUPABASE REALTIME
--    Daftarkan tabel chat_messages ke publication realtime
--    supaya Flutter bisa subscribe via Supabase client.
--    Catatan: blok ini aman di-skip kalau database bukan Supabase
--    (publication "supabase_realtime" tidak ada di Postgres polos).
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'chat_messages'
        ) THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages';
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (untuk Realtime subscribe dari Flutter)
--    Backend Node tetap pakai service role (bypass RLS),
--    tapi client Flutter yang subscribe Realtime harus terikat
--    policy ini supaya user tidak bisa nguping percakapan orang.
--
--    Asumsi: Flutter login ke Supabase Auth dengan UUID user
--    yang sama dengan users.id (auth.uid() = users.id).
--    Kalau pakai custom JWT, sesuaikan claim "sub" → UUID user.
-- ------------------------------------------------------------
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conv_read_own  ON chat_conversations;
CREATE POLICY chat_conv_read_own ON chat_conversations
    FOR SELECT
    USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS chat_msg_read_own ON chat_messages;
CREATE POLICY chat_msg_read_own ON chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
        )
    );

-- Write tetap dilakukan via backend Node (service role) bukan dari client.
