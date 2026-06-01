export const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        // req.user didapat dari verifyToken sebelumnya
        const { role } = req.user;

        // Logika Inheritance: Admin bisa akses semua, Komunitas bisa akses fitur Donatur.
        if (role === 'admin') return next();

        if (allowedRoles.includes(role)) {
            return next();
        }

        // Komunitas mewarisi seluruh kapabilitas donatur (mis. melapor, memberi rating,
        // berangkat). Ini sebelumnya hanya didokumentasikan tapi tidak diterapkan,
        // sehingga akun komunitas ter-403 di endpoint donatur-only seperti /reports.
        if (role === 'komunitas' && allowedRoles.includes('donatur')) {
            return next();
        }

        return res.status(403).json({
            error: `Akses ditolak. Peran '${role}' tidak diizinkan mengakses fitur ini.`
        });
    };
};