# Fitur Absensi Lembur - Implementasi UI

## Deskripsi

Menambahkan fitur absensi masuk dan keluar lembur pada halaman pengajuan lembur. Fitur ini menggunakan kamera untuk mengambil foto dan geolocation untuk mendapatkan lokasi secara otomatis, mirip dengan sistem presensi harian yang sudah ada.

## Komponen yang Dibuat

### 1. LemburAbsensiButton.svelte

- **Lokasi**: `src/lib/LemburAbsensiButton.svelte`
- **Fungsi**: Tombol untuk melakukan absensi masuk/keluar lembur
- **Fitur**:
  - Integrasi dengan CameraModal untuk pengambilan foto
  - Dua tipe: "masuk" dan "keluar"
  - UI yang konsisten dengan komponen absensi sebelumnya
  - Animasi loading dan feedback visual
  - Responsive design untuk mobile dan desktop

### 2. LemburAbsensiData.svelte

- **Lokasi**: `src/lib/LemburAbsensiData.svelte`
- **Fungsi**: Menampilkan preview data absensi yang telah dilakukan
- **Fitur**:
  - Preview foto yang diambil saat absensi
  - Informasi lokasi (koordinat dan alamat jika tersedia)
  - Timestamp absensi
  - Layout yang berbeda untuk absensi masuk dan keluar
  - Responsive grid layout

### 3. Integrasi di Halaman Lembur

- **Lokasi**: `src/routes/lembur/+page.svelte`
- **Perubahan**:
  - Import komponen baru
  - Tambahkan state management untuk data absensi lembur
  - Implementasi handler untuk success callback
  - UI section untuk absensi lembur
  - Logika untuk mengontrol kapan tombol masuk/keluar aktif

## Fitur UI yang Diimplementasi

### Section Absensi Lembur

- Header dengan judul dan deskripsi
- Tombol absensi masuk (aktif jika belum ada data masuk)
- Tombol absensi keluar (aktif jika sudah absensi masuk tapi belum keluar)
- Status completion dengan opsi reset
- Preview data absensi yang telah dilakukan

### Flow Penggunaan

1. **Absensi Masuk**: User klik tombol "Absensi Masuk Lembur"
2. **Kamera Modal**: Modal terbuka untuk mengambil foto dan lokasi
3. **Preview Data**: Data absensi masuk ditampilkan
4. **Absensi Keluar**: Tombol "Absensi Keluar Lembur" menjadi aktif
5. **Completion**: Setelah keduanya selesai, menampilkan status selesai

### Responsive Design

- Layout yang optimal untuk desktop dan mobile
- Grid yang adaptif untuk preview foto dan lokasi
- Button yang mudah diakses di layar kecil

## State Management

### Data Structure

```typescript
lemburAbsensiData: {
  masuk?: {
    foto: string;
    lokasi: { latitude: number; longitude: number; address?: string };
    timestamp: string;
  };
  keluar?: {
    foto: string;
    lokasi: { latitude: number; longitude: number; address?: string };
    timestamp: string;
  };
}
```

### Computed Properties

- `canAbsensiMasukLembur`: Kontrol apakah tombol masuk aktif
- `canAbsensiKeluarLembur`: Kontrol apakah tombol keluar aktif

## Styling

- Konsisten dengan design system yang ada
- Menggunakan gradient background dan glassmorphism
- Icon yang intuitif untuk setiap aksi
- Color coding: biru untuk masuk, merah untuk keluar
- Animasi hover dan transition yang smooth

## Backend Integration (Placeholder)

- Saat ini data disimpan di local state dan ditampilkan di console
- Struktur data sudah disiapkan untuk integrasi backend
- Event handler sudah disiapkan untuk menerima response dari backend

## Catatan Teknis

- Menggunakan komponen CameraModal yang sudah ada
- Memanfaatkan library geolocation dari absensi harian
- Type safety dengan TypeScript
- Error handling dan loading states
- Accessible dengan proper ARIA labels

## Next Steps (Backend)

1. Buat API endpoint untuk menyimpan data absensi lembur
2. Implementasi upload foto ke storage
3. Validasi data di backend
4. Integrasi dengan sistem approval
5. Laporan dan tracking absensi lembur

## Testing

- Komponen berhasil dikompilasi tanpa error TypeScript
- UI responsive untuk berbagai ukuran layar
- Flow absensi masuk dan keluar berfungsi dengan baik
- Preview data tampil dengan benar
