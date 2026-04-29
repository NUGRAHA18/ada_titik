import express from 'express';
import { getRatingsByPoint, giveRating } from '../controllers/ratingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Siapapun yang login bisa melihat rating (transparansi)
router.get('/:point_id', verifyToken, getRatingsByPoint);

// Hanya donatur yang bisa memberikan rating
router.post('/', verifyToken, checkRole(['donatur']), giveRating);

export default router;