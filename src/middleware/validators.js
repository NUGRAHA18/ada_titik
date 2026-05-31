import { body, query, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validasi gagal',
            details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

const VALID_CATEGORIES = ['Pangan','Medis','Pendidikan','Infrastruktur','Pakaian','Lainnya','Umum'];
const VALID_POST_TYPES = ['bantuanDibutuhkan','pertanyaan','updateKomunitas','inspirasi','kisahSukses'];
const VALID_TABS       = ['terbaru','populer','diskusi'];

export const registerRules = [
    body('name').trim().notEmpty().withMessage('Nama wajib diisi')
        .isLength({ max: 100 }).withMessage('Nama maksimal 100 karakter'),
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
    body('role').isIn(['donatur', 'komunitas']).withMessage("Role harus 'donatur' atau 'komunitas'"),
];

export const loginRules = [
    body('email').isEmail().withMessage('Format email tidak valid'),
    body('password').notEmpty().withMessage('Password wajib diisi'),
];

export const forgotPasswordRules = [
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
];

export const resetPasswordRules = [
    body('token').isString().trim().notEmpty().withMessage('Token wajib diisi')
        .isLength({ min: 16, max: 200 }).withMessage('Token tidak valid'),
    body('new_password').isString().isLength({ min: 8 }).withMessage('new_password minimal 8 karakter'),
];

export const createDonationRules = [
    body('title').trim().notEmpty().withMessage('Judul wajib diisi')
        .isLength({ max: 200 }).withMessage('Judul maksimal 200 karakter'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude tidak valid (-180 s/d 180)'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude tidak valid (-90 s/d 90)'),
    body('urgency').optional().isIn(['Mendesak', 'Normal', 'Rendah'])
        .withMessage("Urgency harus 'Mendesak', 'Normal', atau 'Rendah'"),
    body('category').optional().isIn(VALID_CATEGORIES)
        .withMessage(`Category harus salah satu: ${VALID_CATEGORIES.join(', ')}`),
    body('goal_amount').optional().isFloat({ min: 0 }).withMessage('goal_amount tidak boleh negatif'),
    body('description').optional().isString().trim(),
];

export const updateDonationRules = [
    body('title').optional().trim().notEmpty().withMessage('Judul tidak boleh kosong')
        .isLength({ max: 200 }).withMessage('Judul maksimal 200 karakter'),
    body('urgency').optional().isIn(['Mendesak', 'Normal', 'Rendah'])
        .withMessage("Urgency harus 'Mendesak', 'Normal', atau 'Rendah'"),
    body('category').optional().isIn(VALID_CATEGORIES)
        .withMessage(`Category harus salah satu: ${VALID_CATEGORIES.join(', ')}`),
    body('goal_amount').optional().isFloat({ min: 0 }).withMessage('goal_amount tidak boleh negatif'),
    body('description').optional().isString().trim(),
];

export const updateStatusRules = [
    body('status').isIn(['On Progress', 'Completed'])
        .withMessage("Status harus 'On Progress' atau 'Completed'"),
    body('user_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude tidak valid'),
    body('user_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude tidak valid'),
];

export const giveRatingRules = [
    body('point_id').isInt({ min: 1 }).withMessage('ID titik bantuan tidak valid'),
    body('score').isInt({ min: 1, max: 5 }).withMessage('Score harus antara 1 sampai 5'),
    body('review').optional().isString().trim()
        .isLength({ max: 1000 }).withMessage('Review maksimal 1000 karakter'),
];

export const createReportRules = [
    body('point_id').isInt({ min: 1 }).withMessage('ID titik bantuan tidak valid'),
    body('reason').trim().notEmpty().withMessage('Alasan laporan wajib diisi')
        .isLength({ max: 1000 }).withMessage('Alasan maksimal 1000 karakter'),
];

export const updateProfileRules = [
    body('name').trim().notEmpty().withMessage('Nama tidak boleh kosong')
        .isLength({ max: 100 }).withMessage('Nama maksimal 100 karakter'),
    body('bio').optional().isString().trim()
        .isLength({ max: 500 }).withMessage('Bio maksimal 500 karakter'),
    body('avatar_url').optional({ nullable: true }).isURL().withMessage('avatar_url harus berupa URL valid')
        .isLength({ max: 500 }).withMessage('avatar_url maksimal 500 karakter'),
];

export const nearbyQueryRules = [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Parameter lat tidak valid'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Parameter lng tidak valid'),
    query('radius').isFloat({ min: 1 }).withMessage('Radius harus lebih dari 0 meter'),
];

export const notificationQueryRules = [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Parameter lat tidak valid'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Parameter lng tidak valid'),
    query('radius').optional().isFloat({ min: 1 }).withMessage('Radius harus lebih dari 0 meter'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit antara 1 sampai 50'),
];

export const createPostRules = [
    body('content').trim().notEmpty().withMessage('Konten postingan wajib diisi')
        .isLength({ max: 5000 }).withMessage('Konten maksimal 5000 karakter'),
    body('post_type').optional().isIn(VALID_POST_TYPES)
        .withMessage(`Post type harus salah satu: ${VALID_POST_TYPES.join(', ')}`),
    body('image_url').optional({ nullable: true }).isURL().withMessage('image_url harus berupa URL valid')
        .isLength({ max: 500 }).withMessage('image_url maksimal 500 karakter'),
];

export const createCommentRules = [
    body('content').trim().notEmpty().withMessage('Konten komentar wajib diisi')
        .isLength({ max: 2000 }).withMessage('Komentar maksimal 2000 karakter'),
];

export const communityTabRules = [
    query('tab').optional().isIn(VALID_TABS)
        .withMessage(`tab harus salah satu: ${VALID_TABS.join(', ')}`),
];

const VALID_CHAT_CONTEXTS = ['post', 'donation_point'];

export const startConversationRules = [
    body('target_user_id').isUUID().withMessage('target_user_id harus UUID valid'),
    body('context_type').optional({ nullable: true }).isIn(VALID_CHAT_CONTEXTS)
        .withMessage(`context_type harus salah satu: ${VALID_CHAT_CONTEXTS.join(', ')}`),
    body('context_id').optional({ nullable: true }).isInt({ min: 1 })
        .withMessage('context_id harus integer positif'),
];

export const sendMessageRules = [
    body('body').trim().notEmpty().withMessage('Isi pesan wajib diisi')
        .isLength({ max: 2000 }).withMessage('Pesan maksimal 2000 karakter'),
];

export const listMessagesRules = [
    query('before').optional().isInt({ min: 1 }).withMessage('before harus integer positif'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit antara 1 sampai 100'),
];

export const listConversationsRules = [
    query('page').optional().isInt({ min: 1 }).withMessage('page harus integer positif'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit antara 1 sampai 50'),
];

// ───── Donation Participants (v5) ─────
export const signalBerangkatRules = [
    body('user_lat').optional({ nullable: true }).isFloat({ min: -90, max: 90 })
        .withMessage('user_lat tidak valid (-90 s/d 90)'),
    body('user_lng').optional({ nullable: true }).isFloat({ min: -180, max: 180 })
        .withMessage('user_lng tidak valid (-180 s/d 180)'),
];

export const bulkParticipantsRules = [
    body('donator_ids').isArray({ min: 1 }).withMessage('donator_ids wajib array (min 1)'),
    body('donator_ids.*').isUUID().withMessage('donator_ids harus berisi UUID valid'),
];

export const completeParticipantsRules = [
    body('donator_ids').isArray({ min: 1 }).withMessage('donator_ids wajib array (min 1)'),
    body('donator_ids.*').isUUID().withMessage('donator_ids harus berisi UUID valid'),
    body('user_lat').isFloat({ min: -90, max: 90 })
        .withMessage('user_lat wajib & valid (-90 s/d 90) untuk geo-fencing'),
    body('user_lng').isFloat({ min: -180, max: 180 })
        .withMessage('user_lng wajib & valid (-180 s/d 180) untuk geo-fencing'),
    body('per_donator_amount').optional().isFloat({ min: 0 })
        .withMessage('per_donator_amount harus angka >= 0'),
];

export const updateProgressRules = [
    body('goal_amount').optional().isFloat({ min: 0 })
        .withMessage('goal_amount harus angka >= 0'),
    body('collected_amount').optional().isFloat({ min: 0 })
        .withMessage('collected_amount harus angka >= 0'),
];
