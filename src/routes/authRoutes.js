import express from "express";
import { register, login } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { registerRules, loginRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);

router.get("/me", verifyToken, (req, res) => {
    res.json({ message: "Selamat datang di area aman!", user: req.user });
});

export default router;
