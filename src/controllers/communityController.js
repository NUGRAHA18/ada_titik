import path from 'path';
import pool from '../config/db.js';
import supabase from '../config/supabase.js';
import { createNotification, createNotificationsBulk, NOTIF_TYPE } from '../services/notificationService.js';

const POST_IMAGE_BUCKET = 'community-posts';

const VALID_TABS       = ['terbaru', 'populer', 'diskusi'];
const DISCUSSION_TYPES = ['bantuanDibutuhkan', 'pertanyaan'];
const VALID_POST_TYPES = ['bantuanDibutuhkan', 'pertanyaan', 'updateKomunitas', 'inspirasi', 'kisahSukses'];

export const getPosts = async (req, res) => {
    const tab   = VALID_TABS.includes(req.query.tab) ? req.query.tab : 'terbaru';
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const viewerId = req.user?.userId || null;

    let orderBy   = 'p.created_at DESC';
    const conditions = [];
    const values     = [];
    let idx = 1;

    if (tab === 'populer') {
        orderBy = 'p.likes_count DESC, p.created_at DESC';
    } else if (tab === 'diskusi') {
        conditions.push(`p.post_type = ANY($${idx++})`);
        values.push(DISCUSSION_TYPES);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const viewerIdx = idx++;
    values.push(viewerId);

    const limitIdx  = idx++;
    const offsetIdx = idx;
    values.push(limit, offset);

    try {
        const result = await pool.query(`
            SELECT p.id, p.content, p.post_type, p.image_url, p.likes_count, p.created_at,
                   u.id   AS author_id,
                   u.name AS author_name,
                   u.avatar_url AS author_avatar,
                   u.role AS author_role,
                   (SELECT COUNT(*)::int FROM community_comments c WHERE c.post_id = p.id) AS comments_count,
                   ($${viewerIdx}::uuid IS NOT NULL AND EXISTS (
                       SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $${viewerIdx}::uuid
                   )) AS liked_by_me,
                   COUNT(*) OVER() AS total_count
            FROM community_posts p
            JOIN users u ON p.author_id = u.id
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `, values);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get Community Posts:", error);
        res.status(500).json({ error: "Gagal mengambil daftar postingan" });
    }
};

/**
 * POST /api/community/posts/image (multipart, field name: "image")
 * Upload gambar ke bucket Supabase `community-posts`, return image_url publik.
 * FE lalu mengirim image_url tersebut ke POST /api/community/posts.
 *
 * Dipisah dari createPost supaya FE bisa preview gambar dulu sebelum publish,
 * dan supaya endpoint create post tetap JSON murni (lebih mudah ditest).
 */
export const uploadPostImage = async (req, res) => {
    const { userId } = req.user;

    if (!req.file) {
        return res.status(400).json({ error: 'File gambar wajib diunggah (field "image")' });
    }

    let uploadedPath = null;
    try {
        const ext      = path.extname(req.file.originalname).toLowerCase();
        const filename = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(POST_IMAGE_BUCKET)
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (uploadError) throw uploadError;
        uploadedPath = filename;

        const { data: { publicUrl } } = supabase.storage
            .from(POST_IMAGE_BUCKET)
            .getPublicUrl(filename);

        res.status(201).json({
            message:   'Gambar berhasil diunggah',
            image_url: publicUrl,
        });
    } catch (error) {
        if (uploadedPath) {
            await supabase.storage.from(POST_IMAGE_BUCKET).remove([uploadedPath]).catch(() => {});
        }
        console.error('Error uploadPostImage:', error);
        res.status(500).json({ error: 'Gagal mengunggah gambar postingan' });
    }
};

export const createPost = async (req, res) => {
    const { userId } = req.user;
    const { content, post_type, image_url } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Konten postingan wajib diisi" });
    }

    const finalType = VALID_POST_TYPES.includes(post_type) ? post_type : 'updateKomunitas';

    try {
        const result = await pool.query(`
            INSERT INTO community_posts (author_id, content, post_type, image_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id, content, post_type, image_url, likes_count, created_at
        `, [userId, content.trim(), finalType, image_url || null]);

        res.status(201).json({ message: "Postingan berhasil dibuat", data: result.rows[0] });
    } catch (error) {
        console.error("Error Create Post:", error);
        res.status(500).json({ error: "Gagal membuat postingan" });
    }
};

export const likePost = async (req, res) => {
    const { userId } = req.user;
    const postId = parseInt(req.params.id);

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "ID post tidak valid" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const postCheck = await client.query(
            `SELECT id, author_id FROM community_posts WHERE id = $1 FOR UPDATE`,
            [postId]
        );

        if (postCheck.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Postingan tidak ditemukan" });
        }

        const authorId = postCheck.rows[0].author_id;

        const existing = await client.query(
            `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        let liked;
        if (existing.rowCount > 0) {
            await client.query(
                `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
                [postId, userId]
            );
            await client.query(
                `UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
                [postId]
            );
            liked = false;
        } else {
            await client.query(
                `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
                [postId, userId]
            );
            await client.query(
                `UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = $1`,
                [postId]
            );
            liked = true;
        }

        const updated = await client.query(
            `SELECT likes_count FROM community_posts WHERE id = $1`,
            [postId]
        );

        await client.query('COMMIT');

        // Notifikasi ke author hanya saat liked=true (jangan spam saat unlike).
        if (liked) {
            await createNotification(pool, {
                userId:  authorId,
                actorId: userId,
                type:    NOTIF_TYPE.POST_LIKED,
                title:   'Seseorang menyukai postingan Anda',
                payload: { post_id: postId },
            });
        }

        res.status(200).json({
            message:     liked ? "Postingan disukai" : "Like dibatalkan",
            liked,
            likes_count: updated.rows[0].likes_count,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error Like Post:", error);
        res.status(500).json({ error: "Gagal memproses like" });
    } finally {
        client.release();
    }
};

export const getComments = async (req, res) => {
    const postId = parseInt(req.params.id);
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "ID post tidak valid" });
    }

    try {
        const result = await pool.query(`
            SELECT c.id, c.content, c.created_at,
                   u.id   AS author_id,
                   u.name AS author_name,
                   u.avatar_url AS author_avatar,
                   u.role AS author_role,
                   COUNT(*) OVER() AS total_count
            FROM community_comments c
            JOIN users u ON c.author_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC
            LIMIT $2 OFFSET $3
        `, [postId, limit, offset]);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get Comments:", error);
        res.status(500).json({ error: "Gagal mengambil komentar" });
    }
};

export const createComment = async (req, res) => {
    const { userId } = req.user;
    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "ID post tidak valid" });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Konten komentar wajib diisi" });
    }

    try {
        const postCheck = await pool.query(
            `SELECT id, author_id FROM community_posts WHERE id = $1`,
            [postId]
        );

        if (postCheck.rowCount === 0) {
            return res.status(404).json({ error: "Postingan tidak ditemukan" });
        }

        const result = await pool.query(`
            INSERT INTO community_comments (post_id, author_id, content)
            VALUES ($1, $2, $3)
            RETURNING id, post_id, content, created_at
        `, [postId, userId, content.trim()]);

        await createNotification(pool, {
            userId:  postCheck.rows[0].author_id,
            actorId: userId,
            type:    NOTIF_TYPE.POST_COMMENTED,
            title:   'Postingan Anda dikomentari',
            body:    content.trim().slice(0, 140),
            payload: { post_id: postId, comment_id: result.rows[0].id },
        });

        res.status(201).json({ message: "Komentar berhasil ditambahkan", data: result.rows[0] });
    } catch (error) {
        console.error("Error Create Comment:", error);
        res.status(500).json({ error: "Gagal menambahkan komentar" });
    }
};

// ─── Report a community post (v7) ─────────────────────────────────────────
// Sebelumnya FE mengirim post_id ke /api/reports (FK ke donation_points) →
// FK violation / salah lapor. Sekarang post dilaporkan lewat reports.post_id.
export const reportPost = async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const { userId } = req.user;

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: 'ID postingan tidak valid' });
    }
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Alasan laporan wajib diisi' });
    }

    try {
        const post = await pool.query(
            `SELECT id, author_id FROM community_posts WHERE id = $1`,
            [postId]
        );
        if (post.rowCount === 0) {
            return res.status(404).json({ error: 'Postingan tidak ditemukan' });
        }

        const result = await pool.query(
            `INSERT INTO reports (reporter_id, post_id, reason)
             VALUES ($1, $2, $3)
             RETURNING id, status, created_at`,
            [userId, postId, reason.trim().slice(0, 1000)]
        );

        // Integrasi admin: beri tahu semua admin ada laporan postingan baru.
        try {
            const admins = await pool.query(`SELECT id FROM users WHERE role = '"admin"'`);
            if (admins.rowCount > 0) {
                await createNotificationsBulk(pool, admins.rows.map(a => ({
                    userId:  a.id,
                    actorId: userId,
                    type:    NOTIF_TYPE.REPORT_CREATED,
                    title:   'Laporan postingan masuk',
                    body:    reason.trim().slice(0, 80),
                    payload: { report_id: result.rows[0].id, post_id: postId },
                })));
            }
        } catch (e) {
            console.error('Gagal notifikasi admin (post report):', e.message);
        }

        res.status(201).json({
            message: 'Laporan postingan berhasil dikirim dan akan ditinjau Admin',
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error Report Post:', error);
        res.status(500).json({ error: 'Gagal mengirim laporan postingan' });
    }
};
