# Update Collection Lembur - Field Changes

Dokumen ini menjelaskan perubahan field yang diperlukan untuk collection `lembur` di Directus berdasarkan requirement baru form pengajuan lembur.

## Requirement Baru

1. Pengajuan lembur dilakukan setelah kegiatan lembur selesai
2. Jika pengajuan dilakukan sebelum hari-H, lampiran foto bersifat opsional
3. Sistem menghitung durasi lembur otomatis berdasarkan jam masuk dan jam keluar
4. Dapat menambahkan catatan penyesuaian jika ada perbedaan antara pengajuan dan realisasi

## Field yang Harus DIHAPUS

Hapus field-field berikut dari collection lembur karena tidak digunakan lagi:

1. **`lampiran_foto`** - Diganti dengan field baru
2. **`timestamp_foto`** - Diganti dengan field baru
3. **`is_foto_required`** - Diganti dengan field baru
4. **`lokasi_foto`** - Diganti dengan field baru

## Field yang Harus DITAMBAHKAN

Tambahkan field-field berikut ke collection lembur:

### 1. `jam_masuk`

- **Type**: String
- **Interface**: Time
- **Required**: Yes
- **Description**: Jam masuk lembur (format HH:MM)

### 2. `jam_keluar`

- **Type**: String
- **Interface**: Time
- **Required**: Yes
- **Description**: Jam keluar lembur (format HH:MM)

### 3. `is_pengajuan_sebelum_h`

- **Type**: Boolean
- **Interface**: Toggle
- **Required**: Yes
- **Default**: false
- **Description**: Apakah pengajuan dilakukan sebelum hari-H

### 4. `lampiran_foto_opsional`

- **Type**: File (atau String untuk nama file)
- **Interface**: File (atau Text Input jika menyimpan path/nama file)
- **Required**: No
- **Nullable**: Yes
- **Description**: Foto opsional jika pengajuan sebelum hari-H, direkomendasikan untuk pengajuan setelah lembur
- **Note**: Implementasi dapat menyimpan file langsung atau path/nama file tergantung setup storage

### 5. `catatan_penyesuaian`

- **Type**: Text
- **Interface**: Textarea
- **Required**: No
- **Nullable**: Yes
- **Description**: Catatan jika ada perbedaan antara pengajuan dan realisasi

## Field yang TETAP ADA (dengan modifikasi)

Field-field berikut tetap ada namun ada perubahan:

### Field Standard Directus (Tetap)

- `id` - Primary key
- `user_created` - User yang membuat
- `date_created` - Tanggal dibuat
- `user_updated` - User yang mengupdate
- `date_updated` - Tanggal diupdate

### Field Data User (Tetap)

- `user_id` - ID user
- `email` - Email user
- `nama` - Nama user

### Field Data Lembur (Tetap/Modifikasi)

- `tanggal` - Tanggal lembur (Tetap)
- `deskripsi` - Deskripsi pekerjaan (Tetap)
- `status` - Status persetujuan (Tetap)
- `tanggal_pengajuan` - Tanggal pengajuan dibuat (Tetap)
- **`durasi_jam`** - **DIUBAH**: Sekarang calculated field berdasarkan jam_masuk dan jam_keluar
- **`durasi_menit`** - **DIUBAH**: Sekarang calculated field berdasarkan jam_masuk dan jam_keluar

## Cara Mengubah durasi_jam dan durasi_menit

### **Opsi 1: Database Trigger (Recommended)**

Buat trigger yang otomatis menghitung durasi saat data disimpan:

```sql
-- MySQL/MariaDB
DELIMITER $$

CREATE TRIGGER calculate_lembur_duration
BEFORE INSERT ON lembur
FOR EACH ROW
BEGIN
    DECLARE masuk_minutes INT;
    DECLARE keluar_minutes INT;
    DECLARE duration_minutes INT;

    -- Convert time to minutes
    SET masuk_minutes = TIME_TO_SEC(NEW.jam_masuk) / 60;
    SET keluar_minutes = TIME_TO_SEC(NEW.jam_keluar) / 60;

    -- Calculate duration (handle overnight work)
    SET duration_minutes = keluar_minutes - masuk_minutes;
    IF duration_minutes < 0 THEN
        SET duration_minutes = duration_minutes + (24 * 60);
    END IF;

    -- Set calculated values
    SET NEW.durasi_jam = FLOOR(duration_minutes / 60);
    SET NEW.durasi_menit = duration_minutes % 60;
END$$

CREATE TRIGGER calculate_lembur_duration_update
BEFORE UPDATE ON lembur
FOR EACH ROW
BEGIN
    DECLARE masuk_minutes INT;
    DECLARE keluar_minutes INT;
    DECLARE duration_minutes INT;

    -- Convert time to minutes
    SET masuk_minutes = TIME_TO_SEC(NEW.jam_masuk) / 60;
    SET keluar_minutes = TIME_TO_SEC(NEW.jam_keluar) / 60;

    -- Calculate duration (handle overnight work)
    SET duration_minutes = keluar_minutes - masuk_minutes;
    IF duration_minutes < 0 THEN
        SET duration_minutes = duration_minutes + (24 * 60);
    END IF;

    -- Set calculated values
    SET NEW.durasi_jam = FLOOR(duration_minutes / 60);
    SET NEW.durasi_menit = duration_minutes % 60;
END$$

DELIMITER ;
```

### **Opsi 2: Directus Hook/Flow**

Buat Directus Flow atau Hook untuk menghitung durasi:

1. **Via Directus Admin Panel:**

   - Buka Settings > Flows
   - Buat flow baru dengan trigger "Event Hook"
   - Pilih collection "lembur"
   - Trigger pada "Create" dan "Update"
   - Tambahkan operation "Run Script"

2. **Script untuk Flow:**

```javascript
// Directus Flow Script
module.exports = async function (data) {
  const { jam_masuk, jam_keluar } = data;

  if (!jam_masuk || !jam_keluar) return data;

  // Parse time strings
  const [masukJam, masukMenit] = jam_masuk.split(":").map(Number);
  const [keluarJam, keluarMenit] = jam_keluar.split(":").map(Number);

  // Convert to minutes
  const masukTotalMenit = masukJam * 60 + masukMenit;
  const keluarTotalMenit = keluarJam * 60 + keluarMenit;

  // Calculate duration (handle overnight)
  let durasiTotalMenit = keluarTotalMenit - masukTotalMenit;
  if (durasiTotalMenit < 0) {
    durasiTotalMenit += 24 * 60; // Add 24 hours
  }

  // Set calculated values
  data.durasi_jam = Math.floor(durasiTotalMenit / 60);
  data.durasi_menit = durasiTotalMenit % 60;

  return data;
};
```

### **Opsi 3: Application Level (Current Implementation)**

Tetap hitung di aplikasi seperti sekarang:

```typescript
// Di lembur.ts (sudah diimplementasi)
function calculateDurasi(
  jamMasuk: string,
  jamKeluar: string
): { jam: number; menit: number } {
  const [masukJam, masukMenit] = jamMasuk.split(":").map(Number);
  const [keluarJam, keluarMenit] = jamKeluar.split(":").map(Number);

  const masukTotalMenit = masukJam * 60 + masukMenit;
  const keluarTotalMenit = keluarJam * 60 + keluarMenit;

  let durasiTotalMenit = keluarTotalMenit - masukTotalMenit;

  // Handle overnight work
  if (durasiTotalMenit < 0) {
    durasiTotalMenit += 24 * 60;
  }

  const jam = Math.floor(durasiTotalMenit / 60);
  const menit = durasiTotalMenit % 60;

  return { jam, menit };
}
```

### **Opsi 4: Database View (Read-Only)**

Buat view yang otomatis menghitung durasi:

```sql
CREATE VIEW lembur_with_calculated_duration AS
SELECT
    *,
    FLOOR(
        (CASE
            WHEN TIME_TO_SEC(jam_keluar) >= TIME_TO_SEC(jam_masuk)
            THEN TIME_TO_SEC(jam_keluar) - TIME_TO_SEC(jam_masuk)
            ELSE (TIME_TO_SEC(jam_keluar) + 86400) - TIME_TO_SEC(jam_masuk)
        END) / 3600
    ) AS durasi_jam_calculated,
    FLOOR(
        (CASE
            WHEN TIME_TO_SEC(jam_keluar) >= TIME_TO_SEC(jam_masuk)
            THEN TIME_TO_SEC(jam_keluar) - TIME_TO_SEC(jam_masuk)
            ELSE (TIME_TO_SEC(jam_keluar) + 86400) - TIME_TO_SEC(jam_masuk)
        END) % 3600 / 60
    ) AS durasi_menit_calculated
FROM lembur;
```

## **Rekomendasi:**

1. **Untuk Production**: Gunakan **Database Trigger** (Opsi 1)
2. **Untuk Directus**: Gunakan **Directus Flow** (Opsi 2)
3. **Untuk Development**: Tetap gunakan **Application Level** (Opsi 3)

**Keuntungan Trigger:**

- ✅ Otomatis terhitung saat data disimpan
- ✅ Konsisten di semua aplikasi yang akses database
- ✅ Tidak perlu logic di setiap aplikasi
- ✅ Data selalu akurat

### Field Approval (Tetap)

- `approved_by` - Yang menyetujui (opsional)
- `approved_at` - Tanggal disetujui (opsional)
- `rejection_reason` - Alasan ditolak (opsional)

## Script Migrasi

Berikut contoh script untuk melakukan migrasi field:

```sql
-- Tambah field baru
ALTER TABLE lembur ADD COLUMN jam_masuk VARCHAR(5);
ALTER TABLE lembur ADD COLUMN jam_keluar VARCHAR(5);
ALTER TABLE lembur ADD COLUMN is_pengajuan_sebelum_h BOOLEAN DEFAULT FALSE;
ALTER TABLE lembur ADD COLUMN lampiran_foto_opsional TEXT;
ALTER TABLE lembur ADD COLUMN catatan_penyesuaian TEXT;

-- Hapus field lama
ALTER TABLE lembur DROP COLUMN lampiran_foto;
ALTER TABLE lembur DROP COLUMN timestamp_foto;
ALTER TABLE lembur DROP COLUMN is_foto_required;
ALTER TABLE lembur DROP COLUMN lokasi_foto;
```

## Logika Perhitungan Durasi

Durasi lembur sekarang dihitung otomatis dengan logika:

```typescript
function calculateDurasi(
  jamMasuk: string,
  jamKeluar: string
): { jam: number; menit: number } {
  const [masukJam, masukMenit] = jamMasuk.split(":").map(Number);
  const [keluarJam, keluarMenit] = jamKeluar.split(":").map(Number);

  const masukTotalMenit = masukJam * 60 + masukMenit;
  const keluarTotalMenit = keluarJam * 60 + keluarMenit;

  let durasiTotalMenit = keluarTotalMenit - masukTotalMenit;

  // Jika jam keluar lebih kecil dari jam masuk (lewat tengah malam)
  if (durasiTotalMenit < 0) {
    durasiTotalMenit += 24 * 60; // Tambah 24 jam
  }

  const jam = Math.floor(durasiTotalMenit / 60);
  const menit = durasiTotalMenit % 60;

  return { jam, menit };
}
```

## Update Permissions

Pastikan permissions untuk collection `lembur` telah diatur dengan benar untuk role yang sesuai.

## Testing

Setelah perubahan dilakukan, test:

1. Form pengajuan lembur dengan jam masuk dan keluar
2. Perhitungan durasi otomatis
3. Pengajuan sebelum vs setelah hari-H
4. Field catatan penyesuaian
5. Edit pengajuan yang pending
6. Display riwayat dengan format baru
7. Upload foto opsional/direkomendasikan
8. Validasi file upload (ukuran, tipe file)
