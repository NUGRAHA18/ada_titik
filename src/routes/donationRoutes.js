import express from "express";
import {
  createDonationPoint,
  getDonationPoints,
  getDonationPointById,
  getNearbyDonations,
  updateDonationStatus
} from "../controllers/donationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Semua user (Donatur & Komunitas) bisa melihat titik (support ?urgency= & ?status=)
router.get('/', getDonationPoints);

// Titik bantuan terdekat (butuh login untuk keamanan lokasi user)
router.get('/nearby', verifyToken, getNearbyDonations);

// Detail satu titik bantuan
router.get('/:id', getDonationPointById);

// HANYA Komunitas yang bisa membuat titik bantuan
router.post('/', verifyToken, checkRole(['komunitas']), createDonationPoint);

// Donatur & Komunitas bisa update status (Donatur -> On Progress, Komunitas pembuat -> Completed)
router.patch('/:id/status', verifyToken, checkRole(['donatur', 'komunitas']), updateDonationStatus);

export default router;