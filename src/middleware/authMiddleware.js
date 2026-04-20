import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // Ambil token dari header request
  const authHeader = req.header("Authorization");
  console.log(authHeader);

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Akses ditolak. Token tidak ditemukan" });
  }

  try {
    // Standar industri menggunakan format "Bearer <token>"
    const token = authHeader.split(" ")[1];

    // Cek keaslian token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Simpan data token (userId, role) untuk digunakan nanti

    next(); // Silakan masuk ke route tujuan
  } catch (error) {
    res.status(400).json({ error: "Token tidak valid atau sudah kadaluarsa" });
  }
};
