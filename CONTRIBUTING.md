# Panduan Kontribusi – Titik Baik

## Alur Branching

```
feature/* ──→ development ──→ staging ──→ main
```

| Branch | Fungsi | Siapa yang bisa push langsung |
|--------|--------|-------------------------------|
| `main` | Kode produksi | Tidak ada (via PR saja) |
| `staging` | Testing akhir sebelum produksi | Tidak ada (via PR saja) |
| `development` | Pengembangan aktif | Semua anggota tim |

---

## Cara Kerja Sehari-hari

### 1. Selalu mulai dari `development`
```bash
git checkout development
git pull origin development
```

### 2. Buat branch fitur baru
```bash
git checkout -b feature/nama-fitur
# contoh: git checkout -b feature/filter-donasi
```

### 3. Kerjakan, commit, push
```bash
git add .
git commit -m "feat: deskripsi singkat perubahan"
git push origin feature/nama-fitur
```

### 4. Buat Pull Request ke `development` di GitHub

### 5. Setelah stabil → PR dari `development` ke `staging`
> Lakukan testing di staging sebelum lanjut

### 6. Setelah QA oke → PR dari `staging` ke `main`

---

## Konvensi Pesan Commit

| Prefix | Kapan digunakan |
|--------|-----------------|
| `feat:` | Fitur baru |
| `fix:` | Perbaikan bug |
| `refactor:` | Refactoring (tanpa fitur/fix baru) |
| `docs:` | Perubahan dokumentasi |
| `chore:` | Update dependensi, konfigurasi |

---

## Setup Environment Lokal

```bash
# Salin template
cp .env.example .env.development

# Edit sesuai konfigurasi lokal Anda
# (isi DATABASE_URL dan JWT_SECRET)

# Jalankan server
npm run dev
```

---

## Branch Protection Rules (Konfigurasi Manual di GitHub)

Buka: **GitHub → Settings → Branches → Add branch ruleset**

### Untuk branch `main`:
- [x] Restrict deletions
- [x] Require a pull request before merging
  - Required approvals: **1**
- [x] Require status checks to pass (pilih: `Run Tests`)
- [x] Block force pushes

### Untuk branch `staging`:
- [x] Restrict deletions
- [x] Require a pull request before merging
- [x] Block force pushes

### Untuk branch `development`:
- Tidak perlu proteksi ketat, anggota tim boleh push langsung

---

## GitHub Secrets (Untuk CI/CD)

Buka: **GitHub → Settings → Secrets and variables → Actions**

| Secret | Keterangan |
|--------|------------|
| `JWT_SECRET` | Secret JWT untuk environment CI |
| `DATABASE_URL` | Koneksi DB untuk test (opsional) |

---

## Menjalankan Per Environment

```bash
npm run dev            # development (NODE_ENV=development)
npm run start:staging  # staging     (NODE_ENV=staging)
npm run start          # production  (NODE_ENV=production)
```
