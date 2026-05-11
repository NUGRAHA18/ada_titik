import path from 'path';
import pool from '../config/db.js';
import supabase from '../config/supabase.js';

const BUCKET = 'documentation';

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

    if (!point_id || !req.file) {
        return res.status(400).json({ error: "ID Titik Bantuan dan file foto wajib diisi" });
    }

    let uploadedPath = null;

    try {
        const pointCheck = await pool.query(
            `SELECT id FROM donation_points WHERE id = $1 AND deleted_at IS NULL`,
            [point_id]
        );

        if (pointCheck.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        const ext      = path.extname(req.file.originalname);
        const filename = `${point_id}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (uploadError) throw uploadError;
        uploadedPath = filename;

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(filename);

        const result = await pool.query(`
            INSERT INTO documentation (point_id, uploaded_by, photo_url, caption)
            VALUES ($1, $2, $3, $4)
            RETURNING id, point_id, photo_url, caption
        `, [point_id, userId, publicUrl, caption]);

        res.status(201).json({ message: "Dokumentasi berhasil diunggah", data: result.rows[0] });
    } catch (error) {
        if (uploadedPath) {
            await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => {});
        }
        console.error("Error Upload Dokumentasi:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};
