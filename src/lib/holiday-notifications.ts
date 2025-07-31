import { writable, get } from "svelte/store";
import { toast } from "./toast";
import { getHolidays, type Holiday } from "./directus";

// Store for holiday notifications
export const holidayNotifications = writable<Holiday[]>([]);

// Local storage key for tracking seen holidays
const SEEN_HOLIDAYS_KEY = "seen_holidays";
// Local storage key for tracking notified holidays (shown but not necessarily read)
const NOTIFIED_HOLIDAYS_KEY = "notified_holidays";

// Check for new holidays and show notifications
export async function checkForNewHolidays() {
  try {
    console.log("🔍 Checking for new holidays...");
    const allHolidays = await getHolidays();
    console.log(`📅 Retrieved ${allHolidays.length} total holidays from API`);

    // Get previously notified holidays from localStorage
    const notifiedHolidaysStr = localStorage.getItem(NOTIFIED_HOLIDAYS_KEY);
    const notifiedHolidays: number[] = notifiedHolidaysStr
      ? JSON.parse(notifiedHolidaysStr)
      : [];
    console.log(
      `� Previously notified holidays: ${notifiedHolidays.length}`,
      notifiedHolidays
    );

    // Get previously seen holidays from localStorage
    const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
    const seenHolidays: number[] = seenHolidaysStr
      ? JSON.parse(seenHolidaysStr)
      : [];
    console.log(
      `👁️ Previously seen holidays: ${seenHolidays.length}`,
      seenHolidays
    );

    // Filter out holidays that haven't been notified yet
    const newHolidays = allHolidays.filter(
      (holiday) => !notifiedHolidays.includes(holiday.id) && holiday.is_active
    );

    console.log(`🆕 Found ${newHolidays.length} new holidays:`, newHolidays);

    // Show notifications for new holidays
    if (newHolidays.length > 0) {
      console.log(
        `🔔 Showing notifications for ${newHolidays.length} new holidays`
      );

      newHolidays.forEach((holiday) => {
        showHolidayNotification(holiday);
      });

      // Mark holidays as notified (but not necessarily seen)
      const updatedNotifiedHolidays = [
        ...notifiedHolidays,
        ...newHolidays.map((h) => h.id),
      ];
      localStorage.setItem(
        NOTIFIED_HOLIDAYS_KEY,
        JSON.stringify(updatedNotifiedHolidays)
      );
      console.log(
        `✅ Updated notified holidays: ${updatedNotifiedHolidays.length}`,
        updatedNotifiedHolidays
      );
    }

    // Update the store with all unread notifications (notified but not seen)
    const unreadNotifications = allHolidays.filter(
      (holiday) =>
        notifiedHolidays.includes(holiday.id) &&
        !seenHolidays.includes(holiday.id) &&
        holiday.is_active
    );

    // Add new holidays to unread notifications
    const allUnreadNotifications = [...unreadNotifications, ...newHolidays];
    holidayNotifications.set(allUnreadNotifications);
    console.log(
      `📱 Updated notification store with ${allUnreadNotifications.length} unread notifications`
    );

    return newHolidays;
  } catch (error) {
    console.error("❌ Error checking for new holidays:", error);
    return [];
  }
}

// Check if a holiday was recently created (within last 24 hours)
function isRecentlyCreated(holiday: Holiday): boolean {
  if (!holiday.created_at) return false;

  const createdAt = new Date(holiday.created_at);
  const now = new Date();
  const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  return diffHours <= 24; // Consider recent if created within last 24 hours
}

// Show notification for a new holiday
function showHolidayNotification(holiday: Holiday) {
  console.log(`🎉 Showing notification for holiday: ${holiday.name}`);

  const holidayDate = new Date(holiday.date);
  const formattedDate = holidayDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Use the new holiday toast type
  toast.holiday(
    `Hari libur baru: ${holiday.name} pada ${formattedDate}`,
    7000 // Show for 7 seconds
  );

  // Also create a custom notification banner
  createHolidayBanner(holiday);
}

// Create a custom notification banner
function createHolidayBanner(holiday: Holiday) {
  // Remove existing banner if any
  const existingBanner = document.querySelector(".holiday-banner");
  if (existingBanner) {
    existingBanner.remove();
  }

  const banner = document.createElement("div");
  banner.className = "holiday-banner";
  banner.innerHTML = `
    <div class="holiday-banner-content">
      <div class="holiday-banner-icon">🎉</div>
      <div class="holiday-banner-text">
        <h4>Hari Libur Baru!</h4>
        <p>${holiday.name} - ${new Date(holiday.date).toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  )}</p>
      </div>
      <button class="holiday-banner-close" onclick="this.parentElement.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  // Style the banner
  Object.assign(banner.style, {
    position: "fixed",
    top: "80px",
    left: "20px",
    right: "20px",
    background: "linear-gradient(135deg, #16a34a, #15803d)",
    color: "white",
    padding: "16px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
    zIndex: "10001",
    animation: "slideDown 0.5s ease-out forwards",
    fontFamily: "Inter, sans-serif",
  });

  // Add CSS animation if not exists
  if (!document.querySelector("#holiday-banner-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "holiday-banner-styles";
    styleSheet.textContent = `
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .holiday-banner-content {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .holiday-banner-icon {
        font-size: 2rem;
        flex-shrink: 0;
      }
      
      .holiday-banner-text {
        flex: 1;
      }
      
      .holiday-banner-text h4 {
        margin: 0 0 4px 0;
        font-size: 1.1rem;
        font-weight: 600;
      }
      
      .holiday-banner-text p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.9;
      }
      
      .holiday-banner-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      
      .holiday-banner-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(styleSheet);
  }

  document.body.appendChild(banner);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (banner.parentElement) {
      banner.style.animation = "slideDown 0.5s ease-out reverse";
      setTimeout(() => {
        if (banner.parentElement) {
          banner.parentElement.removeChild(banner);
        }
      }, 500);
    }
  }, 10000);
}

// Initialize holiday monitoring
export function initHolidayMonitoring() {
  console.log("🔔 Initializing holiday monitoring...");

  // Clear any existing interval to prevent multiple intervals
  if (
    typeof window !== "undefined" &&
    (window as any).holidayMonitoringInterval
  ) {
    clearInterval((window as any).holidayMonitoringInterval);
  }

  // Initialize existing notifications first
  initializeExistingNotifications();

  // Check for new holidays immediately
  checkForNewHolidays();

  // Set up periodic checking every 15 seconds for more responsive updates
  const intervalId = setInterval(() => {
    console.log("⏰ Periodic holiday check triggered");
    checkForNewHolidays();
  }, 15 * 1000);

  // Store interval ID for cleanup if needed
  if (typeof window !== "undefined") {
    (window as any).holidayMonitoringInterval = intervalId;
  }

  console.log("✅ Holiday monitoring initialized with 15-second intervals");
  return intervalId;
}

// Manual function to refresh holiday notifications
export function refreshHolidayNotifications() {
  console.log("🔄 Manually refreshing holiday notifications...");
  return initializeExistingNotifications().then(() => checkForNewHolidays());
}

// Force check for new holidays (ignores notified check)
export async function forceCheckNewHolidays() {
  try {
    console.log("🔍 Force checking for new holidays...");
    const allHolidays = await getHolidays();

    // Get previously notified holidays
    const notifiedHolidaysStr = localStorage.getItem(NOTIFIED_HOLIDAYS_KEY);
    const notifiedHolidays: number[] = notifiedHolidaysStr
      ? JSON.parse(notifiedHolidaysStr)
      : [];

    // Get previously seen holidays
    const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
    const seenHolidays: number[] = seenHolidaysStr
      ? JSON.parse(seenHolidaysStr)
      : [];

    // Show info about current state
    console.log(`Total holidays: ${allHolidays.length}`);
    console.log(`Previously notified: ${notifiedHolidays.length}`);
    console.log(`Previously seen: ${seenHolidays.length}`);
    console.log(
      `Active holidays:`,
      allHolidays.filter((h) => h.is_active)
    );

    // Find unread notifications (notified but not seen)
    const unreadNotifications = allHolidays.filter(
      (holiday) =>
        notifiedHolidays.includes(holiday.id) &&
        !seenHolidays.includes(holiday.id) &&
        holiday.is_active
    );

    console.log(
      `Unread notifications: ${unreadNotifications.length}`,
      unreadNotifications
    );

    // Update the store with unread notifications
    holidayNotifications.set(unreadNotifications);

    return unreadNotifications;
  } catch (error) {
    console.error("Error in force check:", error);
    return [];
  }
}

// Clean up notifications that are no longer active
export function cleanupInactiveNotifications() {
  const currentNotifications = get(holidayNotifications);

  if (currentNotifications.length === 0) {
    return;
  }

  console.log(`🧹 Cleaning up ${currentNotifications.length} notifications...`);

  // Filter out notifications that are no longer active or have passed
  const activeNotifications = currentNotifications.filter((notification) => {
    const holidayDate = new Date(notification.date);
    const now = new Date();

    // Keep notification if holiday is still upcoming or today and is active
    return holidayDate >= now && notification.is_active;
  });

  if (activeNotifications.length !== currentNotifications.length) {
    console.log(
      `🗑️ Removed ${
        currentNotifications.length - activeNotifications.length
      } inactive notifications`
    );

    // Mark removed notifications as seen to prevent them from reappearing
    const removedNotifications = currentNotifications.filter(
      (n) => !activeNotifications.includes(n)
    );
    removedNotifications.forEach((notification) => {
      markHolidayAsSeen(notification.id);
    });

    holidayNotifications.set(activeNotifications);
  }
}

// Clear notification by ID (mark as seen)
export function clearNotificationById(holidayId: number) {
  markHolidayAsSeen(holidayId);
}

// Clear all notifications (mark all as seen)
export function clearAllNotifications() {
  markAllHolidaysAsSeen();
}

// Clear all seen holidays (for testing purposes)
export function clearSeenHolidays() {
  console.log("🗑️ Clearing seen holidays from localStorage...");
  localStorage.removeItem(SEEN_HOLIDAYS_KEY);
  localStorage.removeItem(NOTIFIED_HOLIDAYS_KEY);

  // Force reload of notifications
  checkForNewHolidays();
}

// Debug function to show current state
export function debugHolidayState() {
  const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
  const seenHolidays: number[] = seenHolidaysStr
    ? JSON.parse(seenHolidaysStr)
    : [];

  const notifiedHolidaysStr = localStorage.getItem(NOTIFIED_HOLIDAYS_KEY);
  const notifiedHolidays: number[] = notifiedHolidaysStr
    ? JSON.parse(notifiedHolidaysStr)
    : [];

  console.log("🐛 Holiday Debug Info:");
  console.log("Seen holidays (read):", seenHolidays);
  console.log("Notified holidays (shown):", notifiedHolidays);
  console.log("Current notifications:", get(holidayNotifications));

  return {
    seenHolidays,
    notifiedHolidays,
    currentNotifications: get(holidayNotifications),
  };
}

// Get upcoming holidays in the next 7 days for dashboard display
export async function getUpcomingHolidaysForDashboard(): Promise<Holiday[]> {
  try {
    const allHolidays = await getHolidays();
    const today = new Date();
    const sevenDaysFromNow = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    return allHolidays.filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      return (
        holidayDate >= today &&
        holidayDate <= sevenDaysFromNow &&
        holiday.is_active
      );
    });
  } catch (error) {
    console.error("Error getting upcoming holidays for dashboard:", error);
    return [];
  }
}

// Mark a holiday as seen (read) by user
export function markHolidayAsSeen(holidayId: number) {
  const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
  const seenHolidays: number[] = seenHolidaysStr
    ? JSON.parse(seenHolidaysStr)
    : [];

  if (!seenHolidays.includes(holidayId)) {
    seenHolidays.push(holidayId);
    localStorage.setItem(SEEN_HOLIDAYS_KEY, JSON.stringify(seenHolidays));
    console.log(`👁️ Marked holiday ${holidayId} as seen`);

    // Update the store by removing the seen holiday
    const currentNotifications = get(holidayNotifications);
    const updatedNotifications = currentNotifications.filter(
      (h) => h.id !== holidayId
    );
    holidayNotifications.set(updatedNotifications);
    console.log(
      `📱 Updated notification store: ${updatedNotifications.length} notifications remaining`
    );
  }
}

// Mark all current notifications as seen
export function markAllHolidaysAsSeen() {
  const currentNotifications = get(holidayNotifications);
  const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
  const seenHolidays: number[] = seenHolidaysStr
    ? JSON.parse(seenHolidaysStr)
    : [];

  currentNotifications.forEach((holiday) => {
    if (!seenHolidays.includes(holiday.id)) {
      seenHolidays.push(holiday.id);
    }
  });

  localStorage.setItem(SEEN_HOLIDAYS_KEY, JSON.stringify(seenHolidays));
  console.log(`👁️ Marked ${currentNotifications.length} holidays as seen`);

  // Clear all notifications
  holidayNotifications.set([]);
  console.log(`📱 Cleared all notifications`);
}

// Check if a holiday is seen
export function isHolidaySeen(holidayId: number): boolean {
  const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
  const seenHolidays: number[] = seenHolidaysStr
    ? JSON.parse(seenHolidaysStr)
    : [];
  return seenHolidays.includes(holidayId);
}

// Initialize existing notifications on app load
export async function initializeExistingNotifications() {
  try {
    console.log("🔄 Initializing existing notifications...");
    const allHolidays = await getHolidays();

    // Get previously notified holidays
    const notifiedHolidaysStr = localStorage.getItem(NOTIFIED_HOLIDAYS_KEY);
    const notifiedHolidays: number[] = notifiedHolidaysStr
      ? JSON.parse(notifiedHolidaysStr)
      : [];

    // Get previously seen holidays
    const seenHolidaysStr = localStorage.getItem(SEEN_HOLIDAYS_KEY);
    const seenHolidays: number[] = seenHolidaysStr
      ? JSON.parse(seenHolidaysStr)
      : [];

    // Find notifications that were shown but not yet read
    const unreadNotifications = allHolidays.filter(
      (holiday) =>
        notifiedHolidays.includes(holiday.id) &&
        !seenHolidays.includes(holiday.id) &&
        holiday.is_active
    );

    console.log(
      `📱 Found ${unreadNotifications.length} existing unread notifications`
    );
    holidayNotifications.set(unreadNotifications);

    return unreadNotifications;
  } catch (error) {
    console.error("❌ Error initializing existing notifications:", error);
    return [];
  }
}
