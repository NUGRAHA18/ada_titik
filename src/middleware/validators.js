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

export const createDonationRules = [
    body('title').trim().notEmpty().withMessage('Judul wajib diisi')
        .isLength({ max: 200 }).withMessage('Judul maksimal 200 karakter'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude tidak valid (-180 s/d 180)'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude tidak valid (-90 s/d 90)'),
    body('urgency').optional().isIn(['Mendesak', 'Normal', 'Rendah'])
        .withMessage("Urgency harus 'Mendesak', 'Normal', atau 'Rendah'"),
    body('description').optional().isString().trim(),
];

export const updateDonationRules = [
    body('title').optional().trim().notEmpty().withMessage('Judul tidak boleh kosong')
        .isLength({ max: 200 }).withMessage('Judul maksimal 200 karakter'),
    body('urgency').optional().isIn(['Mendesak', 'Normal', 'Rendah'])
        .withMessage("Urgency harus 'Mendesak', 'Normal', atau 'Rendah'"),
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
];

export const nearbyQueryRules = [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Parameter lat tidak valid'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Parameter lng tidak valid'),
    query('radius').isFloat({ min: 1 }).withMessage('Radius harus lebih dari 0 meter'),
];
