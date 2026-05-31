import express from "express";
import {
  register,
  login,
  refreshSupabaseToken,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  forgotPasswordRules,
  resetPasswordRules,
  validate,
} from "../middleware/validators.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.post("/forgot-password", forgotPasswordRules, validate, requestPasswordReset);
router.post("/reset-password",  resetPasswordRules,  validate, resetPassword);

router.get("/me", verifyToken, (req, res) => {
  res.json({
    message: "Selamat datang di area aman!",
    user: req.user,
  });
});

router.get("/supabase-token", verifyToken, refreshSupabaseToken);

export default router;