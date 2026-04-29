import pool from '../config/db.js';

export const getProfile = async (req, res) => {
    const { userId } = req.user;

    try {
        const result = await pool.query(
            `SELECT id, name, email, role, bio, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User tidak ditemukan" });
        }

        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error Get Profile:", error);
        res.status(500).json({ error: "Gagal mengambil data profil" });
    }
};

export const updateProfile = async (req, res) => {
    const { userId } = req.user;
    const { name, bio } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Nama tidak boleh kosong" });
    }

    try {
        const result = await pool.query(
            `UPDATE users SET name = $1, bio = $2 WHERE id = $3 RETURNING id, name, role, bio`,
            [name, bio || null, userId]
        );
        res.status(200).json({ message: "Profil berhasil diperbarui", data: result.rows[0] });
    } catch (error) {
        console.error("Error Update Profile:", error);
        res.status(500).json({ error: "Gagal memperbarui profil" });
    }
};

export const getUserActivity = async (req, res) => {
    const { userId, role } = req.user;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    try {
        let result;

        if (role === 'komunitas' || role === 'admin') {
            result = await pool.query(`
                SELECT id, title, status, urgency, created_at,
                       COUNT(*) OVER() AS total_count
                FROM donation_points
                WHERE created_by = $1 AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);
        } else {
            result = await pool.query(`
                SELECT r.id, r.score, r.review, r.created_at,
                       dp.id AS point_id, dp.title AS point_title, dp.status AS point_status,
                       COUNT(*) OVER() AS total_count
                FROM ratings r
                JOIN donation_points dp ON r.point_id = dp.id
                WHERE r.given_by = $1
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);
        }

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get Activity:", error);
        res.status(500).json({ error: "Gagal mengambil riwayat aktivitas" });
    }
};
