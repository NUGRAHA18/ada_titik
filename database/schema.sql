-- ============================================================
-- Schema: Titik Baik – Social Donation Mapping
-- Prasyarat: PostgreSQL 13+ dengan ekstensi PostGIS
-- Jalankan: psql -U postgres -d titik_baik -f database/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- USERS
-- users.id bertipe UUID (gen_random_uuid() built-in di PG 13+)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('donatur', 'komunitas', 'admin')),
    bio           TEXT,
    avatar_url    VARCHAR(500),
    points        INT           NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DONATION POINTS
-- created_by bertipe UUID karena referensi ke users.id
-- ============================================================
CREATE TABLE IF NOT EXISTS donation_points (
    id               SERIAL  PRIMARY KEY,
    created_by       UUID    REFERENCES users(id) ON DELETE SET NULL,
    title            VARCHAR(200)  NOT NULL,
    description      TEXT,
    location         GEOMETRY(Point, 4326) NOT NULL,
    urgency          VARCHAR(20)   NOT NULL DEFAULT 'Mendesak'
                         CHECK (urgency IN ('Mendesak', 'Normal', 'Rendah')),
    status           VARCHAR(20)   NOT NULL DEFAULT 'Open'
                         CHECK (status IN ('Open', 'On Progress', 'Completed')),
    category         VARCHAR(50)   NOT NULL DEFAULT 'Umum'
                         CHECK (category IN ('Pangan','Medis','Pendidikan','Infrastruktur','Pakaian','Lainnya','Umum')),
    goal_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
    collected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    deleted_at       TIMESTAMP WITH TIME ZONE NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index (wajib untuk ST_DWithin / ST_Distance)
CREATE INDEX idx_donation_points_location ON donation_points USING GIST(location);
CREATE INDEX idx_donation_points_status   ON donation_points(status);
CREATE INDEX idx_donation_points_category ON donation_points(category);
CREATE INDEX idx_donation_points_active   ON donation_points(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- DOCUMENTATION (bukti foto distribusi)
-- ============================================================
CREATE TABLE IF NOT EXISTS documentation (
    id          SERIAL  PRIMARY KEY,
    point_id    INTEGER NOT NULL REFERENCES donation_points(id) ON DELETE CASCADE,
    uploaded_by UUID    REFERENCES users(id) ON DELETE SET NULL,
    photo_url   VARCHAR(500) NOT NULL,
    caption     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documentation_point_id ON documentation(point_id);

-- ============================================================
-- RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    id       SERIAL  PRIMARY KEY,
    point_id INTEGER NOT NULL REFERENCES donation_points(id) ON DELETE CASCADE,
    given_by UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score    INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    review   TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, given_by)
);

CREATE INDEX idx_ratings_point_id ON ratings(point_id);

-- ============================================================
-- REPORTS (anti-fraud)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id          SERIAL  PRIMARY KEY,
    reporter_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    point_id    INTEGER NOT NULL REFERENCES donation_points(id) ON DELETE CASCADE,
    reason      TEXT    NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_status   ON reports(status);
CREATE INDEX idx_reports_point_id ON reports(point_id);

-- ============================================================
-- COMMUNITY POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS community_posts (
    id          SERIAL PRIMARY KEY,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    post_type   VARCHAR(30) NOT NULL DEFAULT 'updateKomunitas'
                CHECK (post_type IN ('bantuanDibutuhkan','pertanyaan','updateKomunitas','inspirasi','kisahSukses')),
    image_url   VARCHAR(500),
    likes_count INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_type    ON community_posts(post_type);

-- ============================================================
-- COMMUNITY COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS community_comments (
    id          SERIAL PRIMARY KEY,
    post_id     INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_community_comments_post ON community_comments(post_id);

-- ============================================================
-- POST LIKES (toggle, PK kompleks)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_likes (
    post_id    INT  NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- ============================================================
-- CHAT: 1-on-1 conversations + messages
-- user_a_id < user_b_id agar pasangan unik (A,B) == (B,A)
-- ============================================================
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

CREATE INDEX idx_chat_conv_user_a
    ON chat_conversations(user_a_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_chat_conv_user_b
    ON chat_conversations(user_b_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS chat_messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INT  NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    read_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conv_created
    ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread
    ON chat_messages(conversation_id, sender_id) WHERE read_at IS NULL;

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

-- ============================================================
-- DONATION PARTICIPANTS
-- Relasi donatur-titik untuk flow Berangkat/Accept/Complete.
-- ============================================================
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

CREATE INDEX idx_donation_participants_point_state
    ON donation_participants(point_id, state);
CREATE INDEX idx_donation_participants_donator
    ON donation_participants(donator_id, created_at DESC);

-- ============================================================
-- DONATOR POINTS LOG (audit poin donatur)
-- ============================================================
CREATE TABLE IF NOT EXISTS donator_points_log (
    id         SERIAL PRIMARY KEY,
    donator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    point_id   INT  REFERENCES donation_points(id) ON DELETE SET NULL,
    delta      INT  NOT NULL,
    reason     VARCHAR(60) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_donator_points_log_user
    ON donator_points_log(donator_id, created_at DESC);

-- ============================================================
-- NOTIFICATIONS (event-driven)
-- Tipe disepakati di src/services/notificationService.js.
-- ============================================================
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

CREATE INDEX idx_notifications_user_created
    ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================================
-- PASSWORD RESET TOKENS (v6)
-- token_hash = sha256(plaintext token). Plaintext dikirim via email.
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_password_reset_tokens_hash
    ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_user_active
    ON password_reset_tokens(user_id) WHERE used_at IS NULL;
