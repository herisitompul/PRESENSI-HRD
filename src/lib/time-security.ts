/**
 * Time Security Module
 * Provides secure timestamp functionality to prevent client-side time manipulation
 */

interface ServerTimeResponse {
  server_time: string;
  timezone: string;
  unix_timestamp: number;
}

interface TimeValidationResult {
  isValid: boolean;
  timeDifference: number; // in milliseconds
  message: string;
  serverTime: Date;
  clientTime: Date;
}

// Maximum allowed time difference between client and server (in milliseconds)
const MAX_TIME_DIFFERENCE = 5 * 60 * 1000; // 5 minutes

/**
 * Get server time from backend
 */
export async function getServerTime(): Promise<Date> {
  try {
    // Option 1: Use your Directus server to get server time
    const response = await fetch(
      `${import.meta.env.VITE_DIRECTUS_URL}/server-time`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data: ServerTimeResponse = await response.json();
      return new Date(data.server_time);
    }

    // Option 2: Fallback to reliable time API
    return await getExternalServerTime();
  } catch (error) {
    console.warn("Failed to get server time, using fallback:", error);
    return await getExternalServerTime();
  }
}

/**
 * Get time from external reliable source as fallback
 */
async function getExternalServerTime(): Promise<Date> {
  try {
    // Use multiple time services for redundancy
    const timeApis = [
      "https://worldtimeapi.org/api/timezone/Asia/Jakarta",
      "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Jakarta",
      "http://worldclockapi.com/api/json/asia/jakarta/now",
    ];

    for (const api of timeApis) {
      try {
        const response = await fetch(api, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          const data = await response.json();

          // Parse different API response formats
          let timestamp: string;
          if (data.datetime) {
            timestamp = data.datetime; // WorldTimeAPI
          } else if (data.dateTime) {
            timestamp = data.dateTime; // TimeAPI.io
          } else if (data.currentDateTime) {
            timestamp = data.currentDateTime; // WorldClockAPI
          } else {
            continue;
          }

          return new Date(timestamp);
        }
      } catch (error) {
        console.warn(`Time API ${api} failed:`, error);
        continue;
      }
    }

    throw new Error("All time APIs failed");
  } catch (error) {
    console.error("Failed to get external server time:", error);
    throw new Error("Tidak dapat mendapatkan waktu server yang valid");
  }
}

/**
 * Validate client time against server time
 */
export async function validateClientTime(
  clientTime: Date = new Date()
): Promise<TimeValidationResult> {
  try {
    const serverTime = await getServerTime();
    const timeDifference = Math.abs(
      clientTime.getTime() - serverTime.getTime()
    );

    const isValid = timeDifference <= MAX_TIME_DIFFERENCE;

    return {
      isValid,
      timeDifference,
      serverTime,
      clientTime,
      message: isValid
        ? "Waktu perangkat valid"
        : `Waktu perangkat tidak sinkron dengan server (selisih: ${Math.round(
            timeDifference / 1000 / 60
          )} menit). Mohon sinkronkan waktu perangkat Anda.`,
    };
  } catch (error) {
    console.error("Time validation error:", error);
    throw new Error(
      "Gagal memvalidasi waktu. Pastikan koneksi internet stabil."
    );
  }
}

/**
 * Get secure timestamp for absensi
 * Always use server time to prevent manipulation
 */
export async function getSecureTimestamp(): Promise<{
  timestamp: string;
  serverTime: Date;
  jakartaTime: string;
}> {
  const serverTime = await getServerTime();

  // Ensure we're using Jakarta timezone
  const jakartaTime =
    serverTime
      .toLocaleString("sv-SE", {
        timeZone: "Asia/Jakarta",
      })
      .replace(" ", "T") + ".000Z";

  return {
    timestamp: serverTime.toISOString(),
    serverTime,
    jakartaTime,
  };
}

/**
 * Format time for lateness calculation (HH:MM:SS format)
 */
export function formatTimeForCalculation(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

/**
 * Check if current time is within allowed working hours
 */
export function isWithinWorkingHours(time: Date): {
  isValid: boolean;
  message: string;
} {
  const jakartaTime = new Date(
    time.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const hour = jakartaTime.getHours();
  const minute = jakartaTime.getMinutes();

  // Working hours: 06:00 - 22:00 WIB
  const workStartHour = 6;
  const workEndHour = 24;

  const currentMinutes = hour * 60 + minute;
  const workStartMinutes = workStartHour * 60;
  const workEndMinutes = workEndHour * 60;

  const isValid =
    currentMinutes >= workStartMinutes && currentMinutes <= workEndMinutes;

  return {
    isValid,
    message: isValid
      ? "Dalam jam kerja"
      : `Absensi hanya diperbolehkan antara ${workStartHour}:00 - ${workEndHour}:00 WIB`,
  };
}

/**
 * Additional security: Check for suspicious timing patterns
 */
export function detectSuspiciousPatterns(
  previousAbsensi: Date[],
  currentTime: Date
): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for too regular timing (exact same minute every day)
  if (previousAbsensi.length >= 3) {
    const times = previousAbsensi.map((date) => {
      const jakartaTime = new Date(
        date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
      );
      return jakartaTime.getHours() * 60 + jakartaTime.getMinutes();
    });

    const currentMinutes =
      new Date(
        currentTime.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
      ).getHours() *
        60 +
      new Date(
        currentTime.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
      ).getMinutes();

    times.push(currentMinutes);

    // Check if all times are exactly the same (suspicious)
    const uniqueTimes = new Set(times);
    if (uniqueTimes.size === 1) {
      reasons.push("Pola waktu absensi terlalu teratur (selalu sama persis)");
    }
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Generate timestamp with additional security metadata
 */
export async function generateSecureAbsensiData(): Promise<{
  timestamp: string;
  serverTime: Date;
  validationPassed: boolean;
  securityMetadata: {
    clientServerTimeDiff: number;
    withinWorkingHours: boolean;
    suspiciousPattern: boolean;
    userAgent: string;
    timezoneOffset: number;
  };
}> {
  const clientTime = new Date();
  const validation = await validateClientTime(clientTime);
  const { serverTime, timestamp } = await getSecureTimestamp();
  const workingHours = isWithinWorkingHours(serverTime);

  // For now, we'll skip suspicious pattern detection here
  // It should be implemented when we have access to previous absensi data

  return {
    timestamp,
    serverTime,
    validationPassed: validation.isValid && workingHours.isValid,
    securityMetadata: {
      clientServerTimeDiff: validation.timeDifference,
      withinWorkingHours: workingHours.isValid,
      suspiciousPattern: false, // Will be checked in absensi function
      userAgent: navigator.userAgent,
      timezoneOffset: clientTime.getTimezoneOffset(),
    },
  };
}
