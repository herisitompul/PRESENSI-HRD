// Test file untuk fitur holiday notifications
import {
  getHolidays,
  getHolidaysForYear,
  getUpcomingHolidays,
  isHolidayDate,
} from "../src/lib/directus";

import {
  checkForNewHolidays,
  clearSeenHolidays,
  getUpcomingHolidaysForDashboard,
} from "../src/lib/holiday-notifications";

// Test basic holiday functions
async function testHolidayFunctions() {
  console.log("🧪 Testing Holiday Functions...");

  try {
    // Test getHolidays
    console.log("Testing getHolidays...");
    const allHolidays = await getHolidays();
    console.log(`✅ Found ${allHolidays.length} holidays`);

    // Test getHolidaysForYear
    console.log("Testing getHolidaysForYear...");
    const currentYear = new Date().getFullYear();
    const yearHolidays = await getHolidaysForYear(currentYear);
    console.log(`✅ Found ${yearHolidays.length} holidays for ${currentYear}`);

    // Test getUpcomingHolidays
    console.log("Testing getUpcomingHolidays...");
    const upcomingHolidays = await getUpcomingHolidays();
    console.log(`✅ Found ${upcomingHolidays.length} upcoming holidays`);

    // Test isHolidayDate
    console.log("Testing isHolidayDate...");
    const testDate = "2025-12-25";
    const holidayCheck = await isHolidayDate(testDate);
    console.log(`✅ Date ${testDate} is holiday: ${holidayCheck.isHoliday}`);

    // Test notification functions
    console.log("Testing notification functions...");
    const dashboardHolidays = await getUpcomingHolidaysForDashboard();
    console.log(`✅ Found ${dashboardHolidays.length} holidays for dashboard`);

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Test notification system
async function testNotificationSystem() {
  console.log("🧪 Testing Notification System...");

  try {
    // Clear seen holidays for testing
    clearSeenHolidays();
    console.log("✅ Cleared seen holidays");

    // Check for new holidays
    const newHolidays = await checkForNewHolidays();
    console.log(`✅ Found ${newHolidays.length} new holidays`);

    return true;
  } catch (error) {
    console.error("❌ Notification test failed:", error);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log("🚀 Starting Holiday Feature Tests...\n");

  const results = {
    basicFunctions: await testHolidayFunctions(),
    notifications: await testNotificationSystem(),
  };

  console.log("\n📊 Test Results:");
  console.log(
    `Basic Functions: ${results.basicFunctions ? "✅ PASSED" : "❌ FAILED"}`
  );
  console.log(
    `Notifications: ${results.notifications ? "✅ PASSED" : "❌ FAILED"}`
  );

  const allPassed = Object.values(results).every((result) => result === true);
  console.log(
    `\n🎯 Overall: ${
      allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
    }`
  );

  return allPassed;
}

// Helper function to create test data
async function createTestData() {
  console.log("🧪 Creating Test Data...");

  const testHolidays = [
    {
      date: "2025-08-17",
      year: 2025,
      name: "Hari Kemerdekaan Indonesia",
      description: "Peringatan kemerdekaan Republik Indonesia ke-80",
      type: "national",
      is_active: true,
    },
    {
      date: "2025-12-25",
      year: 2025,
      name: "Hari Natal",
      description: "Peringatan hari raya Natal",
      type: "religious",
      is_active: true,
    },
    {
      date: "2025-12-31",
      year: 2025,
      name: "Libur Akhir Tahun",
      description: "Libur perusahaan untuk persiapan tahun baru",
      type: "company",
      is_active: true,
    },
  ];

  console.log("📝 Test data created. Please add these manually to Directus:");
  console.log(JSON.stringify(testHolidays, null, 2));
}

// Export functions for browser console testing
if (typeof window !== "undefined") {
  window.holidayTests = {
    runTests,
    testHolidayFunctions,
    testNotificationSystem,
    createTestData,
  };
}

export {
  runTests,
  testHolidayFunctions,
  testNotificationSystem,
  createTestData,
};
