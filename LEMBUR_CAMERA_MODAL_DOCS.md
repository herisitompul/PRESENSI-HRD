# LemburCameraModal Documentation

## Overview

`LemburCameraModal` adalah komponen modal kamera khusus untuk absensi lembur yang terpisah dari `CameraModal` reguler. Komponen ini dirancang dengan UI dan fungsionalitas yang berbeda untuk memberikan pengalaman yang unik dan tidak saling tergantung dengan sistem absensi reguler.

## Fitur Utama

### 🎨 **Desain Visual yang Berbeda**

- Warna tema biru gelap (indigo) berbeda dari hijau/biru reguler
- Border dan aksen dengan warna khusus lembur
- Modal overlay dengan blur effect yang berbeda
- Z-index lebih tinggi (1001) untuk memastikan tidak konflik dengan modal reguler

### 🕐 **Validasi Waktu Lembur**

- Validasi khusus untuk jam lembur (di luar jam kerja normal)
- Peringatan jika absensi lembur dilakukan pada jam kerja reguler
- Sistem keamanan waktu yang sama dengan absensi reguler

### 📝 **Input Khusus Lembur**

- Field catatan tambahan untuk deskripsi aktivitas lembur
- Batas karakter 200 untuk catatan
- Real-time counter untuk input catatan
- Support untuk mode mandiri dan mode dengan pengajuan

### 📍 **Context Information**

- Menampilkan deskripsi pekerjaan lembur jika tersedia
- Indikator mode mandiri dengan badge khusus
- Lokasi dengan label "Lokasi Lembur Terdeteksi"

## Props

```typescript
export let isOpen: boolean = false; // Status modal terbuka/tertutup
export let type: "masuk" | "keluar" = "masuk"; // Tipe absensi
export let isMandiri: boolean = false; // Mode lembur mandiri
export let lemburDescription: string = ""; // Deskripsi pekerjaan lembur
```

## Events

### `submit`

Dipanggil ketika user mengkonfirmasi absensi lembur.

**Event Detail:**

```typescript
{
  type: "masuk" | "keluar",
  foto: File,                    // File foto yang diambil
  lokasi: {
    latitude: number,
    longitude: number,
    address?: string,
    accuracy?: number
  },
  keterangan: string,            // Keterangan otomatis + catatan user
  isMandiri: boolean,            // Flag mode mandiri
  lemburNote: string             // Catatan tambahan dari user
}
```

### `close`

Dipanggil ketika modal ditutup.

## Penggunaan

### 1. **Dalam LemburAbsensiButton (Otomatis)**

```svelte
<script>
  import LemburAbsensiButton from "$lib/LemburAbsensiButton.svelte";
</script>

<LemburAbsensiButton
  type="masuk"
  lemburId="some-lembur-id"
  isMandiri={false}
  lemburDescription="Menyelesaikan laporan bulanan"
  on:success={handleSuccess}
/>
```

### 2. **Standalone Usage**

```svelte
<script>
  import LemburCameraModal from "$lib/LemburCameraModal.svelte";

  let showModal = false;
  let isOvertimeMandiri = true;

  function handleSubmit(event) {
    console.log("Lembur absensi data:", event.detail);
    showModal = false;
  }

  function handleClose() {
    showModal = false;
  }
</script>

<LemburCameraModal
  isOpen={showModal}
  type="masuk"
  isMandiri={isOvertimeMandiri}
  lemburDescription="Overtime untuk menyelesaikan project deadline"
  on:submit={handleSubmit}
  on:close={handleClose}
/>

<button on:click={() => showModal = true}>
  Buka Lembur Camera Modal
</button>
```

## Perbedaan dengan CameraModal Reguler

| Aspek              | CameraModal       | LemburCameraModal                  |
| ------------------ | ----------------- | ---------------------------------- |
| **Warna Tema**     | Hijau/Biru        | Indigo/Biru Gelap                  |
| **Z-Index**        | 1000              | 1001                               |
| **Validasi Waktu** | Jam kerja reguler | Jam lembur (di luar jam kerja)     |
| **Input Tambahan** | Tidak ada         | Catatan lembur (200 karakter)      |
| **Context Info**   | Tidak ada         | Deskripsi pekerjaan lembur         |
| **Badge Mode**     | Tidak ada         | Badge "Mandiri" untuk mode mandiri |
| **Class Prefix**   | Standar           | `lembur-` prefix                   |
| **Icons**          | 📷                | 🕐                                 |

## Styling

Semua class CSS menggunakan prefix `lembur-` untuk memastikan tidak ada konflik dengan styling modal reguler:

- `.lembur-modal-overlay`
- `.lembur-modal-content`
- `.lembur-camera-section`
- Dan seterusnya...

## Keamanan & Validasi

1. **Time Security**: Validasi waktu sistem sama dengan modal reguler
2. **Location Required**: Lokasi GPS wajib sebelum bisa mengambil foto
3. **Photo Required**: Foto wajib sebelum bisa submit
4. **Overtime Hours Warning**: Peringatan jika absensi lembur pada jam kerja normal

## Responsive Design

- Support mobile dengan breakpoint 480px
- Camera frame yang adjustable
- Button layout yang responsive
- Text scaling untuk layar kecil

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Catatan**: Memerlukan akses kamera dan lokasi dari browser.
