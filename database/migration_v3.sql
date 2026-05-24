-- ============================================================
-- Migration v3: Avatar, category, goal/collected amount,
--               dan modul Community (posts/comments/likes)
-- Jalankan pada database existing:
--   psql -U postgres -d titik_baik -f database/migration_v3.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS: avatar_url
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- ------------------------------------------------------------
-- 2. DONATION_POINTS: category, goal_amount, collected_amount
--    Kategori Indonesian only (konsisten dgn urgency)
-- ------------------------------------------------------------
ALTER TABLE donation_points
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'Umum';

ALTER TABLE donation_points
    DROP CONSTRAINT IF EXISTS donation_points_category_check;

ALTER TABLE donation_points
    ADD CONSTRAINT donation_points_category_check
    CHECK (category IN ('Pangan','Medis','Pendidikan','Infrastruktur','Pakaian','Lainnya','Umum'));

ALTER TABLE donation_points
    ADD COLUMN IF NOT EXISTS goal_amount      NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE donation_points
    ADD COLUMN IF NOT EXISTS collected_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_donation_points_category
    ON donation_points(category);

-- ------------------------------------------------------------
-- 3. COMMUNITY POSTS
-- ------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_community_posts_created
    ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_type
    ON community_posts(post_type);

-- ------------------------------------------------------------
-- 4. COMMUNITY COMMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_comments (
    id          SERIAL PRIMARY KEY,
    post_id     INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
    ON community_comments(post_id);

-- ------------------------------------------------------------
-- 5. POST LIKES (toggle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
    post_id    INT  NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);
