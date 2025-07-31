// approval-timeline-test.js
// Script untuk testing approval timeline dengan data sample

// Sample data untuk testing approval timeline
const sampleLemburWithApproval = {
  id: "test-001",
  user_id: "user-123",
  email: "john.doe@company.com",
  nama: "John Doe",
  divisi: "IT Department",
  tanggal: "2025-01-20",
  jam_masuk: "18:00",
  jam_keluar: "22:00",
  durasi_jam: 4,
  durasi_menit: 0,
  deskripsi: "Maintenance server dan backup database",
  status: "pending",
  tanggal_pengajuan: "2025-01-20T08:00:00Z",
  is_pengajuan_sebelum_h: true,

  // Approval workflow data
  approval_stage: "hrd_admin",
  overall_status: "pending",

  // Manager Divisi - Already approved (first stage)
  manager_divisi_approved: true,
  manager_divisi_approved_by: "Manager Operations",
  manager_divisi_approved_date: "2025-01-20T08:30:00Z", // Will display as: 20 Jan 2025
  manager_divisi_rejection_reason: null,

  // HRD Admin - Currently pending (second stage)
  hrd_admin_approved: null,
  hrd_admin_approved_by: null,
  hrd_admin_approved_date: null, // Will display as: — (pending)
  hrd_admin_rejection_reason: null,

  // Manager HRD - Not yet reached (third stage)
  manager_hrd_approved: null,
  manager_hrd_approved_by: null,
  manager_hrd_approved_date: null,
  manager_hrd_rejection_reason: null,

  // Direktur - Not yet reached (fourth stage)
  direktur_approved: null,
  direktur_approved_by: null,
  direktur_approved_date: null,
  direktur_rejection_reason: null,

  // Final approval - Not yet done
  final_approved_by: null,
  final_approved_date: null,
  final_rejection_reason: null,
};

// Sample data dengan rejection di tahap Manager HRD
const sampleLemburRejected = {
  id: "test-002",
  user_id: "user-456",
  email: "jane.smith@company.com",
  nama: "Jane Smith",
  divisi: "Marketing",
  tanggal: "2025-01-18",
  jam_masuk: "19:00",
  jam_keluar: "23:30",
  durasi_jam: 4,
  durasi_menit: 30,
  deskripsi: "Persiapan presentasi klien besar",
  status: "rejected",
  tanggal_pengajuan: "2025-01-18T07:30:00Z",
  is_pengajuan_sebelum_h: true,

  // Approval workflow data
  approval_stage: "hrd_admin",
  overall_status: "rejected",

  // Manager Divisi - Approved (first stage)
  manager_divisi_approved: true,
  manager_divisi_approved_by: "Marketing Manager",
  manager_divisi_approved_date: "2025-01-18T07:45:00Z",
  manager_divisi_rejection_reason: null,

  // HRD Admin - Rejected (second stage)
  hrd_admin_approved: false,
  hrd_admin_approved_by: "Sarah Admin",
  hrd_admin_approved_date: "2025-01-18T14:30:00Z",
  hrd_admin_rejection_reason:
    "Budget lembur bulan ini sudah habis. Silakan ajukan di bulan depan.",

  // Manager HRD - Not reached due to rejection
  manager_hrd_approved: null,
  manager_hrd_approved_by: null,
  manager_hrd_approved_date: null,
  manager_hrd_rejection_reason: null,

  // Direktur - Not reached due to rejection
  direktur_approved: null,
  direktur_approved_by: null,
  direktur_approved_date: null,
  direktur_rejection_reason: null,

  // Final rejection reason
  final_approved_by: null,
  final_approved_date: null,
  final_rejection_reason:
    "Budget lembur bulan ini sudah habis. Silakan ajukan di bulan depan.",
};

// Sample data dengan full approval
const sampleLemburApproved = {
  id: "test-003",
  user_id: "user-789",
  email: "mike.johnson@company.com",
  nama: "Mike Johnson",
  divisi: "Operations",
  tanggal: "2025-01-15",
  jam_masuk: "20:00",
  jam_keluar: "02:00",
  durasi_jam: 6,
  durasi_menit: 0,
  deskripsi: "Monitoring sistem critical update",
  status: "approved",
  tanggal_pengajuan: "2025-01-15T06:00:00Z",
  is_pengajuan_sebelum_h: true,

  // Approval workflow data
  approval_stage: "completed",
  overall_status: "approved",

  // Manager Divisi - Approved (first stage)
  manager_divisi_approved: true,
  manager_divisi_approved_by: "Ops Manager",
  manager_divisi_approved_date: "2025-01-15T06:30:00Z",
  manager_divisi_rejection_reason: null,

  // HRD Admin - Approved (second stage)
  hrd_admin_approved: true,
  hrd_admin_approved_by: "Sarah Admin",
  hrd_admin_approved_date: "2025-01-15T07:00:00Z",
  hrd_admin_rejection_reason: null,

  // Manager HRD - Approved (third stage)
  manager_hrd_approved: true,
  manager_hrd_approved_by: "Lisa Manager",
  manager_hrd_approved_date: "2025-01-15T10:30:00Z",
  manager_hrd_rejection_reason: null,

  // Direktur - Approved (fourth stage)
  direktur_approved: true,
  direktur_approved_by: "Director John",
  direktur_approved_date: "2025-01-15T15:45:00Z",
  direktur_rejection_reason: null,

  // Final approval
  final_approved_by: "System Auto Approval",
  final_approved_date: "2025-01-16T08:05:00Z",
  final_rejection_reason: null,
};

// Function untuk test approval stages
function testApprovalStages() {
  console.log("=== Testing Approval Timeline ===");

  // Test dengan data pending
  console.log("\n1. Testing Pending Approval:");
  console.log("Sample data:", sampleLemburWithApproval);

  // Test dengan data rejected
  console.log("\n2. Testing Rejected Approval:");
  console.log("Sample data:", sampleLemburRejected);

  // Test dengan data approved
  console.log("\n3. Testing Approved Approval:");
  console.log("Sample data:", sampleLemburApproved);
}

// Function untuk inject test data ke localStorage (untuk development)
function injectTestData() {
  const testData = [
    sampleLemburWithApproval,
    sampleLemburRejected,
    sampleLemburApproved,
  ];

  localStorage.setItem("lembur_test_data", JSON.stringify(testData));
  console.log("Test data injected to localStorage");
  console.log("Use localStorage.getItem('lembur_test_data') to retrieve");
}

// Export untuk digunakan di browser console
if (typeof window !== "undefined") {
  window.approvalTestData = {
    pending: sampleLemburWithApproval,
    rejected: sampleLemburRejected,
    approved: sampleLemburApproved,
    test: testApprovalStages,
    inject: injectTestData,
  };

  console.log("Approval test data available at window.approvalTestData");
  console.log("Available commands:");
  console.log("- window.approvalTestData.test() - Run tests");
  console.log("- window.approvalTestData.inject() - Inject to localStorage");
  console.log("- window.approvalTestData.pending - Sample pending data");
  console.log("- window.approvalTestData.rejected - Sample rejected data");
  console.log("- window.approvalTestData.approved - Sample approved data");
}

// Node.js export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    sampleLemburWithApproval,
    sampleLemburRejected,
    sampleLemburApproved,
    testApprovalStages,
    injectTestData,
  };
}
