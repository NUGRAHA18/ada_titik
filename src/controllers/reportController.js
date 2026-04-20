export const reportPoint = async (req, res) => {
    const { point_id, reason } = req.body;
    const { userId } = req.user;

    try {
        const query = `INSERT INTO reports (reporter_id, point_id, reason) VALUES ($1, $2, $3) RETURNING *`;
        await pool.query(query, [userId, point_id, reason]);
        res.status(201).json({ message: "Laporan Anda telah diterima dan akan diverifikasi oleh Admin." });
    } catch (error) {
        res.status(500).json({ error: "Gagal mengirim laporan" });
    }
};