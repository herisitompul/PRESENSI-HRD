// src/lib/lembur.ts
import { directus } from "./directus";
import { createItem, readItems, updateItem, uploadFiles } from "@directus/sdk";
import type { Lembur } from "./directus";
import { user } from "./auth";
import { get } from "svelte/store";

// Interface untuk form submission
export interface LemburSubmission {
  tanggal: string;
  jam_masuk: string;
  jam_keluar: string;
  deskripsi: string;
  is_pengajuan_sebelum_h?: boolean;
  lampiran_foto_opsional?: File | null;
  catatan_penyesuaian?: string;
}

// Interface untuk update lembur (menambahkan flag untuk menjaga foto existing)
export interface LemburUpdateSubmission extends LemburSubmission {
  keep_existing_foto?: boolean; // Flag untuk menjaga foto yang sudah ada
}

// Re-export Lembur type for convenience
export type { Lembur };

/**
 * Menghitung durasi lembur berdasarkan jam masuk dan jam keluar
 */
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

/**
 * Cek apakah pengajuan dilakukan sebelum hari-H
 */
function isPengajuanSebelumH(tanggalLembur: string): boolean {
  const today = new Date();
  const lemburDate = new Date(tanggalLembur);

  // Reset time untuk perbandingan tanggal saja
  today.setHours(0, 0, 0, 0);
  lemburDate.setHours(0, 0, 0, 0);

  const result = lemburDate > today;
  console.log("isPengajuanSebelumH check:", {
    today: today.toISOString(),
    todayLocal: today.toLocaleDateString(),
    lemburDate: lemburDate.toISOString(),
    lemburDateLocal: lemburDate.toLocaleDateString(),
    tanggalLembur,
    result,
  });

  return result;
}

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

    // Hitung durasi otomatis
    const durasi = calculateDurasi(data.jam_masuk, data.jam_keluar);

    // Cek apakah pengajuan sebelum hari-H
    const isPengajuanSebelum =
      data.is_pengajuan_sebelum_h ?? isPengajuanSebelumH(data.tanggal);

    // Handle file upload ke Directus Files API
    let fileId: string | null = null;
    if (
      data.lampiran_foto_opsional &&
      data.lampiran_foto_opsional instanceof File
    ) {
      const fileTitle = `Lampiran Lembur - ${currentUser.nama_lengkap} - ${data.tanggal}`;
      fileId = await uploadFileToDirectus(
        data.lampiran_foto_opsional,
        fileTitle
      );

      if (!fileId) {
        console.warn("File upload failed, proceeding without attachment");
      }
    }

    const now = new Date();

    // Buat data yang kompatibel dengan schema lembur yang ada
    const lemburData: any = {
      user_id: String(currentUser.id), // Pastikan user_id sebagai string
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      divisi: currentUser.divisi, // Tambahkan divisi dari user
      tanggal: data.tanggal,
      durasi_jam: durasi.jam,
      durasi_menit: durasi.menit,
      deskripsi: data.deskripsi,
      status: "pending",
      tanggal_pengajuan: now.toISOString(),
      // Field baru - pastikan format yang benar
      jam_masuk: data.jam_masuk,
      jam_keluar: data.jam_keluar,
      is_pengajuan_sebelum_h: Boolean(isPengajuanSebelum),
      is_foto_required: Boolean(!isPengajuanSebelum),
    };

    // Tambahkan field opsional hanya jika ada nilai
    if (fileId) {
      lemburData.lampiran_foto_opsional = fileId;
    }

    if (data.catatan_penyesuaian && data.catatan_penyesuaian.trim()) {
      lemburData.catatan_penyesuaian = data.catatan_penyesuaian;
    }

    console.log("Data yang akan dikirim ke Directus:", lemburData);
    console.log("Debug field values:", {
      jam_masuk: data.jam_masuk,
      jam_keluar: data.jam_keluar,
      catatan_penyesuaian: data.catatan_penyesuaian,
      fileId: fileId,
      is_pengajuan_sebelum_h: isPengajuanSebelum,
    });

    // Debug: log each field type
    console.log("Field types check:", {
      user_id: typeof lemburData.user_id,
      jam_masuk: typeof lemburData.jam_masuk,
      jam_keluar: typeof lemburData.jam_keluar,
      is_pengajuan_sebelum_h: typeof lemburData.is_pengajuan_sebelum_h,
      is_foto_required: typeof lemburData.is_foto_required,
      lampiran_foto_opsional: typeof lemburData.lampiran_foto_opsional,
      catatan_penyesuaian: typeof lemburData.catatan_penyesuaian,
    });

    try {
      const result = await directus.request(createItem("lembur", lemburData));
      console.log("Lembur submitted successfully:", result);
      return result;
    } catch (directusError) {
      console.error(
        "First attempt failed, trying with minimal fields:",
        directusError
      );

      // Log specific error details
      if (
        directusError &&
        typeof directusError === "object" &&
        "errors" in directusError
      ) {
        const errorDetails = (directusError as any).errors;
        console.error("Directus error details:", errorDetails);

        // Log each error message
        if (Array.isArray(errorDetails)) {
          errorDetails.forEach((err, index) => {
            console.error(`CREATE Error ${index + 1}:`, {
              message: err.message,
              field: err.extensions?.field,
              code: err.extensions?.code,
              reason: err.extensions?.reason,
            });
          });
        }
      }

      // Try with minimal required fields only
      const minimalData: any = {
        user_id: String(currentUser.id), // Pastikan konsisten sebagai string
        email: currentUser.email,
        nama: currentUser.nama_lengkap,
        divisi: currentUser.divisi, // Tambahkan divisi dari user
        tanggal: data.tanggal,
        durasi_jam: durasi.jam,
        durasi_menit: durasi.menit,
        deskripsi: data.deskripsi,
        status: "pending" as const,
        tanggal_pengajuan: now.toISOString(),
      };

      console.log("Trying with minimal data:", minimalData);
      const result = await directus.request(createItem("lembur", minimalData));
      console.log("Lembur submitted with minimal fields:", result);

      // Now try to update with the missing fields
      if (result && result.id) {
        try {
          console.log("Attempting to update with additional fields...");
          const updateData: any = {};

          if (data.jam_masuk) updateData.jam_masuk = data.jam_masuk;
          if (data.jam_keluar) updateData.jam_keluar = data.jam_keluar;
          updateData.is_pengajuan_sebelum_h = isPengajuanSebelum;
          updateData.is_foto_required = !isPengajuanSebelum;

          if (fileId) updateData.lampiran_foto_opsional = fileId;
          if (data.catatan_penyesuaian && data.catatan_penyesuaian.trim()) {
            updateData.catatan_penyesuaian = data.catatan_penyesuaian;
          }

          console.log("Update data:", updateData);

          const updatedResult = await directus.request(
            updateItem("lembur", result.id, updateData)
          );
          console.log(
            "Successfully updated with additional fields:",
            updatedResult
          );
          return updatedResult;
        } catch (updateError) {
          console.error(
            "Failed to update with additional fields:",
            updateError
          );

          // Log detailed update error
          if (
            updateError &&
            typeof updateError === "object" &&
            "errors" in updateError
          ) {
            const updateErrorDetails = (updateError as any).errors;
            console.error("Update error details:", updateErrorDetails);

            if (Array.isArray(updateErrorDetails)) {
              updateErrorDetails.forEach((err, index) => {
                console.error(`Update Error ${index + 1}:`, {
                  message: err.message,
                  field: err.extensions?.field,
                  code: err.extensions?.code,
                  reason: err.extensions?.reason,
                });
              });
            }
          }

          // Try field-by-field update approach
          console.log("Trying field-by-field update approach...");

          // Create test data for individual field testing
          const testData = {
            jam_masuk: data.jam_masuk,
            jam_keluar: data.jam_keluar,
            is_pengajuan_sebelum_h: isPengajuanSebelum,
            is_foto_required: !isPengajuanSebelum,
            lampiran_foto_opsional: fileId,
            catatan_penyesuaian: data.catatan_penyesuaian,
          };

          // Use debug function to test each field individually
          await testFieldsIndividually(result.id, testData);

          try {
            // Update jam_masuk and jam_keluar first (core fields)
            if (data.jam_masuk && data.jam_keluar) {
              const coreUpdate = await directus.request(
                updateItem("lembur", result.id, {
                  jam_masuk: data.jam_masuk,
                  jam_keluar: data.jam_keluar,
                })
              );
              console.log("Core fields updated:", coreUpdate);
            }

            // Update boolean fields
            try {
              const booleanUpdate = await directus.request(
                updateItem("lembur", result.id, {
                  is_pengajuan_sebelum_h: isPengajuanSebelum,
                  is_foto_required: !isPengajuanSebelum,
                })
              );
              console.log("Boolean fields updated:", booleanUpdate);
            } catch (boolErr) {
              console.error("Boolean fields update failed:", boolErr);
            }

            // Update optional text fields one by one
            if (data.catatan_penyesuaian && data.catatan_penyesuaian.trim()) {
              try {
                const textUpdate = await directus.request(
                  updateItem("lembur", result.id, {
                    catatan_penyesuaian: data.catatan_penyesuaian,
                  })
                );
                console.log("Text field updated:", textUpdate);
              } catch (textErr) {
                console.error("Text field update failed:", textErr);
              }
            }

            // Update file field last
            if (fileId) {
              try {
                const fileUpdate = await directus.request(
                  updateItem("lembur", result.id, {
                    lampiran_foto_opsional: fileId,
                  })
                );
                console.log("File field updated:", fileUpdate);
              } catch (fileErr) {
                console.error("File field update failed:", fileErr);
              }
            }

            // Get final result
            const finalResult = await directus.request(
              readItems("lembur", {
                filter: { id: { _eq: result.id } },
              })
            );

            if (finalResult && finalResult[0]) {
              console.log(
                "Final result after field-by-field update:",
                finalResult[0]
              );
              return finalResult[0];
            }
          } catch (fieldByFieldError) {
            console.error(
              "Field-by-field update also failed:",
              fieldByFieldError
            );
          }

          // Return the basic result if all update attempts fail
          return result;
        }
      }

      return result;
    }
  } catch (error) {
    console.error("Error submitting lembur:", error);

    // Log detailed error information
    if (error && typeof error === "object" && "response" in error) {
      const errorResponse = error as any;
      if (errorResponse.response) {
        console.error("HTTP Status:", errorResponse.response.status);
        console.error("Response headers:", errorResponse.response.headers);

        try {
          const errorBody = await errorResponse.response.text();
          console.error("Error response body:", errorBody);
        } catch (e) {
          console.error("Could not read response body:", e);
        }
      }
    }

    // Log error details if available
    if (error && typeof error === "object" && "errors" in error) {
      console.error("Directus errors:", (error as any).errors);
    }

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

      // Handle field validation errors
      if (
        error.message.includes("Field") &&
        error.message.includes("doesn't exist")
      ) {
        throw new Error(
          "Beberapa field baru belum ada di collection 'lembur'. Silakan lakukan migrasi database terlebih dahulu atau gunakan versi lama form."
        );
      }

      throw new Error(`Gagal mengirim pengajuan lembur: ${error.message}`);
    }

    // Handle response errors
    if (typeof error === "object" && error !== null && "response" in error) {
      const responseError = error as any;
      if (responseError.response && responseError.response.status === 400) {
        throw new Error(
          "Data pengajuan tidak valid. Pastikan semua field telah diisi dengan benar dan collection 'lembur' sudah diupdate dengan field terbaru."
        );
      }
    }

    throw new Error(
      "Gagal mengirim pengajuan lembur. Silakan coba lagi atau hubungi administrator."
    );
  }
}

/**
 * Update pengajuan lembur yang masih pending
 */
export async function updateLembur(
  id: string,
  data: LemburUpdateSubmission
): Promise<Lembur> {
  try {
    // Validasi input
    if (!id || id.trim() === "") {
      throw new Error("ID pengajuan tidak valid");
    }

    // Get current user
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    // Get existing data terlebih dahulu untuk menjaga foto yang sudah ada
    const existingData = await directus.request(
      readItems("lembur", {
        filter: { id: { _eq: id } },
        fields: ["*"],
      })
    );

    if (!existingData || existingData.length === 0) {
      throw new Error("Pengajuan lembur tidak ditemukan");
    }

    const existing = existingData[0] as Lembur;

    // Validasi data wajib
    if (
      !data.tanggal ||
      !data.jam_masuk ||
      !data.jam_keluar ||
      !data.deskripsi?.trim()
    ) {
      throw new Error("Data wajib tidak lengkap");
    }

    // Validasi format jam
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.jam_masuk) || !timeRegex.test(data.jam_keluar)) {
      throw new Error("Format jam tidak valid");
    }

    // Validasi tanggal
    const lemburDate = new Date(data.tanggal);
    if (isNaN(lemburDate.getTime())) {
      throw new Error("Format tanggal tidak valid");
    }

    // Hitung durasi otomatis
    const durasi = calculateDurasi(data.jam_masuk, data.jam_keluar);

    // Cek apakah pengajuan sebelum hari-H
    const isPengajuanSebelum =
      data.is_pengajuan_sebelum_h ?? isPengajuanSebelumH(data.tanggal);

    // Handle file upload - hanya upload jika ada file baru
    let fileId: string | null = null;
    let shouldUpdateFoto = false;

    if (
      data.lampiran_foto_opsional &&
      data.lampiran_foto_opsional instanceof File
    ) {
      // Ada file baru yang diupload
      const fileTitle = `Lampiran Lembur Update - ${currentUser.nama_lengkap} - ${data.tanggal}`;
      fileId = await uploadFileToDirectus(
        data.lampiran_foto_opsional,
        fileTitle
      );

      if (fileId) {
        shouldUpdateFoto = true;
      } else {
        console.warn("File upload failed, keeping existing photo");
      }
    } else if (data.keep_existing_foto === false) {
      // Explicitly remove photo
      fileId = null;
      shouldUpdateFoto = true;
    }
    // If keep_existing_foto is true or undefined, don't change photo

    // Buat data yang kompatibel dengan schema lembur yang ada
    const lemburData: any = {
      tanggal: data.tanggal,
      durasi_jam: durasi.jam,
      durasi_menit: durasi.menit,
      deskripsi: data.deskripsi.trim(),
      // Field baru
      jam_masuk: data.jam_masuk,
      jam_keluar: data.jam_keluar,
      is_pengajuan_sebelum_h: isPengajuanSebelum,
      is_foto_required: !isPengajuanSebelum, // Foto wajib jika bukan pengajuan sebelum hari-H
      tanggal_update: new Date().toISOString(), // Tambahkan timestamp update
    };

    // Tambahkan field opsional hanya jika ada nilai atau perlu di-update
    if (shouldUpdateFoto) {
      lemburData.lampiran_foto_opsional = fileId;
    }

    if (data.catatan_penyesuaian !== undefined) {
      lemburData.catatan_penyesuaian = data.catatan_penyesuaian?.trim() || null;
    }

    console.log("Updating lembur with data:", {
      id,
      lemburData,
      shouldUpdateFoto,
      fileId,
      existingFoto: existing.lampiran_foto_opsional,
    });

    const result = await directus.request(updateItem("lembur", id, lemburData));

    console.log("Lembur updated successfully:", result);
    return result;
  } catch (error) {
    console.error("Error updating lembur:", error);

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
      if (error.message.includes("not found")) {
        throw new Error(
          "Pengajuan lembur tidak ditemukan atau sudah tidak bisa diubah."
        );
      }
      throw new Error(`Gagal memperbarui pengajuan lembur: ${error.message}`);
    }

    throw new Error("Gagal memperbarui pengajuan lembur. Silakan coba lagi.");
  }
}

/**
 * Submit pengajuan lembur baru (legacy mode untuk kompatibilitas)
 */
export async function submitLemburLegacy(data: {
  tanggal: string;
  durasi_jam: number;
  durasi_menit: number;
  deskripsi: string;
}): Promise<Lembur> {
  try {
    // Get current user
    const currentUser = get(user);
    if (!currentUser) {
      throw new Error("User tidak terautentikasi");
    }

    const now = new Date();
    const lemburData = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      divisi: currentUser.divisi, // Tambahkan divisi dari user
      tanggal: data.tanggal,
      durasi_jam: data.durasi_jam,
      durasi_menit: data.durasi_menit,
      deskripsi: data.deskripsi,
      status: "pending" as const,
      tanggal_pengajuan: now.toISOString(),
    };

    const result = await directus.request(createItem("lembur", lemburData));

    console.log("Lembur submitted successfully (legacy mode):", result);
    return result;
  } catch (error) {
    console.error("Error submitting lembur (legacy):", error);
    throw new Error("Gagal mengirim pengajuan lembur. Silakan coba lagi.");
  }
}
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

/**
 * Helper function untuk format durasi (alias untuk compatibility)
 */
export function formatDurasiLembur(jam: number, menit: number): string {
  return formatDurasi(jam, menit);
}

/**
 * Utility functions untuk approval workflow
 */

export interface ApprovalStageInfo {
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
 * Mendapatkan informasi lengkap tentang tahapan approval
 */
export function getApprovalStages(lembur: Lembur): ApprovalStageInfo[] {
  const stages: ApprovalStageInfo[] = [
    {
      stage: "manager_divisi",
      title: "Manager Divisi",
      order: 1,
      completed: !!lembur.manager_divisi_approved_by,
      approved: lembur.manager_divisi_approved,
      approver: lembur.manager_divisi_approved_by,
      date: lembur.manager_divisi_approved_date,
      rejectionReason: lembur.manager_divisi_rejection_reason,
    },
    {
      stage: "hrd_admin",
      title: "HRD Admin",
      order: 2,
      completed: !!lembur.hrd_admin_approved_by,
      approved: lembur.hrd_admin_approved,
      approver: lembur.hrd_admin_approved_by,
      date: lembur.hrd_admin_approved_date,
      rejectionReason: lembur.hrd_admin_rejection_reason,
    },
    {
      stage: "manager_hrd",
      title: "Manager HRD",
      order: 3,
      completed: !!lembur.manager_hrd_approved_by,
      approved: lembur.manager_hrd_approved,
      approver: lembur.manager_hrd_approved_by,
      date: lembur.manager_hrd_approved_date,
      rejectionReason: lembur.manager_hrd_rejection_reason,
    },
    {
      stage: "direktur",
      title: "Direktur",
      order: 4,
      completed: !!lembur.direktur_approved_by,
      approved: lembur.direktur_approved,
      approver: lembur.direktur_approved_by,
      date: lembur.direktur_approved_date,
      rejectionReason: lembur.direktur_rejection_reason,
    },
  ];

  return stages;
}

/**
 * Mendapatkan status approval saat ini
 */
export function getCurrentApprovalStatus(lembur: Lembur): {
  currentStage: string | null;
  overallStatus: "pending" | "approved" | "rejected";
  finalApprover?: string;
  finalDate?: string;
  finalRejectionReason?: string;
} {
  // Cek apakah ada final approval/rejection
  if (lembur.final_approved_by && lembur.final_approved_date) {
    return {
      currentStage: "completed",
      overallStatus: "approved",
      finalApprover: lembur.final_approved_by,
      finalDate: lembur.final_approved_date,
    };
  }

  if (lembur.final_rejection_reason) {
    return {
      currentStage: "rejected",
      overallStatus: "rejected",
      finalRejectionReason: lembur.final_rejection_reason,
    };
  }

  // Cek tahapan yang ditolak
  const stages = getApprovalStages(lembur);
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
 * Format tanggal untuk tampilan
 */
export function formatApprovalDate(dateString?: string): string {
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
 * Mendapatkan ikon status approval
 */
export function getApprovalStatusIcon(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) return "fas fa-clock";
  if (approved === true) return "fas fa-check-circle";
  if (approved === false) return "fas fa-times-circle";
  return "fas fa-clock";
}

/**
 * Mendapatkan warna status approval
 */
export function getApprovalStatusColor(
  completed: boolean,
  approved?: boolean
): string {
  if (!completed) return "#f59e0b"; // amber
  if (approved === true) return "#10b981"; // green
  if (approved === false) return "#ef4444"; // red
  return "#f59e0b"; // amber
}

/**
 * Debug function to test individual fields one by one
 */
async function testFieldsIndividually(
  recordId: string,
  testData: any
): Promise<void> {
  console.log("=== TESTING FIELDS INDIVIDUALLY ===");

  const fieldsToTest = [
    { name: "jam_masuk", value: testData.jam_masuk },
    { name: "jam_keluar", value: testData.jam_keluar },
    { name: "is_pengajuan_sebelum_h", value: testData.is_pengajuan_sebelum_h },
    { name: "is_foto_required", value: testData.is_foto_required },
    { name: "lampiran_foto_opsional", value: testData.lampiran_foto_opsional },
    { name: "catatan_penyesuaian", value: testData.catatan_penyesuaian },
  ];

  for (const field of fieldsToTest) {
    if (field.value !== undefined && field.value !== null) {
      try {
        console.log(
          `Testing field: ${field.name} = ${
            field.value
          } (${typeof field.value})`
        );

        const updatePayload = { [field.name]: field.value };
        const result = await directus.request(
          updateItem("lembur", recordId, updatePayload)
        );

        console.log(`✅ ${field.name}: SUCCESS`);
      } catch (fieldError) {
        console.error(`❌ ${field.name}: FAILED`, fieldError);

        if (
          fieldError &&
          typeof fieldError === "object" &&
          "errors" in fieldError
        ) {
          const errors = (fieldError as any).errors;
          if (Array.isArray(errors)) {
            errors.forEach((err) => {
              console.error(`   - Error: ${err.message}`);
              if (err.extensions) {
                console.error(`   - Code: ${err.extensions.code}`);
                console.error(`   - Field: ${err.extensions.field}`);
                console.error(`   - Reason: ${err.extensions.reason}`);
              }
            });
          }
        }
      }
    } else {
      console.log(`Skipping ${field.name}: value is ${field.value}`);
    }
  }

  console.log("=== END FIELD TESTING ===");
}

/**
 * Upload file ke Directus Files collection
 */
async function uploadFileToDirectus(
  file: File,
  title?: string
): Promise<string | null> {
  try {
    console.log("Uploading file to Directus:", file.name, "Size:", file.size);

    const formData = new FormData();
    formData.append("file", file);

    if (title) {
      formData.append("title", title);
    }

    const result = await directus.request(uploadFiles(formData));

    console.log("File upload result:", result);

    if (result && result.id) {
      console.log("✅ File uploaded successfully with ID:", result.id);
      return result.id;
    }

    console.error("❌ File upload failed: No ID returned");
    return null;
  } catch (error) {
    console.error("❌ File upload error:", error);

    // Log detailed error
    if (error && typeof error === "object" && "errors" in error) {
      const errors = (error as any).errors;
      if (Array.isArray(errors)) {
        errors.forEach((err, index) => {
          console.error(`Upload Error ${index + 1}:`, {
            message: err.message,
            code: err.extensions?.code,
            field: err.extensions?.field,
          });
        });
      }
    }

    return null;
  }
}
