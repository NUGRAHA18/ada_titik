jest.mock('../config/db.js', () => ({ __esModule: true, default: { query: jest.fn() } }));

import pool from '../config/db.js';
import {
    getDonationPoints,
    getDonationPointById,
    createDonationPoint,
    updateDonationPoint,
} from '../controllers/donationController.js';

const mockReq = (body = {}, params = {}, query = {}, user = {}) => ({ body, params, query, user });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

beforeEach(() => { pool.query.mockReset(); });

// ─── GET LIST ─────────────────────────────────────────────────────────────────

describe('getDonationPoints', () => {
    it('mengembalikan 200 dengan struktur pagination', async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: 1, title: 'Test', status: 'Open', urgency: 'Normal',
                     latitude: -7.8, longitude: 110.3, created_at: new Date(), total_count: '1' }],
            rowCount: 1,
        });

        const res = mockRes();
        await getDonationPoints(mockReq({}, {}, {}), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pagination: expect.objectContaining({ current_page: 1, limit: 10 }),
            data: expect.any(Array),
        }));
    });

    it('menolak urgency yang tidak valid dengan 400', async () => {
        const res = mockRes();
        await getDonationPoints(mockReq({}, {}, { urgency: 'SangatMendesak' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('menolak status yang tidak valid dengan 400', async () => {
        const res = mockRes();
        await getDonationPoints(mockReq({}, {}, { status: 'Selesai' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('mengembalikan data kosong dengan pagination jika tidak ada hasil', async () => {
        pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = mockRes();
        await getDonationPoints(mockReq({}, {}, { search: 'tidakada' }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pagination: expect.objectContaining({ total: 0 }),
            data: [],
        }));
    });
});

// ─── GET BY ID ────────────────────────────────────────────────────────────────

describe('getDonationPointById', () => {
    it('mengembalikan 404 jika titik tidak ditemukan', async () => {
        pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = mockRes();
        await getDonationPointById(mockReq({}, { id: 999 }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('mengembalikan 200 dan data jika titik ditemukan', async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: 1, title: 'Bantuan Banjir', status: 'Open', avg_rating: '4.5' }],
            rowCount: 1,
        });

        const res = mockRes();
        await getDonationPointById(mockReq({}, { id: 1 }), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

// ─── CREATE ───────────────────────────────────────────────────────────────────

describe('createDonationPoint', () => {
    it('menolak jika koordinat tidak disertakan', async () => {
        const res = mockRes();
        await createDonationPoint(mockReq({ title: 'Test' }, {}, {}, { userId: 1 }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('berhasil membuat titik bantuan dengan urgency default Normal', async () => {
        pool.query.mockResolvedValue({
            rows: [{ id: 5, title: 'Bantuan Banjir', status: 'Open', urgency: 'Normal' }],
        });

        const res = mockRes();
        await createDonationPoint(
            mockReq({ title: 'Bantuan Banjir', longitude: 110.36, latitude: -7.79 }, {}, {}, { userId: 2 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
});

// ─── UPDATE POINT ─────────────────────────────────────────────────────────────

describe('updateDonationPoint', () => {
    it('menolak jika tidak ada field yang diisi', async () => {
        const res = mockRes();
        await updateDonationPoint(mockReq({}, { id: 1 }, {}, { userId: 1 }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('menolak jika user bukan pengelola titik', async () => {
        pool.query.mockResolvedValue({
            rows: [{ created_by: 99, deleted_at: null }], rowCount: 1,
        });

        const res = mockRes();
        await updateDonationPoint(
            mockReq({ title: 'Judul Baru' }, { id: 1 }, {}, { userId: 1 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('berhasil update jika user adalah pengelola', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ created_by: 1, deleted_at: null }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Judul Baru', urgency: 'Mendesak', status: 'Open' }] });

        const res = mockRes();
        await updateDonationPoint(
            mockReq({ title: 'Judul Baru', urgency: 'Mendesak' }, { id: 1 }, {}, { userId: 1 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });
});
