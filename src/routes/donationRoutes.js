import express from "express";
import {
  createDonationPoint,
  getDonationPoints,
  getNearbyDonations,
  updateDonationStatus
} from "../controllers/donationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Wajib login untuk buat titik bantuan
router.post("/", verifyToken, createDonationPoint);
router.get('/nearby', getNearbyDonations);
router.get("/", getDonationPoints);
router.patch('/:id/status', verifyToken, updateDonationStatus);

export default router;
