import express from 'express';
import { getSummaryStats, getHeatmapData } from '../controllers/analyticsController.js';

const router = express.Router();

// Route bersifat publik agar mudah ditampilkan di halaman utama
router.get('/stats', getSummaryStats);
router.get('/heatmap', getHeatmapData);

export default router;