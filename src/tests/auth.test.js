jest.mock('../config/db.js', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('bcrypt', () => ({ __esModule: true, default: { hash: jest.fn(), compare: jest.fn() } }));
jest.mock('jsonwebtoken', () => ({ __esModule: true, default: { sign: jest.fn(), verify: jest.fn() } }));

import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login } from '../controllers/authController.js';

process.env.JWT_SECRET = 'test_secret';

const mockReq  = (body = {}) => ({ body });
const mockRes  = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

beforeEach(() => {
    pool.query.mockReset();
    jest.clearAllMocks();
});

// ─── REGISTER ────────────────────────────────────────────────────────────────

describe('register', () => {
    it('menolak jika ada field kosong', async () => {
        const res = mockRes();
        await register(mockReq({ name: '', email: '', password: '', role: '' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('menolak role yang tidak valid', async () => {
        const res = mockRes();
        await register(mockReq({ name: 'Budi', email: 'b@test.com', password: 'pass123', role: 'superadmin' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('berhasil registrasi dengan data valid', async () => {
        bcrypt.hash.mockResolvedValue('hashed_pw');
        pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const res = mockRes();
        await register(mockReq({ name: 'Budi', email: 'budi@test.com', password: 'password123', role: 'donatur' }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
    });

    it('menolak email duplikat dengan 409', async () => {
        bcrypt.hash.mockResolvedValue('hashed_pw');
        const err = Object.assign(new Error('dup'), { code: '23505' });
        pool.query.mockRejectedValue(err);

        const res = mockRes();
        await register(mockReq({ name: 'Budi', email: 'exist@test.com', password: 'password123', role: 'donatur' }), res);

        expect(res.status).toHaveBeenCalledWith(409);
    });
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────

describe('login', () => {
    it('menolak dengan 401 jika user tidak ditemukan', async () => {
        pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = mockRes();
        await login(mockReq({ email: 'ghost@test.com', password: 'pass' }), res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('menolak dengan 401 jika password salah', async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: 1, name: 'Budi', email: 'budi@test.com', password_hash: 'hash', role: 'donatur' }],
            rowCount: 1,
        });
        bcrypt.compare.mockResolvedValue(false);

        const res = mockRes();
        await login(mockReq({ email: 'budi@test.com', password: 'salah' }), res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('berhasil login dan mengembalikan token', async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: 1, name: 'Budi', email: 'budi@test.com', password_hash: 'hash', role: 'donatur' }],
            rowCount: 1,
        });
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('fake_jwt_token');

        const res = mockRes();
        await login(mockReq({ email: 'budi@test.com', password: 'password123' }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'fake_jwt_token' }));
    });
});
