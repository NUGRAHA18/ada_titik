import pool from '../config/db.js';

export const listMyNotifications = async (req, res) => {
    const { userId } = req.user;
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset  = (page - 1) * limit;
    const unread  = req.query.unread === 'true';

    try {
        const conditions = ['user_id = $1::uuid'];
        const values     = [userId];
        let idx = 2;

        if (unread) {
            conditions.push('read_at IS NULL');
        }

        values.push(limit, offset);

        const result = await pool.query(`
            SELECT id, user_id, actor_id, type, title, body, payload, read_at, created_at,
                   COUNT(*) OVER() AS total_count,
                   (SELECT COUNT(*)::int FROM notifications
                    WHERE user_id = $1::uuid AND read_at IS NULL) AS unread_count
            FROM notifications
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT $${idx} OFFSET $${idx + 1}
        `, values);

        const total       = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
        const unreadCount = result.rows.length > 0 ? parseInt(result.rows[0].unread_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            unread_count: unreadCount,
            data: result.rows.map(({ total_count, unread_count, ...row }) => row),
        });
    } catch (error) {
        console.error('Error List Notifications:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar notifikasi' });
    }
};

export const markNotificationRead = async (req, res) => {
    const { userId } = req.user;
    const notifId = parseInt(req.params.id);

    if (!Number.isInteger(notifId) || notifId < 1) {
        return res.status(400).json({ error: 'ID notifikasi tidak valid' });
    }

    try {
        const result = await pool.query(`
            UPDATE notifications
               SET read_at = COALESCE(read_at, NOW())
             WHERE id = $1 AND user_id = $2::uuid
            RETURNING id, read_at
        `, [notifId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
        }

        res.status(200).json({ message: 'Notifikasi ditandai dibaca', data: result.rows[0] });
    } catch (error) {
        console.error('Error Mark Notification Read:', error);
        res.status(500).json({ error: 'Gagal menandai notifikasi' });
    }
};

export const markAllNotificationsRead = async (req, res) => {
    const { userId } = req.user;

    try {
        const result = await pool.query(`
            UPDATE notifications
               SET read_at = NOW()
             WHERE user_id = $1::uuid AND read_at IS NULL
            RETURNING id
        `, [userId]);

        res.status(200).json({
            message: 'Semua notifikasi ditandai dibaca',
            marked_count: result.rowCount,
        });
    } catch (error) {
        console.error('Error Mark All Notifications Read:', error);
        res.status(500).json({ error: 'Gagal menandai notifikasi' });
    }
};

export const deleteNotification = async (req, res) => {
    const { userId } = req.user;
    const notifId = parseInt(req.params.id);

    if (!Number.isInteger(notifId) || notifId < 1) {
        return res.status(400).json({ error: 'ID notifikasi tidak valid' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2::uuid RETURNING id`,
            [notifId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notifikasi tidak ditemukan' });
        }

        res.status(200).json({ message: 'Notifikasi dihapus' });
    } catch (error) {
        console.error('Error Delete Notification:', error);
        res.status(500).json({ error: 'Gagal menghapus notifikasi' });
    }
};

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
