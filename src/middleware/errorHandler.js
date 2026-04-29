import pool from '../config/db.js';

export const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url} —`, err.message);

    // Multer: file terlalu besar
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran file terlalu besar. Maksimal 5 MB.' });
    }

    // Multer: error lainnya
    if (err.name === 'MulterError') {
        return res.status(400).json({ error: err.message });
    }

    // JWT kadaluarsa / tidak valid
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token sudah kadaluarsa, silakan login ulang.' });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token tidak valid.' });
    }

    // CORS
    if (err.message && err.message.includes('tidak diizinkan oleh CORS')) {
        return res.status(403).json({ error: err.message });
    }

    // Sembunyikan detail error di production
    const isProd = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
        error: isProd ? 'Terjadi kesalahan pada server.' : err.message,
    });
};

// Health check — cek koneksi DB sekaligus
export const healthCheck = async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({
            status:   'ok',
            database: 'connected',
            uptime:   Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    } catch {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
};
