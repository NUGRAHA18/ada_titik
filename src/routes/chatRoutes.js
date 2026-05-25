import express from 'express';
import {
    listConversations,
    startConversation,
    listMessages,
    sendMessage,
    markAsRead,
} from '../controllers/chatController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    startConversationRules,
    sendMessageRules,
    listMessagesRules,
    listConversationsRules,
    validate,
} from '../middleware/validators.js';

const router = express.Router();

router.get('/',              verifyToken, listConversationsRules, validate, listConversations);
router.post('/',             verifyToken, startConversationRules, validate, startConversation);
router.get('/:id/messages',  verifyToken, listMessagesRules,      validate, listMessages);
router.post('/:id/messages', verifyToken, sendMessageRules,       validate, sendMessage);
router.patch('/:id/read',    verifyToken, markAsRead);

export default router;
