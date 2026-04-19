import pool from '../config/db.js';

export const giveRating = async (req, res) => {
    const { point_id, score, review } = req.body;
    const { userId } = req.user; // Dari token JWT (Donatur)

    if (!point_id || !score || score < 1 || score > 5) {
        return res.status(400).json({ error: "ID titik bantuan dan score (1-5) wajib diisi" });
    }

    try {
        // 1. Validasi Status Bantuan (Harus Completed)
        const checkQuery = `SELECT status FROM donation_points WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [point_id]);

        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        if (checkResult.rows[0].status !== 'Completed') {
            return res.status(400).json({ error: "Rating hanya dapat diberikan pada titik bantuan yang sudah berstatus 'Completed'" });
        }

        // 2. Simpan Rating
        const insertQuery = `
            INSERT INTO ratings (point_id, given_by, score, review)
            VALUES ($1, $2, $3, $4)
            RETURNING id, score, review
        `;
        const result = await pool.query(insertQuery, [point_id, userId, score, review]);

        res.status(201).json({
            message: "Penilaian berhasil dikirim. Terima kasih atas partisipasi Anda!",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error Give Rating:", error);
        // Error khusus jika user mencoba memberi rating 2 kali (Constraint UNIQUE)
        if (error.code === '23505') {
            return res.status(409).json({ error: "Anda sudah memberikan penilaian untuk titik bantuan ini" });
        }
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};