import express from 'express';
import { getProfile, updateProfile, getUserActivity, uploadAvatar } from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { updateProfileRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/profile',   verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfileRules, validate, updateProfile);
router.post('/avatar',   verifyToken, upload.single('avatar'), uploadAvatar);
router.get('/activity',  verifyToken, getUserActivity);

export default router;
