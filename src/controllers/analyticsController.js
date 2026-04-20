import pool from '../config/db.js';

// Mengambil total bantuan berdasarkan status
export const getSummaryStats = async (req, res) => {
    try {
        const query = `
            SELECT status, COUNT(*) as total 
            FROM donation_points 
            GROUP BY status
        `;
        const result = await pool.query(query);
        
        res.status(200).json({
            message: "Statistik berhasil diambil",
            data: result.rows
        });
    } catch (error) {
        console.error("Error Get Stats:", error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};

// Mengambil data titik koordinat untuk Heatmap (peta kepadatan)
export const getHeatmapData = async (req, res) => {
    try {
        // Hanya ambil yang berstatus Open, beri bobot (weight) lebih besar jika Mendesak
        const query = `
            SELECT ST_X(location::geometry) AS longitude, 
                   ST_Y(location::geometry) AS latitude,
                   CASE 
                       WHEN urgency = 'Mendesak' THEN 3
                       WHEN urgency = 'Normal' THEN 2
                       ELSE 1
                   END as weight
            FROM donation_points
            WHERE status = 'Open'
        `;
        const result = await pool.query(query);

        res.status(200).json({
            message: "Data heatmap berhasil diambil",
            data: result.rows
        });
    } catch (error) {
        console.error("Error Get Heatmap:", error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};