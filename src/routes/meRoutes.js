import express from 'express';
import {
    getMyPosts,
    getMyLikes,
    getMyComments,
} from '../controllers/meController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/community/posts',    verifyToken, getMyPosts);
router.get('/community/likes',    verifyToken, getMyLikes);
router.get('/community/comments', verifyToken, getMyComments);

export default router;
