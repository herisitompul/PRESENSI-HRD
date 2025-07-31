// src/lib/kasbon.ts
import { directus } from "./directus";
import { createItem, readItems, updateItem } from "@directus/sdk";
import type { Kasbon, KasbonPayment } from "./directus";
import { user } from "./auth";
import { get } from "svelte/store";

// Interface untuk form submission
export interface KasbonSubmission {
  tanggal: string;
  nominal: number;
  tenor: number;
  keterangan: string;
}

// Interface untuk statistik kasbon
export interface KasbonStatistics {
  totalKasbon: number;
  totalPaid: number;
  remainingDebt: number;
  activeKasbon: number;
  completedKasbon: number;
}

// Interface untuk progress pembayaran
export interface PaymentProgress {
  kasbon: Kasbon;
  payments: KasbonPayment[];
  progressPercentage: number;
  remainingAmount: number;
  nextPaymentDue?: Date;
  monthsPassed: number;
  monthsRemaining: number;
  paymentStatus: "on_time" | "overdue" | "completed" | "not_started";
}

// Re-export Kasbon type for convenience
export type { Kasbon, KasbonPayment };

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
 * Update pengajuan kasbon yang masih pending
 */
export async function updateKasbon(
  id: string,
  data: KasbonSubmission
): Promise<Kasbon> {
  try {
    // Get current user
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const updateData: Partial<Kasbon> = {
      tanggal: data.tanggal,
      nominal: data.nominal,
      tenor: data.tenor,
      keterangan: data.keterangan,
      // Hanya update field yang diperbolehkan, tidak mengubah status atau data sistem
    };

    const result = await directus.request(updateItem("kasbon", id, updateData));

    console.log("Kasbon updated successfully:", result);
    return result;
  } catch (error) {
    console.error("Error updating kasbon:", error);

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
      if (error.message.includes("not found")) {
        throw new Error(
          "Pengajuan kasbon tidak ditemukan atau sudah tidak dapat diedit."
        );
      }
      throw new Error(`Gagal memperbarui pengajuan kasbon: ${error.message}`);
    }

    throw new Error("Gagal memperbarui pengajuan kasbon. Silakan coba lagi.");
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

/**
 * Helper function untuk format currency (alias untuk compatibility)
 */
export function formatRupiah(amount: number): string {
  return formatCurrency(amount);
}

/**
 * KASBON APPROVAL WORKFLOW UTILITY FUNCTIONS
 * Simplified approval system with only Manager HRD
 */

export interface KasbonApprovalStageInfo {
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
 * Mendapatkan informasi lengkap tentang tahapan approval untuk kasbon
 * Kasbon hanya memerlukan persetujuan Manager HRD
 */
export function getKasbonApprovalStages(
  kasbon: Kasbon
): KasbonApprovalStageInfo[] {
  const stages: KasbonApprovalStageInfo[] = [
    {
      stage: "manager_hrd",
      title: "Manager HRD",
      order: 1,
      completed:
        kasbon.manager_hrd_approved !== null &&
        kasbon.manager_hrd_approved !== undefined,
      approved: kasbon.manager_hrd_approved || undefined,
      approver: kasbon.manager_hrd_approved_by || undefined,
      date: kasbon.manager_hrd_approved_date || undefined,
      rejectionReason: kasbon.manager_hrd_rejection_reason || undefined,
    },
  ];

  return stages.sort((a, b) => a.order - b.order);
}

/**
 * Mendapatkan status approval saat ini untuk kasbon
 */
export function getCurrentKasbonApprovalStatus(kasbon: Kasbon) {
  const stages = getKasbonApprovalStages(kasbon);

  // Cek apakah ada yang ditolak
  const rejectedStage = stages.find(
    (stage) => stage.completed && stage.approved === false
  );
  if (rejectedStage) {
    return {
      currentStage: rejectedStage.stage,
      overallStatus: "rejected" as const,
      finalApprover: rejectedStage.approver,
      finalDate: rejectedStage.date,
      finalRejectionReason: rejectedStage.rejectionReason,
    };
  }

  // Cek apakah semua sudah approved
  const allCompleted = stages.every(
    (stage) => stage.completed && stage.approved === true
  );
  if (allCompleted) {
    const finalStage = stages[stages.length - 1];
    return {
      currentStage: null,
      overallStatus: "approved" as const,
      finalApprover: finalStage.approver,
      finalDate: finalStage.date,
    };
  }

  // Masih dalam proses - cari stage yang belum completed
  const currentStage = stages.find((stage) => !stage.completed);
  return {
    currentStage: currentStage?.stage || null,
    overallStatus: "pending" as const,
  };
}

/**
 * Format tanggal approval untuk tampilan
 */
export function formatKasbonApprovalDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Mendapatkan warna untuk status approval icon
 */
export function getKasbonApprovalStatusColor(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) {
    return "#fbbf24"; // yellow untuk pending
  }

  if (approved === true) {
    return "#10b981"; // green untuk approved
  } else if (approved === false) {
    return "#ef4444"; // red untuk rejected
  }

  return "#94a3b8"; // gray default
}

/**
 * Mendapatkan icon untuk status approval
 */
export function getKasbonApprovalStatusIcon(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) {
    return "fas fa-clock"; // clock untuk pending
  }

  if (approved === true) {
    return "fas fa-check"; // check untuk approved
  } else if (approved === false) {
    return "fas fa-times"; // times untuk rejected
  }

  return "fas fa-question"; // question default
}

/**
 * KASBON PAYMENT & DASHBOARD FUNCTIONS
 */

/**
 * Mendapatkan kasbon aktif user (yang sudah approved)
 */
export async function getActiveKasbon(): Promise<Kasbon[]> {
  try {
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const result = await directus.request(
      readItems("kasbon", {
        filter: {
          user_id: { _eq: currentUser.id },
          status: { _eq: "approved" },
          payment_status: { _neq: "completed" },
        },
        sort: ["-tanggal_pengajuan"],
      })
    );

    return result;
  } catch (error) {
    console.error("Error fetching active kasbon:", error);
    throw new Error("Gagal mengambil data kasbon aktif");
  }
}

/**
 * Mendapatkan riwayat pembayaran untuk kasbon tertentu
 */
export async function getKasbonPayments(
  kasbonId: string
): Promise<KasbonPayment[]> {
  try {
    const result = await directus.request(
      readItems("kasbon_payments", {
        filter: {
          kasbon_id: { _eq: kasbonId },
        },
        sort: ["-payment_date"],
      })
    );

    return result;
  } catch (error) {
    console.error("Error fetching kasbon payments:", error);
    throw new Error("Gagal mengambil data pembayaran kasbon");
  }
}

/**
 * Mendapatkan statistik kasbon user
 */
export async function getKasbonStatistics(): Promise<KasbonStatistics> {
  try {
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    // Get all kasbon for user
    const allKasbon = await directus.request(
      readItems("kasbon", {
        filter: {
          user_id: { _eq: currentUser.id },
        },
      })
    );

    // Calculate statistics
    const totalKasbon = allKasbon.reduce(
      (sum, kasbon) => sum + kasbon.nominal,
      0
    );
    const totalPaid = allKasbon.reduce(
      (sum, kasbon) => sum + (kasbon.total_paid || 0),
      0
    );
    const remainingDebt = totalKasbon - totalPaid;
    const activeKasbon = allKasbon.filter(
      (k) => k.status === "approved" && k.payment_status !== "completed"
    ).length;
    const completedKasbon = allKasbon.filter(
      (k) => k.payment_status === "completed"
    ).length;

    return {
      totalKasbon,
      totalPaid,
      remainingDebt,
      activeKasbon,
      completedKasbon,
    };
  } catch (error) {
    console.error("Error fetching kasbon statistics:", error);
    throw new Error("Gagal mengambil statistik kasbon");
  }
}

/**
 * Mendapatkan progress pembayaran untuk kasbon
 */
export async function getPaymentProgress(
  kasbon: Kasbon
): Promise<PaymentProgress> {
  try {
    const payments = await getKasbonPayments(kasbon.id!);

    const totalPaid = kasbon.total_paid || 0;
    const progressPercentage = (totalPaid / kasbon.nominal) * 100;
    const remainingAmount = kasbon.nominal - totalPaid;

    // Calculate months passed and remaining
    const startDate = new Date(kasbon.tanggal);
    const currentDate = new Date();
    const monthsPassed = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    const monthsRemaining = kasbon.tenor - monthsPassed;

    // Calculate next payment due (monthly)
    const nextPaymentDue = new Date(startDate);
    nextPaymentDue.setMonth(nextPaymentDue.getMonth() + monthsPassed + 1);

    // Determine payment status
    let paymentStatus: "on_time" | "overdue" | "completed" | "not_started" =
      "not_started";

    if (progressPercentage >= 100) {
      paymentStatus = "completed";
    } else if (totalPaid > 0) {
      const expectedPaid = (kasbon.nominal / kasbon.tenor) * monthsPassed;
      if (totalPaid >= expectedPaid) {
        paymentStatus = "on_time";
      } else {
        paymentStatus = "overdue";
      }
    }

    return {
      kasbon,
      payments,
      progressPercentage: Math.min(progressPercentage, 100),
      remainingAmount: Math.max(remainingAmount, 0),
      nextPaymentDue:
        paymentStatus !== "completed" ? nextPaymentDue : undefined,
      monthsPassed: Math.max(monthsPassed, 0),
      monthsRemaining: Math.max(monthsRemaining, 0),
      paymentStatus,
    };
  } catch (error) {
    console.error("Error calculating payment progress:", error);
    throw new Error("Gagal menghitung progress pembayaran");
  }
}

/**
 * Format status pembayaran untuk tampilan
 */
export function getPaymentStatusText(status: string): string {
  switch (status) {
    case "on_time":
      return "Tepat Waktu";
    case "overdue":
      return "Terlambat";
    case "completed":
      return "Lunas";
    case "not_started":
      return "Belum Bayar";
    default:
      return "Tidak Diketahui";
  }
}

/**
 * Mendapatkan warna untuk status pembayaran
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case "on_time":
      return "#10b981";
    case "overdue":
      return "#ef4444";
    case "completed":
      return "#6366f1";
    case "not_started":
      return "#f59e0b";
    default:
      return "#94a3b8";
  }
}

/**
 * Mendapatkan icon untuk status pembayaran
 */
export function getPaymentStatusIcon(status: string): string {
  switch (status) {
    case "on_time":
      return "fas fa-check-circle";
    case "overdue":
      return "fas fa-exclamation-triangle";
    case "completed":
      return "fas fa-medal";
    case "not_started":
      return "fas fa-clock";
    default:
      return "fas fa-question-circle";
  }
}

/**
 * Format metode pembayaran untuk tampilan
 */
export function getPaymentMethodText(method?: string): string {
  switch (method) {
    case "cash":
      return "Tunai";
    case "transfer":
      return "Transfer";
    case "deduction":
      return "Potong Gaji";
    case "other":
      return "Lainnya";
    default:
      return "Tidak Diketahui";
  }
}
