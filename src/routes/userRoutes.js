import express from 'express';
import { getProfile, updateProfile, getUserActivity } from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { updateProfileRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/profile', verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfileRules, validate, updateProfile);
router.get('/activity', verifyToken, getUserActivity);

export default router;
