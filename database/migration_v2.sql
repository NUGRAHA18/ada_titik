-- ============================================================
-- Migration v2: Tambah kolom soft-delete & uploaded_by
-- Jalankan pada database yang sudah ada (bukan fresh install)
-- psql -U postgres -d titik_baik -f database/migration_v2.sql
-- ============================================================

-- Soft delete pada donation_points
ALTER TABLE donation_points
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;

-- Index partial untuk performa query aktif
CREATE INDEX IF NOT EXISTS idx_donation_points_active
    ON donation_points(deleted_at) WHERE deleted_at IS NULL;

-- Kolom pembuat dokumentasi (opsional, tidak breaking)
-- Gunakan UUID karena users.id bertipe uuid
ALTER TABLE documentation
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
