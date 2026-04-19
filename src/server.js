import express from "express";
import cors from "cors";
import "dotenv/config";
import "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import documentationRoutes from './routes/documentationRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import fs from "fs";

const PORT = process.env.PORT || 3000;
const app = express();
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
    console.log('📁 Folder uploads berhasil dibuat otomatis');
}

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static('uploads'));
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use('/api/documentation', documentationRoutes); 
app.use('/api/ratings', ratingRoutes);


app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
