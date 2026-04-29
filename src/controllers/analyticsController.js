import pool from '../config/db.js';

export const getSummaryStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT status, COUNT(*) AS total
            FROM donation_points
            WHERE deleted_at IS NULL
            GROUP BY status
        `);

        res.status(200).json({ message: "Statistik berhasil diambil", data: result.rows });
    } catch (error) {
        console.error("Error Get Stats:", error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};

export const getHeatmapData = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ST_X(location::geometry) AS longitude,
                   ST_Y(location::geometry) AS latitude,
                   CASE
                       WHEN urgency = 'Mendesak' THEN 3
                       WHEN urgency = 'Normal'   THEN 2
                       ELSE 1
                   END AS weight
            FROM donation_points
            WHERE status = 'Open' AND deleted_at IS NULL
        `);

        res.status(200).json({ message: "Data heatmap berhasil diambil", data: result.rows });
    } catch (error) {
        console.error("Error Get Heatmap:", error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};
