// URUTAN IMPORT PENTING: env.js harus pertama agar db.js dapat process.env
import "./config/env.js";
import "./config/db.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import morgan from "morgan";
import rateLimit from 'express-rate-limit';
import { verifyToken } from "./middleware/authMiddleware.js";
import { errorHandler, healthCheck } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import documentationRoutes from './routes/documentationRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { getNearbyNotifications } from './controllers/donationController.js';

const PORT = process.env.PORT || 3000;
const app  = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
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

// ── Folder uploads ────────────────────────────────────────────────────────────
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('📁 Folder uploads berhasil dibuat otomatis');
}

// ── Middleware global ─────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit." },
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', healthCheck);

// ── Routes ────────────────────────────────────────────────────────────────────
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

// ── Global error handler (harus setelah semua route) ─────────────────────────
app.use(errorHandler);

// ── Start server + graceful shutdown ─────────────────────────────────────────
const server = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`Server berjalan di http://localhost:${PORT} [${env}]`);
});

const shutdown = (signal) => {
    console.log(`\n${signal} diterima. Menutup server...`);
    server.close(() => {
        console.log('Server berhasil ditutup.');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',   (err)    => { console.error('Uncaught Exception:', err);    shutdown('uncaughtException'); });
process.on('unhandledRejection',  (reason) => { console.error('Unhandled Rejection:', reason); shutdown('unhandledRejection'); });
