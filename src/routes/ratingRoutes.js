import express from 'express';
import { getRatingsByPoint, giveRating } from '../controllers/ratingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { giveRatingRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/:point_id', verifyToken, getRatingsByPoint);

router.post('/', verifyToken, checkRole(['donatur']), giveRatingRules, validate, giveRating);

export default router;
