import express from 'express';
import { uploadDocumentation } from '../controllers/documentationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Route dengan 2 middleware: Cek Token (Login) -> Proses Upload Foto (maks 1 file) -> Controller
router.post('/', verifyToken, upload.single('photo'), uploadDocumentation);

export default router;