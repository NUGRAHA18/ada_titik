import jwt from 'jsonwebtoken';

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 jam

// Mint JWT untuk Supabase client.
// Supabase Realtime & RLS membaca claim `sub` sebagai auth.uid().
// Secret HARUS sama dengan "JWT Secret" di Supabase dashboard
// (Settings → API → JWT Settings).
export const mintSupabaseToken = (userId, opts = {}) => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
        throw new Error('SUPABASE_JWT_SECRET belum di-set di environment');
    }
    if (!userId) {
        throw new Error('userId wajib diisi untuk mint Supabase JWT');
    }

    const ttl = Number.isInteger(opts.expiresIn) ? opts.expiresIn : DEFAULT_TTL_SECONDS;

    return jwt.sign(
        {
            sub:  userId,
            role: 'authenticated',
            aud:  'authenticated',
        },
        secret,
        { algorithm: 'HS256', expiresIn: ttl }
    );
};
