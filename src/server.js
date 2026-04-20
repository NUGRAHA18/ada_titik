import express from "express";
import cors from "cors";
import "./config/db.js";
import fs from "fs";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import documentationRoutes from './routes/documentationRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import rateLimit from 'express-rate-limit';
import analyticsRoutes from './routes/analyticsRoutes.js';

const PORT = process.env.PORT || 3000;
const app = express();

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
    console.log('📁 Folder uploads berhasil dibuat otomatis');
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: { error: "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit." }
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use('/api/documentation', documentationRoutes); 
app.use('/api/ratings', ratingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
