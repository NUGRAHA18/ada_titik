-- ============================================================
-- Migration v5: Flow Donasi (Berangkat/Accept/Complete),
--                Notifikasi event-driven, Poin Donatur,
--                + Realtime untuk chat_conversations & notifications
--
-- Jalankan pada database existing:
--   psql -U postgres -d titik_baik -f database/migration_v5.sql
--
-- Idempotent: semua CREATE pakai IF NOT EXISTS / ON CONFLICT,
-- semua ALTER PUBLICATION dibungkus pengecekan.
-- ============================================================

-- ------------------------------------------------------------
-- 1. POIN DONATUR
--    Kolom akumulasi poin di tabel users + tabel audit log.
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS donator_points_log (
    id           SERIAL PRIMARY KEY,
    donator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    point_id     INT  REFERENCES donation_points(id) ON DELETE SET NULL,
    delta        INT  NOT NULL,
    reason       VARCHAR(60) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donator_points_log_user
    ON donator_points_log(donator_id, created_at DESC);

-- ------------------------------------------------------------
-- 2. DONATION PARTICIPANTS
--    Satu donatur dapat berpartisipasi per titik (UNIQUE).
--    State: requested → accepted → completed (linear, tidak balik).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donation_participants (
    id                  SERIAL PRIMARY KEY,
    point_id            INT  NOT NULL REFERENCES donation_points(id) ON DELETE CASCADE,
    donator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state               VARCHAR(20) NOT NULL DEFAULT 'requested'
                            CHECK (state IN ('requested','accepted','completed','cancelled')),
    contribution_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    accepted_at         TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    completed_user_lat  DOUBLE PRECISION,
    completed_user_lng  DOUBLE PRECISION,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT donation_participants_pair_unique UNIQUE (point_id, donator_id)
);

CREATE INDEX IF NOT EXISTS idx_donation_participants_point_state
    ON donation_participants(point_id, state);
CREATE INDEX IF NOT EXISTS idx_donation_participants_donator
    ON donation_participants(donator_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. NOTIFICATIONS (event-driven)
--    payload jsonb fleksibel untuk variasi tipe notifikasi.
--    Tipe disepakati di kode (lihat src/services/notificationService.js).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    type       VARCHAR(40) NOT NULL,
    title      VARCHAR(200) NOT NULL,
    body       TEXT,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id) WHERE read_at IS NULL;

-- ------------------------------------------------------------
-- 4. DEFAULT URGENCY = 'Mendesak'
--    Sesuai requirement: titik baru default High Urgency.
--    Tidak mengubah CHECK constraint; hanya ganti default.
-- ------------------------------------------------------------
ALTER TABLE donation_points
    ALTER COLUMN urgency SET DEFAULT 'Mendesak';

-- ------------------------------------------------------------
-- 5. SUPABASE REALTIME
--    Aktifkan publication untuk:
--      - chat_conversations (supaya conversations_list realtime)
--      - notifications      (supaya badge/popup notif realtime)
--    chat_messages sudah ditambahkan di migration_v4.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'chat_conversations'
        ) THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'notifications'
        ) THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications';
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (untuk client Flutter via Supabase Realtime)
--    Backend Node tetap pakai service role (bypass RLS) untuk write.
-- ------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_read_own ON notifications;
CREATE POLICY notif_read_own ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);
