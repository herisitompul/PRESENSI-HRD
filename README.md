# Aplikasi Presensi Karyawan

Aplikasi presensi modern dengan fitur GPS tracking dan photo capture, dibangun menggunakan SvelteKit dan Directus CMS.

## ✨ Fitur Utama

### 🔐 Authentication

- **Firebase Authentication**: Login aman dengan email/password
- **Session Management**: Auto-redirect untuk user yang belum login
- **User Profile**: Tampilan informasi user yang sedang login

### 📍 GPS Location Tracking

- **Real-time GPS**: Deteksi lokasi otomatis saat absensi
- **Address Resolution**: Konversi koordinat GPS ke alamat yang mudah dibaca
- **Location Accuracy**: Menampilkan tingkat akurasi lokasi
- **Geolocation API**: Menggunakan HTML5 Geolocation untuk presisi tinggi

### 📷 Photo Capture

- **Mandatory Photos**: Wajib foto selfie untuk setiap absensi
- **Camera Integration**: Langsung menggunakan kamera device
- **File Validation**: Validasi tipe file (image) dan ukuran maksimal 5MB
- **Preview Feature**: Preview foto sebelum submit
- **Secure Upload**: Upload ke Directus storage dengan enkripsi

### 📊 Absensi Management

- **Check-in/Check-out**: Sistem absensi masuk dan keluar
- **Daily Tracking**: Satu set absensi per hari per karyawan
- **Time Recording**: Record timestamp yang akurat
- **Status Dashboard**: Monitor status absensi hari ini
- **History View**: Riwayat absensi untuk tracking

### 💾 Data Storage

- **Directus CMS**: Backend modern dengan REST API
- **Real-time Sync**: Data tersinkronisasi real-time
- **Structured Data**: Schema database yang terorganisir
- **File Management**: Storage foto yang aman dan terorganisir

## 🚀 Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Backend**: Directus CMS
- **Authentication**: Firebase Auth
- **Storage**: Directus File Storage
- **Styling**: Custom CSS dengan responsive design
- **Build Tool**: Vite

## 📱 Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest)
- **Mobile Support**: iOS Safari, Chrome Mobile
- **Required APIs**:
  - Geolocation API
  - MediaDevices API (Camera)
  - File API

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ dan npm
- Account Firebase untuk authentication
- Instance Directus yang sudah running

### 1. Clone Repository

```bash
git clone <repository-url>
cd presensi
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Buat file `.env` di root project:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Directus Configuration
VITE_DIRECTUS_URL=https://your-directus-instance.com
VITE_DIRECTUS_TOKEN=your_directus_static_token

# Development Mode
VITE_USE_MOCK_DATA=false
```

### 4. Setup Directus Collection

Lihat file `DIRECTUS_SETUP.md` untuk petunjuk lengkap setup collection `absensi_karyawan`.

### 5. Run Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## 📖 Usage Guide

### For Employees

1. **Login**: Gunakan email dan password yang telah disediakan
2. **Dashboard**: Lihat status absensi dan waktu saat ini
3. **Presensi**: Klik "Buka Halaman Presensi" untuk melakukan absensi
4. **Absensi Masuk**:
   - Izinkan akses lokasi browser
   - Klik "Dapatkan Lokasi" untuk GPS
   - Klik "Ambil Foto" untuk selfie
   - Tambahkan keterangan (opsional)
   - Submit absensi masuk
5. **Absensi Keluar**:
   - Ambil foto untuk absensi keluar
   - Submit absensi keluar
6. **Riwayat**: Lihat riwayat absensi di bagian bawah halaman

### For Administrators

- **Directus Admin**: Akses data absensi melalui Directus admin panel
- **Reports**: Export data untuk laporan bulanan/tahunan
- **User Management**: Kelola user melalui Firebase Console

## 🔧 Development

### Project Structure

```
src/
├── lib/
│   ├── absensi.ts       # Service untuk fitur absensi
│   ├── auth.ts          # Authentication utilities
│   ├── directus.ts      # Directus client & types
│   ├── firebase.ts      # Firebase configuration
│   ├── services.ts      # Additional services
│   └── toast.ts         # Notification system
├── routes/
│   ├── +layout.svelte   # Layout utama
│   ├── +page.svelte     # Dashboard
│   ├── login/           # Halaman login
│   ├── presensi/        # Halaman absensi
│   └── test/            # Testing page
└── app.html             # HTML template
```

### Available Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type checking
npm run check:watch  # Type checking dengan watch mode
```

### Testing

- Visit `/test` untuk testing fitur GPS, camera, dan Directus connection
- Gunakan browser developer tools untuk debugging

## 🐛 Troubleshooting

### Common Issues

1. **"Akses lokasi ditolak"**

   - Pastikan browser memiliki permission untuk location
   - Gunakan HTTPS untuk production

2. **"Gagal mengunggah foto"**

   - Periksa koneksi internet
   - Pastikan ukuran foto < 5MB
   - Pastikan format file adalah image

3. **"Directus connection failed"**

   - Periksa VITE_DIRECTUS_URL dan VITE_DIRECTUS_TOKEN
   - Pastikan Directus instance running
   - Cek CORS settings di Directus

4. **"Firebase auth error"**
   - Verifikasi Firebase configuration
   - Pastikan domain sudah ditambahkan di Firebase Console

### Debug Mode

Set environment variable untuk debugging:

```env
VITE_DEBUG=true
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

Untuk bantuan teknis atau pertanyaan:

- Create issue di repository ini
- Contact: [your-email@domain.com]

---

**Built with ❤️ using SvelteKit & Directus**
