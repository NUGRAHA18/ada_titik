import pool from '../config/db.js';

const VALID_CONTEXT_TYPES = ['post', 'donation_point'];

// Normalisasi pasangan UUID: (smaller, larger) sesuai CHECK constraint user_a_id < user_b_id.
const orderedPair = (uuid1, uuid2) => (uuid1 < uuid2 ? [uuid1, uuid2] : [uuid2, uuid1]);

// Pastikan req.user.userId adalah salah satu peserta percakapan.
const loadConversationForUser = async (conversationId, userId) => {
    const result = await pool.query(
        `SELECT id, user_a_id, user_b_id, context_type, context_id, last_message_at, created_at
         FROM chat_conversations
         WHERE id = $1 AND ($2::uuid IN (user_a_id, user_b_id))`,
        [conversationId, userId]
    );
    return result.rows[0] || null;
};

export const listConversations = async (req, res) => {
    const { userId } = req.user;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(`
            SELECT c.id,
                   c.context_type,
                   c.context_id,
                   c.created_at,
                   COALESCE(c.last_message_at, c.created_at) AS last_activity_at,
                   CASE WHEN c.user_a_id = $1::uuid THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
                   other.name       AS other_user_name,
                   other.avatar_url AS other_user_avatar,
                   other.role       AS other_user_role,
                   last_msg.id        AS last_message_id,
                   last_msg.body      AS last_message_body,
                   last_msg.sender_id AS last_message_sender_id,
                   last_msg.created_at AS last_message_at,
                   (SELECT COUNT(*)::int FROM chat_messages m
                    WHERE m.conversation_id = c.id
                      AND m.sender_id <> $1::uuid
                      AND m.read_at IS NULL) AS unread_count,
                   COUNT(*) OVER() AS total_count
            FROM chat_conversations c
            JOIN users other
              ON other.id = (CASE WHEN c.user_a_id = $1::uuid THEN c.user_b_id ELSE c.user_a_id END)
            LEFT JOIN LATERAL (
                SELECT id, body, sender_id, created_at
                FROM chat_messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
            ) last_msg ON true
            WHERE c.user_a_id = $1::uuid OR c.user_b_id = $1::uuid
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error('Error List Conversations:', error);
        res.status(500).json({ error: 'Gagal mengambil daftar percakapan' });
    }
};

export const startConversation = async (req, res) => {
    const { userId } = req.user;
    const { target_user_id, context_type, context_id } = req.body;

    if (target_user_id === userId) {
        return res.status(400).json({ error: 'Tidak bisa memulai chat dengan diri sendiri' });
    }

    const ctxType = VALID_CONTEXT_TYPES.includes(context_type) ? context_type : null;
    const ctxId   = ctxType && Number.isInteger(parseInt(context_id)) ? parseInt(context_id) : null;
    if (ctxType && !ctxId) {
        return res.status(400).json({ error: 'context_id wajib diisi jika context_type diisi' });
    }

    try {
        const targetCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1::uuid`,
            [target_user_id]
        );
        if (targetCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Pengguna target tidak ditemukan' });
        }

        const [userA, userB] = orderedPair(userId, target_user_id);

        // Upsert idempotent: kalau pasangan sudah ada, ambil yang lama.
        // ON CONFLICT DO UPDATE dipakai (bukan DO NOTHING) supaya RETURNING tetap mengembalikan row.
        // (xmax = 0) → true kalau baru di-INSERT, false kalau ambil yang lama.
        const result = await pool.query(`
            INSERT INTO chat_conversations (user_a_id, user_b_id, context_type, context_id)
            VALUES ($1::uuid, $2::uuid, $3, $4)
            ON CONFLICT (user_a_id, user_b_id) DO UPDATE
                SET user_a_id = chat_conversations.user_a_id
            RETURNING id, user_a_id, user_b_id, context_type, context_id, created_at,
                      (xmax = 0) AS was_created
        `, [userA, userB, ctxType, ctxId]);

        const row = result.rows[0];
        res.status(row.was_created ? 201 : 200).json({
            message: row.was_created ? 'Percakapan dibuat' : 'Percakapan sudah ada',
            data: {
                id:           row.id,
                user_a_id:    row.user_a_id,
                user_b_id:    row.user_b_id,
                context_type: row.context_type,
                context_id:   row.context_id,
                created_at:   row.created_at,
            },
        });
    } catch (error) {
        console.error('Error Start Conversation:', error);
        res.status(500).json({ error: 'Gagal memulai percakapan' });
    }
};

export const listMessages = async (req, res) => {
    const { userId } = req.user;
    const conversationId = parseInt(req.params.id);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const before = req.query.before ? parseInt(req.query.before) : null;

    if (!Number.isInteger(conversationId) || conversationId < 1) {
        return res.status(400).json({ error: 'ID percakapan tidak valid' });
    }

    try {
        const conv = await loadConversationForUser(conversationId, userId);
        if (!conv) {
            return res.status(404).json({ error: 'Percakapan tidak ditemukan' });
        }

        const result = await pool.query(`
            SELECT id, conversation_id, sender_id, body, read_at, created_at
            FROM chat_messages
            WHERE conversation_id = $1
              AND ($2::int IS NULL OR id < $2::int)
            ORDER BY id DESC
            LIMIT $3
        `, [conversationId, before, limit]);

        // Urut ASC (lama → baru) di response biar enak dirender chronologically.
        const data = result.rows.slice().reverse();
        const nextCursor = result.rows.length === limit ? result.rows[result.rows.length - 1].id : null;

        res.status(200).json({
            pagination: { limit, next_cursor: nextCursor, has_more: nextCursor !== null },
            data,
        });
    } catch (error) {
        console.error('Error List Messages:', error);
        res.status(500).json({ error: 'Gagal mengambil pesan' });
    }
};

export const sendMessage = async (req, res) => {
    const { userId } = req.user;
    const conversationId = parseInt(req.params.id);
    const { body } = req.body;

    if (!Number.isInteger(conversationId) || conversationId < 1) {
        return res.status(400).json({ error: 'ID percakapan tidak valid' });
    }

    try {
        const conv = await loadConversationForUser(conversationId, userId);
        if (!conv) {
            return res.status(404).json({ error: 'Percakapan tidak ditemukan' });
        }

        const result = await pool.query(`
            INSERT INTO chat_messages (conversation_id, sender_id, body)
            VALUES ($1, $2::uuid, $3)
            RETURNING id, conversation_id, sender_id, body, read_at, created_at
        `, [conversationId, userId, body.trim()]);

        res.status(201).json({ message: 'Pesan terkirim', data: result.rows[0] });
    } catch (error) {
        console.error('Error Send Message:', error);
        res.status(500).json({ error: 'Gagal mengirim pesan' });
    }
};

export const markAsRead = async (req, res) => {
    const { userId } = req.user;
    const conversationId = parseInt(req.params.id);

    if (!Number.isInteger(conversationId) || conversationId < 1) {
        return res.status(400).json({ error: 'ID percakapan tidak valid' });
    }

    try {
        const conv = await loadConversationForUser(conversationId, userId);
        if (!conv) {
            return res.status(404).json({ error: 'Percakapan tidak ditemukan' });
        }

        const result = await pool.query(`
            UPDATE chat_messages
               SET read_at = NOW()
             WHERE conversation_id = $1
               AND sender_id <> $2::uuid
               AND read_at IS NULL
            RETURNING id
        `, [conversationId, userId]);

        res.status(200).json({
            message: 'Pesan ditandai sudah dibaca',
            marked_count: result.rowCount,
        });
    } catch (error) {
        console.error('Error Mark As Read:', error);
        res.status(500).json({ error: 'Gagal menandai pesan' });
    }
};
