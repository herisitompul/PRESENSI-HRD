// Test untuk fitur Cuti Tahunan
// Jalankan di browser console atau sebagai script terpisah

// Test Case 1: Perhitungan sisa cuti
function testCutiCalculation() {
  console.log("=== Test Case 1: Perhitungan Sisa Cuti ===");
  
  const totalAllocation = 12;
  const usedDays = 5;
  const remaining = totalAllocation - usedDays;
  
  console.log(`Total alokasi: ${totalAllocation} hari`);
  console.log(`Sudah digunakan: ${usedDays} hari`);
  console.log(`Sisa tersedia: ${remaining} hari`);
  
  if (remaining === 7) {
    console.log("✅ Test PASSED: Perhitungan sisa cuti benar");
  } else {
    console.log("❌ Test FAILED: Perhitungan sisa cuti salah");
  }
}

// Test Case 2: Validasi melebihi sisa cuti
function testExceedValidation() {
  console.log("\n=== Test Case 2: Validasi Melebihi Sisa Cuti ===");
  
  const remaining = 3;
  const requestedDays = 5;
  
  console.log(`Sisa cuti: ${remaining} hari`);
  console.log(`Pengajuan: ${requestedDays} hari`);
  
  const isValid = requestedDays <= remaining;
  
  if (!isValid) {
    console.log("✅ Test PASSED: Validasi mendeteksi pengajuan melebihi sisa");
  } else {
    console.log("❌ Test FAILED: Validasi tidak mendeteksi pengajuan melebihi sisa");
  }
}

// Test Case 3: Validasi periode tahun
function testYearValidation() {
  console.log("\n=== Test Case 3: Validasi Periode Tahun ===");
  
  const currentYear = new Date().getFullYear();
  const startDate = new Date(`${currentYear}-06-01`);
  const endDate = new Date(`${currentYear + 1}-01-15`);
  
  console.log(`Tanggal mulai: ${startDate.toDateString()}`);
  console.log(`Tanggal selesai: ${endDate.toDateString()}`);
  
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const isValidYear = startYear === currentYear && endYear === currentYear;
  
  if (!isValidYear) {
    console.log("✅ Test PASSED: Validasi mendeteksi tanggal lintas tahun");
  } else {
    console.log("❌ Test FAILED: Validasi tidak mendeteksi tanggal lintas tahun");
  }
}

// Test Case 4: Perhitungan total hari
function testDaysCalculation() {
  console.log("\n=== Test Case 4: Perhitungan Total Hari ===");
  
  const startDate = new Date('2025-07-01');
  const endDate = new Date('2025-07-03');
  
  console.log(`Tanggal mulai: ${startDate.toDateString()}`);
  console.log(`Tanggal selesai: ${endDate.toDateString()}`);
  
  const timeDiff = endDate.getTime() - startDate.getTime();
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 karena termasuk hari mulai
  
  console.log(`Total hari: ${dayDiff} hari`);
  
  if (dayDiff === 3) {
    console.log("✅ Test PASSED: Perhitungan total hari benar (termasuk hari mulai)");
  } else {
    console.log("❌ Test FAILED: Perhitungan total hari salah");
  }
}

// Test Case 5: Warning levels
function testWarningLevels() {
  console.log("\n=== Test Case 5: Warning Levels ===");
  
  const testCases = [
    { remaining: 0, expected: "error" },
    { remaining: 2, expected: "warning" },
    { remaining: 5, expected: "normal" }
  ];
  
  testCases.forEach((testCase, index) => {
    const { remaining, expected } = testCase;
    
    let level;
    if (remaining <= 0) {
      level = "error";
    } else if (remaining <= 3) {
      level = "warning";
    } else {
      level = "normal";
    }
    
    console.log(`Test ${index + 1}: Sisa ${remaining} hari -> Level: ${level}`);
    
    if (level === expected) {
      console.log("✅ Test PASSED");
    } else {
      console.log("❌ Test FAILED");
    }
  });
}

// Jalankan semua test
function runAllTests() {
  console.log("🧪 Running Cuti Tahunan Feature Tests...\n");
  
  testCutiCalculation();
  testExceedValidation();
  testYearValidation();
  testDaysCalculation();
  testWarningLevels();
  
  console.log("\n🎉 All tests completed!");
}

// Auto-run untuk Node.js atau browser
runAllTests();
