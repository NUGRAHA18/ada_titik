-- ============================================================
-- Migration v6: Password Reset + Realtime publication tambahan
--                 (community_posts, donation_points)
--
-- Jalankan pada database existing:
--   psql -U postgres -d titik_baik -f database/migration_v6.sql
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PASSWORD RESET TOKENS
--    token_hash = sha256(token plaintext). Token plaintext
--    HANYA dikirim ke email user (di dev mode bisa di-return via
--    response — lihat ENV RESET_TOKEN_IN_RESPONSE).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL,                    -- sha256 hex (64 char)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_tokens_hash
    ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_active
    ON password_reset_tokens(user_id) WHERE used_at IS NULL;

-- ------------------------------------------------------------
-- 2. SUPABASE REALTIME
--    Tambahkan community_posts & donation_points ke publication
--    supaya client (Flutter) bisa subscribe ke INSERT/UPDATE.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'community_posts'
        ) THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE community_posts';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = 'donation_points'
        ) THEN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE donation_points';
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    community_posts & donation_points adalah resource publik di
--    kontrak REST API. Untuk subscribe via Supabase Realtime
--    tetap perlu policy SELECT yang permissive — backend Node
--    pakai service role (bypass RLS) untuk INSERT/UPDATE.
-- ------------------------------------------------------------
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_posts_public_read ON community_posts;
CREATE POLICY community_posts_public_read ON community_posts
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS donation_points_public_read ON donation_points;
CREATE POLICY donation_points_public_read ON donation_points
    FOR SELECT
    USING (deleted_at IS NULL);
