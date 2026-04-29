import express from 'express';
import { createReport } from '../controllers/reportController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Hanya donatur yang bisa melaporkan bantuan fiktif
router.post('/', verifyToken, checkRole(['donatur']), createReport);

export default router;