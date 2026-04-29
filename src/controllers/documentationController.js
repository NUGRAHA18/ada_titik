import pool from '../config/db.js';

export const getDocumentationByPoint = async (req, res) => {
    const { point_id } = req.params;

    try {
        const result = await pool.query(`
            SELECT id, point_id, photo_url, caption, created_at
            FROM documentation
            WHERE point_id = $1
            ORDER BY created_at DESC
        `, [point_id]);

        res.status(200).json({
            message: "Dokumentasi berhasil diambil",
            count: result.rowCount,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error Get Documentation:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const uploadDocumentation = async (req, res) => {
    const { point_id, caption } = req.body;
    const { userId } = req.user;
    const photo_url  = req.file ? `/uploads/${req.file.filename}` : null;

    if (!point_id || !photo_url) {
        return res.status(400).json({ error: "ID Titik Bantuan dan file foto wajib diisi" });
    }

    try {
        const pointCheck = await pool.query(
            `SELECT id FROM donation_points WHERE id = $1 AND deleted_at IS NULL`,
            [point_id]
        );

        if (pointCheck.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        const result = await pool.query(`
            INSERT INTO documentation (point_id, uploaded_by, photo_url, caption)
            VALUES ($1, $2, $3, $4)
            RETURNING id, point_id, photo_url, caption
        `, [point_id, userId, photo_url, caption]);

        res.status(201).json({ message: "Dokumentasi berhasil diunggah", data: result.rows[0] });
    } catch (error) {
        console.error("Error Upload Dokumentasi:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};
