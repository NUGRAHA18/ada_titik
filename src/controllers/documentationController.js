import pool from '../config/db.js';

export const uploadDocumentation = async (req, res) => {
    const { point_id, caption } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null; 

    if (!point_id || !photo_url) {
        return res.status(400).json({ error: "ID Titik Bantuan dan file foto wajib diisi" });
    }

    try {
        const query = `
            INSERT INTO documentation (point_id, photo_url, caption)
            VALUES ($1, $2, $3)
            RETURNING id, point_id, photo_url, caption
        `;
        const result = await pool.query(query, [point_id, photo_url, caption]);

        res.status(201).json({
            message: "Dokumentasi berhasil diunggah",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error Upload Dokumentasi:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};