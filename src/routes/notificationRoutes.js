import express from 'express';
import {
    getNearbyNotifications,
    listMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { notificationQueryRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/nearby',   verifyToken, notificationQueryRules, validate, getNearbyNotifications);

router.get('/',             verifyToken, listMyNotifications);
router.patch('/read-all',   verifyToken, markAllNotificationsRead);
router.patch('/:id/read',   verifyToken, markNotificationRead);
router.delete('/:id',       verifyToken, deleteNotification);

export default router;
