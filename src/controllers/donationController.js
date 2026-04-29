import pool from "../config/db.js";

export const createDonationPoint = async (req, res) => {
    const { userId } = req.user;
    const { title, description, longitude, latitude, urgency } = req.body;

    if (!title || !longitude || !latitude) {
        return res.status(400).json({ error: "Judul dan koordinat (longitude, latitude) wajib diisi" });
    }

    try {
        const result = await pool.query(`
            INSERT INTO donation_points (created_by, title, description, location, urgency)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
            RETURNING id, title, status, urgency
        `, [userId, title, description, longitude, latitude, urgency || 'Normal']);

        res.status(201).json({ message: "Titik bantuan berhasil ditambahkan", data: result.rows[0] });
    } catch (error) {
        console.error("Error Create Donation Point:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const getDonationPoints = async (req, res) => {
    const { urgency, status, search, page = 1, limit = 10 } = req.query;

    const validUrgencies = ['Mendesak', 'Normal', 'Rendah'];
    const validStatuses  = ['Open', 'On Progress', 'Completed'];

    if (urgency && !validUrgencies.includes(urgency)) {
        return res.status(400).json({ error: "Nilai urgency tidak valid. Gunakan: Mendesak, Normal, atau Rendah" });
    }
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Nilai status tidak valid. Gunakan: Open, On Progress, atau Completed" });
    }

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const offset   = (pageNum - 1) * limitNum;

    try {
        const conditions = ['deleted_at IS NULL'];
        const values = [];
        let idx = 1;

        if (status) {
            conditions.push(`status = $${idx++}`);
            values.push(status);
        } else {
            conditions.push(`status = 'Open'`);
        }

        if (urgency) {
            conditions.push(`urgency = $${idx++}`);
            values.push(urgency);
        }

        if (search) {
            conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
            values.push(`%${search}%`);
            idx++;
        }

        const limitIdx  = idx++;
        const offsetIdx = idx;
        values.push(limitNum, offset);

        const result = await pool.query(`
            SELECT id, title, description, status, urgency, created_at,
                   ST_X(location::geometry) AS longitude,
                   ST_Y(location::geometry) AS latitude,
                   COUNT(*) OVER() AS total_count
            FROM donation_points
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `, values);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            message: "Data titik bantuan berhasil diambil",
            pagination: {
                total,
                total_pages:  Math.ceil(total / limitNum),
                current_page: pageNum,
                limit:        limitNum,
            },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get Donation Points:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const getDonationPointById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT dp.id, dp.title, dp.description, dp.status, dp.urgency,
                   dp.created_at, dp.created_by,
                   ST_X(dp.location::geometry) AS longitude,
                   ST_Y(dp.location::geometry) AS latitude,
                   u.name AS creator_name,
                   COALESCE(AVG(r.score), 0) AS avg_rating,
                   COUNT(DISTINCT r.id)       AS total_ratings,
                   COUNT(DISTINCT d.id)       AS total_docs
            FROM donation_points dp
            LEFT JOIN users u         ON dp.created_by = u.id
            LEFT JOIN ratings r       ON dp.id = r.point_id
            LEFT JOIN documentation d ON dp.id = d.point_id
            WHERE dp.id = $1 AND dp.deleted_at IS NULL
            GROUP BY dp.id, u.name
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        res.status(200).json({ message: "Detail titik bantuan berhasil diambil", data: result.rows[0] });
    } catch (error) {
        console.error("Error Get Donation Point By Id:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const getNearbyDonations = async (req, res) => {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius) {
        return res.status(400).json({ error: "Parameter lat, lng, dan radius (dalam meter) wajib diisi" });
    }

    try {
        const result = await pool.query(`
            SELECT id, title, description, status, urgency,
                   ST_X(location::geometry) AS longitude,
                   ST_Y(location::geometry) AS latitude,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points
            WHERE status = 'Open' AND deleted_at IS NULL
              AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            ORDER BY distance_meters ASC
        `, [lng, lat, radius]);

        res.status(200).json({
            message: `Menampilkan titik bantuan dalam radius ${radius} meter`,
            count: result.rowCount,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error Get Nearby Donations:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const updateDonationStatus = async (req, res) => {
    const { id } = req.params;
    const { status, user_lat, user_lng } = req.body;
    const { userId } = req.user;

    const allowedStatuses = ['On Progress', 'Completed'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Status tidak valid. Gunakan 'On Progress' atau 'Completed'" });
    }

    try {
        const checkResult = await pool.query(`
            SELECT status, created_by, deleted_at,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points WHERE id = $3
        `, [user_lng || 0, user_lat || 0, id]);

        if (checkResult.rowCount === 0) return res.status(404).json({ error: "Titik tidak ditemukan" });

        const point = checkResult.rows[0];

        if (point.deleted_at) return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });

        if (status === 'On Progress') {
            if (point.status !== 'Open') {
                return res.status(400).json({ error: "Hanya bantuan 'Open' yang bisa diproses" });
            }
        } else if (status === 'Completed') {
            if (point.status !== 'On Progress') {
                return res.status(400).json({ error: "Bantuan harus berstatus 'On Progress' sebelum diselesaikan" });
            }
            if (point.created_by !== userId) {
                return res.status(403).json({ error: "Hanya Komunitas pengelola yang bisa menyelesaikan ini" });
            }
            if (!user_lat || !user_lng || point.distance_meters > 100) {
                return res.status(403).json({
                    error: `Geo-fencing gagal. Jarak Anda: ${Math.round(point.distance_meters)}m (Maks 100m)`,
                });
            }
        }

        const result = await pool.query(
            `UPDATE donation_points SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );

        res.status(200).json({ message: `Status berhasil diubah menjadi ${status}`, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};

export const updateDonationPoint = async (req, res) => {
    const { id } = req.params;
    const { title, description, urgency } = req.body;
    const { userId } = req.user;

    if (!title && description === undefined && !urgency) {
        return res.status(400).json({ error: "Minimal satu field (title, description, urgency) harus diisi" });
    }

    try {
        const checkResult = await pool.query(
            `SELECT created_by, deleted_at FROM donation_points WHERE id = $1`,
            [id]
        );

        if (checkResult.rowCount === 0 || checkResult.rows[0].deleted_at) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        if (checkResult.rows[0].created_by !== userId) {
            return res.status(403).json({ error: "Hanya pengelola titik bantuan ini yang bisa mengeditnya" });
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (title)                    { fields.push(`title = $${idx++}`);       values.push(title); }
        if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
        if (urgency)                  { fields.push(`urgency = $${idx++}`);     values.push(urgency); }
        values.push(id);

        const result = await pool.query(
            `UPDATE donation_points SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, description, urgency, status`,
            values
        );

        res.status(200).json({ message: "Titik bantuan berhasil diperbarui", data: result.rows[0] });
    } catch (error) {
        console.error("Error Update Donation Point:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

export const getNearbyNotifications = async (req, res) => {
    const { lat, lng, radius = 5000 } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "Lokasi saat ini (lat, lng) diperlukan" });
    }

    try {
        const result = await pool.query(`
            SELECT id, title, urgency,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance
            FROM donation_points
            WHERE status = 'Open' AND deleted_at IS NULL
              AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            ORDER BY created_at DESC
            LIMIT 5
        `, [lng, lat, radius]);

        res.status(200).json({ message: "Data notifikasi bantuan terdekat berhasil diambil", data: result.rows });
    } catch (error) {
        console.error("Error Get Notifications:", error);
        res.status(500).json({ error: "Gagal mengambil data notifikasi" });
    }
};
