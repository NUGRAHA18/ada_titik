import pool from '../config/db.js';

const parsePagination = (req) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

export const getMyPosts = async (req, res) => {
    const { userId } = req.user;
    const { page, limit, offset } = parsePagination(req);

    try {
        const result = await pool.query(`
            SELECT p.id, p.content, p.post_type, p.image_url, p.likes_count, p.created_at,
                   (SELECT COUNT(*)::int FROM community_comments c WHERE c.post_id = p.id) AS comments_count,
                   EXISTS (
                       SELECT 1 FROM post_likes pl
                       WHERE pl.post_id = p.id AND pl.user_id = $1::uuid
                   ) AS liked_by_me,
                   COUNT(*) OVER() AS total_count
            FROM community_posts p
            WHERE p.author_id = $1::uuid
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data: result.rows.map(({ total_count, ...row }) => row),
        });
    } catch (error) {
        console.error("Error Get My Posts:", error);
        res.status(500).json({ error: "Gagal mengambil daftar postingan Anda" });
    }
};

export const getMyLikes = async (req, res) => {
    const { userId } = req.user;
    const { page, limit, offset } = parsePagination(req);

    try {
        const result = await pool.query(`
            SELECT pl.post_id,
                   pl.created_at AS created_at,
                   p.content        AS post_content,
                   p.post_type      AS post_type,
                   p.image_url      AS post_image_url,
                   p.likes_count    AS post_likes_count,
                   p.created_at     AS post_created_at,
                   u.id             AS post_author_id,
                   u.name           AS post_author_name,
                   u.avatar_url     AS post_author_avatar,
                   u.role           AS post_author_role,
                   (SELECT COUNT(*)::int FROM community_comments c WHERE c.post_id = p.id) AS post_comments_count,
                   COUNT(*) OVER() AS total_count
            FROM post_likes pl
            JOIN community_posts p ON p.id = pl.post_id
            JOIN users u          ON u.id = p.author_id
            WHERE pl.user_id = $1::uuid
            ORDER BY pl.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        const data = result.rows.map(r => ({
            post_id:    r.post_id,
            created_at: r.created_at,
            post_snapshot: {
                content:        r.post_content,
                post_type:      r.post_type,
                image_url:      r.post_image_url,
                likes_count:    r.post_likes_count,
                comments_count: r.post_comments_count,
                author_id:      r.post_author_id,
                author_name:    r.post_author_name,
                author_avatar:  r.post_author_avatar,
                author_role:    r.post_author_role,
                created_at:     r.post_created_at,
            },
        }));

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data,
        });
    } catch (error) {
        console.error("Error Get My Likes:", error);
        res.status(500).json({ error: "Gagal mengambil daftar like Anda" });
    }
};

export const getMyComments = async (req, res) => {
    const { userId } = req.user;
    const { page, limit, offset } = parsePagination(req);

    try {
        const result = await pool.query(`
            SELECT c.id          AS comment_id,
                   c.post_id     AS post_id,
                   c.content     AS content,
                   c.created_at  AS created_at,
                   p.content     AS post_content,
                   p.post_type   AS post_type,
                   p.image_url   AS post_image_url,
                   u.id          AS post_author_id,
                   u.name        AS post_author_name,
                   u.avatar_url  AS post_author_avatar,
                   u.role        AS post_author_role,
                   COUNT(*) OVER() AS total_count
            FROM community_comments c
            JOIN community_posts p ON p.id = c.post_id
            JOIN users u          ON u.id = p.author_id
            WHERE c.author_id = $1::uuid
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

        const data = result.rows.map(r => ({
            comment_id: r.comment_id,
            post_id:    r.post_id,
            content:    r.content,
            created_at: r.created_at,
            post_snapshot: {
                content:       r.post_content,
                post_type:     r.post_type,
                image_url:     r.post_image_url,
                author_id:     r.post_author_id,
                author_name:   r.post_author_name,
                author_avatar: r.post_author_avatar,
                author_role:   r.post_author_role,
            },
        }));

        res.status(200).json({
            pagination: { total, total_pages: Math.ceil(total / limit), current_page: page, limit },
            data,
        });
    } catch (error) {
        console.error("Error Get My Comments:", error);
        res.status(500).json({ error: "Gagal mengambil daftar komentar Anda" });
    }
};
