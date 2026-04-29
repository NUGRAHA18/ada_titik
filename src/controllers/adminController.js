import pool from '../config/db.js';

export const getAllReports = async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    try {
        const conditions = [];
        const values = [];
        let idx = 1;

        if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
            conditions.push(`r.status = $${idx++}`);
            values.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        values.push(limit, offset);

        const result = await pool.query(`
            SELECT r.id AS report_id, r.reason, r.status AS report_status, r.created_at,
                   u.name AS reporter_name,
                   p.title AS point_title, p.id AS point_id,
                   COUNT(*) OVER() AS total_count
            FROM reports r
            JOIN users u           ON r.reporter_id = u.id
            JOIN donation_points p ON r.point_id = p.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT $${idx++} OFFSET $${idx}
        `, values);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get All Reports:", error);
        res.status(500).json({ error: "Gagal mengambil data laporan" });
    }
};

export const getSystemStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users)                                                              AS total_users,
                (SELECT COUNT(*) FROM donation_points WHERE deleted_at IS NULL)                           AS total_points,
                (SELECT COUNT(*) FROM donation_points WHERE status = 'Completed' AND deleted_at IS NULL)  AS completed_points,
                (SELECT COUNT(*) FROM reports WHERE status = 'pending')                                   AS pending_reports
        `);
        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error("Error Get System Stats:", error);
        res.status(500).json({ error: "Gagal mengambil statistik" });
    }
};

export const updateReportStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status tidak valid. Gunakan 'resolved' atau 'dismissed'" });
    }

    try {
        const result = await pool.query(
            `UPDATE reports SET status = $1 WHERE id = $2 RETURNING id, status`,
            [status, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: "Laporan tidak ditemukan" });

        res.status(200).json({
            message: `Laporan berhasil diverifikasi dengan status '${status}'`,
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error Update Report Status:", error);
        res.status(500).json({ error: "Gagal memperbarui status laporan" });
    }
};

// Soft delete: titik disembunyikan dari publik, data tetap tersimpan untuk audit
export const deleteInvalidPoint = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `UPDATE donation_points SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING title`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Titik tidak ditemukan atau sudah dihapus" });
        }

        res.status(200).json({ message: `Titik '${result.rows[0].title}' berhasil disembunyikan dari tampilan publik.` });
    } catch (error) {
        console.error("Error Delete Point:", error);
        res.status(500).json({ error: "Gagal menghapus data" });
    }
};
