import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { mintSupabaseToken } from "../utils/supabaseJwt.js";

// Token plaintext panjang 48 byte → 64 char base64url. Hash sha256.
const RESET_TOKEN_BYTES   = 48;
const RESET_TOKEN_TTL_MIN = 60;

const hashToken = (plain) => crypto.createHash('sha256').update(plain).digest('hex');

// Pesan generik anti email-enumeration. Selalu dikembalikan dari /forgot-password
// terlepas dari email terdaftar atau tidak.
const GENERIC_RESET_RESPONSE = {
    success: true,
    message: 'Jika email terdaftar, instruksi reset password telah dikirim',
};

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Semua field harus diisi" });
  }

  if (role !== "donatur" && role !== "komunitas") {
    return res
      .status(400)
      .json({ error: "Role harus 'donatur' atau 'komunitas'" });
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const query = `
            INSERT INTO users (name, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;
    const values = [name, email, passwordHash, role];

    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Registrasi berhasil",
      userId: result.rows[0].id,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    console.error("Error Registrasi:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server" });
  }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // LOWER(...) supaya konsisten dengan registrasi yang menormalisasi email
        // ke huruf kecil (registerRules.normalizeEmail). Tanpa ini, user yang
        // daftar "User@x.com" lalu login "user@x.com" akan gagal.
        const query = `SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = LOWER($1)`;
        const result = await pool.query(query, [email]);

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Email atau password salah" });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Email atau password salah" });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        let supabaseToken = null;
        try {
            supabaseToken = mintSupabaseToken(user.id);
        } catch (e) {
            console.warn('Supabase token tidak dibuat:', e.message);
        }

        res.status(200).json({
            message: "Login berhasil",
            token: token,
            supabase_token: supabaseToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Error saat login:", error);
        res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Selalu return 200 dengan pesan generik supaya tidak bisa dipakai
 * email-enumeration. Token plaintext hanya disertakan di response saat
 * `process.env.RESET_TOKEN_IN_RESPONSE === 'true'` (untuk dev / testing
 * karena belum ada email service di project ini).
 */
export const requestPasswordReset = async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, error: 'Email wajib diisi' });

    try {
        const userResult = await pool.query(
            `SELECT id FROM users WHERE LOWER(email) = $1`,
            [email]
        );

        if (userResult.rowCount === 0) {
            // Sengaja sleep singkat supaya timing-attack lebih sulit.
            await new Promise(r => setTimeout(r, 80));
            return res.status(200).json(GENERIC_RESET_RESPONSE);
        }

        const userId      = userResult.rows[0].id;
        const tokenPlain  = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
        const tokenHash   = hashToken(tokenPlain);
        const expiresAt   = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

        // Invalidate token sebelumnya yang masih aktif, lalu insert yang baru.
        await pool.query(
            `UPDATE password_reset_tokens
                SET used_at = NOW()
              WHERE user_id = $1::uuid AND used_at IS NULL`,
            [userId]
        );
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1::uuid, $2, $3)`,
            [userId, tokenHash, expiresAt]
        );

        // TODO: integrasi dengan email service (SendGrid / Mailgun / SES).
        // JANGAN log token plaintext di production (bocor lewat agregasi log).
        // Hanya tampilkan di development untuk keperluan testing.
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[password-reset] user=${userId} token=${tokenPlain} expires=${expiresAt.toISOString()}`);
        }

        const payload = { ...GENERIC_RESET_RESPONSE };
        if (process.env.RESET_TOKEN_IN_RESPONSE === 'true') {
            payload.dev_reset_token = tokenPlain;
            payload.expires_at      = expiresAt.toISOString();
        }
        return res.status(200).json(payload);
    } catch (error) {
        console.error('Error requestPasswordReset:', error);
        return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server' });
    }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 *
 * Token plaintext dicari berdasarkan hash, harus belum dipakai,
 * belum expired. Setelah sukses, token ditandai used dan password user
 * di-update (bcrypt rehash).
 */
export const resetPassword = async (req, res) => {
    const token       = (req.body?.token || '').trim();
    const newPassword = req.body?.new_password;

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'token dan new_password wajib diisi' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'new_password minimal 8 karakter' });
    }

    const tokenHash = hashToken(token);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tokenRow = await client.query(`
            SELECT id, user_id, expires_at, used_at
            FROM password_reset_tokens
            WHERE token_hash = $1
            FOR UPDATE
        `, [tokenHash]);

        if (tokenRow.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Token tidak valid' });
        }
        const row = tokenRow.rows[0];
        if (row.used_at) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Token sudah digunakan' });
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Token sudah kadaluarsa' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await client.query(
            `UPDATE users SET password_hash = $1 WHERE id = $2::uuid`,
            [passwordHash, row.user_id]
        );
        await client.query(
            `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
            [row.id]
        );
        // Invalidate token aktif lain milik user yang sama.
        await client.query(
            `UPDATE password_reset_tokens
                SET used_at = NOW()
              WHERE user_id = $1::uuid AND used_at IS NULL`,
            [row.user_id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ success: true, message: 'Password berhasil direset' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error resetPassword:', error);
        return res.status(500).json({ success: false, error: 'Terjadi kesalahan pada server' });
    } finally {
        client.release();
    }
};

// Refresh Supabase token (dipanggil Flutter kalau token lama hampir expired).
// Auth dengan JWT aplikasi (verifyToken di router).
export const refreshSupabaseToken = (req, res) => {
    try {
        const { userId } = req.user;
        const supabaseToken = mintSupabaseToken(userId);
        res.status(200).json({ supabase_token: supabaseToken });
    } catch (e) {
        console.error('Error refresh Supabase token:', e);
        res.status(500).json({ error: 'Gagal membuat Supabase token' });
    }
};