import express from 'express';
import { getAllReports, getSystemStats, deleteInvalidPoint, updateReportStatus } from '../controllers/adminController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Semua route di sini diproteksi: Harus Login & Role Admin
router.use(verifyToken, checkRole(['admin']));

router.get('/reports', getAllReports);
router.patch('/reports/:id', updateReportStatus);
router.get('/stats', getSystemStats);
router.delete('/points/:id', deleteInvalidPoint);

export default router;