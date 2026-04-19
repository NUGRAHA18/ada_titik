import express from 'express';
import { giveRating } from '../controllers/ratingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Wajib login untuk memberikan rating
router.post('/', verifyToken, giveRating);

export default router;