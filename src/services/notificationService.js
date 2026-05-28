import pool from '../config/db.js';

// Daftar tipe notifikasi yang dipakai sistem.
// Tambahkan tipe baru di sini supaya gampang dicari & disepakati dgn FE.
export const NOTIF_TYPE = Object.freeze({
    // donasi
    DONATOR_DEPARTED:        'donator_departed',         // → owner komunitas
    PARTICIPANT_ACCEPTED:    'participant_accepted',     // → donatur
    PARTICIPANT_COMPLETED:   'participant_completed',    // → donatur (+ poin)
    PROGRESS_UPDATED:        'progress_updated',         // → donatur partisipan
    URGENCY_CHANGED:         'urgency_changed',          // → donatur partisipan
    // komunitas / sosial
    POST_LIKED:              'post_liked',               // → author post
    POST_COMMENTED:          'post_commented',           // → author post
});

// Jalankan via client (di tengah transaction) atau pool langsung.
const exec = (clientOrPool) => clientOrPool || pool;

/**
 * Tulis 1 notifikasi ke DB.
 * Tidak melempar error ke pemanggil — kegagalan notifikasi
 * tidak boleh meng-rollback aksi utama (like / accept / dst).
 */
export const createNotification = async (
    runner,
    { userId, actorId = null, type, title, body = null, payload = {} }
) => {
    if (!userId || userId === actorId) return null; // jangan notif diri sendiri
    try {
        const result = await exec(runner).query(`
            INSERT INTO notifications (user_id, actor_id, type, title, body, payload)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
            RETURNING id, user_id, actor_id, type, title, body, payload, read_at, created_at
        `, [userId, actorId, type, title, body, JSON.stringify(payload)]);
        return result.rows[0];
    } catch (error) {
        console.error('createNotification failed:', { type, userId, error: error.message });
        return null;
    }
};

/** Bulk: 1 query INSERT untuk banyak penerima sekaligus. */
export const createNotificationsBulk = async (runner, rows) => {
    const filtered = rows.filter(r => r.userId && r.userId !== r.actorId);
    if (filtered.length === 0) return [];

    const values = [];
    const placeholders = filtered.map((r, i) => {
        const base = i * 6;
        values.push(
            r.userId,
            r.actorId || null,
            r.type,
            r.title,
            r.body || null,
            JSON.stringify(r.payload || {}),
        );
        return `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb)`;
    });

    try {
        const result = await exec(runner).query(
            `INSERT INTO notifications (user_id, actor_id, type, title, body, payload)
             VALUES ${placeholders.join(', ')}
             RETURNING id, user_id, type, created_at`,
            values
        );
        return result.rows;
    } catch (error) {
        console.error('createNotificationsBulk failed:', { count: filtered.length, error: error.message });
        return [];
    }
};
