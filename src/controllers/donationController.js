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

// Fungsi Ambil Semua Titik Bantuan (Untuk Peta)
export const getDonationPoints = async (req, res) => {
  try {
    // Mengubah format PostGIS kembali menjadi Longitude & Latitude agar mudah dibaca Frontend
    const query = `
            SELECT id, title, description, status, urgency, 
                   ST_X(location::geometry) AS longitude, 
                   ST_Y(location::geometry) AS latitude 
            FROM donation_points
            WHERE status = 'Open'
        `;

    const result = await pool.query(query);

    res.status(200).json({
      message: "Data titik bantuan berhasil diambil",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error Get Donation Points:", error);
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
    const { status, user_lat, user_lng } = req.body; // Minta koordinat device user
    const { userId } = req.user;

    // Validasi Input Dasar
    if (!status || !['Open', 'On Progress', 'Completed'].includes(status)) {
        return res.status(400).json({ error: "Status tidak valid" });
    }
    if (!user_lat || !user_lng) {
        return res.status(400).json({ error: "Koordinat pengguna saat ini wajib dikirimkan" });
    }

    try {
        // Ambil data titik dan hitung jaraknya dengan lokasi user (dalam meter)
        const checkQuery = `
            SELECT created_by,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points 
            WHERE id = $3
        `;
        // PostGIS: ST_MakePoint(Longitude, Latitude)
        const checkResult = await pool.query(checkQuery, [user_lng, user_lat, id]);

        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: "Titik bantuan tidak ditemukan" });
        }

        const { created_by, distance_meters } = checkResult.rows[0];

        // Verifikasi Kepemilikan
        if (created_by !== userId) {
            return res.status(403).json({ error: "Akses ditolak. Hanya pembuat yang dapat mengubah status" });
        }

        // Verifikasi Geo-Fencing (Radius Maksimal 100 Meter)
        if (distance_meters > 100) {
            return res.status(403).json({ 
                error: `Geo-Fencing gagal. Anda berada ${Math.round(distance_meters)} meter dari lokasi. Jarak maksimal adalah 100 meter.` 
            });
        }

        // Update Status
        const updateQuery = `
            UPDATE donation_points 
            SET status = $1 
            WHERE id = $2 
            RETURNING id, title, status
        `;
        const updateResult = await pool.query(updateQuery, [status, id]);

        res.status(200).json({
            message: "Status bantuan berhasil diperbarui",
            data: updateResult.rows[0]
        });

    } catch (error) {
        console.error("Error Update Status:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};