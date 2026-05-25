import jwt from 'jsonwebtoken';
import { mintSupabaseToken } from '../utils/supabaseJwt.js';

const FAKE_SECRET = 'test-supabase-jwt-secret-yang-cukup-panjang';
const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('mintSupabaseToken', () => {
    const ORIGINAL = process.env.SUPABASE_JWT_SECRET;

    beforeEach(() => { process.env.SUPABASE_JWT_SECRET = FAKE_SECRET; });
    afterAll(()  => { process.env.SUPABASE_JWT_SECRET = ORIGINAL; });

    it('throw kalau SUPABASE_JWT_SECRET kosong', () => {
        delete process.env.SUPABASE_JWT_SECRET;
        expect(() => mintSupabaseToken(USER_ID)).toThrow(/SUPABASE_JWT_SECRET/);
    });

    it('throw kalau userId kosong', () => {
        expect(() => mintSupabaseToken(null)).toThrow(/userId/);
        expect(() => mintSupabaseToken(undefined)).toThrow(/userId/);
    });

    it('mengembalikan JWT yang verifiable + claim sub/role/aud benar', () => {
        const token = mintSupabaseToken(USER_ID);
        const decoded = jwt.verify(token, FAKE_SECRET);

        expect(decoded.sub).toBe(USER_ID);
        expect(decoded.role).toBe('authenticated');
        expect(decoded.aud).toBe('authenticated');
        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('default expiresIn 1 jam', () => {
        const token = mintSupabaseToken(USER_ID);
        const decoded = jwt.verify(token, FAKE_SECRET);
        const lifetime = decoded.exp - decoded.iat;
        expect(lifetime).toBe(60 * 60);
    });

    it('expiresIn dapat di-override', () => {
        const token = mintSupabaseToken(USER_ID, { expiresIn: 120 });
        const decoded = jwt.verify(token, FAKE_SECRET);
        expect(decoded.exp - decoded.iat).toBe(120);
    });

    it('token tidak valid dengan secret yang salah', () => {
        const token = mintSupabaseToken(USER_ID);
        expect(() => jwt.verify(token, 'secret-yang-salah')).toThrow();
    });

    it('menggunakan algoritma HS256', () => {
        const token = mintSupabaseToken(USER_ID);
        const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
        expect(header.alg).toBe('HS256');
    });
});
