import dotenv from 'dotenv';

// Load .env sesuai NODE_ENV, fallback ke .env
// Harus diimport SEBELUM modul lain yang butuh process.env (misal db.js)
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: envFile });
dotenv.config(); // fallback ke .env jika file spesifik tidak ada
