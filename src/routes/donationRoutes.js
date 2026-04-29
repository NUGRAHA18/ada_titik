import express from "express";
import {
    createDonationPoint,
    getDonationPoints,
    getDonationPointById,
    getNearbyDonations,
    updateDonationStatus,
    updateDonationPoint,
} from "../controllers/donationController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { checkRole } from '../middleware/roleMiddleware.js';
import {
    createDonationRules,
    updateDonationRules,
    updateStatusRules,
    nearbyQueryRules,
    validate,
} from '../middleware/validators.js';

const router = express.Router();

router.get('/', getDonationPoints);

router.get('/nearby', verifyToken, nearbyQueryRules, validate, getNearbyDonations);

router.get('/:id', getDonationPointById);

router.post('/', verifyToken, checkRole(['komunitas']), createDonationRules, validate, createDonationPoint);

router.patch('/:id', verifyToken, checkRole(['komunitas']), updateDonationRules, validate, updateDonationPoint);

router.patch('/:id/status', verifyToken, checkRole(['donatur', 'komunitas']), updateStatusRules, validate, updateDonationStatus);

export default router;
