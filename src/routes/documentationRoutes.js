import express from 'express';
import { getDocumentationByPoint, uploadDocumentation } from '../controllers/documentationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Siapapun yang login bisa melihat dokumentasi (transparansi donatur)
router.get('/:point_id', verifyToken, getDocumentationByPoint);

// Hanya komunitas yang bisa upload dokumentasi bukti distribusi
router.post('/', verifyToken, checkRole(['komunitas']), upload.single('photo'), uploadDocumentation);

export default router;