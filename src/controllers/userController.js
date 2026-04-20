export const updateProfile = async (req, res) => {
    const { userId } = req.user;
    const { name, bio } = req.body;

    try {
        const query = `UPDATE users SET name = $1, bio = $2 WHERE id = $3 RETURNING id, name, role`;
        const result = await pool.query(query, [name, bio, userId]);
        res.status(200).json({ message: "Profil berhasil diperbarui", data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Gagal memperbarui profil" });
    }
};