# Fitur Cuti Tahunan - Dokumentasi

## Overview
Fitur baru yang menambahkan logika khusus untuk kategori "Cuti Tahunan" dengan sistem perhitungan sisa cuti berdasarkan alokasi 12 hari per tahun.

## Fitur yang Ditambahkan

### 1. Alokasi Cuti Tahunan
- **Total alokasi**: 12 hari per tahun (1 Januari - 31 Desember)
- **Periode**: Per tahun kalender (reset setiap 1 Januari)
- **Basis perhitungan**: Berdasarkan tanggal pengajuan yang sudah disetujui (status: "approved")

### 2. Tampilan Informasi Cuti
Ketika kategori "Cuti Tahunan" dipilih, sistem akan menampilkan:
- **Total Alokasi**: 12 hari
- **Sudah Digunakan**: Jumlah hari cuti yang sudah disetujui dalam tahun berjalan
- **Sisa Tersedia**: Sisa cuti yang masih bisa digunakan
- **Status warning**: Jika sisa cuti tinggal sedikit atau sudah habis

### 3. Validasi Otomatis
- **Validasi sisa cuti**: Mencegah pengajuan melebihi sisa cuti yang tersedia
- **Validasi periode tahun**: Memastikan tanggal pengajuan dalam tahun yang sama
- **Peringatan real-time**: Menampilkan peringatan saat menghitung total hari

### 4. Indikator Visual
- **Warna hijau**: Untuk sisa cuti yang tersedia
- **Warna kuning**: Untuk peringatan sisa cuti sedikit (≤3 hari)  
- **Warna merah**: Untuk sisa cuti habis atau pengajuan melebihi batas

## Teknical Implementation

### Database Structure
Menggunakan tabel `izin_hari` yang sudah ada dengan filter:
- `kategori`: "Cuti Tahunan" (sesuai nama di `kategori_izin`)
- `status`: "approved" 
- `tanggal_mulai` & `tanggal_selesai`: Dalam rentang tahun berjalan

### Functions Added
1. `loadCutiTahunanData()`: Memuat data cuti tahunan dari database
2. `onKategoriChange()`: Handler perubahan kategori 
3. Enhanced `validateFormIzinHari()`: Validasi khusus cuti tahunan
4. Enhanced `calculateTotalDays()`: Peringatan real-time

### UI Components
1. **Cuti Info Panel**: Menampilkan ringkasan data cuti
2. **Enhanced Total Days Display**: Indikator visual sisa cuti
3. **Warning Messages**: Peringatan interaktif

## Validasi Rules

### 1. Sisa Cuti
```javascript
if (formDataHari.totalHari > cutiTahunanRemaining) {
  // Error: Melebihi sisa cuti
}
```

### 2. Periode Tahun
```javascript
if (startYear !== currentYear || endYear !== currentYear) {
  // Error: Harus dalam tahun yang sama
}
```

### 3. Real-time Warning
```javascript
if (dayDiff > cutiTahunanRemaining) {
  // Warning: Melebihi sisa cuti (belum submit)
}
```

## Usage Flow

1. **User memilih kategori** "Cuti Tahunan"
2. **System loads data** cuti untuk tahun berjalan
3. **UI menampilkan** informasi sisa cuti
4. **User input tanggal** mulai dan selesai
5. **System hitung** total hari dan berikan peringatan jika perlu
6. **Validasi saat submit** untuk memastikan tidak melebihi batas
7. **Update data** setelah pengajuan berhasil

## Integration Points

### Existing Code
- Menggunakan system izin yang sudah ada
- Compatible dengan approval workflow
- Tidak mempengaruhi kategori izin lainnya

### Database
- Menggunakan tabel `izin_hari` dan `kategori_izin` yang sudah ada
- Tidak memerlukan perubahan schema database
- Filter berdasarkan status "approved" untuk akurasi perhitungan

### Error Handling
- Graceful fallback jika data tidak tersedia
- Loading states untuk UX yang baik
- Non-blocking errors (logging only untuk data cuti)

## Benefits

1. **Transparency**: User dapat melihat sisa cuti secara real-time
2. **Prevention**: Mencegah pengajuan yang melebihi alokasi
3. **User Experience**: Interface yang informatif dan user-friendly
4. **Compliance**: Memastikan penggunaan cuti sesuai kebijakan 12 hari/tahun
5. **Integration**: Seamless dengan sistem yang sudah ada

## Future Enhancements

1. **Historical View**: Melihat penggunaan cuti tahun-tahun sebelumnya
2. **Carry Over**: Logika cuti yang tidak terpakai (jika diperlukan)
3. **Different Categories**: Alokasi berbeda untuk jabatan/divisi tertentu
4. **Reporting**: Dashboard HRD untuk monitoring penggunaan cuti
5. **Notifications**: Reminder otomatis untuk cuti yang akan expired
