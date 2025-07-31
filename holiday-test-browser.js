// Test script for holiday notifications
// Run this script in the browser console to test holiday notification functionality

console.log("🧪 Holiday Notification Test Script Loaded");

// Test functions
const HolidayTest = {
  // Clear all seen holidays (to test new notifications)
  clearSeenHolidays: () => {
    localStorage.removeItem("seen_holidays");
    localStorage.removeItem("notified_holidays");
    console.log("✅ Cleared seen and notified holidays from localStorage");
  },

  // Get current seen holidays
  getSeenHolidays: () => {
    const seen = localStorage.getItem("seen_holidays");
    const parsed = seen ? JSON.parse(seen) : [];
    console.log("👁️ Current seen holidays:", parsed);
    return parsed;
  },

  // Get current notified holidays
  getNotifiedHolidays: () => {
    const notified = localStorage.getItem("notified_holidays");
    const parsed = notified ? JSON.parse(notified) : [];
    console.log("📢 Current notified holidays:", parsed);
    return parsed;
  },

  // Force check for new holidays
  forceCheck: async () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log("🔄 Force checking for new holidays...");
      const result = await window.testHolidayNotifications.forceCheck();
      console.log("✅ Force check result:", result);
      return result;
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Initialize existing notifications
  initExisting: async () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log("🔄 Initializing existing notifications...");
      const result = await window.testHolidayNotifications.initExisting();
      console.log("✅ Init result:", result);
      return result;
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Mark a holiday as seen
  markAsSeen: (holidayId) => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log(`👁️ Marking holiday ${holidayId} as seen...`);
      window.testHolidayNotifications.markAsSeen(holidayId);
      console.log("✅ Holiday marked as seen");
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Mark all holidays as seen
  markAllAsSeen: () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log("👁️ Marking all holidays as seen...");
      window.testHolidayNotifications.markAllAsSeen();
      console.log("✅ All holidays marked as seen");
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Debug current state
  debug: async () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log("🐛 Getting debug information...");
      const result = await window.testHolidayNotifications.debug();
      console.log("📊 Debug result:", result);
      return result;
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Get current notifications
  getCurrentNotifications: () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      const notifications =
        window.testHolidayNotifications.currentNotifications();
      console.log("📱 Current notifications:", notifications);
      return notifications;
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Manual refresh
  refresh: async () => {
    if (typeof window !== "undefined" && window.testHolidayNotifications) {
      console.log("🔄 Manually refreshing holiday notifications...");
      const result = await window.testHolidayNotifications.refresh();
      console.log("✅ Refresh result:", result);
      return result;
    } else {
      console.log(
        "❌ Test functions not available. Make sure you're on the dashboard page."
      );
    }
  },

  // Full test sequence
  fullTest: async () => {
    console.log("🧪 Starting full holiday notification test...");

    // Step 1: Clear seen holidays
    HolidayTest.clearSeenHolidays();

    // Step 2: Initialize existing notifications
    await HolidayTest.initExisting();

    // Step 3: Force check
    await HolidayTest.forceCheck();

    // Step 4: Debug state
    await HolidayTest.debug();

    // Step 5: Get current notifications
    HolidayTest.getCurrentNotifications();

    console.log("✅ Full test completed!");
  },

  // Test notification persistence
  testPersistence: async () => {
    console.log("🧪 Testing notification persistence...");

    // Step 1: Clear everything
    HolidayTest.clearSeenHolidays();

    // Step 2: Force check to get notifications
    await HolidayTest.forceCheck();

    // Step 3: Check current notifications
    const notifications = HolidayTest.getCurrentNotifications();
    console.log(`📱 Got ${notifications.length} notifications`);

    // Step 4: Refresh page simulation (init existing)
    console.log("🔄 Simulating page refresh...");
    await HolidayTest.initExisting();

    // Step 5: Check if notifications are still there
    const persistedNotifications = HolidayTest.getCurrentNotifications();
    console.log(
      `📱 After refresh: ${persistedNotifications.length} notifications`
    );

    if (persistedNotifications.length === notifications.length) {
      console.log("✅ Notifications persisted successfully!");
    } else {
      console.log("❌ Notifications did not persist correctly!");
    }
  },
};

// Make it globally available
window.HolidayTest = HolidayTest;

console.log("🎯 Test functions available:");
console.log(
  "- HolidayTest.clearSeenHolidays() - Clear seen and notified holidays"
);
console.log("- HolidayTest.getSeenHolidays() - Get current seen holidays");
console.log(
  "- HolidayTest.getNotifiedHolidays() - Get current notified holidays"
);
console.log("- HolidayTest.forceCheck() - Force check for new holidays");
console.log("- HolidayTest.initExisting() - Initialize existing notifications");
console.log("- HolidayTest.markAsSeen(id) - Mark holiday as seen");
console.log("- HolidayTest.markAllAsSeen() - Mark all holidays as seen");
console.log("- HolidayTest.debug() - Debug current state");
console.log(
  "- HolidayTest.getCurrentNotifications() - Get current notifications"
);
console.log("- HolidayTest.refresh() - Manual refresh");
console.log("- HolidayTest.fullTest() - Run full test sequence");
console.log("- HolidayTest.testPersistence() - Test notification persistence");
