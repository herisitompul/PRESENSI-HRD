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
      divisi: currentUser.divisi, // <-- kirim divisi user
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
  totalHari: number;
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

    // Calculate total days (use provided value if available)
    const totalHari =
      data.totalHari ||
      (() => {
        const startDate = new Date(data.tanggalMulai);
        const endDate = new Date(data.tanggalSelesai);
        const timeDiff = endDate.getTime() - startDate.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      })();

    const now = new Date();
    // Phase 1: Basic submission data only
    const izinData: Omit<IzinHari, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      divisi: currentUser.divisi, // <-- kirim divisi user
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

// Update izin jam request (only if status is pending)
export async function updateIzinJam(
  id: string,
  data: {
    kategori: string;
    tanggal: string;
    dariJam: string;
    sampaiJam: string;
    keterangan: string;
    lampiran?: File;
  }
): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    await initDirectus();

    // Check if item exists and belongs to current user
    const existingItem = await directus.request(
      readItems("izin_jam", {
        filter: {
          id: { _eq: id },
          user_id: { _eq: currentUser.id },
        },
      })
    );

    if (!existingItem || existingItem.length === 0) {
      throw new Error("Data izin tidak ditemukan atau bukan milik Anda");
    }

    const currentItem = existingItem[0] as IzinJam;
    if (currentItem.status !== "pending") {
      throw new Error(
        "Hanya pengajuan dengan status pending yang dapat diedit"
      );
    }

    let lampiranId = currentItem.lampiran;

    // Upload lampiran if provided
    if (data.lampiran) {
      lampiranId = await uploadLampiran(data.lampiran);
    }

    const updateData = {
      kategori: data.kategori as "izin" | "cuti" | "sakit",
      tanggal: data.tanggal,
      dari_jam: data.dariJam,
      sampai_jam: data.sampaiJam,
      keterangan: data.keterangan,
      lampiran: lampiranId || undefined,
    };

    await directus.request(updateItem("izin_jam", id, updateData));
  } catch (error) {
    console.error("Update izin jam error:", error);

    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error("Akses ditolak untuk mengupdate data izin");
      } else if (response?.status === 404) {
        throw new Error("Data izin tidak ditemukan");
      } else {
        throw new Error(
          `Error ${response?.status || "Unknown"}: Gagal mengupdate data`
        );
      }
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(
        "Gagal terhubung ke server. Periksa koneksi internet Anda."
      );
    }
  }
}

// Update izin hari request (only if status is pending)
export async function updateIzinHari(
  id: string,
  data: {
    kategori: string;
    tanggalMulai: string;
    tanggalSelesai: string;
    totalHari: number;
    keterangan: string;
    lampiran?: File;
  }
): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    await initDirectus();

    // Check if item exists and belongs to current user
    const existingItem = await directus.request(
      readItems("izin_hari", {
        filter: {
          id: { _eq: id },
          user_id: { _eq: currentUser.id },
        },
      })
    );

    if (!existingItem || existingItem.length === 0) {
      throw new Error("Data izin tidak ditemukan atau bukan milik Anda");
    }

    const currentItem = existingItem[0] as IzinHari;
    if (currentItem.status !== "pending") {
      throw new Error(
        "Hanya pengajuan dengan status pending yang dapat diedit"
      );
    }

    let lampiranId = currentItem.lampiran;

    // Upload lampiran if provided
    if (data.lampiran) {
      lampiranId = await uploadLampiran(data.lampiran);
    }

    const updateData = {
      kategori: data.kategori as "izin" | "cuti" | "sakit",
      tanggal_mulai: data.tanggalMulai,
      tanggal_selesai: data.tanggalSelesai,
      total_hari: data.totalHari,
      keterangan: data.keterangan,
      lampiran: lampiranId || undefined,
    };

    await directus.request(updateItem("izin_hari", id, updateData));
  } catch (error) {
    console.error("Update izin hari error:", error);

    if (error && typeof error === "object" && "response" in error) {
      const response = (error as any).response;
      if (response?.status === 403) {
        throw new Error("Akses ditolak untuk mengupdate data izin");
      } else if (response?.status === 404) {
        throw new Error("Data izin tidak ditemukan");
      } else {
        throw new Error(
          `Error ${response?.status || "Unknown"}: Gagal mengupdate data`
        );
      }
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(
        "Gagal terhubung ke server. Periksa koneksi internet Anda."
      );
    }
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

/**
 * APPROVAL WORKFLOW UTILITY FUNCTIONS
 * Similar to lembur approval system
 */

export interface IzinApprovalStageInfo {
  stage: string;
  title: string;
  order: number;
  completed: boolean;
  approved?: boolean;
  approver?: string;
  date?: string;
  rejectionReason?: string;
}

/**
 * Mendapatkan informasi lengkap tentang tahapan approval untuk izin
 */
export function getIzinApprovalStages(
  izin: IzinJam | IzinHari
): IzinApprovalStageInfo[] {
  const stages: IzinApprovalStageInfo[] = [
    {
      stage: "manager_divisi",
      title: "Manager Divisi",
      order: 1,
      completed: !!izin.manager_divisi_approved_by,
      approved: izin.manager_divisi_approved,
      approver: izin.manager_divisi_approved_by,
      date: izin.manager_divisi_approved_date,
      rejectionReason: izin.manager_divisi_rejection_reason,
    },
    {
      stage: "hrd_admin",
      title: "HRD Admin",
      order: 2,
      completed: !!izin.hrd_admin_approved_by,
      approved: izin.hrd_admin_approved,
      approver: izin.hrd_admin_approved_by,
      date: izin.hrd_admin_approved_date,
      rejectionReason: izin.hrd_admin_rejection_reason,
    },
    {
      stage: "manager_hrd",
      title: "Manager HRD",
      order: 3,
      completed: !!izin.manager_hrd_approved_by,
      approved: izin.manager_hrd_approved,
      approver: izin.manager_hrd_approved_by,
      date: izin.manager_hrd_approved_date,
      rejectionReason: izin.manager_hrd_rejection_reason,
    },
    {
      stage: "direktur",
      title: "Direktur",
      order: 4,
      completed: !!izin.direktur_approved_by,
      approved: izin.direktur_approved,
      approver: izin.direktur_approved_by,
      date: izin.direktur_approved_date,
      rejectionReason: izin.direktur_rejection_reason,
    },
  ];

  return stages;
}

/**
 * Mendapatkan status approval saat ini untuk izin
 */
export function getCurrentIzinApprovalStatus(izin: IzinJam | IzinHari): {
  currentStage: string | null;
  overallStatus: "pending" | "approved" | "rejected";
  finalApprover?: string;
  finalDate?: string;
  finalRejectionReason?: string;
} {
  // Cek apakah ada final approval/rejection
  if (izin.final_approved_by && izin.final_approved_date) {
    return {
      currentStage: "completed",
      overallStatus: "approved",
      finalApprover: izin.final_approved_by,
      finalDate: izin.final_approved_date,
    };
  }

  if (izin.final_rejection_reason) {
    return {
      currentStage: "rejected",
      overallStatus: "rejected",
      finalRejectionReason: izin.final_rejection_reason,
    };
  }

  // Cek tahapan yang ditolak
  const stages = getIzinApprovalStages(izin);
  for (const stage of stages) {
    if (stage.completed && stage.approved === false) {
      return {
        currentStage: stage.stage,
        overallStatus: "rejected",
        finalRejectionReason: stage.rejectionReason,
      };
    }
  }

  // Cek tahapan yang sedang menunggu approval
  for (const stage of stages) {
    if (!stage.completed) {
      return {
        currentStage: stage.stage,
        overallStatus: "pending",
      };
    }
  }

  // Semua tahapan selesai tapi belum ada final approval
  return {
    currentStage: "waiting_final",
    overallStatus: "pending",
  };
}

/**
 * Format tanggal untuk tampilan izin (reuse from lembur)
 */
export function formatIzinApprovalDate(dateString?: string): string {
  if (!dateString) return "—";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Mendapatkan ikon status approval izin
 */
export function getIzinApprovalStatusIcon(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) return "fas fa-clock";
  if (approved === true) return "fas fa-check-circle";
  if (approved === false) return "fas fa-times-circle";
  return "fas fa-clock";
}

/**
 * Mendapatkan warna status approval izin
 */
export function getIzinApprovalStatusColor(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) return "#f59e0b"; // amber
  if (approved === true) return "#10b981"; // green
  if (approved === false) return "#ef4444"; // red
  return "#f59e0b"; // amber
}
