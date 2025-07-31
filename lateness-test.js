// Test script untuk fungsi keterlambatan
// Jalankan di browser console untuk testing

// Import fungsi yang akan ditest (copy dari absensi.ts)
function calculateLateness(waktuMasuk) {
  const workStartHour = 8;
  const workStartMinute = 0;

  const timeParts = waktuMasuk.split(":");
  const jam = parseInt(timeParts[0]);
  const menit = parseInt(timeParts[1]);

  const waktuMasukMenit = jam * 60 + menit;
  const workStartMenit = workStartHour * 60 + workStartMinute;

  if (waktuMasukMenit <= workStartMenit) {
    return { terlambat: false, menitKeterlambatan: 0 };
  } else {
    const keterlambatan = waktuMasukMenit - workStartMenit;
    return { terlambat: true, menitKeterlambatan: keterlambatan };
  }
}

function formatKeterlambatan(menitKeterlambatan) {
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

// Test cases
const testCases = [
  { waktu: "07:30:00", expected: { terlambat: false, menitKeterlambatan: 0 } },
  { waktu: "08:00:00", expected: { terlambat: false, menitKeterlambatan: 0 } },
  { waktu: "08:15:00", expected: { terlambat: true, menitKeterlambatan: 15 } },
  { waktu: "08:30:00", expected: { terlambat: true, menitKeterlambatan: 30 } },
  { waktu: "09:00:00", expected: { terlambat: true, menitKeterlambatan: 60 } },
  { waktu: "09:30:00", expected: { terlambat: true, menitKeterlambatan: 90 } },
  { waktu: "10:00:00", expected: { terlambat: true, menitKeterlambatan: 120 } },
];

console.log("=== Testing calculateLateness ===");
testCases.forEach((test, index) => {
  const result = calculateLateness(test.waktu);
  const isCorrect =
    result.terlambat === test.expected.terlambat &&
    result.menitKeterlambatan === test.expected.menitKeterlambatan;

  console.log(`Test ${index + 1}: ${test.waktu}`);
  console.log(`  Expected: ${JSON.stringify(test.expected)}`);
  console.log(`  Result: ${JSON.stringify(result)}`);
  console.log(`  Status: ${isCorrect ? "✅ PASS" : "❌ FAIL"}`);
  console.log("---");
});

console.log("\n=== Testing formatKeterlambatan ===");
const formatTests = [
  { menit: 0, expected: "Tepat waktu" },
  { menit: 15, expected: "Terlambat 15 menit" },
  { menit: 30, expected: "Terlambat 30 menit" },
  { menit: 60, expected: "Terlambat 1 jam" },
  { menit: 90, expected: "Terlambat 1 jam 30 menit" },
  { menit: 120, expected: "Terlambat 2 jam" },
  { menit: 150, expected: "Terlambat 2 jam 30 menit" },
];

formatTests.forEach((test, index) => {
  const result = formatKeterlambatan(test.menit);
  const isCorrect = result === test.expected;

  console.log(`Format Test ${index + 1}: ${test.menit} menit`);
  console.log(`  Expected: "${test.expected}"`);
  console.log(`  Result: "${result}"`);
  console.log(`  Status: ${isCorrect ? "✅ PASS" : "❌ FAIL"}`);
  console.log("---");
});

console.log("\n=== Test Summary ===");
console.log(
  "Semua test case telah dijalankan. Cek status ✅ PASS atau ❌ FAIL di atas."
);
console.log(
  "Jika ada yang FAIL, periksa implementasi fungsi di src/lib/absensi.ts"
);
