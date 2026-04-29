import '../src/config/env.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcrypt';

async function seed() {
    console.log('🌱 Memulai seed data...');

    const hash = await bcrypt.hash('password123', 10);

    // Hapus data lama (urutan penting: FK constraints)
    await pool.query('DELETE FROM reports');
    await pool.query('DELETE FROM ratings');
    await pool.query('DELETE FROM documentation');
    await pool.query('DELETE FROM donation_points');
    await pool.query('DELETE FROM users');

    // Insert users
    const { rows: users } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role) VALUES
        ($1, $2, $3, 'admin'),
        ($4, $5, $6, 'komunitas'),
        ($7, $8, $9, 'donatur')
        RETURNING id, role
    `, [
        'Admin Sistem',          'admin@titikbaik.id',        hash,
        'Komunitas Peduli Yogya','komunitas@example.com',     hash,
        'Budi Santoso',          'donatur@example.com',       hash,
    ]);

    const komunitasId = users.find(u => u.role === 'komunitas').id;
    const donaturId   = users.find(u => u.role === 'donatur').id;

    // Insert donation points (sekitar Yogyakarta)
    const { rows: points } = await pool.query(`
        INSERT INTO donation_points (created_by, title, description, location, urgency, status) VALUES
        ($1, 'Korban Banjir Kali Code',
             'Warga membutuhkan sembako dan pakaian bersih pasca banjir. Sekitar 50 KK terdampak.',
             ST_SetSRID(ST_MakePoint(110.3695, -7.7956), 4326), 'Mendesak', 'Open'),
        ($1, 'Lansia Sebatang Kara Mrican',
             'Nenek 78 tahun tinggal sendirian, membutuhkan bantuan bahan pangan rutin.',
             ST_SetSRID(ST_MakePoint(110.3821, -7.7699), 4326), 'Normal', 'Open'),
        ($1, 'Anak Yatim Piatu Nitikan',
             'Panti asuhan kecil menampung 15 anak, membutuhkan bantuan operasional bulanan.',
             ST_SetSRID(ST_MakePoint(110.3714, -7.8189), 4326), 'Normal', 'On Progress'),
        ($1, 'Petani Gagal Panen Sleman',
             'Kelompok petani terdampak kekeringan, butuh bibit dan pupuk.',
             ST_SetSRID(ST_MakePoint(110.3548, -7.7321), 4326), 'Rendah', 'Completed')
        RETURNING id
    `, [komunitasId]);

    // Sample rating dari donatur untuk titik ke-3 (status Completed)
    await pool.query(`
        INSERT INTO ratings (point_id, given_by, score, review) VALUES ($1, $2, 4, 'Bantuan tepat sasaran, distribusi berjalan lancar.')
    `, [points[2].id, donaturId]);

    console.log('✅ Seed selesai!');
    console.log('');
    console.log('Akun tersedia (password: password123):');
    console.log('  admin@titikbaik.id        → admin');
    console.log('  komunitas@example.com     → komunitas');
    console.log('  donatur@example.com       → donatur');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed gagal:', err.message);
    process.exit(1);
});
