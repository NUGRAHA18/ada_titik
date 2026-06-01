import '../src/config/env.js';
import pool from '../src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
    'schema.sql',
    'migration_v2.sql',
    'migration_v3.sql',
    // BUG FIX: v4–v6 sebelumnya TIDAK terdaftar di runner, sehingga setup
    // realtime publication, donation_participants, notifications, dan RLS
    // tidak pernah diterapkan via `npm run migrate` (penyebab realtime tak
    // jalan di DB yang baru di-setup). Semuanya idempotent (pakai
    // IF [NOT] EXISTS / DROP POLICY IF EXISTS) jadi aman di-rerun.
    'migration_v4.sql',
    'migration_v5.sql',
    'migration_v6.sql',
    'migration_v7.sql',
];

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            name       VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);

    for (const file of MIGRATIONS) {
        const { rows } = await pool.query(
            'SELECT name FROM _migrations WHERE name = $1', [file]
        );
        if (rows.length > 0) {
            console.log(`⏭  ${file} — sudah diterapkan, dilewati`);
            continue;
        }

        const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
            await pool.query('COMMIT');
            console.log(`✅ ${file} — berhasil diterapkan`);
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error(`❌ ${file} — gagal:`, err.message);
            process.exit(1);
        }
    }

    await pool.end();
    console.log('Migration selesai.');
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
