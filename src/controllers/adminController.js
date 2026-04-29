import pool from '../config/db.js';

// 1. Mengambil semua laporan dari Donatur (Verifikasi Laporan)
export const getAllReports = async (req, res) => {
    try {
        const query = `
            SELECT r.id as report_id, r.reason, r.status as report_status, r.created_at,
                   u.name as reporter_name,
                   p.title as point_title, p.id as point_id
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            JOIN donation_points p ON r.point_id = p.id
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json({ data: result.rows });
    } catch (error) {
        res.status(500).json({ error: "Gagal mengambil data laporan" });
    }
};

// 2. Monitoring Sistem (Statistik Keseluruhan)
export const getSystemStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM donation_points) as total_points,
                (SELECT COUNT(*) FROM donation_points WHERE status = 'Completed') as completed_points,
                (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports
        `;
        const result = await pool.query(statsQuery);
        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Gagal mengambil statistik" });
    }
};

// 3. Verifikasi Laporan: Update Status Laporan (pending -> resolved / dismissed)
export const updateReportStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status tidak valid. Gunakan 'resolved' atau 'dismissed'" });
    }

    try {
        const query = `UPDATE reports SET status = $1 WHERE id = $2 RETURNING id, status`;
        const result = await pool.query(query, [status, id]);

        if (result.rowCount === 0) return res.status(404).json({ error: "Laporan tidak ditemukan" });

        res.status(200).json({
            message: `Laporan berhasil diverifikasi dengan status '${status}'`,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui status laporan" });
    }
};

// 4. Moderasi: Hapus Titik Bantuan Tidak Valid
export const deleteInvalidPoint = async (req, res) => {
    const { id } = req.params; // ID Titik Bantuan
    try {
        // Hapus titik (Otomatis menghapus laporan terkait karena ON DELETE CASCADE)
        const deleteQuery = `DELETE FROM donation_points WHERE id = $1 RETURNING title`;
        const result = await pool.query(deleteQuery, [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: "Titik tidak ditemukan" });

        res.status(200).json({ message: `Titik '${result.rows[0].title}' berhasil dihapus karena tidak valid.` });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghapus data" });
    }
};