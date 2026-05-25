import bcrypt from "bcrypt";
import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import { mintSupabaseToken } from "../utils/supabaseJwt.js";

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
        const query = `SELECT id, name, email, password_hash, role FROM users WHERE email = $1`;
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