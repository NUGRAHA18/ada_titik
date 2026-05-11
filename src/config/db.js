import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV !== "test" ? { rejectUnauthorized: false } : false,
});

pool
  .connect()
  .then(() => console.log("✅ Terhubung ke database Titik Baik!"))
  .catch((err) => console.error("❌ Gagal koneksi database:", err));

export default pool;