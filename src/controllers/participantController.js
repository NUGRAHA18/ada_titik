import pool from '../config/db.js';
import { computeUrgency, DONATOR_POINTS_PER_COMPLETION } from '../utils/urgency.js';
import {
    createNotification,
    createNotificationsBulk,
    NOTIF_TYPE,
} from '../services/notificationService.js';

const GEOFENCE_RADIUS_METERS = 100;

const parsePointId = (req) => {
    const pointId = parseInt(req.params.pointId);
    return Number.isInteger(pointId) && pointId >= 1 ? pointId : null;
};

/**
 * Hitung ulang collected_amount, urgency, dan status dari sebuah titik
 * berdasarkan state participants. Dipanggil setelah accept/complete.
 *
 * - collected = SUM(contribution_amount) untuk state 'completed'
 * - urgency   = computeUrgency(goal, collected)
 * - status    = 'On Progress' bila ada >= 1 participant accepted/completed,
 *               'Open' kalau kosong.
 *               Status 'Completed' tetap dikelola manual (komunitas menutup titik).
 *
 * Return { collected_amount, urgency, status, urgency_changed }.
 */
const recomputePointAggregates = async (client, pointId) => {
    const before = await client.query(
        `SELECT urgency, status, goal_amount FROM donation_points WHERE id = $1 FOR UPDATE`,
        [pointId]
    );
    if (before.rowCount === 0) return null;
    const prev = before.rows[0];

    const sums = await client.query(`
        SELECT
            COALESCE(SUM(CASE WHEN state = 'completed' THEN contribution_amount END), 0) AS collected,
            COUNT(*) FILTER (WHERE state IN ('accepted','completed')) AS active_count
        FROM donation_participants
        WHERE point_id = $1
    `, [pointId]);

    const collected   = parseFloat(sums.rows[0].collected);
    const activeCount = parseInt(sums.rows[0].active_count);
    const newUrgency  = computeUrgency(prev.goal_amount, collected);

    let newStatus = prev.status;
    if (prev.status !== 'Completed') {
        newStatus = activeCount > 0 ? 'On Progress' : 'Open';
    }

    const updated = await client.query(`
        UPDATE donation_points
           SET collected_amount = $1,
               urgency          = $2,
               status           = $3
         WHERE id = $4
        RETURNING collected_amount, urgency, status
    `, [collected, newUrgency, newStatus, pointId]);

    return {
        ...updated.rows[0],
        urgency_changed: prev.urgency !== updated.rows[0].urgency,
        previous_urgency: prev.urgency,
    };
};

// ─────────────────────────────────────────────────────────────────
// 1) Donatur tekan "Berangkat" → buat row participant (state=requested)
// ─────────────────────────────────────────────────────────────────
export const signalBerangkat = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId, role } = req.user;
    if (role !== 'donatur' && role !== 'admin') {
        return res.status(403).json({ error: "Hanya donatur yang dapat menekan 'Berangkat'" });
    }

    const lat = req.body?.user_lat;
    const lng = req.body?.user_lng;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pointCheck = await client.query(
            `SELECT id, title, created_by, status, deleted_at
             FROM donation_points WHERE id = $1 FOR UPDATE`,
            [pointId]
        );
        if (pointCheck.rowCount === 0 || pointCheck.rows[0].deleted_at) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Titik bantuan tidak ditemukan' });
        }
        const point = pointCheck.rows[0];
        if (point.status === 'Completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Titik sudah Completed, tidak menerima donatur baru' });
        }

        // Upsert: kalau sudah pernah Berangkat sebelumnya (state requested/accepted/completed),
        // jangan duplicate; kembalikan row existing.
        const upsert = await client.query(`
            INSERT INTO donation_participants (point_id, donator_id, state, completed_user_lat, completed_user_lng)
            VALUES ($1, $2::uuid, 'requested', $3, $4)
            ON CONFLICT (point_id, donator_id) DO UPDATE
                SET donator_id = donation_participants.donator_id
            RETURNING id, point_id, donator_id, state, accepted_at, completed_at, created_at,
                      (xmax = 0) AS was_created
        `, [pointId, userId, lat ?? null, lng ?? null]);

        const row = upsert.rows[0];

        await client.query('COMMIT');

        if (row.was_created) {
            // Notifikasi ke owner komunitas (di luar transaction, best-effort).
            await createNotification(pool, {
                userId:  point.created_by,
                actorId: userId,
                type:    NOTIF_TYPE.DONATOR_DEPARTED,
                title:   "Donatur baru menekan 'Berangkat'",
                body:    `Titik "${point.title}" mendapat sinyal Berangkat dari seorang donatur`,
                payload: { point_id: point.id, donator_id: userId, state: 'requested' },
            });
        }

        res.status(row.was_created ? 201 : 200).json({
            message: row.was_created
                ? "Sinyal 'Berangkat' terkirim"
                : "Anda sudah menekan 'Berangkat' untuk titik ini",
            data: {
                id:           row.id,
                point_id:     row.point_id,
                donator_id:   row.donator_id,
                state:        row.state,
                accepted_at:  row.accepted_at,
                completed_at: row.completed_at,
                created_at:   row.created_at,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error signalBerangkat:', error);
        res.status(500).json({ error: "Gagal mencatat sinyal 'Berangkat'" });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// 2) Donatur batalkan "Berangkat" (sebelum di-accept).
// ─────────────────────────────────────────────────────────────────
export const cancelBerangkat = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId } = req.user;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query(`
            SELECT id, state FROM donation_participants
            WHERE point_id = $1 AND donator_id = $2::uuid
            FOR UPDATE
        `, [pointId, userId]);

        if (existing.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Partisipasi tidak ditemukan' });
        }
        if (existing.rows[0].state === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Donasi sudah selesai, tidak bisa dibatalkan' });
        }

        await client.query(
            `DELETE FROM donation_participants WHERE id = $1`,
            [existing.rows[0].id]
        );

        const point = await client.query(
            `SELECT created_by, title FROM donation_points WHERE id = $1`,
            [pointId]
        );

        const aggr = await recomputePointAggregates(client, pointId);

        await client.query('COMMIT');

        if (point.rowCount > 0) {
            await createNotification(pool, {
                userId:  point.rows[0].created_by,
                actorId: userId,
                type:    NOTIF_TYPE.DONATOR_DEPARTED,
                title:   'Seorang donatur membatalkan keberangkatan',
                body:    `Titik "${point.rows[0].title}" — donatur membatalkan sinyal Berangkat`,
                payload: { point_id: pointId, donator_id: userId, state: 'cancelled' },
            });
        }

        res.status(200).json({
            message: "Sinyal 'Berangkat' dibatalkan",
            aggregates: aggr,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cancelBerangkat:', error);
        res.status(500).json({ error: 'Gagal membatalkan keberangkatan' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// 3) Komunitas lihat list participants di titik miliknya
// ─────────────────────────────────────────────────────────────────
export const listParticipants = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId, role } = req.user;
    const stateFilter = req.query.state;
    const validStates = ['requested', 'accepted', 'completed', 'cancelled'];

    if (stateFilter && !validStates.includes(stateFilter)) {
        return res.status(400).json({ error: `state harus salah satu: ${validStates.join(', ')}` });
    }

    try {
        const point = await pool.query(
            `SELECT created_by, deleted_at FROM donation_points WHERE id = $1`,
            [pointId]
        );
        if (point.rowCount === 0 || point.rows[0].deleted_at) {
            return res.status(404).json({ error: 'Titik bantuan tidak ditemukan' });
        }
        if (role !== 'admin' && point.rows[0].created_by !== userId) {
            return res.status(403).json({ error: 'Hanya pengelola titik yang dapat melihat daftar donatur' });
        }

        const conditions = ['dp.point_id = $1'];
        const values = [pointId];
        if (stateFilter) {
            conditions.push(`dp.state = $${values.length + 1}`);
            values.push(stateFilter);
        }

        const result = await pool.query(`
            SELECT dp.id, dp.donator_id, dp.state, dp.contribution_amount,
                   dp.accepted_at, dp.completed_at, dp.created_at,
                   u.name       AS donator_name,
                   u.avatar_url AS donator_avatar
            FROM donation_participants dp
            JOIN users u ON u.id = dp.donator_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY
                CASE dp.state WHEN 'requested' THEN 0 WHEN 'accepted' THEN 1
                              WHEN 'completed' THEN 2 ELSE 3 END,
                dp.created_at DESC
        `, values);

        res.status(200).json({ count: result.rowCount, data: result.rows });
    } catch (error) {
        console.error('Error listParticipants:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar donatur' });
    }
};

// ─────────────────────────────────────────────────────────────────
// 4) Komunitas Accept (bulk) — { donator_ids: [uuid, ...] }
// ─────────────────────────────────────────────────────────────────
export const bulkAcceptParticipants = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId, role } = req.user;
    const ids = Array.isArray(req.body?.donator_ids) ? req.body.donator_ids.filter(Boolean) : [];

    if (ids.length === 0) {
        return res.status(400).json({ error: 'donator_ids wajib diisi (array UUID)' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const point = await client.query(
            `SELECT id, title, created_by, deleted_at FROM donation_points WHERE id = $1 FOR UPDATE`,
            [pointId]
        );
        if (point.rowCount === 0 || point.rows[0].deleted_at) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Titik bantuan tidak ditemukan' });
        }
        if (role !== 'admin' && point.rows[0].created_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Hanya pengelola titik yang dapat menerima donatur' });
        }

        const updated = await client.query(`
            UPDATE donation_participants
               SET state       = 'accepted',
                   accepted_at = COALESCE(accepted_at, NOW())
             WHERE point_id   = $1
               AND donator_id = ANY($2::uuid[])
               AND state      = 'requested'
            RETURNING id, donator_id
        `, [pointId, ids]);

        const aggr = await recomputePointAggregates(client, pointId);

        await client.query('COMMIT');

        // Notifikasi ke tiap donatur (best-effort, di luar transaction).
        if (updated.rowCount > 0) {
            await createNotificationsBulk(pool, updated.rows.map(r => ({
                userId:  r.donator_id,
                actorId: userId,
                type:    NOTIF_TYPE.PARTICIPANT_ACCEPTED,
                title:   'Komunitas menerima keberangkatan Anda',
                body:    `Titik "${point.rows[0].title}" — Anda di-accept oleh komunitas`,
                payload: { point_id: pointId, participant_id: r.id, state: 'accepted' },
            })));
        }

        res.status(200).json({
            message:        `${updated.rowCount} donatur ditandai accepted`,
            accepted_count: updated.rowCount,
            aggregates:     aggr,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulkAcceptParticipants:', error);
        res.status(500).json({ error: 'Gagal menerima donatur' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// 5) Komunitas Complete (bulk) — { donator_ids, user_lat, user_lng, per_donator_amount? }
//    Geo-fencing wajib ≤ 100 m dari titik.
//    Trigger: progress update, urgency recompute, poin donatur,
//    notifikasi ke tiap donatur.
// ─────────────────────────────────────────────────────────────────
export const bulkCompleteParticipants = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId, role } = req.user;
    const ids = Array.isArray(req.body?.donator_ids) ? req.body.donator_ids.filter(Boolean) : [];
    const userLat = req.body?.user_lat;
    const userLng = req.body?.user_lng;
    const perDonatorAmount = parseFloat(req.body?.per_donator_amount) || 0;

    if (ids.length === 0) {
        return res.status(400).json({ error: 'donator_ids wajib diisi (array UUID)' });
    }
    if (userLat === undefined || userLng === undefined) {
        return res.status(400).json({ error: 'user_lat dan user_lng wajib diisi untuk geo-fencing' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const point = await client.query(`
            SELECT id, title, created_by, deleted_at,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM donation_points WHERE id = $3 FOR UPDATE
        `, [userLng, userLat, pointId]);

        if (point.rowCount === 0 || point.rows[0].deleted_at) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Titik bantuan tidak ditemukan' });
        }
        if (role !== 'admin' && point.rows[0].created_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Hanya pengelola titik yang dapat menyelesaikan donasi' });
        }
        if (point.rows[0].distance_meters > GEOFENCE_RADIUS_METERS) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: `Geo-fencing gagal. Jarak Anda: ${Math.round(point.rows[0].distance_meters)}m (maks ${GEOFENCE_RADIUS_METERS}m)`,
            });
        }

        // Hanya boleh complete dari state 'accepted'.
        const updated = await client.query(`
            UPDATE donation_participants
               SET state              = 'completed',
                   completed_at       = NOW(),
                   completed_user_lat = $3,
                   completed_user_lng = $4,
                   contribution_amount = CASE WHEN $5::numeric > 0 THEN $5::numeric ELSE contribution_amount END
             WHERE point_id   = $1
               AND donator_id = ANY($2::uuid[])
               AND state      = 'accepted'
            RETURNING id, donator_id, contribution_amount
        `, [pointId, ids, userLat, userLng, perDonatorAmount]);

        // Pemberian poin donatur + audit log.
        if (updated.rowCount > 0) {
            const donatorIds = updated.rows.map(r => r.donator_id);
            await client.query(`
                UPDATE users SET points = points + $1
                 WHERE id = ANY($2::uuid[])
            `, [DONATOR_POINTS_PER_COMPLETION, donatorIds]);

            // Log per donatur.
            const logValues = [];
            const logPlaceholders = donatorIds.map((id, i) => {
                const base = i * 4;
                logValues.push(id, pointId, DONATOR_POINTS_PER_COMPLETION, 'participant_completed');
                return `($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4})`;
            });
            await client.query(
                `INSERT INTO donator_points_log (donator_id, point_id, delta, reason)
                 VALUES ${logPlaceholders.join(', ')}`,
                logValues
            );
        }

        const aggr = await recomputePointAggregates(client, pointId);

        await client.query('COMMIT');

        // Notifikasi (best-effort).
        if (updated.rowCount > 0) {
            await createNotificationsBulk(pool, updated.rows.map(r => ({
                userId:  r.donator_id,
                actorId: userId,
                type:    NOTIF_TYPE.PARTICIPANT_COMPLETED,
                title:   'Donasi Anda telah selesai dikonfirmasi',
                body:    `Selamat, Anda mendapatkan +${DONATOR_POINTS_PER_COMPLETION} Poin Donatur dari "${point.rows[0].title}"`,
                payload: {
                    point_id:       pointId,
                    participant_id: r.id,
                    state:          'completed',
                    points_awarded: DONATOR_POINTS_PER_COMPLETION,
                },
            })));

            // Notifikasi urgency_changed ke semua participant aktif jika ada perubahan.
            if (aggr?.urgency_changed) {
                const activeParticipants = await pool.query(`
                    SELECT donator_id FROM donation_participants
                    WHERE point_id = $1 AND state IN ('requested','accepted','completed')
                `, [pointId]);

                await createNotificationsBulk(pool, activeParticipants.rows.map(r => ({
                    userId:  r.donator_id,
                    actorId: userId,
                    type:    NOTIF_TYPE.URGENCY_CHANGED,
                    title:   `Urgensi titik berubah: ${aggr.previous_urgency} → ${aggr.urgency}`,
                    body:    `Titik "${point.rows[0].title}" sekarang berstatus ${aggr.urgency}`,
                    payload: {
                        point_id:    pointId,
                        from_urgency: aggr.previous_urgency,
                        to_urgency:   aggr.urgency,
                    },
                })));
            }
        }

        res.status(200).json({
            message:         `${updated.rowCount} donasi ditandai selesai`,
            completed_count: updated.rowCount,
            points_awarded_each: DONATOR_POINTS_PER_COMPLETION,
            aggregates:      aggr,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulkCompleteParticipants:', error);
        res.status(500).json({ error: 'Gagal menyelesaikan donasi' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// 6) Komunitas update progress manual (collected_amount).
//    Memicu recompute urgency + notifikasi ke partisipan.
// ─────────────────────────────────────────────────────────────────
export const updateProgress = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId, role } = req.user;
    const goalAmount      = req.body?.goal_amount;
    const collectedAmount = req.body?.collected_amount;

    if (goalAmount === undefined && collectedAmount === undefined) {
        return res.status(400).json({ error: 'Minimal salah satu dari goal_amount / collected_amount wajib diisi' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const point = await client.query(
            `SELECT id, title, created_by, urgency, goal_amount, collected_amount, deleted_at
             FROM donation_points WHERE id = $1 FOR UPDATE`,
            [pointId]
        );
        if (point.rowCount === 0 || point.rows[0].deleted_at) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Titik bantuan tidak ditemukan' });
        }
        if (role !== 'admin' && point.rows[0].created_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Hanya pengelola titik yang dapat mengubah progres' });
        }

        const newGoal      = goalAmount      !== undefined ? parseFloat(goalAmount)      : parseFloat(point.rows[0].goal_amount);
        const newCollected = collectedAmount !== undefined ? parseFloat(collectedAmount) : parseFloat(point.rows[0].collected_amount);

        if (Number.isNaN(newGoal) || Number.isNaN(newCollected) || newGoal < 0 || newCollected < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'goal_amount / collected_amount harus angka >= 0' });
        }

        const newUrgency = computeUrgency(newGoal, newCollected);
        const previousUrgency = point.rows[0].urgency;

        const updated = await client.query(`
            UPDATE donation_points
               SET goal_amount      = $1,
                   collected_amount = $2,
                   urgency          = $3
             WHERE id = $4
            RETURNING id, goal_amount, collected_amount, urgency, status
        `, [newGoal, newCollected, newUrgency, pointId]);

        await client.query('COMMIT');

        // Notifikasi ke semua participant aktif kalau progress / urgency berubah.
        const participants = await pool.query(`
            SELECT donator_id FROM donation_participants
            WHERE point_id = $1 AND state IN ('requested','accepted','completed')
        `, [pointId]);

        await createNotificationsBulk(pool, participants.rows.map(r => ({
            userId:  r.donator_id,
            actorId: userId,
            type:    NOTIF_TYPE.PROGRESS_UPDATED,
            title:   'Progres titik diperbarui',
            body:    `"${point.rows[0].title}" — ${newCollected}/${newGoal}`,
            payload: {
                point_id:         pointId,
                goal_amount:      newGoal,
                collected_amount: newCollected,
            },
        })));

        if (previousUrgency !== newUrgency) {
            await createNotificationsBulk(pool, participants.rows.map(r => ({
                userId:  r.donator_id,
                actorId: userId,
                type:    NOTIF_TYPE.URGENCY_CHANGED,
                title:   `Urgensi titik berubah: ${previousUrgency} → ${newUrgency}`,
                body:    `Titik "${point.rows[0].title}" sekarang berstatus ${newUrgency}`,
                payload: {
                    point_id:     pointId,
                    from_urgency: previousUrgency,
                    to_urgency:   newUrgency,
                },
            })));
        }

        res.status(200).json({
            message: 'Progres dan urgensi diperbarui',
            data: updated.rows[0],
            urgency_changed: previousUrgency !== newUrgency,
            previous_urgency: previousUrgency,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updateProgress:', error);
        res.status(500).json({ error: 'Gagal memperbarui progres' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// 7) Donatur cek partisipasi sendiri di sebuah titik (untuk UI)
// ─────────────────────────────────────────────────────────────────
export const getMyParticipation = async (req, res) => {
    const pointId = parsePointId(req);
    if (!pointId) return res.status(400).json({ error: 'ID titik tidak valid' });

    const { userId } = req.user;
    try {
        const result = await pool.query(`
            SELECT id, point_id, donator_id, state, contribution_amount,
                   accepted_at, completed_at, created_at
            FROM donation_participants
            WHERE point_id = $1 AND donator_id = $2::uuid
        `, [pointId, userId]);

        if (result.rowCount === 0) {
            return res.status(200).json({ data: null });
        }
        res.status(200).json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error getMyParticipation:', error);
        res.status(500).json({ error: 'Gagal mengambil partisipasi' });
    }
};
