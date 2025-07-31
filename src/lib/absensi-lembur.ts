// src/lib/absensi-lembur.ts
import { directus, type AbsensiLembur } from "./directus";
import { createItem, readItems, updateItem, uploadFiles } from "@directus/sdk";
import { user } from "./auth";
import { get } from "svelte/store";
import { getSecureTimestamp, validateClientTime } from "./time-security";

// Re-export AbsensiLembur type
export type { AbsensiLembur };

// Interface untuk data absensi yang dikirim dari UI
export interface AbsensiLemburData {
  type: "masuk" | "keluar";
  foto: string; // Base64 data URL
  lokasi: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  };
  keterangan?: string;
  timestamp: string;
}

// Interface untuk submission data
export interface AbsensiLemburSubmission {
  lembur_id?: string; // Optional untuk absensi mandiri
  foto: File;
  lokasi: {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  };
  keterangan?: string;
}

/**
 * Konversi base64 data URL ke File object
 */
function dataURLtoFile(dataURL: string, filename: string): File {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Upload foto absensi ke Directus
 */
async function uploadFotoAbsensi(
  foto: File,
  type: "masuk" | "keluar",
  userId: string,
  lemburId: string
): Promise<string> {
  try {
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `absensi-lembur-${type}-${userId}-${lemburId}-${timestamp}.jpg`;

    // Rename file dengan format yang konsisten
    const renamedFile = new File([foto], filename, { type: foto.type });
    formData.append("file", renamedFile);

    const result = await directus.request(uploadFiles(formData));

    if (!result || !result.id) {
      throw new Error("Gagal mengupload foto");
    }

    return result.id;
  } catch (error) {
    console.error("Error uploading foto:", error);
    throw new Error("Gagal mengupload foto absensi");
  }
}

/**
 * Hitung durasi lembur berdasarkan waktu masuk dan keluar
 */
function calculateDurasiAktual(
  waktuMasuk: string,
  waktuKeluar: string
): {
  jam: number;
  menit: number;
} {
  const [masukJam, masukMenit, masukDetik] = waktuMasuk.split(":").map(Number);
  const [keluarJam, keluarMenit, keluarDetik] = waktuKeluar
    .split(":")
    .map(Number);

  const masukTotalDetik = masukJam * 3600 + masukMenit * 60 + (masukDetik || 0);
  const keluarTotalDetik =
    keluarJam * 3600 + keluarMenit * 60 + (keluarDetik || 0);

  let durasiTotalDetik = keluarTotalDetik - masukTotalDetik;

  // Jika keluar di hari berikutnya (lewat tengah malam)
  if (durasiTotalDetik < 0) {
    durasiTotalDetik += 24 * 3600; // Tambah 24 jam
  }

  const durasiTotalMenit = Math.floor(durasiTotalDetik / 60);
  const jam = Math.floor(durasiTotalMenit / 60);
  const menit = durasiTotalMenit % 60;

  return { jam, menit };
}

/**
 * Cari atau buat record absensi lembur
 */
async function getOrCreateAbsensiLembur(
  lemburId: string
): Promise<AbsensiLembur> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    // Cek apakah sudah ada record absensi untuk lembur ini
    const existingRecords = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          lembur_id: { _eq: lemburId },
          user_id: { _eq: currentUser.id },
        },
        limit: 1,
      })
    );

    if (existingRecords && existingRecords.length > 0) {
      return existingRecords[0] as AbsensiLembur;
    }

    // Buat record baru jika belum ada
    const newRecord: Partial<AbsensiLembur> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap || currentUser.email,
      divisi: currentUser.divisi || "",
      lembur_id: lemburId,
      tanggal: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      is_completed: false,
      status_absensi: "belum_mulai",
    };

    const created = await directus.request(
      createItem("absensi_lembur", newRecord)
    );
    return created as AbsensiLembur;
  } catch (error) {
    console.error("Error getting/creating absensi lembur:", error);
    throw new Error("Gagal menyiapkan data absensi lembur");
  }
}

/**
 * Absensi masuk lembur
 */
export async function absensiMasukLembur(
  lemburId: string,
  data: AbsensiLemburData
): Promise<AbsensiLembur> {
  try {
    // Validasi waktu sistem
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(`Validasi waktu gagal: ${timeValidation.message}`);
    }

    // Get secure timestamp
    const { serverTime } = await getSecureTimestamp();
    const waktuMasuk = serverTime.toTimeString().split(" ")[0]; // HH:MM:SS

    // Konversi foto dari base64 ke File
    const fotoFile = dataURLtoFile(
      data.foto,
      `absensi-masuk-${Date.now()}.jpg`
    );

    // Upload foto
    const fotoId = await uploadFotoAbsensi(fotoFile, "masuk", "", lemburId);

    // Get atau create record absensi
    const absensiRecord = await getOrCreateAbsensiLembur(lemburId);

    // Update record dengan data absensi masuk
    const updateData: Partial<AbsensiLembur> = {
      waktu_masuk: waktuMasuk,
      foto_masuk: fotoId,
      lokasi_masuk_lat: data.lokasi.latitude,
      lokasi_masuk_lng: data.lokasi.longitude,
      lokasi_masuk_address: data.lokasi.address,
      lokasi_masuk_accuracy: data.lokasi.accuracy,
      keterangan_masuk: data.keterangan,
      status_absensi: "sedang_lembur",
    };

    const updated = await directus.request(
      updateItem("absensi_lembur", absensiRecord.id!, updateData)
    );

    return updated as AbsensiLembur;
  } catch (error) {
    console.error("Error absensi masuk lembur:", error);
    throw error;
  }
}

/**
 * Absensi keluar lembur
 */
export async function absensiKeluarLembur(
  lemburId: string,
  data: AbsensiLemburData
): Promise<AbsensiLembur> {
  try {
    // Validasi waktu sistem
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(`Validasi waktu gagal: ${timeValidation.message}`);
    }

    // Get secure timestamp
    const { serverTime } = await getSecureTimestamp();
    const waktuKeluar = serverTime.toTimeString().split(" ")[0]; // HH:MM:SS

    // Konversi foto dari base64 ke File
    const fotoFile = dataURLtoFile(
      data.foto,
      `absensi-keluar-${Date.now()}.jpg`
    );

    // Upload foto
    const fotoId = await uploadFotoAbsensi(fotoFile, "keluar", "", lemburId);

    // Get record absensi yang sudah ada
    const absensiRecord = await getOrCreateAbsensiLembur(lemburId);

    if (!absensiRecord.waktu_masuk) {
      throw new Error("Absensi masuk belum dilakukan");
    }

    // Hitung durasi aktual
    const durasi = calculateDurasiAktual(
      absensiRecord.waktu_masuk,
      waktuKeluar
    );

    // Update record dengan data absensi keluar
    const updateData: Partial<AbsensiLembur> = {
      waktu_keluar: waktuKeluar,
      foto_keluar: fotoId,
      lokasi_keluar_lat: data.lokasi.latitude,
      lokasi_keluar_lng: data.lokasi.longitude,
      lokasi_keluar_address: data.lokasi.address,
      lokasi_keluar_accuracy: data.lokasi.accuracy,
      keterangan_keluar: data.keterangan,
      durasi_aktual_jam: durasi.jam,
      durasi_aktual_menit: durasi.menit,
      is_completed: true,
      status_absensi: "selesai",
    };

    const updated = await directus.request(
      updateItem("absensi_lembur", absensiRecord.id!, updateData)
    );

    return updated as AbsensiLembur;
  } catch (error) {
    console.error("Error absensi keluar lembur:", error);
    throw error;
  }
}

/**
 * Get data absensi lembur berdasarkan lembur ID
 */
export async function getAbsensiLembur(
  lemburId: string
): Promise<AbsensiLembur | null> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    const records = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          lembur_id: { _eq: lemburId },
          user_id: { _eq: currentUser.id },
        },
        limit: 1,
      })
    );

    return records && records.length > 0 ? (records[0] as AbsensiLembur) : null;
  } catch (error) {
    console.error("Error getting absensi lembur:", error);
    return null;
  }
}

/**
 * Get riwayat absensi lembur user
 */
export async function getRiwayatAbsensiLembur(
  limit = 10,
  offset = 0
): Promise<AbsensiLembur[]> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    const records = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          user_id: { _eq: currentUser.id },
        },
        sort: ["-date_created"],
        limit,
        offset,
      })
    );

    return (records as AbsensiLembur[]) || [];
  } catch (error) {
    console.error("Error getting riwayat absensi lembur:", error);
    throw new Error("Gagal memuat riwayat absensi lembur");
  }
}

/**
 * Format durasi untuk tampilan
 */
export function formatDurasiAktual(jam: number, menit: number): string {
  if (jam === 0 && menit === 0) {
    return "0 menit";
  }

  if (jam === 0) {
    return `${menit} menit`;
  }

  if (menit === 0) {
    return `${jam} jam`;
  }

  return `${jam} jam ${menit} menit`;
}

/**
 * Cek apakah user bisa melakukan absensi masuk
 */
export function canAbsensiMasuk(absensi: AbsensiLembur | null): boolean {
  return !absensi || !absensi.waktu_masuk;
}

/**
 * Cek apakah user bisa melakukan absensi keluar
 */
export function canAbsensiKeluar(absensi: AbsensiLembur | null): boolean {
  return absensi !== null && !!absensi.waktu_masuk && !absensi.waktu_keluar;
}

/**
 * Absensi lembur mandiri (tanpa pengajuan terlebih dahulu)
 * Mencari atau membuat record absensi lembur untuk hari ini
 */
async function getOrCreateAbsensiLemburMandiri(): Promise<AbsensiLembur> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // Cek apakah sudah ada record absensi untuk hari ini (tanpa lembur_id)
    const existingRecords = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          user_id: { _eq: currentUser.id },
          tanggal: { _eq: today },
          lembur_id: { _null: true }, // Record mandiri (tidak terkait pengajuan)
        },
        limit: 1,
      })
    );

    if (existingRecords && existingRecords.length > 0) {
      return existingRecords[0] as AbsensiLembur;
    }

    // Buat record baru untuk absensi mandiri
    const newRecord: Partial<AbsensiLembur> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap || currentUser.email,
      divisi: currentUser.divisi || "",
      // lembur_id: undefined, // Tidak set (null) untuk record mandiri
      tanggal: today,
      is_completed: false,
      status_absensi: "belum_mulai",
      keterangan_masuk: "Absensi lembur mandiri",
    };

    const createdRecord = await directus.request(
      createItem("absensi_lembur", newRecord)
    );

    return createdRecord as AbsensiLembur;
  } catch (error) {
    console.error("Error getting/creating absensi lembur mandiri:", error);
    throw new Error("Gagal membuat record absensi lembur mandiri");
  }
}

/**
 * Absensi masuk lembur mandiri
 */
export async function absensiMasukLemburMandiri(
  data: AbsensiLemburSubmission
): Promise<void> {
  try {
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(timeValidation.message);
    }

    const absensiRecord = await getOrCreateAbsensiLemburMandiri();

    if (absensiRecord.waktu_masuk) {
      throw new Error("Anda sudah melakukan absensi masuk hari ini");
    }

    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const fotoId = await uploadFotoAbsensi(
      data.foto,
      "masuk",
      currentUser.id,
      "mandiri"
    );
    const secureTimestamp = await getSecureTimestamp();

    const updateData: Partial<AbsensiLembur> = {
      waktu_masuk: secureTimestamp.jakartaTime.split("T")[1].split(".")[0], // HH:MM:SS
      foto_masuk: fotoId,
      lokasi_masuk_lat: data.lokasi.latitude,
      lokasi_masuk_lng: data.lokasi.longitude,
      lokasi_masuk_address:
        data.lokasi.address ||
        `${data.lokasi.latitude.toFixed(6)}, ${data.lokasi.longitude.toFixed(
          6
        )}`,
      lokasi_masuk_accuracy: data.lokasi.accuracy,
      status_absensi: "sedang_lembur",
      keterangan_masuk: data.keterangan || absensiRecord.keterangan_masuk,
    };

    await directus.request(
      updateItem("absensi_lembur", absensiRecord.id!, updateData)
    );
  } catch (error) {
    console.error("Error absensi masuk lembur mandiri:", error);
    throw error;
  }
}

/**
 * Absensi keluar lembur mandiri
 */
export async function absensiKeluarLemburMandiri(
  data: AbsensiLemburSubmission
): Promise<void> {
  try {
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(timeValidation.message);
    }

    const today = new Date().toISOString().split("T")[0];
    const currentUser = get(user);

    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    // Cari record absensi hari ini
    const existingRecords = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          user_id: { _eq: currentUser.id },
          tanggal: { _eq: today },
          lembur_id: { _null: true }, // Record mandiri menggunakan null
        },
        limit: 1,
      })
    );

    if (!existingRecords || existingRecords.length === 0) {
      throw new Error("Anda belum melakukan absensi masuk hari ini");
    }

    const absensiRecord = existingRecords[0] as AbsensiLembur;

    if (!absensiRecord.waktu_masuk) {
      throw new Error("Anda harus melakukan absensi masuk terlebih dahulu");
    }

    if (absensiRecord.waktu_keluar) {
      throw new Error("Anda sudah melakukan absensi keluar hari ini");
    }

    const fotoId = await uploadFotoAbsensi(
      data.foto,
      "keluar",
      currentUser.id,
      "mandiri"
    );
    const secureTimestamp = await getSecureTimestamp();

    const waktuKeluar = secureTimestamp.jakartaTime.split("T")[1].split(".")[0]; // HH:MM:SS
    const durasi = calculateDurasiAktual(
      absensiRecord.waktu_masuk!,
      waktuKeluar
    );

    const updateData: Partial<AbsensiLembur> = {
      waktu_keluar: waktuKeluar,
      foto_keluar: fotoId,
      lokasi_keluar_lat: data.lokasi.latitude,
      lokasi_keluar_lng: data.lokasi.longitude,
      lokasi_keluar_address:
        data.lokasi.address ||
        `${data.lokasi.latitude.toFixed(6)}, ${data.lokasi.longitude.toFixed(
          6
        )}`,
      lokasi_keluar_accuracy: data.lokasi.accuracy,
      durasi_aktual_jam: durasi.jam,
      durasi_aktual_menit: durasi.menit,
      status_absensi: "selesai",
      is_completed: true,
      keterangan_keluar: data.keterangan || absensiRecord.keterangan_keluar,
    };

    await directus.request(
      updateItem("absensi_lembur", absensiRecord.id!, updateData)
    );
  } catch (error) {
    console.error("Error absensi keluar lembur mandiri:", error);
    throw error;
  }
}

/**
 * Get absensi lembur mandiri untuk hari ini
 */
export async function getAbsensiLemburMandiri(): Promise<AbsensiLembur | null> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const records = await directus.request(
      readItems("absensi_lembur", {
        filter: {
          user_id: { _eq: currentUser.id },
          tanggal: { _eq: today },
          lembur_id: { _null: true }, // Record mandiri menggunakan null
        },
        limit: 1,
      })
    );

    return records && records.length > 0 ? (records[0] as AbsensiLembur) : null;
  } catch (error) {
    console.error("Error getting absensi lembur mandiri:", error);
    throw new Error("Gagal memuat data absensi lembur mandiri");
  }
}
