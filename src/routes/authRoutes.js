import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  refreshSupabaseToken,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  validate,
} from "../middleware/validators.js";

const router = express.Router();

// Limiter ketat khusus endpoint sensitif (anti brute-force).
// Lebih ketat dari limiter global (100/15m) di server.js.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit.",
  },
});

router.post("/register", registerRules, validate, register);
router.post("/login", authLimiter, loginRules, validate, login);

router.post("/forgot-password", authLimiter, forgotPasswordRules, validate, requestPasswordReset);
router.post("/reset-password",  authLimiter, resetPasswordRules,  validate, resetPassword);

router.get("/me", verifyToken, (req, res) => {
  res.json({
    message: "Selamat datang di area aman!",
    user: req.user,
  });
});

router.get("/supabase-token", verifyToken, refreshSupabaseToken);

export default router;