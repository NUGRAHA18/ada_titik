import express from 'express';
import { createReport } from '../controllers/reportController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { createReportRules, validate } from '../middleware/validators.js';

const router = express.Router();

router.post('/', verifyToken, checkRole(['donatur']), createReportRules, validate, createReport);

export default router;
