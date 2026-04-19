import multer from 'multer';
import path from 'path';

// Konfigurasi penyimpanan lokal
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Pastikan folder 'uploads' sudah Anda buat
    },
    filename: (req, file, cb) => {
        // Buat nama file unik (Timestamp + Ekstensi Asli)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter hanya menerima file gambar
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Format file tidak didukung. Hanya gambar yang diizinkan.'), false);
    }
};

export const upload = multer({ storage, fileFilter });