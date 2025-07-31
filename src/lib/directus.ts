import {
  createDirectus,
  rest,
  authentication,
  readItems,
  uploadFiles,
} from "@directus/sdk";

export interface AbsensiKaryawan {
  id?: string;
  user_id: string;
  email: string;
  nama?: string;
  tanggal: string;
  waktu_masuk?: string;
  waktu_keluar?: string;
  lokasi?: string;
  lokasi_keluar?: string;
  foto: string;
  foto_keluar?: string;
  keterangan?: string;
  terlambat: boolean;
  menit_keterlambatan: number;
}

export interface IzinJam {
  id?: string;
  user_id: string;
  email: string;
  nama: string;
  kategori: "izin" | "cuti" | "sakit";
  divisi: string; // divisi user yang mengajukan izin/cuti
  tanggal: string;
  dari_jam: string;
  sampai_jam: string;
  keterangan: string;
  lampiran?: string;
  status: "pending" | "approved" | "rejected";
  tanggal_pengajuan: string;
  created_at?: string;
  updated_at?: string;

  // Legacy approval fields
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  hrd_notes?: string;

  // Approval workflow fields
  approval_stage?:
    | "manager_divisi"
    | "hrd_admin"
    | "manager_hrd"
    | "direktur"
    | "completed"
    | null;
  overall_status?: "pending" | "approved" | "rejected";

  // Manager Divisi approval (Stage 1)
  manager_divisi_approved?: boolean;
  manager_divisi_approved_by?: string;
  manager_divisi_approved_date?: string;
  manager_divisi_rejection_reason?: string;

  // HRD Admin approval (Stage 2)
  hrd_admin_approved?: boolean;
  hrd_admin_approved_by?: string;
  hrd_admin_approved_date?: string;
  hrd_admin_rejection_reason?: string;

  // Manager HRD approval (Stage 3)
  manager_hrd_approved?: boolean;
  manager_hrd_approved_by?: string;
  manager_hrd_approved_date?: string;
  manager_hrd_rejection_reason?: string;

  // Direktur approval (Stage 4)
  direktur_approved?: boolean;
  direktur_approved_by?: string;
  direktur_approved_date?: string;
  direktur_rejection_reason?: string;

  // Final approval data
  final_approved_by?: string;
  final_approved_date?: string;
  final_rejection_reason?: string;
}

export interface IzinHari {
  id?: string;
  user_id: string;
  email: string;
  nama: string;
  kategori: "izin" | "cuti" | "sakit";
  divisi: string; // divisi user yang mengajukan izin/cuti
  tanggal_mulai: string;
  tanggal_selesai: string;
  total_hari: number;
  keterangan: string;
  lampiran?: string;
  status: "pending" | "approved" | "rejected";
  tanggal_pengajuan: string;
  created_at?: string;
  updated_at?: string;

  // Legacy approval fields
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  hrd_notes?: string;

  // Approval workflow fields
  approval_stage?:
    | "manager_divisi"
    | "hrd_admin"
    | "manager_hrd"
    | "direktur"
    | "completed"
    | null;
  overall_status?: "pending" | "approved" | "rejected";

  // Manager Divisi approval (Stage 1)
  manager_divisi_approved?: boolean;
  manager_divisi_approved_by?: string;
  manager_divisi_approved_date?: string;
  manager_divisi_rejection_reason?: string;

  // HRD Admin approval (Stage 2)
  hrd_admin_approved?: boolean;
  hrd_admin_approved_by?: string;
  hrd_admin_approved_date?: string;
  hrd_admin_rejection_reason?: string;

  // Manager HRD approval (Stage 3)
  manager_hrd_approved?: boolean;
  manager_hrd_approved_by?: string;
  manager_hrd_approved_date?: string;
  manager_hrd_rejection_reason?: string;

  // Direktur approval (Stage 4)
  direktur_approved?: boolean;
  direktur_approved_by?: string;
  direktur_approved_date?: string;
  direktur_rejection_reason?: string;

  // Final approval data
  final_approved_by?: string;
  final_approved_date?: string;
  final_rejection_reason?: string;
}

export interface Lembur {
  id?: string;
  user_created?: string;
  date_created?: string;
  user_updated?: string;
  date_updated?: string;
  user_id: string;
  email: string;
  nama: string;
  divisi: string; // divisi user yang mengajukan lembur
  tanggal: string;
  jam_masuk: string; // Format HH:MM
  jam_keluar: string; // Format HH:MM
  durasi_jam: number; // Calculated field berdasarkan jam_masuk dan jam_keluar
  durasi_menit: number; // Calculated field berdasarkan jam_masuk dan jam_keluar
  deskripsi: string;
  status: "pending" | "approved" | "rejected";
  tanggal_pengajuan: string;
  is_pengajuan_sebelum_h: boolean; // Apakah pengajuan dilakukan sebelum hari-H
  is_foto_required?: boolean; // Apakah foto diperlukan (legacy field)
  lampiran_foto_opsional?: string | null; // File ID from directus_files collection
  catatan_penyesuaian?: string | null; // Catatan penyesuaian jika ada perbedaan
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;

  // Approval workflow fields
  approval_stage?:
    | "manager_divisi"
    | "hrd_admin"
    | "manager_hrd"
    | "direktur"
    | "completed"
    | null;
  overall_status?: "pending" | "approved" | "rejected";

  // HRD Admin approval
  hrd_admin_approved?: boolean;
  hrd_admin_approved_by?: string;
  hrd_admin_approved_date?: string;
  hrd_admin_rejection_reason?: string;

  // Manager HRD approval
  manager_hrd_approved?: boolean;
  manager_hrd_approved_by?: string;
  manager_hrd_approved_date?: string;
  manager_hrd_rejection_reason?: string;

  // Direktur approval
  direktur_approved?: boolean;
  direktur_approved_by?: string;
  direktur_approved_date?: string;
  direktur_rejection_reason?: string;

  // Manager Divisi approval
  manager_divisi_approved?: boolean;
  manager_divisi_approved_by?: string;
  manager_divisi_approved_date?: string;
  manager_divisi_rejection_reason?: string;

  // Final approval data
  final_approved_by?: string;
  final_approved_date?: string;
  final_rejection_reason?: string;
}

export interface Kasbon {
  id?: string;
  user_created?: string;
  date_created?: string;
  user_updated?: string;
  date_updated?: string;
  user_id: string;
  email: string;
  nama: string;
  divisi: string; // divisi user yang mengajukan kasbon
  tanggal: string;
  nominal: number;
  tenor: number;
  keterangan: string;
  status: "pending" | "approved" | "rejected";
  tanggal_pengajuan: string;

  // Payment tracking fields
  total_paid?: number;
  payment_status?: "not_started" | "in_progress" | "completed" | "overdue";
  last_payment_date?: string;
  monthly_payment?: number;

  // Approval fields for Manager HRD only
  approval_stage?: "manager_hrd" | null;
  manager_hrd_approved?: boolean | null;
  manager_hrd_approved_by?: string | null;
  manager_hrd_approved_date?: string | null;
  manager_hrd_rejection_reason?: string | null;

  // Final approval tracking
  final_approved_by?: string | null;
  final_approved_date?: string | null;
  final_rejection_reason?: string | null;
  overall_status?: "pending" | "approved" | "rejected";

  // Legacy fields (to maintain backward compatibility)
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface KasbonPayment {
  id?: string;
  user_created?: string;
  date_created?: string;
  user_updated?: string;
  date_updated?: string;
  kasbon_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  recorded_by?: string;
  recorded_at?: string;
  payment_method?: "cash" | "transfer" | "deduction" | "other";
  receipt_number?: string;
}

export interface Akun {
  id: string;
  email: string;
  password: string;
  nama_lengkap: string;
  employee_id: string;
  divisi: string;
  created_at: string;
  role: string;
}

export interface Holiday {
  id: number;
  date: string;
  year: number;
  name: string;
  description: string;
  type: "company" | "national" | "religious";
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  created_by: string;
}

export interface DirectusSchema {
  absensi_karyawan: AbsensiKaryawan[];
  izin_jam: IzinJam[];
  izin_hari: IzinHari[];
  lembur: Lembur[];
  kasbon: Kasbon[];
  kasbon_payments: KasbonPayment[];
  akun: Akun[];
  holidays: Holiday[];
}

// Create Directus client
export const directus = createDirectus<DirectusSchema>(
  import.meta.env.VITE_DIRECTUS_URL
)
  .with(rest())
  .with(authentication());

// Initialize authentication with static token
export async function initDirectus() {
  try {
    await directus.setToken(import.meta.env.VITE_DIRECTUS_TOKEN);
    return true;
  } catch (error) {
    console.error("Failed to initialize Directus:", error);
    return false;
  }
}

// Function to clear Directus cache/state when user changes
export function clearDirectusCache() {
  try {
    // Force reconnection by clearing any cached auth state
    directus.setToken(null);
    directus.setToken(import.meta.env.VITE_DIRECTUS_TOKEN);
    console.log("Directus cache cleared and reconnected");
  } catch (error) {
    console.error("Error clearing Directus cache:", error);
  }
}

// Function to authenticate user with Directus
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: Akun; error?: string }> {
  try {
    await initDirectus();

    // Query the akun collection to find user by email and password
    const users = await directus.request(
      readItems("akun", {
        filter: {
          email: { _eq: email },
          password: { _eq: password },
        },
        limit: 1,
      })
    );

    if (users.length > 0) {
      const user = users[0];
      return { success: true, user };
    } else {
      return { success: false, error: "Email atau password salah" };
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, error: "Terjadi kesalahan saat login" };
  }
}

// Function to get user by ID
export async function getUserById(id: string): Promise<Akun | null> {
  try {
    await initDirectus();

    const users = await directus.request(
      readItems("akun", {
        filter: {
          id: { _eq: id },
        },
        limit: 1,
      })
    );

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }
}

// Function to get user by email
export async function getUserByEmail(email: string): Promise<Akun | null> {
  try {
    await initDirectus();

    const users = await directus.request(
      readItems("akun", {
        filter: {
          email: { _eq: email },
        },
        limit: 1,
      })
    );

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error("Error getting user by email:", error);
    return null;
  }
}

// Function to get all active holidays
export async function getHolidays(): Promise<Holiday[]> {
  try {
    await initDirectus();

    const holidays = await directus.request(
      readItems("holidays", {
        filter: {
          is_active: { _eq: true },
        },
        sort: ["date"],
      })
    );

    return holidays;
  } catch (error) {
    console.error("Error getting holidays:", error);
    return [];
  }
}

// Function to get holidays for current year
export async function getHolidaysForYear(year: number): Promise<Holiday[]> {
  try {
    await initDirectus();

    const holidays = await directus.request(
      readItems("holidays", {
        filter: {
          year: { _eq: year },
          is_active: { _eq: true },
        },
        sort: ["date"],
      })
    );

    return holidays;
  } catch (error) {
    console.error("Error getting holidays for year:", error);
    return [];
  }
}

// Function to get upcoming holidays (next 30 days)
export async function getUpcomingHolidays(): Promise<Holiday[]> {
  try {
    await initDirectus();

    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;

    // Get holidays for current and next year, then filter on client side
    const holidays = await directus.request(
      readItems("holidays", {
        filter: {
          _and: [
            { year: { _in: [currentYear, nextYear] } },
            { is_active: { _eq: true } },
          ],
        },
        sort: ["date"],
      })
    );

    // Filter upcoming holidays on client side
    const thirtyDaysFromNow = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const todayStr = today.toISOString().split("T")[0];
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

    return holidays.filter(
      (holiday) => holiday.date >= todayStr && holiday.date <= thirtyDaysStr
    );
  } catch (error) {
    console.error("Error getting upcoming holidays:", error);
    return [];
  }
}

// Function to check if a specific date is a holiday
export async function isHolidayDate(
  date: string
): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  try {
    await initDirectus();

    const holidays = await directus.request(
      readItems("holidays", {
        filter: {
          date: { _eq: date },
          is_active: { _eq: true },
        },
        limit: 1,
      })
    );

    if (holidays.length > 0) {
      return { isHoliday: true, holiday: holidays[0] };
    }

    return { isHoliday: false };
  } catch (error) {
    console.error("Error checking holiday date:", error);
    return { isHoliday: false };
  }
}

// Function to get holiday by ID
export async function getHolidayById(id: number): Promise<Holiday | null> {
  try {
    await initDirectus();

    const holidays = await directus.request(
      readItems("holidays", {
        filter: {
          id: { _eq: id },
        },
        limit: 1,
      })
    );

    return holidays.length > 0 ? holidays[0] : null;
  } catch (error) {
    console.error("Error getting holiday by ID:", error);
    return null;
  }
}
