import {
  directus,
  initDirectus,
  type IzinJam,
  type IzinHari,
} from "./directus";
import { readItems, createItem, updateItem, uploadFiles } from "@directus/sdk";
import { user } from "./auth";
import { get } from "svelte/store";

// Re-export types for easier importing
export type { IzinJam, IzinHari } from "./directus";

/**
 * IZIN JAM SERVICE - PHASE 1 IMPLEMENTATION
 *
 * Current features:
 * - Employee submission of izin jam requests
 * - File upload for attachments
 * - Basic status tracking (pending/approved/rejected)
 * - User history retrieval
 *
 * Phase 2 (HRD Dashboard) will include:
 * - Approval/rejection workflow
 * - Admin filtering and search
 * - Approval notes and reasons
 * - Email notifications
 */

// Upload lampiran file to Directus
export async function uploadLampiran(file: File): Promise<string> {
  try {
    await initDirectus();

    const formData = new FormData();
    formData.append("file", file);

    const result = await directus.request(uploadFiles(formData));

    if (result && result.id) {
      return result.id;
    }

    throw new Error("Failed to upload lampiran");
  } catch (error) {
    console.error("Lampiran upload error:", error);
    throw new Error("Gagal mengunggah lampiran");
  }
}

// Submit izin jam request
export async function submitIzinJam(data: {
  kategori: string;
  tanggal: string;
  dariJam: string;
  sampaiJam: string;
  keterangan: string;
  lampiran?: File;
}): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    await initDirectus();

    let lampiranId = null;

    // Upload lampiran if provided
    if (data.lampiran) {
      lampiranId = await uploadLampiran(data.lampiran);
    }

    const now = new Date();
    // Phase 1: Basic submission data only
    const izinData: Omit<IzinJam, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      kategori: data.kategori as "izin" | "cuti" | "sakit",
      tanggal: data.tanggal,
      dari_jam: data.dariJam,
      sampai_jam: data.sampaiJam,
      keterangan: data.keterangan,
      lampiran: lampiranId || undefined,
      status: "pending", // Default status for new submissions
      tanggal_pengajuan: now.toISOString(),
      // Note: HRD approval fields will be handled in Phase 2
    };

    await directus.request(createItem("izin_jam", izinData));
  } catch (error) {
    console.error("Submit izin jam error:", error);

    // Handle different types of errors
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error(
          "Akses ditolak. Collection 'izin_jam' belum dikonfigurasi di Directus atau permissions belum diatur dengan benar."
        );
      } else if (response?.status === 404) {
        throw new Error(
          "Collection 'izin_jam' tidak ditemukan. Silakan buat collection terlebih dahulu di Directus."
        );
      } else if (response?.status === 422) {
        throw new Error(
          "Data tidak valid. Pastikan semua field sudah terisi dengan benar."
        );
      } else {
        throw new Error(
          `Error ${
            response?.status || "Unknown"
          }: Gagal mengirim data ke server.`
        );
      }
    } else {
      throw new Error(
        "Gagal terhubung ke server. Periksa koneksi internet Anda."
      );
    }
  }
}

// Get user's izin jam history
export async function getIzinJamHistory(): Promise<IzinJam[]> {
  const currentUser = get(user);
  if (!currentUser) {
    return [];
  }

  try {
    await initDirectus();

    const items = await directus.request(
      readItems("izin_jam", {
        filter: {
          user_id: { _eq: currentUser.id },
        },
        sort: ["-tanggal_pengajuan"],
        limit: 50,
      })
    );

    return items as IzinJam[];
  } catch (error) {
    console.error("Error fetching izin jam history:", error);

    // Handle different types of errors
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error(
          "Akses ditolak. Collection 'izin_jam' belum dikonfigurasi di Directus atau permissions belum diatur."
        );
      } else if (response?.status === 404) {
        throw new Error("Collection 'izin_jam' tidak ditemukan di Directus.");
      } else {
        throw new Error(
          `Error ${
            response?.status || "Unknown"
          }: Gagal mengambil data dari server.`
        );
      }
    } else {
      throw new Error("Gagal terhubung ke server.");
    }
  }
}

// Get pending izin jam requests (for admin)
export async function getPendingIzinJam(): Promise<IzinJam[]> {
  try {
    await initDirectus();

    const items = await directus.request(
      readItems("izin_jam", {
        filter: {
          status: { _eq: "pending" },
        },
        sort: ["-tanggal_pengajuan"],
        limit: 100,
      })
    );

    return items as IzinJam[];
  } catch (error) {
    console.error("Error fetching pending izin jam:", error);
    return [];
  }
}

// Submit izin hari request
export async function submitIzinHari(data: {
  kategori: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  keterangan: string;
  lampiran?: File;
}): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    await initDirectus();

    let lampiranId = null;

    // Upload lampiran if provided
    if (data.lampiran) {
      lampiranId = await uploadLampiran(data.lampiran);
    }

    // Calculate total days
    const startDate = new Date(data.tanggalMulai);
    const endDate = new Date(data.tanggalSelesai);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalHari = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const now = new Date();
    // Phase 1: Basic submission data only
    const izinData: Omit<IzinHari, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      kategori: data.kategori as "izin" | "cuti" | "sakit",
      tanggal_mulai: data.tanggalMulai,
      tanggal_selesai: data.tanggalSelesai,
      total_hari: totalHari,
      keterangan: data.keterangan,
      lampiran: lampiranId || undefined,
      status: "pending", // Default status for new submissions
      tanggal_pengajuan: now.toISOString(),
      // Note: HRD approval fields will be handled in Phase 2
    };

    await directus.request(createItem("izin_hari", izinData));
  } catch (error) {
    console.error("Submit izin hari error:", error);

    // Handle different types of errors
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error(
          "Akses ditolak. Collection 'izin_hari' belum dikonfigurasi di Directus atau permissions belum diatur dengan benar."
        );
      } else if (response?.status === 404) {
        throw new Error(
          "Collection 'izin_hari' tidak ditemukan. Silakan buat collection terlebih dahulu di Directus."
        );
      } else if (response?.status === 422) {
        throw new Error(
          "Data tidak valid. Pastikan semua field sudah terisi dengan benar."
        );
      } else {
        throw new Error(
          `Error ${
            response?.status || "Unknown"
          }: Gagal mengirim data ke server.`
        );
      }
    } else {
      throw new Error(
        "Gagal terhubung ke server. Periksa koneksi internet Anda."
      );
    }
  }
}

// Get user's izin hari history
export async function getIzinHariHistory(): Promise<IzinHari[]> {
  const currentUser = get(user);
  if (!currentUser) {
    return [];
  }

  try {
    await initDirectus();

    const items = await directus.request(
      readItems("izin_hari", {
        filter: {
          user_id: { _eq: currentUser.id },
        },
        sort: ["-tanggal_pengajuan"],
        limit: 50,
      })
    );

    return items as IzinHari[];
  } catch (error) {
    console.error("Error fetching izin hari history:", error);

    // Handle different types of errors
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error(
          "Akses ditolak. Collection 'izin_hari' belum dikonfigurasi di Directus atau permissions belum diatur."
        );
      } else if (response?.status === 404) {
        throw new Error("Collection 'izin_hari' tidak ditemukan di Directus.");
      } else {
        throw new Error(
          `Error ${
            response?.status || "Unknown"
          }: Gagal mengambil data dari server.`
        );
      }
    } else {
      throw new Error("Gagal terhubung ke server.");
    }
  }
}

// Get pending izin hari requests (for admin)
export async function getPendingIzinHari(): Promise<IzinHari[]> {
  try {
    await initDirectus();

    const items = await directus.request(
      readItems("izin_hari", {
        filter: {
          status: { _eq: "pending" },
        },
        sort: ["-tanggal_pengajuan"],
        limit: 100,
      })
    );

    return items as IzinHari[];
  } catch (error) {
    console.error("Error fetching pending izin hari:", error);
    return [];
  }
}

// Helper function to get all izin history (both jam and hari)
export async function getAllIzinHistory(): Promise<{
  izinJam: IzinJam[];
  izinHari: IzinHari[];
}> {
  try {
    const [izinJam, izinHari] = await Promise.all([
      getIzinJamHistory(),
      getIzinHariHistory(),
    ]);

    return { izinJam, izinHari };
  } catch (error) {
    console.error("Error fetching all izin history:", error);
    return { izinJam: [], izinHari: [] };
  }
}

// Helper function to format status for display
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

// Helper function to format kategori for display
export function formatKategori(kategori: string): string {
  switch (kategori) {
    case "izin":
      return "Izin";
    case "cuti":
      return "Cuti";
    case "sakit":
      return "Sakit";
    default:
      return kategori;
  }
}
