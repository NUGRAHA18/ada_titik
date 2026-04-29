import pool from "../config/db.js";

// Fungsi Tambah Titik Bantuan
export const createDonationPoint = async (req, res) => {
  const { userId } = req.user;
  const { title, description, longitude, latitude, urgency } = req.body;

  if (!title || !longitude || !latitude) {
    return res
      .status(400)
      .json({ error: "Judul dan koordinat (longitude, latitude) wajib diisi" });
  }

  try {
    const query = `
            INSERT INTO donation_points (created_by, title, description, location, urgency)
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
            RETURNING id, title, status, urgency
        `;
    const values = [
      userId,
      title,
      description,
      longitude,  
      latitude,
      urgency || "Normal",
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Titik bantuan berhasil ditambahkan",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error Create Donation Point:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

// Fungsi Ambil Semua Titik Bantuan (Untuk Peta) dengan Filter
export const getDonationPoints = async (req, res) => {
  const { urgency, status } = req.query;

  const validUrgencies = ['Mendesak', 'Normal', 'Rendah'];
  const validStatuses = ['Open', 'On Progress', 'Completed'];

  if (urgency && !validUrgencies.includes(urgency)) {
    return res.status(400).json({ error: "Nilai urgency tidak valid. Gunakan: Mendesak, Normal, atau Rendah" });
  }
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Nilai status tidak valid. Gunakan: Open, On Progress, atau Completed" });
  }

  try {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    } else {
      // Default: tampilkan hanya yang Open
      conditions.push(`status = 'Open'`);
    }

    if (urgency) {
      conditions.push(`urgency = $${idx++}`);
      values.push(urgency);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
            SELECT id, title, description, status, urgency, created_at,
                   ST_X(location::geometry) AS longitude,
                   ST_Y(location::geometry) AS latitude
            FROM donation_points
            ${whereClause}
            ORDER BY created_at DESC
        `;

    const result = await pool.query(query, values);

    res.status(200).json({
      message: "Data titik bantuan berhasil diambil",
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error Get Donation Points:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

// Fungsi Ambil Detail Satu Titik Bantuan
export const getDonationPointById = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT dp.id, dp.title, dp.description, dp.status, dp.urgency,
                   dp.created_at, dp.created_by,
                   ST_X(dp.location::geometry) AS longitude,
                   ST_Y(dp.location::geometry) AS latitude,
                   u.name AS creator_name,
                   COALESCE(AVG(r.score), 0) AS avg_rating,
                   COUNT(DISTINCT r.id) AS total_ratings,
                   COUNT(DISTINCT d.id) AS total_docs
            FROM donation_points dp
            LEFT JOIN users u ON dp.created_by = u.id
            LEFT JOIN ratings r ON dp.id = r.point_id
            LEFT JOIN documentation d ON dp.id = d.point_id
            WHERE dp.id = $1
            GROUP BY dp.id, u.name
        `;
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        res.status(200).json({
            message: "Detail titik bantuan berhasil diambil",
            data: result.rows[0]
        });
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
        // Cari titik dalam radius X meter, urutkan dari yang paling dekat
        const query = `
            SELECT id, title, description, status, urgency, 
                   ST_X(location::geometry) AS longitude, 
                   ST_Y(location::geometry) AS latitude,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points
            WHERE status = 'Open' 
              AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            ORDER BY distance_meters ASC
        `;
        
        const values = [lng, lat, radius]; 

        const result = await pool.query(query, values);

        res.status(200).json({
            message: `Menampilkan titik bantuan dalam radius ${radius} meter`,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error("Error Get Nearby Donations:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

// Fungsi Update Status Bantuan dengan Geo-Fencing
export const updateDonationStatus = async (req, res) => {
    const { id } = req.params;
    const { status, user_lat, user_lng } = req.body;
    const { userId, role } = req.user;

    const allowedStatuses = ['On Progress', 'Completed'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Status tidak valid. Gunakan 'On Progress' atau 'Completed'" });
    }

    try {
        // 1. Ambil data titik saat ini
        const checkQuery = `
            SELECT status, created_by,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points WHERE id = $3
        `;
        const checkResult = await pool.query(checkQuery, [user_lng || 0, user_lat || 0, id]);

        if (checkResult.rowCount === 0) return res.status(404).json({ error: "Titik tidak ditemukan" });

        const currentData = checkResult.rows[0];

        // 2. LOGIKA TRANSISI STATUS (Sesuai Diagram)
        
        // A. Transisi ke 'On Progress' (Bisa dilakukan Donatur/Komunitas lain)
        if (status === 'On Progress') {
            if (currentData.status !== 'Open') {
                return res.status(400).json({ error: "Hanya bantuan 'Open' yang bisa diproses" });
            }
        } 

        // B. Transisi ke 'Completed' (Wajib Geo-fencing & Pembuat Titik)
        else if (status === 'Completed') {
            if (currentData.status !== 'On Progress') {
                return res.status(400).json({ error: "Bantuan harus berstatus 'On Progress' sebelum diselesaikan" });
            }
            if (currentData.created_by !== userId) {
                return res.status(403).json({ error: "Hanya Komunitas pengelola yang bisa menyelesaikan ini" });
            }
            if (!user_lat || !user_lng || currentData.distance_meters > 100) {
                return res.status(403).json({ 
                    error: `Geo-fencing gagal. Jarak Anda: ${Math.round(currentData.distance_meters)}m (Maks 100m)` 
                });
            }
        }

        // 3. Eksekusi Update
        const updateQuery = `UPDATE donation_points SET status = $1 WHERE id = $2 RETURNING *`;
        const result = await pool.query(updateQuery, [status, id]);

        res.status(200).json({
            message: `Status berhasil diubah menjadi ${status}`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Terjadi kesalahan server" });
    }
};

export const getNearbyNotifications = async (req, res) => {
    const { lat, lng, radius = 5000 } = req.query; // Default radius 5km

    if (!lat || !lng) {
        return res.status(400).json({ error: "Lokasi saat ini (lat, lng) diperlukan" });
    }

    try {
        const query = `
            SELECT id, title, urgency, 
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance
            FROM donation_points
            WHERE status = 'Open' 
              AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), $3)
            ORDER BY created_at DESC
            LIMIT 5
        `;
        const result = await pool.query(query, [lng, lat, radius]);

        res.status(200).json({
            message: "Data notifikasi bantuan terdekat berhasil diambil",
            data: result.rows
        });
    } catch (error) {
        console.error("Error Get Notifications:", error);
        res.status(500).json({ error: "Gagal mengambil data notifikasi" });
    }
};