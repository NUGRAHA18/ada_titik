import pool from '../config/db.js';
import { createNotificationsBulk, NOTIF_TYPE } from '../services/notificationService.js';

export const createReport = async (req, res) => {
    const { point_id, reason } = req.body;
    const { userId } = req.user;

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
        const report = result.rows[0];

        // Integrasi admin: kirim notifikasi ke SEMUA admin agar lonceng/dashboard
        // admin langsung menyala saat ada laporan baru (loop pelapor → admin).
        try {
            const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin'`);
            const point  = await pool.query(`SELECT title FROM donation_points WHERE id = $1`, [point_id]);
            const pointTitle = point.rows[0]?.title || `#${point_id}`;
            if (admins.rowCount > 0) {
                await createNotificationsBulk(pool, admins.rows.map(a => ({
                    userId:  a.id,
                    actorId: userId,
                    type:    NOTIF_TYPE.REPORT_CREATED,
                    title:   'Laporan baru masuk',
                    body:    `Titik "${pointTitle}" dilaporkan: ${reason.slice(0, 80)}`,
                    payload: { report_id: report.id, point_id: Number(point_id) },
                })));
            }
        } catch (notifErr) {
            console.error('Gagal notifikasi admin (report):', notifErr.message);
        }

        res.status(201).json({
            message: "Laporan berhasil dikirim dan akan segera diperiksa Admin",
            data: report
        });
    } catch (error) {
        console.error("Error Create Report:", error);
        res.status(500).json({ error: "Gagal mengirim laporan" });
    }
};