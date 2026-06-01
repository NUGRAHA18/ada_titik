import express from 'express';
import {
    getPosts,
    createPost,
    likePost,
    getComments,
    createComment,
    uploadPostImage,
    reportPost,
} from '../controllers/communityController.js';
import { verifyToken, verifyTokenOptional } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import {
    createPostRules,
    createCommentRules,
    communityTabRules,
    validate,
} from '../middleware/validators.js';

const router = express.Router();

router.get('/posts', verifyTokenOptional, communityTabRules, validate, getPosts);
router.post('/posts', verifyToken, checkRole(['komunitas']), createPostRules, validate, createPost);
router.post('/posts/image', verifyToken, checkRole(['komunitas']), upload.single('image'), uploadPostImage);
router.post('/posts/:id/like', verifyToken, likePost);
router.get('/posts/:id/comments', getComments);
router.post('/posts/:id/comments', verifyToken, createCommentRules, validate, createComment);
router.post('/posts/:id/report', verifyToken, reportPost);

export default router;
