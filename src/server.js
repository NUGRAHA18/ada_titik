import "./config/env.js";
import "./config/db.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import morgan from "morgan";
import rateLimit from 'express-rate-limit';
import { verifyToken } from "./middleware/authMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import documentationRoutes from './routes/documentationRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { getNearbyNotifications } from './controllers/donationController.js';
import { errorHandler, healthCheck } from './middleware/errorHandler.js';

const PORT = process.env.PORT || 3000;
const app  = express();
app.set('trust proxy', 1);
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

const corsOptions = {
    origin: (process.env.NODE_ENV === 'production' && allowedOrigins)
        ? (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error(`Origin '${origin}' tidak diizinkan oleh CORS`));
          }
        : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// folder uploads
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('Folder uploads berhasil dibuat otomatis');
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit." },
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(limiter);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use("/api/auth",          authRoutes);
app.use("/api/donations",     donationRoutes);
app.use('/api/documentation', documentationRoutes);
app.use('/api/ratings',       ratingRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/users',         userRoutes);
app.use('/uploads',           express.static('uploads'));
app.get('/api/notifications/nearby', verifyToken, getNearbyNotifications);
app.get('/health', healthCheck);

app.use(errorHandler);

app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`Server berjalan di http://localhost:${PORT} [${env}]`);
});
