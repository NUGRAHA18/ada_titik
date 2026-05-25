jest.mock('../config/db.js', () => ({ __esModule: true, default: { query: jest.fn() } }));

import pool from '../config/db.js';
import {
    listConversations,
    startConversation,
    listMessages,
    sendMessage,
    markAsRead,
} from '../controllers/chatController.js';

const mockReq = (body = {}, params = {}, query = {}, user = {}) => ({ body, params, query, user });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const USER_C = '33333333-3333-3333-3333-333333333333';

beforeEach(() => { pool.query.mockReset(); });

// ─── LIST CONVERSATIONS ───────────────────────────────────────────────────────

describe('listConversations', () => {
    it('mengembalikan 200 dengan pagination + data', async () => {
        pool.query.mockResolvedValue({
            rows: [{
                id: 1,
                other_user_id: USER_B,
                other_user_name: 'Komunitas Sejahtera',
                last_message_body: 'Halo',
                unread_count: 2,
                total_count: '1',
            }],
            rowCount: 1,
        });

        const res = mockRes();
        await listConversations(mockReq({}, {}, {}, { userId: USER_A }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pagination: expect.objectContaining({ current_page: 1, limit: 20, total: 1 }),
            data: expect.arrayContaining([expect.objectContaining({ id: 1, unread_count: 2 })]),
        }));
        // Pastikan total_count tidak bocor ke client
        const payload = res.json.mock.calls[0][0];
        expect(payload.data[0]).not.toHaveProperty('total_count');
    });

    it('mengembalikan list kosong dengan pagination jika user belum punya percakapan', async () => {
        pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = mockRes();
        await listConversations(mockReq({}, {}, {}, { userId: USER_A }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pagination: expect.objectContaining({ total: 0 }),
            data: [],
        }));
    });
});

// ─── START CONVERSATION ───────────────────────────────────────────────────────

describe('startConversation', () => {
    it('menolak chat ke diri sendiri dengan 400', async () => {
        const res = mockRes();
        await startConversation(
            mockReq({ target_user_id: USER_A }, {}, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(pool.query).not.toHaveBeenCalled();
    });

    it('mengembalikan 404 jika target user tidak ditemukan', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = mockRes();
        await startConversation(
            mockReq({ target_user_id: USER_C }, {}, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('mengembalikan 201 saat percakapan baru dibuat', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: USER_B }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    user_a_id: USER_A,
                    user_b_id: USER_B,
                    context_type: 'post',
                    context_id: 42,
                    created_at: new Date(),
                    was_created: true,
                }],
            });

        const res = mockRes();
        await startConversation(
            mockReq({ target_user_id: USER_B, context_type: 'post', context_id: 42 }, {}, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.any(String),
            data: expect.objectContaining({ id: 7, context_type: 'post', context_id: 42 }),
        }));
    });

    it('mengembalikan 200 saat percakapan sudah ada (idempotent)', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: USER_B }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    id: 7,
                    user_a_id: USER_A,
                    user_b_id: USER_B,
                    context_type: null,
                    context_id: null,
                    created_at: new Date(),
                    was_created: false,
                }],
            });

        const res = mockRes();
        await startConversation(
            mockReq({ target_user_id: USER_B }, {}, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('menormalkan pasangan: user_a_id < user_b_id terkirim ke INSERT', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: USER_A }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [{
                    id: 9,
                    user_a_id: USER_A,
                    user_b_id: USER_B,
                    context_type: null,
                    context_id: null,
                    created_at: new Date(),
                    was_created: true,
                }],
            });

        const res = mockRes();
        // User B yang inisiasi, target adalah A — pasangan harus tetap (A, B).
        await startConversation(
            mockReq({ target_user_id: USER_A }, {}, {}, { userId: USER_B }),
            res
        );

        const insertCall = pool.query.mock.calls[1];
        expect(insertCall[1].slice(0, 2)).toEqual([USER_A, USER_B]);
    });

    it('menolak context_type valid tapi tanpa context_id dengan 400', async () => {
        const res = mockRes();
        await startConversation(
            mockReq({ target_user_id: USER_B, context_type: 'post' }, {}, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(pool.query).not.toHaveBeenCalled();
    });
});

// ─── LIST MESSAGES ────────────────────────────────────────────────────────────

describe('listMessages', () => {
    it('menolak id percakapan tidak valid dengan 400', async () => {
        const res = mockRes();
        await listMessages(mockReq({}, { id: 'bukan-angka' }, {}, { userId: USER_A }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('mengembalikan 404 jika user bukan peserta percakapan', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = mockRes();
        await listMessages(mockReq({}, { id: 1 }, {}, { userId: USER_C }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('mengembalikan messages urut ASC + next_cursor null kalau belum penuh', async () => {
        pool.query
            .mockResolvedValueOnce({
                rows: [{ id: 1, user_a_id: USER_A, user_b_id: USER_B }],
                rowCount: 1,
            })
            .mockResolvedValueOnce({
                rows: [
                    { id: 5, sender_id: USER_A, body: 'paling baru', created_at: new Date('2026-05-25T03:00:00Z') },
                    { id: 4, sender_id: USER_B, body: 'lebih lama',  created_at: new Date('2026-05-25T02:00:00Z') },
                ],
            });

        const res = mockRes();
        await listMessages(mockReq({}, { id: 1 }, {}, { userId: USER_A }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        // DB query DESC, controller reverse ke ASC
        expect(payload.data.map(m => m.id)).toEqual([4, 5]);
        expect(payload.pagination.next_cursor).toBeNull();
        expect(payload.pagination.has_more).toBe(false);
    });

    it('mengembalikan next_cursor ketika limit tercapai (has_more)', async () => {
        const fakeRows = Array.from({ length: 30 }, (_, i) => ({
            id: 100 - i, sender_id: USER_A, body: `m${i}`, created_at: new Date(),
        }));
        pool.query
            .mockResolvedValueOnce({
                rows: [{ id: 1, user_a_id: USER_A, user_b_id: USER_B }],
                rowCount: 1,
            })
            .mockResolvedValueOnce({ rows: fakeRows });

        const res = mockRes();
        await listMessages(mockReq({}, { id: 1 }, {}, { userId: USER_A }), res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.pagination.has_more).toBe(true);
        expect(payload.pagination.next_cursor).toBe(71); // id terkecil di batch
    });
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────

describe('sendMessage', () => {
    it('mengembalikan 404 jika user bukan peserta', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = mockRes();
        await sendMessage(
            mockReq({ body: 'hai' }, { id: 1 }, {}, { userId: USER_C }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('mengembalikan 201 + data pesan saat sukses', async () => {
        pool.query
            .mockResolvedValueOnce({
                rows: [{ id: 1, user_a_id: USER_A, user_b_id: USER_B }],
                rowCount: 1,
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 10, conversation_id: 1, sender_id: USER_A,
                    body: 'hai', read_at: null, created_at: new Date(),
                }],
            });

        const res = mockRes();
        await sendMessage(
            mockReq({ body: '  hai  ' }, { id: 1 }, {}, { userId: USER_A }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.any(String),
            data: expect.objectContaining({ id: 10, body: 'hai' }),
        }));
        // pastikan body di-trim sebelum INSERT
        const insertCall = pool.query.mock.calls[1];
        expect(insertCall[1][2]).toBe('hai');
    });
});

// ─── MARK AS READ ─────────────────────────────────────────────────────────────

describe('markAsRead', () => {
    it('menolak id percakapan tidak valid', async () => {
        const res = mockRes();
        await markAsRead(mockReq({}, { id: '0' }, {}, { userId: USER_A }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('mengembalikan 404 jika user bukan peserta', async () => {
        pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const res = mockRes();
        await markAsRead(mockReq({}, { id: 1 }, {}, { userId: USER_C }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('hanya menandai pesan dari lawan bicara (bukan dari diri sendiri)', async () => {
        pool.query
            .mockResolvedValueOnce({
                rows: [{ id: 1, user_a_id: USER_A, user_b_id: USER_B }],
                rowCount: 1,
            })
            .mockResolvedValueOnce({ rowCount: 3 });

        const res = mockRes();
        await markAsRead(mockReq({}, { id: 1 }, {}, { userId: USER_A }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ marked_count: 3 }));

        const updateCall = pool.query.mock.calls[1];
        // Pastikan UPDATE pakai sender_id <> userId
        expect(updateCall[0]).toMatch(/sender_id <> \$2/);
        expect(updateCall[1]).toEqual([1, USER_A]);
    });
});
