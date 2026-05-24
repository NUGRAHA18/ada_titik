import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Akses ditolak. Token tidak ditemukan" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;

    next();
  } catch (error) {
    res.status(400).json({ error: "Token tidak valid atau sudah kadaluarsa" });
  }
};

export const verifyTokenOptional = (req, _res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return next();

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    // token tidak valid → perlakukan sebagai anonymous, biarkan req.user undefined
  }
  next();
};
