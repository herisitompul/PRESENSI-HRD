// src/lib/kasbon.ts
import { directus } from "./directus";
import { createItem, readItems } from "@directus/sdk";
import type { Kasbon } from "./directus";
import { user } from "./auth";
import { get } from "svelte/store";

// Interface untuk form submission
export interface KasbonSubmission {
  tanggal: string;
  nominal: number;
  tenor: number;
  keterangan: string;
}

// Re-export Kasbon type for convenience
export type { Kasbon };

/**
 * Submit pengajuan kasbon baru
 */
export async function submitKasbon(data: KasbonSubmission): Promise<Kasbon> {
  try {
    // Get current user
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const now = new Date();
    const kasbonData: Omit<Kasbon, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      divisi: currentUser.divisi, // Tambahkan divisi dari user
      tanggal: data.tanggal,
      nominal: data.nominal,
      tenor: data.tenor,
      keterangan: data.keterangan,
      status: "pending",
      tanggal_pengajuan: now.toISOString(),
    };

    const result = await directus.request(createItem("kasbon", kasbonData));

    console.log("Kasbon submitted successfully:", result);
    return result;
  } catch (error) {
    console.error("Error submitting kasbon:", error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'kasbon' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'kasbon' di Directus."
        );
      }
      throw new Error(`Gagal mengirim pengajuan kasbon: ${error.message}`);
    }

    throw new Error("Gagal mengirim pengajuan kasbon. Silakan coba lagi.");
  }
}

/**
 * Get riwayat pengajuan kasbon user
 */
export async function getKasbonHistory(): Promise<Kasbon[]> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    const result = await directus.request(
      readItems("kasbon", {
        sort: ["-tanggal_pengajuan"],
        limit: 50,
        filter: {
          user_id: { _eq: currentUser.id },
        },
      })
    );

    console.log("Kasbon history loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading kasbon history:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'kasbon' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'kasbon' di Directus."
        );
      }
    }

    throw new Error("Gagal memuat riwayat kasbon. Silakan coba lagi.");
  }
}

/**
 * Get kasbon yang masih pending
 */
export async function getPendingKasbon(): Promise<Kasbon[]> {
  try {
    const result = await directus.request(
      readItems("kasbon", {
        sort: ["-date_created"],
        filter: {
          status: {
            _eq: "pending",
          },
        },
      })
    );

    console.log("Pending kasbon loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading pending kasbon:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'kasbon' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'kasbon' di Directus."
        );
      }
    }

    throw new Error("Gagal memuat data kasbon pending. Silakan coba lagi.");
  }
}

/**
 * Get kasbon yang sudah disetujui
 */
export async function getApprovedKasbon(): Promise<Kasbon[]> {
  const currentUser = get(user);
  if (!currentUser) {
    return [];
  }

  try {
    const result = await directus.request(
      readItems("kasbon", {
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

    console.log("Approved kasbon loaded:", result);
    return result;
  } catch (error) {
    console.error("Error loading approved kasbon:", error);

    if (error instanceof Error) {
      if (error.message.includes("Collection")) {
        throw new Error(
          "Collection 'kasbon' belum dikonfigurasi. Silakan setup collection di Directus terlebih dahulu."
        );
      }
      if (
        error.message.includes("forbidden") ||
        error.message.includes("Akses ditolak")
      ) {
        throw new Error(
          "Akses ditolak. Periksa permissions untuk collection 'kasbon' di Directus."
        );
      }
    }

    throw new Error(
      "Gagal memuat data kasbon yang disetujui. Silakan coba lagi."
    );
  }
}

/**
 * Helper function untuk format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
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
 * Calculate total kasbon amount for user
 */
export async function getTotalKasbonAmount(): Promise<number> {
  const currentUser = get(user);
  if (!currentUser) {
    return 0;
  }

  try {
    const result = await directus.request(
      readItems("kasbon", {
        filter: {
          user_id: { _eq: currentUser.id },
          status: { _eq: "approved" },
        },
      })
    );

    const total = result.reduce((sum, kasbon) => sum + kasbon.nominal, 0);
    return total;
  } catch (error) {
    console.error("Error calculating total kasbon amount:", error);
    return 0;
  }
}
