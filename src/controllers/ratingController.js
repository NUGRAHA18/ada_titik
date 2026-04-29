import pool from '../config/db.js';

export const getRatingsByPoint = async (req, res) => {
    const { point_id } = req.params;

    try {
        const result = await pool.query(`
            SELECT r.id, r.score, r.review, r.created_at,
                   u.name AS reviewer_name
            FROM ratings r
            JOIN users u ON r.given_by = u.id
            WHERE r.point_id = $1
            ORDER BY r.created_at DESC
        `, [point_id]);

        const avgResult = await pool.query(
            `SELECT COALESCE(AVG(score), 0) AS avg_score FROM ratings WHERE point_id = $1`,
            [point_id]
        );

        res.status(200).json({
            message: "Data rating berhasil diambil",
            avg_score: parseFloat(parseFloat(avgResult.rows[0].avg_score).toFixed(1)),
            count: result.rowCount,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error Get Ratings:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const giveRating = async (req, res) => {
    const { point_id, score, review } = req.body;
    const { userId } = req.user;

    if (!point_id || !score || score < 1 || score > 5) {
        return res.status(400).json({ error: "ID titik bantuan dan score (1-5) wajib diisi" });
    }

    try {
        const pointResult = await pool.query(
            `SELECT created_by, deleted_at FROM donation_points WHERE id = $1`,
            [point_id]
        );

        if (pointResult.rowCount === 0 || pointResult.rows[0].deleted_at) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        if (pointResult.rows[0].created_by === userId) {
            return res.status(403).json({ error: "Anda tidak dapat memberikan rating pada bantuan yang Anda buat sendiri." });
        }

        const result = await pool.query(`
            INSERT INTO ratings (point_id, given_by, score, review)
            VALUES ($1, $2, $3, $4)
            RETURNING id, score, review
        `, [point_id, userId, score, review]);

        res.status(201).json({
            message: "Penilaian berhasil dikirim. Terima kasih atas partisipasi Anda!",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error Give Rating:", error);
        if (error.code === '23505') {
            return res.status(409).json({ error: "Anda sudah memberikan penilaian untuk titik bantuan ini" });
        }
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};
