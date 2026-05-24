import pool from '../config/db.js';

export const getNearbyNotifications = async (req, res) => {
    const { lat, lng, radius = 5000, limit = 5 } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "Lokasi saat ini (lat, lng) diperlukan" });
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 5));

    try {
        const result = await pool.query(`
            SELECT id, title, urgency, category, created_at,
                   ST_X(location::geometry) AS longitude,
                   ST_Y(location::geometry) AS latitude,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points
            WHERE status = 'Open' AND deleted_at IS NULL
              AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            ORDER BY created_at DESC
            LIMIT $4
        `, [lng, lat, radius, limitNum]);

        const data = result.rows.map(row => ({
            id:        row.id,
            title:     'Bantuan baru di dekat Anda',
            subtitle:  row.title,
            type:      'nearby_donation',
            urgency:   row.urgency,
            category:  row.category,
            distance_meters: Math.round(row.distance_meters),
            longitude: row.longitude,
            latitude:  row.latitude,
            created_at: row.created_at,
            point_id:  row.id,
        }));

        res.status(200).json({
            message: "Data notifikasi bantuan terdekat berhasil diambil",
            count:   data.length,
            data,
        });
    } catch (error) {
        console.error("Error Get Notifications:", error);
        res.status(500).json({ error: "Gagal mengambil data notifikasi" });
    }
};
