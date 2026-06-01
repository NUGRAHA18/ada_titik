import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// pg/pg-connection-string versi baru memperlakukan sslmode=require sebagai
// verify-full, yang MENOLAK rantai sertifikat self-signed Supabase
// (SELF_SIGNED_CERT_IN_CHAIN). Kita kelola SSL lewat opsi `ssl` di bawah
// (rejectUnauthorized:false), jadi buang sslmode/ssl dari connection string
// agar tidak menimpa konfigurasi tersebut.
function sanitizeConnectionString(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/, "");
  }
}

const pool = new Pool({
  connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .connect()
  .then(() => console.log("✅ Terhubung ke database Titik Baik!"))
  .catch((err) => console.error("❌ Gagal koneksi database:", err));

export default pool;