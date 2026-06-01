import pool from '../config/db.js';
import { createNotification, createNotificationsBulk, NOTIF_TYPE } from '../services/notificationService.js';

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

        // LEFT JOIN supaya laporan TITIK maupun POSTINGAN komunitas (v7) ikut
        // tampil. target_type membedakan keduanya untuk UI admin.
        const result = await pool.query(`
            SELECT r.id AS report_id, r.reason, r.status AS report_status, r.created_at,
                   r.reporter_id, u.name AS reporter_name, u.email AS reporter_email,
                   r.point_id, r.post_id,
                   CASE WHEN r.post_id IS NOT NULL THEN 'post' ELSE 'point' END AS target_type,
                   COALESCE(p.title, 'Postingan #' || r.post_id) AS point_title,
                   COALESCE(p.created_by, post.author_id) AS owner_id,
                   COALESCE(owner.name, post_owner.name)   AS owner_name,
                   COUNT(*) OVER() AS total_count
            FROM reports r
            JOIN users u                  ON r.reporter_id = u.id
            LEFT JOIN donation_points p   ON r.point_id = p.id
            LEFT JOIN community_posts post ON r.post_id = post.id
            LEFT JOIN users owner          ON p.created_by = owner.id
            LEFT JOIN users post_owner     ON post.author_id = post_owner.id
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
            `UPDATE reports SET status = $1 WHERE id = $2
             RETURNING id, status, reporter_id, point_id`,
            [status, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: "Laporan tidak ditemukan" });

        const report = result.rows[0];

        // Tutup loop ke pelapor: beri tahu laporannya sudah ditindaklanjuti admin.
        const verdict = status === 'resolved'
            ? 'Laporan Anda terbukti dan telah ditindaklanjuti.'
            : 'Laporan Anda telah ditinjau namun tidak ditemukan pelanggaran.';
        await createNotification(pool, {
            userId:  report.reporter_id,
            actorId: req.user.userId,
            type:    NOTIF_TYPE.REPORT_REVIEWED,
            title:   'Laporan Anda telah ditinjau',
            body:    verdict,
            payload: { report_id: report.id, status: report.status, point_id: report.point_id },
        });

        res.status(200).json({
            message: `Laporan berhasil diverifikasi dengan status '${status}'`,
            data: { id: report.id, status: report.status },
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
            `UPDATE donation_points SET deleted_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING title, created_by`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Titik tidak ditemukan atau sudah dihapus" });
        }

        const { title, created_by } = result.rows[0];

        // Beri tahu pemilik titik (komunitas) bahwa titiknya disembunyikan admin.
        await createNotification(pool, {
            userId:  created_by,
            actorId: req.user.userId,
            type:    NOTIF_TYPE.POINT_REMOVED,
            title:   'Titik Anda disembunyikan',
            body:    `Titik "${title}" disembunyikan oleh admin karena melanggar ketentuan komunitas.`,
            payload: { point_id: Number(id) },
        });

        // Tutup loop ke para pelapor titik ini: laporan mereka ditindaklanjuti.
        const reporters = await pool.query(
            `SELECT DISTINCT reporter_id FROM reports WHERE point_id = $1`,
            [id]
        );
        if (reporters.rowCount > 0) {
            await createNotificationsBulk(pool, reporters.rows.map(r => ({
                userId:  r.reporter_id,
                actorId: req.user.userId,
                type:    NOTIF_TYPE.REPORT_REVIEWED,
                title:   'Laporan Anda ditindaklanjuti',
                body:    `Titik "${title}" yang Anda laporkan telah disembunyikan.`,
                payload: { point_id: Number(id), status: 'resolved' },
            })));
            // Sekaligus tandai laporan titik ini resolved.
            await pool.query(
                `UPDATE reports SET status = 'resolved' WHERE point_id = $1 AND status = 'pending'`,
                [id]
            );
        }

        res.status(200).json({ message: `Titik '${title}' berhasil disembunyikan dari tampilan publik.` });
    } catch (error) {
        console.error("Error Delete Point:", error);
        res.status(500).json({ error: "Gagal menghapus data" });
    }
};
