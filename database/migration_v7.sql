-- migration_v7.sql
--
-- BUG FIX: laporan postingan komunitas sebelumnya dikirim ke /api/reports
-- dengan post_id ditaruh di kolom point_id (FK ke donation_points) → FK
-- violation / salah lapor ke titik yang tidak berkaitan.
--
-- Solusi: reports kini bisa menargetkan donation_point ATAU community_post.
-- Tepat satu dari (point_id, post_id) harus terisi.
--
-- Idempotent: aman di-rerun.

-- 1) Kolom target baru untuk postingan komunitas.
ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS post_id INT
        REFERENCES community_posts(id) ON DELETE CASCADE;

-- 2) point_id tidak lagi wajib (laporan bisa untuk post).
ALTER TABLE reports
    ALTER COLUMN point_id DROP NOT NULL;

-- 3) Tepat satu target yang terisi.
ALTER TABLE reports
    DROP CONSTRAINT IF EXISTS reports_single_target;
ALTER TABLE reports
    ADD CONSTRAINT reports_single_target
        CHECK ((point_id IS NOT NULL) <> (post_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_reports_post_id ON reports(post_id);
