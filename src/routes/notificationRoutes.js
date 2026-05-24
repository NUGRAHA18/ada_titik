import express from 'express';
import { getNearbyNotifications } from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { notificationQueryRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/nearby', verifyToken, notificationQueryRules, validate, getNearbyNotifications);

export default router;
