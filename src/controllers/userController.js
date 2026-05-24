import path from 'path';
import pool from '../config/db.js';
import supabase from '../config/supabase.js';

const AVATAR_BUCKET = 'avatars';

export const getProfile = async (req, res) => {
    const { userId, role } = req.user;

    try {
        let result;

        if (role === 'komunitas' || role === 'admin') {
            result = await pool.query(`
                SELECT u.id, u.name, u.email, u.role, u.bio, u.avatar_url, u.created_at,
                       COUNT(DISTINCT dp.id)
                           FILTER (WHERE dp.deleted_at IS NULL) AS donation_count,
                       COUNT(DISTINCT dp.id)
                           FILTER (WHERE dp.deleted_at IS NULL AND dp.status = 'Completed') AS points_helped,
                       COALESCE(SUM(dp.goal_amount)
                           FILTER (WHERE dp.deleted_at IS NULL), 0) AS total_donation
                FROM users u
                LEFT JOIN donation_points dp ON dp.created_by = u.id
                WHERE u.id = $1
                GROUP BY u.id
            `, [userId]);
        } else {
            result = await pool.query(`
                SELECT u.id, u.name, u.email, u.role, u.bio, u.avatar_url, u.created_at,
                       COUNT(DISTINCT r.id) AS donation_count,
                       COUNT(DISTINCT dp.id)
                           FILTER (WHERE dp.status = 'Completed' AND dp.deleted_at IS NULL) AS points_helped,
                       COALESCE(SUM(DISTINCT dp.goal_amount)
                           FILTER (WHERE dp.status = 'Completed' AND dp.deleted_at IS NULL), 0) AS total_donation
                FROM users u
                LEFT JOIN ratings r          ON r.given_by = u.id
                LEFT JOIN donation_points dp ON dp.id = r.point_id
                WHERE u.id = $1
                GROUP BY u.id
            `, [userId]);
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User tidak ditemukan" });
        }

        const row = result.rows[0];
        res.status(200).json({
            data: {
                ...row,
                donation_count: parseInt(row.donation_count) || 0,
                points_helped:  parseInt(row.points_helped)  || 0,
                total_donation: parseFloat(row.total_donation) || 0,
            },
        });
    } catch (error) {
        console.error("Error Get Profile:", error);
        res.status(500).json({ error: "Gagal mengambil data profil" });
    }
};

export const updateProfile = async (req, res) => {
    const { userId } = req.user;
    const { name, bio, avatar_url } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Nama tidak boleh kosong" });
    }

    try {
        const fields = ['name = $1', 'bio = $2'];
        const values = [name, bio || null];
        let idx = 3;

        if (avatar_url !== undefined) {
            fields.push(`avatar_url = $${idx++}`);
            values.push(avatar_url || null);
        }

        values.push(userId);

        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, role, bio, avatar_url`,
            values
        );
        res.status(200).json({ message: "Profil berhasil diperbarui", data: result.rows[0] });
    } catch (error) {
        console.error("Error Update Profile:", error);
        res.status(500).json({ error: "Gagal memperbarui profil" });
    }
};

export const uploadAvatar = async (req, res) => {
    const { userId } = req.user;

    if (!req.file) {
        return res.status(400).json({ error: "File foto avatar wajib diunggah" });
    }

    let uploadedPath = null;

    try {
        const ext      = path.extname(req.file.originalname);
        const filename = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (uploadError) throw uploadError;
        uploadedPath = filename;

        const { data: { publicUrl } } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(filename);

        const result = await pool.query(
            `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, name, avatar_url`,
            [publicUrl, userId]
        );

        res.status(200).json({ message: "Avatar berhasil diunggah", data: result.rows[0] });
    } catch (error) {
        if (uploadedPath) {
            await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]).catch(() => {});
        }
        console.error("Error Upload Avatar:", error);
        res.status(500).json({ error: "Gagal mengunggah avatar" });
    }
};

export const getUserActivity = async (req, res) => {
    const { userId, role } = req.user;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    try {
        let rows;
        let total = 0;

        if (role === 'komunitas' || role === 'admin') {
            const result = await pool.query(`
                SELECT id, title, status, urgency, category, created_at,
                       COUNT(*) OVER() AS total_count
                FROM donation_points
                WHERE created_by = $1 AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
            rows = result.rows.map(r => ({
                id:         r.id,
                title:      r.title,
                subtitle:   `${r.status} • ${r.urgency}`,
                type:       'donation_managed',
                status:     r.status,
                urgency:    r.urgency,
                category:   r.category,
                created_at: r.created_at,
            }));
        } else {
            const result = await pool.query(`
                SELECT r.id, r.score, r.review, r.created_at,
                       dp.id AS point_id, dp.title AS point_title, dp.status AS point_status,
                       dp.category AS point_category,
                       COUNT(*) OVER() AS total_count
                FROM ratings r
                JOIN donation_points dp ON r.point_id = dp.id
                WHERE r.given_by = $1
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
            rows = result.rows.map(r => ({
                id:         r.id,
                title:      r.point_title,
                subtitle:   `Memberi nilai ${r.score}/5`,
                type:       'rating_given',
                score:      r.score,
                review:     r.review,
                point_id:   r.point_id,
                point_status:   r.point_status,
                point_category: r.point_category,
                created_at: r.created_at,
            }));
        }

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: rows,
        });
    } catch (error) {
        console.error("Error Get Activity:", error);
        res.status(500).json({ error: "Gagal mengambil riwayat aktivitas" });
    }
};
