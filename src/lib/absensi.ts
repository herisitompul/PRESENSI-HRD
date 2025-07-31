import { directus, initDirectus, type AbsensiKaryawan } from "./directus";
import { readItems, createItem, updateItem, uploadFiles } from "@directus/sdk";
import { user } from "./auth";
import { get } from "svelte/store";
import {
  getSecureTimestamp,
  validateClientTime,
  isWithinWorkingHours,
  detectSuspiciousPatterns,
  formatTimeForCalculation,
} from "./time-security";

// Re-export AbsensiKaryawan type
export type { AbsensiKaryawan };

// Helper function to calculate lateness
export function calculateLateness(waktuMasuk: string): {
  terlambat: boolean;
  menitKeterlambatan: number;
} {
  // Expected work start time: 08:00 WIB
  const workStartHour = 8;
  const workStartMinute = 0;

  // Parse waktu_masuk (format: "HH:MM:SS" or "HH:MM")
  const timeParts = waktuMasuk.split(":");
  const jam = parseInt(timeParts[0]);
  const menit = parseInt(timeParts[1]);

  // Calculate total minutes from midnight
  const waktuMasukMenit = jam * 60 + menit;
  const workStartMenit = workStartHour * 60 + workStartMinute;

  if (waktuMasukMenit <= workStartMenit) {
    return { terlambat: false, menitKeterlambatan: 0 };
  } else {
    const keterlambatan = waktuMasukMenit - workStartMenit;
    return { terlambat: true, menitKeterlambatan: keterlambatan };
  }
}

// Helper function to format lateness display
export function formatKeterlambatan(menitKeterlambatan: number): string {
  if (menitKeterlambatan === 0) {
    return "Tepat waktu";
  }

  const jam = Math.floor(menitKeterlambatan / 60);
  const menit = menitKeterlambatan % 60;

  if (jam === 0) {
    return `Terlambat ${menit} menit`;
  } else if (menit === 0) {
    return `Terlambat ${jam} jam`;
  } else {
    return `Terlambat ${jam} jam ${menit} menit`;
  }
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

export interface AbsensiData {
  lokasi?: string;
  foto: File;
  keterangan?: string;
}

// Get current user location using GPS
export async function getCurrentLocation(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung oleh browser ini"));
      return;
    }

    // Try high accuracy first, then fallback to lower accuracy
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000, // 30 seconds cache
    };

    const lowAccuracyOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes cache
    };

    // First attempt with high accuracy
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log("High accuracy position:", position);
        await processPosition(position, resolve, reject);
      },
      async (error) => {
        console.warn("High accuracy failed, trying low accuracy:", error);

        // Fallback to low accuracy
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            console.log("Low accuracy position:", position);
            await processPosition(position, resolve, reject);
          },
          (error) => {
            let message = "Gagal mendapatkan lokasi";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                message = "Akses lokasi ditolak. Silakan izinkan akses lokasi.";
                break;
              case error.POSITION_UNAVAILABLE:
                message =
                  "Informasi lokasi tidak tersedia. Pastikan GPS aktif.";
                break;
              case error.TIMEOUT:
                message = "Timeout saat mendapatkan lokasi. Silakan coba lagi.";
                break;
            }
            reject(new Error(message));
          },
          lowAccuracyOptions
        );
      },
      highAccuracyOptions
    );
  });

  async function processPosition(
    position: GeolocationPosition,
    resolve: Function,
    reject: Function
  ) {
    try {
      const { latitude, longitude, accuracy } = position.coords;

      console.log(
        `GPS Coordinates: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`
      );

      // Try to get address from coordinates with multiple providers
      let address = "";
      try {
        address = await getAddressFromCoordinates(latitude, longitude);
      } catch (error) {
        console.warn("Failed to get address:", error);
        address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }

      resolve({
        latitude,
        longitude,
        accuracy: accuracy || undefined,
        address,
      });
    } catch (error) {
      reject(error);
    }
  }
}

// Convert coordinates to address using reverse geocoding with multiple providers
async function getAddressFromCoordinates(
  lat: number,
  lng: number
): Promise<string> {
  console.log(`Getting address for: ${lat}, ${lng}`);

  // Try multiple geocoding services for better accuracy
  const providers = [
    // Primary: OpenStreetMap Nominatim with Indonesia-specific settings
    async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?` +
            `format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&` +
            `accept-language=id,en&countrycodes=id&extratags=1&namedetails=1`,
          {
            headers: {
              "User-Agent": "PresensiApp/1.0",
            },
          }
        );

        if (!response.ok) throw new Error("Nominatim request failed");

        const data = await response.json();
        console.log("Nominatim response:", data);

        if (data && data.address) {
          // Enhanced format address for Indonesia
          const addr = data.address;
          const parts = [];

          // Building/House details
          if (addr.house_number && addr.road) {
            parts.push(`${addr.house_number} ${addr.road}`);
          } else if (addr.road) {
            parts.push(addr.road);
          } else if (addr.pedestrian) {
            parts.push(addr.pedestrian);
          } else if (addr.footway) {
            parts.push(addr.footway);
          }

          // Area details (RT/RW, Kelurahan, etc)
          if (addr.neighbourhood) parts.push(addr.neighbourhood);
          if (addr.suburb) parts.push(addr.suburb);
          if (addr.village) parts.push(addr.village);
          if (addr.hamlet) parts.push(addr.hamlet);

          // District/City
          if (addr.city_district) parts.push(`Kec. ${addr.city_district}`);
          if (addr.city) parts.push(addr.city);
          else if (addr.town) parts.push(addr.town);
          else if (addr.municipality) parts.push(addr.municipality);
          else if (addr.county) parts.push(addr.county);

          // Province
          if (addr.state) parts.push(addr.state);
          else if (addr.province) parts.push(addr.province);

          // Postal code
          if (addr.postcode) parts.push(addr.postcode);

          const formattedAddress =
            parts.length > 0 ? parts.join(", ") : data.display_name;
          console.log("Formatted address:", formattedAddress);
          return formattedAddress;
        }

        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } catch (error) {
        console.warn("Nominatim provider failed:", error);
        throw error;
      }
    },

    // Secondary: MapBox Geocoding (good for Indonesia)
    async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
            `access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw&` +
            `language=id&country=id&types=address,poi`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const place = data.features[0];
            console.log("MapBox response:", place);
            return place.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          }
        }
        throw new Error("MapBox failed");
      } catch (error) {
        console.warn("MapBox provider failed:", error);
        throw error;
      }
    },

    // Tertiary: Alternative Nominatim instance
    async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `https://nominatim.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log("Alternative Nominatim response:", data);
          return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
        throw new Error("Alternative Nominatim failed");
      } catch (error) {
        console.warn("Alternative Nominatim provider failed:", error);
        throw error;
      }
    },

    // Fallback: return coordinates
    async () => {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    },
  ];

  // Try each provider in sequence
  for (let i = 0; i < providers.length; i++) {
    try {
      const address = await providers[i]();
      if (address && address.trim()) {
        console.log(`Address from provider ${i + 1}:`, address);
        return address;
      }
    } catch (error) {
      console.warn(`Provider ${i + 1} failed:`, error);
      continue;
    }
  }

  // Ultimate fallback
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// Upload photo to Directus
export async function uploadPhoto(file: File): Promise<string> {
  try {
    await initDirectus();

    const formData = new FormData();
    formData.append("file", file);

    const result = await directus.request(uploadFiles(formData));

    if (result && result.id) {
      return result.id;
    }

    throw new Error("Failed to upload photo");
  } catch (error) {
    console.error("Photo upload error:", error);
    throw new Error("Gagal mengunggah foto");
  }
}

// Check if user already has absensi today
export async function getTodayAbsensi(): Promise<AbsensiKaryawan | null> {
  const currentUser = get(user);
  if (!currentUser) {
    return null;
  }

  try {
    await initDirectus();

    const today = new Date().toISOString().split("T")[0];

    const items = await directus.request(
      readItems("absensi_karyawan", {
        filter: {
          user_id: { _eq: currentUser.id },
          tanggal: { _eq: today },
        },
        limit: 1,
      })
    );

    return items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error("Error fetching today absensi:", error);
    return null;
  }
}

// Record absensi masuk
export async function absensiMasuk(data: AbsensiData): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    // ====== SECURITY: Time Validation ======
    console.log("🔒 Memulai validasi keamanan waktu...");

    // 1. Validate client time against server time
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(`❌ SECURITY: ${timeValidation.message}`);
    }
    console.log("✅ Validasi waktu client berhasil");

    // 2. Get secure server timestamp
    const { timestamp: secureTimestamp, serverTime } =
      await getSecureTimestamp();
    console.log("✅ Mendapatkan timestamp server yang aman:", secureTimestamp);

    // 3. Check working hours
    const workingHoursCheck = isWithinWorkingHours(serverTime);
    if (!workingHoursCheck.isValid) {
      throw new Error(`❌ SECURITY: ${workingHoursCheck.message}`);
    }
    console.log("✅ Validasi jam kerja berhasil");

    // 4. Check for existing absensi today
    const existingAbsensi = await getTodayAbsensi();
    if (existingAbsensi) {
      throw new Error("Anda sudah melakukan absensi masuk hari ini");
    }

    // 5. Check for suspicious patterns (if user has history)
    const userHistory = await getAbsensiHistory(10);
    const previousTimes = userHistory
      .filter((abs) => abs.waktu_masuk)
      .map((abs) => new Date(abs.waktu_masuk!));

    if (previousTimes.length > 0) {
      const suspiciousCheck = detectSuspiciousPatterns(
        previousTimes,
        serverTime
      );
      if (suspiciousCheck.isSuspicious) {
        console.warn(
          "⚠️ SECURITY WARNING: Suspicious pattern detected:",
          suspiciousCheck.reasons
        );
        // Log but don't block - let admin review
      }
    }

    // ====== CONTINUE WITH NORMAL ABSENSI PROCESS ======

    // Get location
    const location = await getCurrentLocation();
    const locationString =
      data.lokasi ||
      location.address ||
      `${location.latitude}, ${location.longitude}`;

    // Upload photo
    const photoId = await uploadPhoto(data.foto);

    // Create absensi record with SECURE timestamp
    await initDirectus();

    const tanggal = serverTime.toISOString().split("T")[0];
    const waktuMasuk = secureTimestamp; // Use secure server timestamp

    // Get time in HH:MM:SS format for lateness calculation using server time
    const waktuMasukTime = formatTimeForCalculation(serverTime);

    // Calculate lateness
    const keterlambatan = calculateLateness(waktuMasukTime);

    const absensiData: Omit<AbsensiKaryawan, "id"> = {
      user_id: currentUser.id,
      email: currentUser.email,
      nama: currentUser.nama_lengkap,
      tanggal,
      waktu_masuk: waktuMasuk, // SECURE: Server timestamp
      lokasi: locationString,
      foto: photoId,
      keterangan: data.keterangan || "",
      terlambat: keterlambatan.terlambat,
      menit_keterlambatan: keterlambatan.menitKeterlambatan,
    };

    // Log security metadata for audit trail (could be stored in separate table)
    console.log("🔒 Security Metadata:", {
      client_time_diff: timeValidation.timeDifference,
      user_agent: navigator.userAgent,
      timezone_offset: new Date().getTimezoneOffset(),
      server_timestamp: secureTimestamp,
      client_timestamp: new Date().toISOString(),
    });

    await directus.request(createItem("absensi_karyawan", absensiData));
    console.log(
      "✅ Absensi masuk berhasil dicatat dengan timestamp server yang aman"
    );
  } catch (error) {
    console.error("❌ Absensi masuk error:", error);
    throw error;
  }
}

// Record absensi keluar
export async function absensiKeluar(data: AbsensiData): Promise<void> {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }

  try {
    // ====== SECURITY: Time Validation ======
    console.log("🔒 Memulai validasi keamanan waktu untuk absensi keluar...");

    // 1. Validate client time against server time
    const timeValidation = await validateClientTime();
    if (!timeValidation.isValid) {
      throw new Error(`❌ SECURITY: ${timeValidation.message}`);
    }
    console.log("✅ Validasi waktu client berhasil");

    // 2. Get secure server timestamp
    const { timestamp: secureTimestamp, serverTime } =
      await getSecureTimestamp();
    console.log("✅ Mendapatkan timestamp server yang aman:", secureTimestamp);

    // 3. Check working hours
    const workingHoursCheck = isWithinWorkingHours(serverTime);
    if (!workingHoursCheck.isValid) {
      throw new Error(`❌ SECURITY: ${workingHoursCheck.message}`);
    }
    console.log("✅ Validasi jam kerja berhasil");

    // ====== CONTINUE WITH NORMAL ABSENSI PROCESS ======

    // Check if absensi masuk exists today
    const existingAbsensi = await getTodayAbsensi();
    if (!existingAbsensi) {
      throw new Error("Anda belum melakukan absensi masuk hari ini");
    }

    if (existingAbsensi.waktu_keluar) {
      throw new Error("Anda sudah melakukan absensi keluar hari ini");
    }

    // Get location
    const location = await getCurrentLocation();
    const locationString =
      data.lokasi ||
      location.address ||
      `${location.latitude}, ${location.longitude}`;

    // Upload photo
    const photoId = await uploadPhoto(data.foto);

    // Update absensi record with SECURE timestamp
    await initDirectus();

    const waktuKeluar = secureTimestamp; // Use secure server timestamp

    const updateData = {
      nama: currentUser.nama_lengkap,
      waktu_keluar: waktuKeluar, // SECURE: Server timestamp
      lokasi_keluar: locationString,
      foto_keluar: photoId,
      keterangan: data.keterangan
        ? `${existingAbsensi.keterangan || ""} | Keluar: ${data.keterangan}`
        : existingAbsensi.keterangan,
    };

    // Log security metadata for audit trail
    console.log("🔒 Security Metadata:", {
      client_time_diff: timeValidation.timeDifference,
      user_agent: navigator.userAgent,
      timezone_offset: new Date().getTimezoneOffset(),
      server_timestamp: secureTimestamp,
      client_timestamp: new Date().toISOString(),
    });

    await directus.request(
      updateItem("absensi_karyawan", existingAbsensi.id!, updateData)
    );
    console.log(
      "✅ Absensi keluar berhasil dicatat dengan timestamp server yang aman"
    );
  } catch (error) {
    console.error("❌ Absensi keluar error:", error);
    throw error;
  }
}

// Get absensi history
export async function getAbsensiHistory(
  limit: number = 10
): Promise<AbsensiKaryawan[]> {
  const currentUser = get(user);
  if (!currentUser) {
    return [];
  }

  try {
    await initDirectus();

    const items = await directus.request(
      readItems("absensi_karyawan", {
        filter: {
          user_id: { _eq: currentUser.id },
        },
        sort: ["-tanggal", "-waktu_masuk"],
        limit,
      })
    );

    return items;
  } catch (error) {
    console.error("Error fetching absensi history:", error);
    return [];
  }
}
