import express from "express";
import {
  createDonationPoint,
  getDonationPoints,
  getNearbyDonations,
  updateDonationStatus
} from "../controllers/donationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { checkRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Semua user (Donatur & Komunitas) bisa melihat titik
router.get('/', getDonationPoints);

// HANYA Komunitas & Admin yang bisa membuat titik bantuan
router.post('/', verifyToken, checkRole(['komunitas']), createDonationPoint);

// HANYA Komunitas pembuat yang bisa update status (Logika kepemilikan ada di controller)
router.patch('/:id/status', verifyToken, checkRole(['komunitas']), updateDonationStatus);

export default router;