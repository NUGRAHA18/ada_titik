import pool from '../config/db.js';

export const getProfile = async (req, res) => {
    const { userId } = req.user;

    try {
        const query = `SELECT id, name, email, role, bio, created_at FROM users WHERE id = $1`;
        const result = await pool.query(query, [userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User tidak ditemukan" });
        }

        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
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
        const query = `UPDATE users SET name = $1, bio = $2 WHERE id = $3 RETURNING id, name, role, bio`;
        const result = await pool.query(query, [name, bio || null, userId]);
        res.status(200).json({ message: "Profil berhasil diperbarui", data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui profil" });
    }
};