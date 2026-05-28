import express from "express";
import {
    createDonationPoint,
    getDonationPoints,
    getDonationPointById,
    getNearbyDonations,
    updateDonationStatus,
    updateDonationPoint,
} from "../controllers/donationController.js";
import {
    signalBerangkat,
    cancelBerangkat,
    listParticipants,
    bulkAcceptParticipants,
    bulkCompleteParticipants,
    updateProgress,
    getMyParticipation,
} from '../controllers/participantController.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { checkRole } from '../middleware/roleMiddleware.js';
import {
    createDonationRules,
    updateDonationRules,
    updateStatusRules,
    nearbyQueryRules,
    bulkParticipantsRules,
    completeParticipantsRules,
    signalBerangkatRules,
    updateProgressRules,
    validate,
} from '../middleware/validators.js';

const router = express.Router();

router.get('/', getDonationPoints);

router.get('/nearby', verifyToken, nearbyQueryRules, validate, getNearbyDonations);

router.get('/:id', getDonationPointById);

router.post('/', verifyToken, checkRole(['komunitas']), createDonationRules, validate, createDonationPoint);

router.patch('/:id', verifyToken, checkRole(['komunitas']), updateDonationRules, validate, updateDonationPoint);

router.patch('/:id/status', verifyToken, checkRole(['donatur', 'komunitas']), updateStatusRules, validate, updateDonationStatus);

// Flow Donasi: Berangkat / Accept / Complete 
router.post('/:pointId/participants',verifyToken,checkRole(['donatur']),               signalBerangkatRules,      validate, signalBerangkat);
router.delete('/:pointId/participants/me',      verifyToken, checkRole(['donatur']),                                                    cancelBerangkat);
router.get('/:pointId/participants/me',         verifyToken,                                                                            getMyParticipation);
router.get('/:pointId/participants',            verifyToken, checkRole(['komunitas']),                                                  listParticipants);
router.patch('/:pointId/participants/accept',   verifyToken, checkRole(['komunitas']), bulkParticipantsRules,    validate, bulkAcceptParticipants);
router.patch('/:pointId/participants/complete', verifyToken, checkRole(['komunitas']), completeParticipantsRules, validate, bulkCompleteParticipants);
router.patch('/:pointId/progress',              verifyToken, checkRole(['komunitas']), updateProgressRules,       validate, updateProgress);

export default router;
