import pool from '../config/db.js';

export const createReport = async (req, res) => {
    const { point_id, reason } = req.body;
    const { userId } = req.user; // ID Donatur dari token

    if (!point_id || !reason) {
        return res.status(400).json({ error: "ID titik dan alasan laporan wajib diisi" });
    }

    try {
        const query = `
            INSERT INTO reports (reporter_id, point_id, reason)
            VALUES ($1, $2, $3)
            RETURNING id, status, created_at
        `;
        const result = await pool.query(query, [userId, point_id, reason]);

        res.status(201).json({
            message: "Laporan berhasil dikirim dan akan segera diperiksa Admin",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error Create Report:", error);
        res.status(500).json({ error: "Gagal mengirim laporan" });
    }
};