// src/lib/lembur.ts
import { directus } from "./directus";
import { createItem, readItems } from "@directus/sdk";
import type { Lembur } from "./directus";
import { user } from "./auth";
import { get } from "svelte/store";

// Interface untuk form submission
export interface LemburSubmission {
  tanggal: string;
  jam_masuk: string;
  jam_keluar: string;
  durasi_jam: number;
  durasi_menit: number;
  deskripsi: string;
}

// Re-export Lembur type for convenience
export type { Lembur };

/**
 * Submit pengajuan lembur baru
 */
export async function submitLembur(data: LemburSubmission): Promise<Lembur> {
  try {
    // Get current user
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const now = new Date();
    const lemburData: Omit<Lembur, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      divisi: currentUser.divisi, // Tambahkan divisi dari user
      tanggal: data.tanggal,
      jam_masuk: data.jam_masuk,
      jam_keluar: data.jam_keluar,
      durasi_jam: data.durasi_jam,
      durasi_menit: data.durasi_menit,
      deskripsi: data.deskripsi,
      status: "pending",
      tanggal_pengajuan: now.toISOString(),
      is_pengajuan_sebelum_h: false, // Default value
    };

    const result = await directus.request(createItem("lembur", lemburData));

    console.log("Lembur submitted successfully:", result);
    return result;
  } catch (error) {
    console.error("Error submitting lembur:", error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'lembur' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'lembur' di Directus."
        );
      }
      throw new Error(`Gagal mengirim pengajuan lembur: ${error.message}`);
    }

    throw new Error("Gagal mengirim pengajuan lembur. Silakan coba lagi.");
  }
}

/**
 * Get riwayat pengajuan lembur user
 */
export async function getLemburHistory(): Promise<Lembur[]> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    const result = await directus.request(
      readItems("lembur", {
        sort: ["-tanggal_pengajuan"],
        limit: 50,
        filter: {
          user_id: { _eq: currentUser.id },
        },
      })
    );

    console.log("Lembur history loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading lembur history:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'lembur' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'lembur' di Directus."
        );
      }
    }

    throw new Error("Gagal memuat riwayat lembur. Silakan coba lagi.");
  }
}

/**
 * Get lembur yang masih pending
 */
export async function getPendingLembur(): Promise<Lembur[]> {
  try {
    const result = await directus.request(
      readItems("lembur", {
        sort: ["-date_created"],
        filter: {
          status: {
            _eq: "pending",
          },
        },
      })
    );

    console.log("Pending lembur loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading pending lembur:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'lembur' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'lembur' di Directus."
        );
      }
    }

    throw new Error("Gagal memuat data lembur pending. Silakan coba lagi.");
  }
}

/**
 * Get lembur yang sudah disetujui
 */
export async function getApprovedLembur(): Promise<Lembur[]> {
  const currentUser = get(user);
  if (!currentUser) {
    return [];
  }

  try {
    const result = await directus.request(
      readItems("lembur", {
        sort: ["-approved_at"],
        filter: {
          status: {
            _eq: "approved",
          },
          user_id: {
            _eq: currentUser.id,
          },
        },
      })
    );

    console.log("Approved lembur loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading approved lembur:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'lembur' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'lembur' di Directus."
        );
      }
    }

    throw new Error(
      "Gagal memuat data lembur yang disetujui. Silakan coba lagi."
    );
  }
}

/**
 * Helper function untuk format durasi
 */
export function formatDurasi(jam: number, menit: number): string {
  if (jam === 0) {
    return `${menit} menit`;
  } else if (menit === 0) {
    return `${jam} jam`;
  } else {
    return `${jam} jam ${menit} menit`;
  }
}

/**
 * Helper function untuk format status
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Menunggu Persetujuan";
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    default:
      return status;
  }
}

/**
 * Helper function untuk format tanggal
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Calculate total lembur hours for user
 */
export async function getTotalLemburHours(): Promise<{
  jam: number;
  menit: number;
}> {
  const currentUser = get(user);
  if (!currentUser) {
    return { jam: 0, menit: 0 };
  }

  try {
    const result = await directus.request(
      readItems("lembur", {
        filter: {
          user_id: { _eq: currentUser.id },
          status: { _eq: "approved" },
        },
      })
    );

    const totalMenit = result.reduce((sum, lembur) => {
      return sum + lembur.durasi_jam * 60 + lembur.durasi_menit;
    }, 0);

    const jam = Math.floor(totalMenit / 60);
    const menit = totalMenit % 60;

    return { jam, menit };
  } catch (error) {
    console.error("Error calculating total lembur hours:", error);
    return { jam: 0, menit: 0 };
  }
}
