<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { user } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import { goto } from "$app/navigation";
  import {
    submitLembur,
    submitLemburLegacy,
    getLemburHistory,
    formatDurasiLembur,
    updateLembur,
    getApprovalStages,
    getCurrentApprovalStatus,
    formatApprovalDate,
    getApprovalStatusIcon,
    getApprovalStatusColor,
    type Lembur,
    type LemburSubmission,
    type LemburUpdateSubmission,
    type ApprovalStageInfo,
  } from "$lib/lembur";
  import type { Akun } from "$lib/directus";
  import LemburAbsensiButton from "$lib/LemburAbsensiButton.svelte";
  import LemburAbsensiData from "$lib/LemburAbsensiData.svelte";
  import LemburAbsensiMandiri from "$lib/LemburAbsensiMandiri.svelte";
  import {
    getAbsensiLembur,
    canAbsensiMasuk,
    canAbsensiKeluar,
    type AbsensiLembur,
  } from "$lib/absensi-lembur";

  let currentUser: Akun | null = null;

  // Tab navigation state
  let currentTab = "pengajuan"; // "pengajuan" or "absensi-mandiri"

  // Edit mode variables
  let editMode = false;
  let editingItemId: string | null = null;
  let originalFormData: any = null;

  // Riwayat pengajuan lembur
  let lemburHistory: Lembur[] = [];
  let isLoadingHistory = false;
  let historyError: string | null = null;

  // Form data untuk Lembur
  let formDataLembur = {
    tanggal: "",
    jam_masuk: "",
    jam_keluar: "",
    deskripsi: "",
    catatan_penyesuaian: "",
  };

  // File upload
  let fotoFile: File | null = null;
  let fileInput: HTMLInputElement;
  let existingFotoUrl: string | null = null; // URL foto yang sudah ada (untuk edit mode)
  let previewUrl: string | null = null; // URL preview untuk foto baru yang dipilih
  let showImageModal = false; // Flag untuk modal preview gambar
  let modalImageUrl: string | null = null; // URL gambar untuk modal
  let imageLoadError = false; // Flag untuk error loading gambar

  // Lembur absensi data
  let currentAbsensiLembur: AbsensiLembur | null = null;
  let selectedLemburId: string | null = null; // ID lembur yang dipilih untuk absensi
  let isLoadingAbsensi = false;

  // Legacy UI data for preview (will be replaced by backend data)
  let lemburAbsensiData: {
    masuk?: {
      foto: string;
      lokasi: { latitude: number; longitude: number; address?: string };
      timestamp: string;
    };
    keluar?: {
      foto: string;
      lokasi: { latitude: number; longitude: number; address?: string };
      timestamp: string;
    };
  } = {};

  // Computed values
  $: durasiOtomatis =
    formDataLembur.jam_masuk && formDataLembur.jam_keluar
      ? calculateDurasiDisplay(
          formDataLembur.jam_masuk,
          formDataLembur.jam_keluar
        )
      : null;

  $: isPengajuanSebelumH = formDataLembur.tanggal
    ? checkPengajuanSebelumH(formDataLembur.tanggal)
    : false;

  // Helper functions
  function calculateDurasiDisplay(jamMasuk: string, jamKeluar: string): string {
    try {
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

      return `${jam} jam ${menit} menit`;
    } catch {
      return "Invalid time";
    }
  }

  function checkPengajuanSebelumH(tanggalLembur: string): boolean {
    const today = new Date();
    const lemburDate = new Date(tanggalLembur);

    // Reset time untuk perbandingan tanggal saja
    today.setHours(0, 0, 0, 0);
    lemburDate.setHours(0, 0, 0, 0);

    return lemburDate > today;
  }

  // File upload handler
  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];

      // Validasi ukuran file (maksimal 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file maksimal 5MB", "error");
        target.value = "";
        fotoFile = null;
        clearPreview();
        return;
      }

      // Validasi tipe file
      if (!file.type.startsWith("image/")) {
        showToast("File harus berupa gambar", "error");
        target.value = "";
        fotoFile = null;
        clearPreview();
        return;
      }

      fotoFile = file;
      createPreview(file);
    } else {
      fotoFile = null;
      clearPreview();
    }
  }

  function createPreview(file: File) {
    // Clear existing preview
    clearPreview();

    // Create new preview URL
    previewUrl = URL.createObjectURL(file);
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  // Function to get Directus file URL
  function getDirectusFileUrl(fileId: string): string {
    const directusUrl =
      import.meta.env.VITE_DIRECTUS_URL || "http://localhost:8055";
    return `${directusUrl}/assets/${fileId}`;
  }

  // Modal preview functions
  function openImageModal(imageUrl: string) {
    modalImageUrl = imageUrl;
    showImageModal = true;
  }

  function closeImageModal() {
    showImageModal = false;
    modalImageUrl = null;
    imageLoadError = false;
  }

  function handleImageError() {
    imageLoadError = true;
    showToast("Gagal memuat foto", "error");
  }

  function removeFile() {
    fotoFile = null;
    clearPreview();
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function removeExistingFile() {
    existingFotoUrl = null;
    // Reset file input juga jika ada
    fotoFile = null;
    clearPreview();
    if (fileInput) {
      fileInput.value = "";
    }
    showToast("Foto existing akan dihapus saat update", "info");
  }

  // Lembur attendance handlers
  async function loadAbsensiLembur(lemburId: string) {
    if (!lemburId) return;

    try {
      isLoadingAbsensi = true;
      currentAbsensiLembur = await getAbsensiLembur(lemburId);
    } catch (error) {
      console.error("Error loading absensi lembur:", error);
      showToast("Gagal memuat data absensi lembur", "error");
    } finally {
      isLoadingAbsensi = false;
    }
  }

  function handleLemburSelection(lembur: Lembur) {
    // Absensi lembur sekarang dapat dilakukan untuk semua pengajuan
    // tanpa memperhatikan status persetujuan
    selectedLemburId = lembur.id || null;
    if (selectedLemburId) {
      loadAbsensiLembur(selectedLemburId);
    }
  }

  function handleLemburAbsensiSuccess(event: CustomEvent) {
    const { type, data } = event.detail;

    // Update current absensi data
    currentAbsensiLembur = data;

    // Also update legacy preview data for backward compatibility
    if (type === "masuk") {
      lemburAbsensiData.masuk = {
        foto: data.foto_masuk ? `foto-preview-${data.id}` : "",
        lokasi: {
          latitude: data.lokasi_masuk_lat || 0,
          longitude: data.lokasi_masuk_lng || 0,
          address: data.lokasi_masuk_address,
        },
        timestamp: data.date_updated || new Date().toISOString(),
      };
    } else {
      lemburAbsensiData.keluar = {
        foto: data.foto_keluar ? `foto-preview-${data.id}` : "",
        lokasi: {
          latitude: data.lokasi_keluar_lat || 0,
          longitude: data.lokasi_keluar_lng || 0,
          address: data.lokasi_keluar_address,
        },
        timestamp: data.date_updated || new Date().toISOString(),
      };
    }

    // Trigger reactivity
    lemburAbsensiData = { ...lemburAbsensiData };
  }

  function clearLemburAbsensi(type: "masuk" | "keluar") {
    if (type === "masuk") {
      delete lemburAbsensiData.masuk;
      // Reset backend data as well
      if (currentAbsensiLembur) {
        currentAbsensiLembur.waktu_masuk = undefined;
        currentAbsensiLembur.foto_masuk = undefined;
        currentAbsensiLembur.lokasi_masuk_lat = undefined;
        currentAbsensiLembur.lokasi_masuk_lng = undefined;
        currentAbsensiLembur.lokasi_masuk_address = undefined;
      }
    } else {
      delete lemburAbsensiData.keluar;
      // Reset backend data as well
      if (currentAbsensiLembur) {
        currentAbsensiLembur.waktu_keluar = undefined;
        currentAbsensiLembur.foto_keluar = undefined;
        currentAbsensiLembur.lokasi_keluar_lat = undefined;
        currentAbsensiLembur.lokasi_keluar_lng = undefined;
        currentAbsensiLembur.lokasi_keluar_address = undefined;
      }
    }
    // Trigger reactivity
    lemburAbsensiData = { ...lemburAbsensiData };
  }

  // Check if user can do attendance
  $: canAbsensiMasukLembur =
    selectedLemburId &&
    canAbsensiMasuk(currentAbsensiLembur) &&
    !isLoadingAbsensi;
  $: canAbsensiKeluarLembur =
    selectedLemburId &&
    canAbsensiKeluar(currentAbsensiLembur) &&
    !isLoadingAbsensi;

  // Legacy mode: hitung durasi dari jam masuk/keluar untuk fallback
  function calculateDurasiFromForm(): { jam: number; menit: number } {
    if (!formDataLembur.jam_masuk || !formDataLembur.jam_keluar) {
      // Fallback ke 1 jam jika tidak ada data
      return { jam: 1, menit: 0 };
    }

    try {
      const [masukJam, masukMenit] = formDataLembur.jam_masuk
        .split(":")
        .map(Number);
      const [keluarJam, keluarMenit] = formDataLembur.jam_keluar
        .split(":")
        .map(Number);

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
    } catch {
      // Fallback ke 1 jam jika error
      return { jam: 1, menit: 0 };
    }
  }

  let isSubmitting = false;
  let hasSetupIssue = false;
  let isLegacyMode = false; // Mode kompatibilitas dengan schema lama

  onMount(() => {
    const unsubscribe = user.subscribe(($user) => {
      // Clear data when user changes
      if (currentUser?.id !== $user?.id) {
        lemburHistory = [];
        isLoadingHistory = false;
        historyError = null;
        hasSetupIssue = false;
        resetForm();
      }

      currentUser = $user;
      if (!$user) {
        goto("/login");
        return;
      }

      // Load lembur history on mount
      loadLemburHistory();
    });

    return unsubscribe;
  });

  onDestroy(() => {
    // Cleanup preview URL to prevent memory leaks
    clearPreview();
  });

  async function loadLemburHistory() {
    try {
      isLoadingHistory = true;
      historyError = null;

      lemburHistory = await getLemburHistory();
    } catch (error) {
      console.error("Error loading lembur history:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Gagal memuat riwayat lembur";
      historyError = errorMessage;

      // Check if this is a setup issue
      if (
        errorMessage.includes("Collection") ||
        errorMessage.includes("Akses ditolak")
      ) {
        hasSetupIssue = true;
      }

      // Only show toast for unexpected errors, not for configuration issues
      if (
        !errorMessage.includes("Collection") &&
        !errorMessage.includes("Akses ditolak")
      ) {
        showToast(errorMessage, "error");
      }
    } finally {
      isLoadingHistory = false;
    }
  }

  function resetForm() {
    if (editMode) {
      console.log("Skipping form reset - in edit mode");
      return; // Jangan reset form saat dalam edit mode
    }

    console.log("Resetting form to empty state");

    formDataLembur = {
      tanggal: "",
      jam_masuk: "",
      jam_keluar: "",
      deskripsi: "",
      catatan_penyesuaian: "",
    };

    // Reset file upload
    fotoFile = null;
    existingFotoUrl = null;
    clearPreview();
    if (fileInput) {
      fileInput.value = "";
    }
  }

  // Edit mode functions
  function startEdit(item: Lembur) {
    if (item.status !== "pending") {
      showToast(
        "Hanya pengajuan dengan status pending yang dapat diedit",
        "error"
      );
      return;
    }

    // Validasi apakah item memiliki data yang diperlukan
    if (!item.id) {
      showToast("ID pengajuan tidak valid", "error");
      return;
    }

    console.log("Starting edit for item:", item);

    editMode = true;
    editingItemId = item.id;

    // Simpan data form saat ini sebagai backup
    originalFormData = { ...formDataLembur };

    // Isi form dengan data yang akan diedit
    formDataLembur = {
      tanggal: item.tanggal || "",
      jam_masuk: item.jam_masuk || "",
      jam_keluar: item.jam_keluar || "",
      deskripsi: item.deskripsi || "",
      catatan_penyesuaian: item.catatan_penyesuaian || "",
    };

    // Handle existing foto - jangan reset file input jika ada foto existing
    existingFotoUrl = item.lampiran_foto_opsional || null;

    // Reset file input hanya jika tidak ada foto existing
    if (!existingFotoUrl) {
      fotoFile = null;
      if (fileInput) {
        fileInput.value = "";
      }
    } else {
      // Jika ada foto existing, reset file yang baru dipilih tapi simpan referensi existing
      fotoFile = null;
      if (fileInput) {
        fileInput.value = "";
      }
    }

    // Scroll to form dengan delay kecil untuk memastikan DOM sudah update
    setTimeout(() => {
      document
        .querySelector(".form-container")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    showToast(
      `Mode edit untuk pengajuan tanggal ${formatDate(item.tanggal)}`,
      "info"
    );
  }

  function cancelEdit() {
    console.log("Cancelling edit mode");

    // Konfirmasi jika ada perubahan
    if (
      originalFormData &&
      JSON.stringify(formDataLembur) !== JSON.stringify(originalFormData)
    ) {
      if (
        !confirm(
          "Anda memiliki perubahan yang belum disimpan. Yakin ingin membatalkan edit?"
        )
      ) {
        return;
      }
    }

    editMode = false;
    editingItemId = null;
    existingFotoUrl = null; // Reset existing foto URL
    clearPreview(); // Clear preview URL

    if (originalFormData) {
      // Kembalikan data form ke kondisi sebelum edit
      formDataLembur = { ...originalFormData };
      originalFormData = null;
    } else {
      // Reset form ke keadaan kosong jika tidak ada backup
      resetForm();
    }

    showToast("Edit dibatalkan", "info");
  }

  async function handleUpdateLembur() {
    if (!validateForm()) return;

    if (!editingItemId) {
      showToast("ID pengajuan tidak valid", "error");
      return;
    }

    console.log("Updating lembur with ID:", editingItemId);
    console.log("Form data:", formDataLembur);
    console.log("New file:", fotoFile ? fotoFile.name : null);
    console.log("Existing foto URL:", existingFotoUrl);

    isSubmitting = true;

    try {
      const updateData: LemburUpdateSubmission = {
        tanggal: formDataLembur.tanggal,
        jam_masuk: formDataLembur.jam_masuk,
        jam_keluar: formDataLembur.jam_keluar,
        deskripsi: formDataLembur.deskripsi,
        catatan_penyesuaian: formDataLembur.catatan_penyesuaian,
        lampiran_foto_opsional: fotoFile, // Foto baru jika ada
        keep_existing_foto: existingFotoUrl !== null && !fotoFile, // Jaga foto existing jika masih ada dan tidak ada foto baru
      };

      await updateLembur(editingItemId, updateData);

      showToast("Pengajuan lembur berhasil diperbarui!", "success");

      // Reset edit mode
      cancelEdit();

      // Reload riwayat lembur setelah berhasil update
      await loadLemburHistory();
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal memperbarui pengajuan lembur";

      // Check if this is a setup issue
      if (
        errorMessage.includes("Collection") ||
        errorMessage.includes("Akses ditolak")
      ) {
        hasSetupIssue = true;
      }

      showToast(errorMessage, "error");
    } finally {
      isSubmitting = false;
    }
  }

  async function handleSubmit() {
    console.log("handleSubmit called:", { editMode, editingItemId });

    if (editMode) {
      return await handleUpdateLembur();
    } else {
      return await handleSubmitLembur();
    }
  }

  async function handleSubmitLembur() {
    if (!validateForm()) return;

    isSubmitting = true;

    try {
      console.log("Data form lembur:", {
        tanggal: formDataLembur.tanggal,
        jam_masuk: formDataLembur.jam_masuk,
        jam_keluar: formDataLembur.jam_keluar,
        deskripsi: formDataLembur.deskripsi,
        catatan_penyesuaian: formDataLembur.catatan_penyesuaian,
        fotoFile: fotoFile ? fotoFile.name : null,
        isLegacyMode: isLegacyMode,
      });

      if (isLegacyMode) {
        // Legacy mode: gunakan durasi manual dari form lama
        const durasi = calculateDurasiFromForm();
        await submitLemburLegacy({
          tanggal: formDataLembur.tanggal,
          durasi_jam: durasi.jam,
          durasi_menit: durasi.menit,
          deskripsi: formDataLembur.deskripsi,
        });
      } else {
        // Mode normal: gunakan jam masuk/keluar
        await submitLembur({
          tanggal: formDataLembur.tanggal,
          jam_masuk: formDataLembur.jam_masuk,
          jam_keluar: formDataLembur.jam_keluar,
          deskripsi: formDataLembur.deskripsi,
          catatan_penyesuaian: formDataLembur.catatan_penyesuaian,
          lampiran_foto_opsional: fotoFile,
        });
      }

      showToast("Pengajuan lembur berhasil dikirim!", "success");
      resetForm();

      // Reload riwayat lembur setelah berhasil submit
      await loadLemburHistory();
    } catch (error) {
      console.error("Submit lembur error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal mengirim pengajuan lembur";

      // Check if this is a field validation error (legacy mode needed)
      if (
        errorMessage.includes("field") ||
        errorMessage.includes("Field") ||
        errorMessage.includes("doesn't exist") ||
        errorMessage.includes("tidak valid")
      ) {
        isLegacyMode = true;
        showToast(
          "Menggunakan mode kompatibilitas. Beberapa fitur baru tidak tersedia.",
          "info"
        );
      }

      // Check if this is a setup issue
      if (
        errorMessage.includes("Collection") ||
        errorMessage.includes("Akses ditolak")
      ) {
        hasSetupIssue = true;
      }

      showToast(errorMessage, "error");
    } finally {
      isSubmitting = false;
    }
  }

  function validateForm() {
    if (!formDataLembur.tanggal) {
      showToast("Tanggal lembur harus diisi", "error");
      return false;
    }

    if (!formDataLembur.jam_masuk || !formDataLembur.jam_keluar) {
      showToast("Jam masuk dan jam keluar harus diisi", "error");
      return false;
    }

    // Validasi jam masuk tidak boleh sama dengan jam keluar
    if (formDataLembur.jam_masuk === formDataLembur.jam_keluar) {
      showToast("Jam masuk dan jam keluar tidak boleh sama", "error");
      return false;
    }

    if (!formDataLembur.deskripsi.trim()) {
      showToast("Deskripsi lembur harus diisi", "error");
      return false;
    }

    if (formDataLembur.deskripsi.trim().length < 10) {
      showToast("Deskripsi minimal 10 karakter", "error");
      return false;
    }

    // Validasi khusus untuk edit mode
    if (editMode && !editingItemId) {
      showToast("ID pengajuan yang akan diedit tidak valid", "error");
      return false;
    }

    // Validasi tanggal tidak boleh di masa depan yang terlalu jauh (lebih dari 30 hari)
    const tanggalLembur = new Date(formDataLembur.tanggal);
    const today = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setDate(today.getDate() + 30);

    if (tanggalLembur > maxFutureDate) {
      showToast(
        "Tanggal lembur tidak boleh lebih dari 30 hari ke depan",
        "error"
      );
      return false;
    }

    return true;
  }

  function goBack() {
    goto("/");
  }

  // Utility functions
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "approved":
        return "#10b981";
      case "rejected":
        return "#ef4444";
      case "pending":
      default:
        return "#f59e0b";
    }
  }

  function getStatusText(status: string): string {
    switch (status) {
      case "approved":
        return "Disetujui";
      case "rejected":
        return "Ditolak";
      case "pending":
      default:
        return "Menunggu";
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case "approved":
        return "fas fa-check-circle";
      case "rejected":
        return "fas fa-times-circle";
      case "pending":
      default:
        return "fas fa-clock";
    }
  }
</script>

<div class="page-container">
  <!-- Header -->
  <header class="header">
    <button class="back-btn" on:click={goBack} aria-label="Kembali">
      <i class="fas fa-arrow-left"></i>
    </button>
    <h1>Lembur</h1>
    <div class="spacer"></div>
  </header>

  <!-- Content -->
  <main class="main-content">
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        class="tab-btn {currentTab === 'pengajuan' ? 'active' : ''}"
        on:click={() => (currentTab = "pengajuan")}
      >
        <i class="fas fa-file-alt"></i>
        Pengajuan Lembur
      </button>
      <button
        class="tab-btn {currentTab === 'absensi-mandiri' ? 'active' : ''}"
        on:click={() => (currentTab = "absensi-mandiri")}
      >
        <i class="fas fa-camera"></i>
        Absensi Lembur Mandiri
      </button>
    </div>

    {#if currentTab === "pengajuan"}
      <!-- Form Lembur -->
      <div class="form-container">
        <div class="form-header">
          {#if editMode}
            <h2>✏️ Edit Pengajuan Lembur</h2>
            <p>Perbarui data pengajuan lembur Anda</p>
            <div class="edit-notice">
              <i class="fas fa-info-circle"></i>
              Anda sedang mengedit pengajuan yang masih pending
            </div>
          {:else}
            <h2>⏰ Pengajuan Lembur</h2>
            <!-- <p>Ajukan lembur setelah kegiatan lembur selesai dilakukan</p> -->
            <!-- <div class="info-notice">
            <i class="fas fa-info-circle"></i>
            <div>
              <strong>Informasi:</strong><br />
              • Durasi lembur dihitung otomatis berdasarkan jam masuk dan keluar<br
              />
              • Foto bersifat opsional jika pengajuan dilakukan sebelum hari-H<br
              />
              • Sesuaikan catatan jika ada perbedaan antara pengajuan dan realisasi
            </div>
          </div> -->
          {/if}
        </div>

        {#if hasSetupIssue}
          <div class="setup-warning">
            <div class="setup-warning-header">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>Setup Diperlukan</strong>
            </div>
            <p>
              Collection "lembur" belum dikonfigurasi di Directus. Form masih
              bisa digunakan untuk testing, namun data mungkin tidak tersimpan.
            </p>
            <small
              >📖 Lihat file <code>DIRECTUS_LEMBUR_SETUP.md</code> untuk panduan
              setup lengkap</small
            >
          </div>
        {/if}

        {#if isLegacyMode}
          <div class="legacy-warning">
            <div class="legacy-warning-header">
              <i class="fas fa-info-circle"></i>
              <strong>Mode Kompatibilitas</strong>
            </div>
            <p>
              Beberapa field baru belum tersedia di database. Form berjalan
              dalam mode kompatibilitas. Fitur jam masuk/keluar dan upload foto
              tidak akan disimpan.
            </p>
            <small
              >🔧 Lakukan migrasi database sesuai <code
                >LEMBUR_FIELD_MIGRATION.md</code
              > untuk menggunakan semua fitur</small
            >
          </div>
        {/if}

        <form on:submit|preventDefault={handleSubmit} class="lembur-form">
          <!-- Tanggal Lembur -->
          <div class="form-group">
            <label for="tanggal-lembur" class="form-label">
              <i class="fas fa-calendar-alt"></i>
              Tanggal Lembur *
            </label>
            <input
              type="date"
              id="tanggal-lembur"
              bind:value={formDataLembur.tanggal}
              class="form-input"
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <!-- Jam Masuk dan Keluar -->
          <div class="form-group">
            <fieldset>
              <legend class="form-label">
                <i class="fas fa-clock"></i>
                Waktu Lembur *
                {#if isLegacyMode}
                  <span class="legacy-label">(Mode Kompatibilitas)</span>
                {/if}
              </legend>
              <div class="time-range-row">
                <div class="time-input-group">
                  <label for="jam-masuk" class="time-label">Jam Masuk</label>
                  <input
                    type="time"
                    id="jam-masuk"
                    bind:value={formDataLembur.jam_masuk}
                    class="form-input time-input"
                    required
                  />
                </div>
                <!-- <div class="time-separator">sampai</div> -->
                <div class="time-input-group">
                  <label for="jam-keluar" class="time-label">Jam Keluar</label>
                  <input
                    type="time"
                    id="jam-keluar"
                    bind:value={formDataLembur.jam_keluar}
                    class="form-input time-input"
                    required
                  />
                </div>
              </div>
            </fieldset>
            {#if durasiOtomatis}
              <div class="durasi-display">
                <i class="fas fa-stopwatch"></i>
                <span>Durasi: <strong>{durasiOtomatis}</strong></span>
                {#if isLegacyMode}
                  <span class="legacy-note">(Hanya untuk tampilan)</span>
                {/if}
              </div>
            {/if}
            <small class="form-hint">
              Masukkan jam mulai dan selesai lembur.
              {#if isLegacyMode}
                <strong
                  >Mode kompatibilitas: durasi dihitung untuk tampilan saja.</strong
                >
              {:else}
                Durasi akan dihitung otomatis.
              {/if}
            </small>
          </div>

          <!-- Status Pengajuan -->
          <!-- {#if formDataLembur.tanggal}
          <div class="form-group">
            <div
              class="pengajuan-status {isPengajuanSebelumH
                ? 'sebelum-h'
                : 'setelah-h'}"
            >
              <i
                class="fas {isPengajuanSebelumH
                  ? 'fa-calendar-plus'
                  : 'fa-calendar-check'}"
              ></i>
              <div class="status-info">
                {#if isPengajuanSebelumH}
                  <strong>Pengajuan Sebelum Hari-H</strong>
                  <p>Lampiran foto bersifat opsional</p>
                {:else}
                  <strong>Pengajuan Setelah Kegiatan</strong>
                  <p>Pengajuan dilakukan setelah lembur selesai</p>
                {/if}
              </div>
            </div>
          </div>
        {/if} -->

          <!-- Deskripsi -->
          <div class="form-group">
            <label for="deskripsi-lembur" class="form-label">
              <i class="fas fa-comment"></i>
              Deskripsi Pekerjaan *
            </label>
            <textarea
              id="deskripsi-lembur"
              bind:value={formDataLembur.deskripsi}
              class="form-textarea"
              placeholder="Jelaskan pekerjaan yang dilakukan saat lembur..."
              rows="4"
              required
            ></textarea>
            <small class="form-hint">Minimal 10 karakter</small>
          </div>

          <!-- Catatan Penyesuaian -->
          <!-- <div class="form-group">
          <label for="catatan-penyesuaian" class="form-label">
            <i class="fas fa-edit"></i>
            Catatan Penyesuaian
            <span class="optional-label">(Opsional)</span>
          </label>
          <textarea
            id="catatan-penyesuaian"
            bind:value={formDataLembur.catatan_penyesuaian}
            class="form-textarea"
            placeholder="Tambahkan catatan jika ada perbedaan antara data pengajuan dan realisasi di lapangan..."
            rows="3"
          ></textarea>
          <small class="form-hint">
            Sesuaikan informasi jika terdapat perbedaan antara data pengajuan
            dan realisasi
          </small>
        </div> -->

          <!-- Upload Foto Opsional -->
          <div class="form-group">
            <label for="foto-lembur" class="form-label">
              <i class="fas fa-camera"></i>
              Lampiran Foto
              {#if isPengajuanSebelumH}
                <span class="optional-label">(Wajib)</span>
              {:else}
                <span class="recommended-label">(Wajib)</span>
              {/if}
            </label>

            <!-- File Input -->
            <div class="file-upload-container">
              <input
                type="file"
                id="foto-lembur"
                bind:this={fileInput}
                on:change={handleFileChange}
                accept="image/*"
                class="file-input"
              />
              <label for="foto-lembur" class="file-upload-btn">
                <i class="fas fa-cloud-upload-alt"></i>
                {#if fotoFile}
                  <span>File Terpilih: {fotoFile.name}</span>
                {:else}
                  <span>Pilih Foto</span>
                {/if}
              </label>

              {#if fotoFile}
                <button
                  type="button"
                  class="remove-file-btn"
                  on:click={removeFile}
                  aria-label="Hapus file"
                >
                  <i class="fas fa-times"></i>
                </button>
              {/if}
            </div>

            {#if fotoFile && previewUrl}
              <div class="file-preview">
                <div class="file-info">
                  <i class="fas fa-image"></i>
                  <div class="file-details">
                    <span class="file-name">{fotoFile.name}</span>
                    <span class="file-size"
                      >{Math.round(fotoFile.size / 1024)} KB</span
                    >
                  </div>
                </div>
                <div class="image-preview">
                  <button
                    type="button"
                    class="image-preview-button"
                    on:click={() => previewUrl && openImageModal(previewUrl)}
                    aria-label="Klik untuk melihat foto dalam ukuran penuh"
                  >
                    <img
                      src={previewUrl}
                      alt="Preview foto"
                      class="preview-image"
                      on:error={handleImageError}
                    />
                  </button>
                </div>
              </div>
            {:else if existingFotoUrl && editMode}
              <div class="file-preview existing-file">
                <div class="file-info">
                  <i class="fas fa-image"></i>
                  <div class="file-details">
                    <span class="file-name"
                      >Foto existing: {existingFotoUrl.split("/").pop() ||
                        "foto-lembur.jpg"}</span
                    >
                    <span class="file-status"
                      >Foto yang sudah diupload sebelumnya</span
                    >
                  </div>
                </div>
                <div class="image-preview">
                  <button
                    type="button"
                    class="image-preview-button"
                    on:click={() =>
                      existingFotoUrl &&
                      openImageModal(getDirectusFileUrl(existingFotoUrl))}
                    aria-label="Klik untuk melihat foto dalam ukuran penuh"
                  >
                    <img
                      src={getDirectusFileUrl(existingFotoUrl)}
                      alt="Foto existing"
                      class="preview-image existing"
                      on:error={handleImageError}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  class="remove-file-btn"
                  on:click={removeExistingFile}
                  aria-label="Hapus foto existing"
                  title="Hapus foto existing"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            {/if}

            <small class="form-hint">
              {#if isPengajuanSebelumH}
                Untuk pengajuan sebelum hari-H, foto bersifat opsional
              {:else}
                Direkomendasikan melampirkan foto sebagai bukti kegiatan lembur
              {/if}
              • Format: JPG, PNG, WebP • Maksimal: 5MB
            </small>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            {#if editMode}
              <button
                type="button"
                class="cancel-btn"
                on:click={cancelEdit}
                disabled={isSubmitting}
              >
                <i class="fas fa-times"></i>
                Batal
              </button>
              <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {#if isSubmitting}
                  <i class="fas fa-spinner fa-spin"></i>
                  Memperbarui...
                {:else}
                  <i class="fas fa-save"></i>
                  Perbarui Pengajuan
                {/if}
              </button>
            {:else}
              <button type="submit" class="submit-btn" disabled={isSubmitting}>
                {#if isSubmitting}
                  <i class="fas fa-spinner fa-spin"></i>
                  Mengirim...
                {:else}
                  <i class="fas fa-paper-plane"></i>
                  Kirim Pengajuan
                {/if}
              </button>
            {/if}
          </div>
        </form>
      </div>

      <!-- Riwayat Pengajuan Lembur -->
      <div class="history-container">
        <div class="history-header">
          <h3>📋 Riwayat Pengajuan Lembur</h3>
          <button
            class="refresh-btn"
            on:click={loadLemburHistory}
            disabled={isLoadingHistory}
            aria-label="Muat ulang riwayat"
          >
            <i class="fas fa-sync-alt {isLoadingHistory ? 'fa-spin' : ''}"></i>
          </button>
        </div>

        {#if isLoadingHistory}
          <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Memuat riwayat lembur...</p>
          </div>
        {:else if historyError}
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h4>Tidak Dapat Memuat Riwayat</h4>
            <p>{historyError}</p>
            {#if historyError.includes("Collection") || historyError.includes("Akses ditolak")}
              <div class="setup-info">
                <h5>📋 Langkah Setup yang Diperlukan:</h5>
                <ul>
                  <li>Buat collection "lembur" di Directus</li>
                  <li>Atur permissions untuk Public role</li>
                  <li>Ikuti panduan di DIRECTUS_LEMBUR_SETUP.md</li>
                </ul>
                <small
                  >💡 Fitur pengajuan lembur tetap bisa digunakan meskipun
                  riwayat belum tersedia</small
                >
              </div>
            {/if}
            <button class="retry-btn" on:click={loadLemburHistory}>
              <i class="fas fa-redo"></i>
              Coba Lagi
            </button>
          </div>
        {:else if lemburHistory.length === 0}
          <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>Belum ada pengajuan lembur</p>
            <small>Pengajuan yang Anda buat akan muncul di sini</small>
          </div>
        {:else}
          <div class="history-list">
            {#each lemburHistory as lembur}
              <div
                class="history-item {editMode && editingItemId === lembur.id
                  ? 'editing'
                  : ''}"
              >
                {#if editMode && editingItemId === lembur.id}
                  <div class="editing-banner">
                    <i class="fas fa-edit"></i>
                    Sedang Diedit
                  </div>
                {/if}
                <div class="history-header-row">
                  <div class="history-date">
                    <i class="fas fa-calendar"></i>
                    {formatDate(lembur.tanggal)}
                  </div>
                  <div
                    class="history-status"
                    style="color: {getStatusColor(lembur.status)}"
                  >
                    <i class={getStatusIcon(lembur.status)}></i>
                    {getStatusText(lembur.status)}
                  </div>
                </div>

                <div class="history-details">
                  <div class="detail-row">
                    <span class="detail-label">Waktu:</span>
                    <span class="detail-value">
                      <strong
                        >{lembur.jam_masuk || "--:--"} - {lembur.jam_keluar ||
                          "--:--"}</strong
                      >
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Durasi:</span>
                    <span class="detail-value">
                      <strong
                        >{formatDurasiLembur(
                          lembur.durasi_jam,
                          lembur.durasi_menit
                        )}</strong
                      >
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Deskripsi:</span>
                    <span class="detail-value">{lembur.deskripsi}</span>
                  </div>
                  {#if lembur.catatan_penyesuaian}
                    <div class="detail-row">
                      <span class="detail-label">Catatan Penyesuaian:</span>
                      <span class="detail-value note-adjustment"
                        >{lembur.catatan_penyesuaian}</span
                      >
                    </div>
                  {/if}
                  {#if lembur.lampiran_foto_opsional}
                    <div class="detail-row">
                      <span class="detail-label">Lampiran Foto:</span>
                      <span class="detail-value foto-attachment">
                        <i class="fas fa-image"></i>
                        {lembur.lampiran_foto_opsional}
                      </span>
                    </div>
                  {/if}
                  {#if lembur.rejection_reason}
                    <div class="detail-row">
                      <span class="detail-label">Alasan Ditolak:</span>
                      <span class="detail-value rejection-reason"
                        >{lembur.rejection_reason}</span
                      >
                    </div>
                  {/if}
                  <div class="detail-row">
                    <span class="detail-label">Diajukan:</span>
                    <span class="detail-value">
                      {lembur.date_created
                        ? new Date(lembur.date_created).toLocaleDateString(
                            "id-ID"
                          )
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <!-- Approval Timeline -->
                <div class="approval-timeline">
                  <div class="approval-header">
                    <h4>📋 Status Persetujuan</h4>
                    {#if lembur.overall_status}
                      <div
                        class="overall-status-badge {lembur.overall_status}"
                        style="background-color: {getStatusColor(
                          lembur.overall_status
                        )}"
                      >
                        <i class={getStatusIcon(lembur.overall_status)}></i>
                        {getStatusText(lembur.overall_status)}
                      </div>
                    {/if}
                  </div>

                  {#if lembur.approval_stage || lembur.hrd_admin_approved_by || lembur.manager_hrd_approved_by || lembur.direktur_approved_by || lembur.manager_divisi_approved_by}
                    <div class="approval-stages">
                      {#each getApprovalStages(lembur) as stage, index}
                        <div
                          class="approval-stage {stage.completed
                            ? 'completed'
                            : 'pending'} {stage.approved === false
                            ? 'rejected'
                            : ''}"
                        >
                          <div class="stage-indicator">
                            <div
                              class="stage-icon"
                              style="color: {getApprovalStatusColor(
                                stage.completed,
                                stage.approved
                              )}"
                            >
                              <i
                                class={getApprovalStatusIcon(
                                  stage.completed,
                                  stage.approved
                                )}
                              ></i>
                            </div>
                            {#if index < getApprovalStages(lembur).length - 1}
                              <div
                                class="stage-connector {stage.completed &&
                                stage.approved !== false
                                  ? 'active'
                                  : ''}"
                              ></div>
                            {/if}
                          </div>

                          <div class="stage-content">
                            <div class="stage-title">{stage.title}</div>

                            {#if stage.completed}
                              <div class="stage-details">
                                <div class="stage-info">
                                  {#if stage.approved === true}
                                    <span class="approval-status approved">
                                      <i class="fas fa-check"></i>
                                      Disetujui
                                    </span>
                                  {:else if stage.approved === false}
                                    <span class="approval-status rejected">
                                      <i class="fas fa-times"></i>
                                      Ditolak
                                    </span>
                                  {:else}
                                    <span class="approval-status processed">
                                      <i class="fas fa-eye"></i>
                                      Diproses
                                    </span>
                                  {/if}
                                </div>

                                {#if stage.approver}
                                  <div class="approver-info">
                                    <i class="fas fa-user"></i>
                                    <span>{stage.approver}</span>
                                  </div>
                                {/if}

                                {#if stage.date}
                                  <div class="approval-date">
                                    <i class="fas fa-calendar"></i>
                                    <span>{formatApprovalDate(stage.date)}</span
                                    >
                                  </div>
                                {/if}

                                {#if stage.rejectionReason}
                                  <div class="rejection-reason">
                                    <i class="fas fa-comment"></i>
                                    <span>{stage.rejectionReason}</span>
                                  </div>
                                {/if}
                              </div>
                            {:else}
                              <div class="stage-pending">
                                <i class="fas fa-clock"></i>
                                Menunggu persetujuan
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>

                    <!-- Final Approval Information -->
                    {#if lembur.final_approved_by && lembur.final_approved_date}
                      <div class="final-approval">
                        <div class="final-approval-header">
                          <i class="fas fa-medal"></i>
                          <strong>Persetujuan Final</strong>
                        </div>
                        <div class="final-approval-details">
                          <div class="final-approver">
                            <i class="fas fa-user-check"></i>
                            <span
                              >Disetujui oleh: <strong
                                >{lembur.final_approved_by}</strong
                              ></span
                            >
                          </div>
                          <div class="final-date">
                            <i class="fas fa-calendar-check"></i>
                            <span
                              >{formatApprovalDate(
                                lembur.final_approved_date
                              )}</span
                            >
                          </div>
                        </div>
                      </div>
                    {:else if lembur.final_rejection_reason}
                      <div class="final-rejection">
                        <div class="final-rejection-header">
                          <i class="fas fa-ban"></i>
                          <strong>Pengajuan Ditolak</strong>
                        </div>
                        <div class="final-rejection-reason">
                          <i class="fas fa-comment"></i>
                          <span>{lembur.final_rejection_reason}</span>
                        </div>
                      </div>
                    {/if}
                  {:else}
                    <div class="no-approval-data">
                      <i class="fas fa-info-circle"></i>
                      <span>Belum ada data persetujuan tersedia</span>
                    </div>
                  {/if}
                </div>

                <!-- Action buttons for pending status -->
                {#if lembur.status === "pending"}
                  <div class="history-actions">
                    <button
                      class="edit-btn"
                      on:click={() => startEdit(lembur)}
                      disabled={editMode || isSubmitting}
                      title={editMode
                        ? "Sedang dalam mode edit"
                        : "Edit pengajuan"}
                    >
                      <i class="fas fa-edit"></i>
                      {editMode && editingItemId === lembur.id
                        ? "Sedang Diedit"
                        : "Edit"}
                    </button>
                  </div>
                {/if}

                <!-- Absensi section for all lembur (regardless of status) -->
                <!-- {#if lembur.status !== "pending" || !(editMode && editingItemId === lembur.id)}
                  <div class="absensi-actions">
                    <div class="absensi-header">
                      <h4>📸 Absensi Lembur</h4>
                      <p>Lakukan absensi masuk dan keluar untuk lembur ini</p>
                    </div>

                    {#if selectedLemburId === lembur.id}
                      
                      <div class="absensi-buttons-inline">
                        {#if canAbsensiMasukLembur}
                          <LemburAbsensiButton
                            type="masuk"
                            lemburId={lembur.id || ""}
                            lemburDescription={lembur.deskripsi || ""}
                            loading={isLoadingAbsensi}
                            on:success={handleLemburAbsensiSuccess}
                          />
                        {:else if canAbsensiKeluarLembur}
                          <LemburAbsensiButton
                            type="keluar"
                            lemburId={lembur.id || ""}
                            lemburDescription={lembur.deskripsi || ""}
                            loading={isLoadingAbsensi}
                            on:success={handleLemburAbsensiSuccess}
                          />
                        {:else if currentAbsensiLembur && currentAbsensiLembur.is_completed}
                          <div class="absensi-completed-inline">
                            <div class="completed-icon">✅</div>
                            <span>Absensi Selesai</span>
                          </div>
                        {:else}
                          <div class="absensi-loading">
                            <div class="loading-spinner"></div>
                            <span>Memuat data absensi...</span>
                          </div>
                        {/if}
                      </div>

                      <button
                        class="select-lembur-btn active"
                        on:click={() => (selectedLemburId = null)}
                      >
                        <i class="fas fa-times"></i>
                        Tutup Absensi
                      </button>
                    {:else}
                      
                      <button
                        class="select-lembur-btn"
                        on:click={() => handleLemburSelection(lembur)}
                      >
                        <i class="fas fa-camera"></i>
                        Pilih untuk Absensi
                      </button>
                    {/if}
                  </div>
                {/if} -->

                <!-- Status info for rejected lembur -->
                {#if lembur.status === "rejected"}
                  <div class="status-info">
                    <small class="text-muted"> Pengajuan ditolak </small>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if currentTab === "absensi-mandiri"}
      <!-- Absensi Lembur Mandiri -->
      <LemburAbsensiMandiri />
    {/if}
  </main>

  <!-- Modal Preview Foto -->
  {#if showImageModal && modalImageUrl}
    <div
      class="image-modal-overlay"
      on:click={closeImageModal}
      on:keydown={(e) => e.key === "Escape" && closeImageModal()}
      role="dialog"
      aria-modal="true"
      aria-label="Preview foto"
      tabindex="-1"
    >
      <div
        class="image-modal-content"
        role="img"
        aria-label="Foto dalam ukuran penuh"
      >
        <button
          class="modal-close-btn"
          on:click={closeImageModal}
          aria-label="Tutup preview"
        >
          <i class="fas fa-times"></i>
        </button>
        <img
          src={modalImageUrl}
          alt="Preview foto dalam ukuran penuh"
          class="modal-image"
          on:error={handleImageError}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  /* ===== DISABLE ALL ANIMATIONS & TRANSITIONS ===== */
  * {
    animation: none !important;
    transition: none !important;
  }

  button:hover,
  .btn:hover,
  .card:hover,
  input:hover {
    transform: none !important;
    transition: none !important;
  }
  /* ================================================= */

  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap");

  :global(body) {
    margin: 0;
    padding: 0;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    background: linear-gradient(
      135deg,
      #0a0f1c 0%,
      #1a1f2e 25%,
      #2d1b69 50%,
      #11172b 75%,
      #0a0f1c 100%
    );
    background-size: 100% 100%;
    /* Animation disabled for better performance */
    color: #f1f5f9;
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  /* @keyframes gradientMove {
    0%,
    100% {
      background-position: 0% 50%;
    }
    25% {
      background-position: 100% 0%;
    }
    50% {
      background-position: 100% 100%;
    }
    75% {
      background-position: 0% 100%;
    }
  } */

  /* :global(body::before) {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
        circle at 20% 30%,
        rgba(59, 130, 246, 0.12) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 70%,
        rgba(168, 85, 247, 0.12) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 40% 80%,
        rgba(16, 185, 129, 0.08) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 60% 20%,
        rgba(245, 101, 101, 0.08) 0%,
        transparent 50%
      );
    animation: cosmicDrift 35s ease-in-out infinite;
    z-index: -2;
    pointer-events: none;
  } */

  @keyframes cosmicDrift {
    0%,
    100% {
      transform: translate(0, 0) rotate(0deg) scale(1);
      opacity: 0.8;
    }
    25% {
      transform: translate(80px, -60px) rotate(90deg) scale(1.1);
      opacity: 0.6;
    }
    50% {
      transform: translate(-40px, 100px) rotate(180deg) scale(0.9);
      opacity: 1;
    }
    75% {
      transform: translate(-100px, -40px) rotate(270deg) scale(1.05);
      opacity: 0.7;
    }
  }

  .page-container {
    max-width: 900px;
    margin: 0 auto;
    background: transparent;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  @media (max-width: 1024px) {
    .page-container {
      max-width: 100%;
    }
  }

  @media (max-width: 640px) {
    .page-container {
      min-height: 100vh;
    }
  }

  /* Header - Responsive */
  .header {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    padding: 20px 24px;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .header {
      padding: 16px 20px;
      gap: 16px;
    }
  }

  .header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(6, 182, 212, 0.1) 0%,
      rgba(8, 145, 178, 0.05) 50%,
      rgba(14, 116, 144, 0.1) 100%
    );
    z-index: -1;
  }

  .back-btn {
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    border: none;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 20px;
    box-shadow:
      0 8px 32px rgba(6, 182, 212, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
  }

  .back-btn,
  .spacer {
    width: 44px;
    height: 44px;
  }

  .back-btn {
    font-size: 18px;
  }

  .back-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.6s;
  }

  .back-btn:hover::before {
    left: 100%;
  }

  .back-btn:hover {
    background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(6, 182, 212, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    flex: 1;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  @media (max-width: 640px) {
    .header h1 {
      font-size: 20px;
    }
  }

  .spacer {
    width: 52px;
  }

  /* Main Content - Responsive */
  .main-content {
    padding: 20px;
  }

  /* Tab Navigation */
  .tab-navigation {
    display: flex;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 8px;
    margin-bottom: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: #64748b;
    font-weight: 500;
    font-size: 0.9rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .tab-btn:hover {
    color: #1e293b;
    background: rgba(59, 130, 246, 0.1);
  }

  .tab-btn.active {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    font-weight: 600;
    box-shadow:
      0 4px 12px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .tab-btn.active::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.6s;
  }

  .tab-btn.active:hover::before {
    left: 100%;
  }

  .tab-btn i {
    font-size: 1rem;
  }

  @media (max-width: 640px) {
    .tab-navigation {
      margin-bottom: 16px;
      padding: 6px;
    }

    .tab-btn {
      padding: 10px 12px;
      font-size: 0.85rem;
      gap: 6px;
    }

    .tab-btn i {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 640px) {
    .main-content {
      padding: 16px;
    }
  }

  .form-container {
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 24px;
    padding: 32px;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(148, 163, 184, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .form-container {
      padding: 24px 20px;
      border-radius: 20px;
    }
  }

  .form-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(6, 182, 212, 0.5),
      transparent
    );
  }

  .form-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .form-header h2 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .form-header p {
    margin: 0;
    color: #94a3b8;
    font-size: 16px;
  }

  /* Absensi Section */
  .absensi-section {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    backdrop-filter: blur(20px);
  }

  .absensi-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .absensi-header h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .absensi-header p {
    margin: 0;
    color: #94a3b8;
    font-size: 14px;
  }

  .absensi-buttons {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .absensi-completed {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }

  .completed-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .absensi-completed h4 {
    margin: 0 0 8px 0;
    color: #22c55e;
    font-size: 18px;
    font-weight: 600;
  }

  .absensi-completed p {
    margin: 0 0 16px 0;
    color: #94a3b8;
    font-size: 14px;
  }

  .completed-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* Absensi Actions in History Items */
  .absensi-actions {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    padding: 16px;
    margin-top: 16px;
  }

  .absensi-actions .absensi-header {
    text-align: left;
    margin-bottom: 16px;
  }

  .absensi-actions .absensi-header h4 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .absensi-actions .absensi-header p {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
  }

  .absensi-buttons-inline {
    margin-bottom: 12px;
  }

  .absensi-completed-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    color: #22c55e;
    font-weight: 500;
  }

  .absensi-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    color: #3b82f6;
  }

  .select-lembur-btn {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    justify-content: center;
  }

  .select-lembur-btn:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .select-lembur-btn.active {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .select-lembur-btn.active:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .reset-btn {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-btn:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.5);
  }

  @media (max-width: 640px) {
    .absensi-section {
      padding: 16px;
    }

    .completed-actions {
      flex-direction: column;
    }

    .reset-btn {
      width: 100%;
    }
  }

  /* Setup Warning - Responsive */
  .setup-warning {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.2),
      rgba(245, 158, 11, 0.1)
    );
    backdrop-filter: blur(12px);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow:
      0 8px 32px rgba(245, 158, 11, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 640px) {
    .setup-warning {
      padding: 16px;
      margin-bottom: 20px;
      border-radius: 12px;
    }
  }

  .setup-warning-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .setup-warning-header i {
    color: #fbbf24;
    font-size: 18px;
  }

  .setup-warning-header strong {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 16px;
    font-weight: 700;
  }

  .setup-warning p {
    margin: 0 0 12px 0;
    color: #fde68a;
    font-size: 14px;
    line-height: 1.6;
  }

  .setup-warning small {
    color: #fed7aa;
    font-size: 13px;
  }

  .setup-warning code {
    background: rgba(146, 64, 14, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: "Courier New", monospace;
    font-size: 12px;
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  /* Legacy Warning - Responsive */
  .legacy-warning {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(99, 102, 241, 0.1) 100%
    );
    backdrop-filter: blur(12px);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 640px) {
    .legacy-warning {
      padding: 16px;
      margin-bottom: 20px;
      border-radius: 12px;
    }
  }

  .legacy-warning-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .legacy-warning-header i {
    color: #60a5fa;
    font-size: 18px;
  }

  .legacy-warning-header strong {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 16px;
    font-weight: 700;
  }

  .legacy-warning p {
    margin: 0 0 12px 0;
    color: #bfdbfe;
    font-size: 14px;
    line-height: 1.6;
  }

  .legacy-warning small {
    color: #93c5fd;
    font-size: 13px;
  }

  .legacy-warning code {
    background: rgba(37, 99, 235, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: "Courier New", monospace;
    font-size: 12px;
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  /* Form Styles */
  .lembur-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }

  @media (max-width: 640px) {
    .form-group {
      margin-bottom: 20px;
      gap: 8px;
    }
  }

  .form-group fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  .form-group legend {
    padding: 0;
    margin-bottom: 12px;
  }

  .form-label {
    font-size: 14px;
    font-weight: 600;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .form-label i {
    color: #06b6d4;
    width: 18px;
    font-size: 16px;
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: 16px 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    font-size: 16px; /* Prevents zoom on iOS */
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .form-input,
    .form-select {
      padding: 14px 16px;
      font-size: 16px;
    }
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(6, 182, 212, 0.1),
      0 0 24px rgba(6, 182, 212, 0.2);
    transform: translateY(-1px);
  }

  .form-input::placeholder {
    color: #64748b;
  }

  .form-textarea {
    padding: 16px 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    color: #f1f5f9;
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .form-textarea:focus {
    outline: none;
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(6, 182, 212, 0.1),
      0 0 24px rgba(6, 182, 212, 0.2);
    transform: translateY(-1px);
  }

  .form-textarea::placeholder {
    color: #64748b;
  }

  .form-hint {
    font-size: 13px;
    color: #94a3b8;
    font-style: italic;
  }

  /* Time Duration Styling - Responsive */
  .time-range-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: flex-end;
    gap: 12px;
    margin-top: 12px;
  }

  @media (max-width: 640px) {
    .time-range-row {
      grid-template-columns: 1fr;
      gap: 16px;
      text-align: center;
    }

    .time-separator {
      order: 2;
      margin: 8px 0;
    }

    .time-input-group:last-child {
      order: 3;
    }
  }

  .time-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .time-label {
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .time-input {
    padding: 16px 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    width: 100%;
  }

  .time-input:focus {
    outline: none;
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(6, 182, 212, 0.1),
      0 0 24px rgba(6, 182, 212, 0.2);
    transform: translateY(-1px);
  }

  .time-separator {
    font-size: 14px;
    font-weight: 600;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
    text-align: center;
    align-self: center;
  }

  .durasi-display {
    margin-top: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #bae6fd;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0369a1;
    font-size: 14px;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .durasi-display {
      padding: 10px 14px;
      font-size: 13px;
      text-align: center;
      justify-content: center;
    }
  }

  .durasi-display i {
    color: #0284c7;
  }

  .pengajuan-status {
    padding: 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 2px solid;
    margin-top: 8px;
  }

  @media (max-width: 640px) {
    .pengajuan-status {
      padding: 14px;
      gap: 10px;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }
  }

  .pengajuan-status.sebelum-h {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-color: #f59e0b;
    color: #92400e;
  }

  .pengajuan-status.setelah-h {
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border-color: #10b981;
    color: #065f46;
  }

  .pengajuan-status i {
    font-size: 20px;
    color: inherit;
  }

  .status-info strong {
    display: block;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .status-info p {
    margin: 0;
    font-size: 12px;
    opacity: 0.8;
  }

  .optional-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 400;
    margin-left: 4px;
  }

  .recommended-label {
    font-size: 12px;
    color: #10b981;
    font-weight: 500;
    margin-left: 4px;
  }

  .legacy-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 400;
    margin-left: 4px;
    opacity: 0.8;
  }

  .legacy-note {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
    margin-left: 8px;
  }

  /* File Upload Styles - Responsive */
  .file-upload-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 640px) {
    .file-upload-container {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  .file-upload-btn {
    flex: 1;
    padding: 16px 20px;
    border: 2px dashed rgba(148, 163, 184, 0.3);
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.4);
    backdrop-filter: blur(12px);
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 16px;
    font-weight: 500;
    min-height: 60px;
    text-align: center;
  }

  @media (max-width: 640px) {
    .file-upload-btn {
      padding: 14px 16px;
      min-height: 56px;
      font-size: 15px;
    }
  }

  .file-upload-btn:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background: rgba(6, 182, 212, 0.1);
    color: #06b6d4;
    transform: translateY(-1px);
  }

  .file-upload-btn i {
    font-size: 20px;
    color: inherit;
  }

  .remove-file-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 14px;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .remove-file-btn {
      width: 100%;
      height: 44px;
      border-radius: 12px;
    }
  }

  .remove-file-btn:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  .file-preview {
    margin-top: 12px;
    padding: 12px 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    position: relative;
  }

  .file-preview.existing-file {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .file-preview.existing-file .file-info i {
    color: #3b82f6;
  }

  .file-preview .remove-file-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(239, 68, 68, 0.8);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .file-preview .remove-file-btn:hover {
    background: rgba(239, 68, 68, 1);
    transform: scale(1.1);
  }

  .image-preview {
    margin-top: 12px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .image-preview-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
    width: 100%;
  }

  .preview-image {
    width: 100%;
    max-width: 300px;
    height: auto;
    max-height: 200px;
    object-fit: cover;
    display: block;
    border-radius: 8px;
    transition: transform 0.2s ease;
  }

  .image-preview-button:hover .preview-image {
    transform: scale(1.02);
  }

  .preview-image.existing {
    border: 2px solid rgba(59, 130, 246, 0.3);
  }

  /* Image Modal Styles */
  .image-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease-out;
  }

  .image-modal-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-image {
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: scaleIn 0.3s ease-out;
  }

  .modal-close-btn {
    position: absolute;
    top: -40px;
    right: 0;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }

  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .file-info i {
    color: #06b6d4;
    font-size: 18px;
  }

  .file-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-name {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .file-size {
    font-size: 12px;
    color: #94a3b8;
  }

  .file-status {
    font-size: 12px;
    color: #3b82f6;
    font-style: italic;
  }

  .info-notice {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #bae6fd;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 12px;
    color: #0369a1;
    font-size: 14px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .info-notice {
      padding: 14px;
      font-size: 13px;
      gap: 10px;
    }
  }

  .info-notice i {
    color: #0284c7;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .time-duration-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 8px;
  }

  .time-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .time-label {
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .time-select {
    padding: 14px 16px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .time-select:focus {
    outline: none;
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(6, 182, 212, 0.1),
      0 0 24px rgba(6, 182, 212, 0.2);
    transform: translateY(-1px);
  }

  .time-separator {
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
    text-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
  }

  .submit-btn {
    width: 100%;
    padding: 18px 32px;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow:
      0 20px 25px -5px rgba(6, 182, 212, 0.4),
      0 10px 10px -5px rgba(59, 130, 246, 0.2);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .submit-btn {
      padding: 16px 24px;
      font-size: 15px;
      gap: 8px;
    }
  }

  .submit-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.5s;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow:
      0 25px 50px -12px rgba(6, 182, 212, 0.5),
      0 20px 25px -5px rgba(59, 130, 246, 0.3);
  }

  .submit-btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* Cancel and Edit Buttons */
  .cancel-btn {
    background: linear-gradient(135deg, #64748b 0%, #475569 100%);
    color: white;
    border: none;
    padding: 16px 24px;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .cancel-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(100, 116, 139, 0.1) 0%,
      rgba(71, 85, 105, 0.1) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .cancel-btn:hover:not(:disabled)::before {
    opacity: 1;
  }

  .cancel-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(100, 116, 139, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .edit-btn {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .edit-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.1) 0%,
      rgba(217, 119, 6, 0.1) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .edit-btn:hover:not(:disabled)::before {
    opacity: 1;
  }

  .edit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 8px 25px rgba(245, 158, 11, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .edit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* Form Actions Layout - Responsive */
  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column;
      gap: 12px;
    }
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 32px;
    background: linear-gradient(135deg, #64748b 0%, #475569 100%);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 16px rgba(100, 116, 139, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 640px) {
    .cancel-btn {
      width: 100%;
      padding: 14px 24px;
    }
  }

  .cancel-btn:hover {
    background: linear-gradient(135deg, #475569 0%, #334155 100%);
    transform: translateY(-2px);
    box-shadow:
      0 12px 24px rgba(100, 116, 139, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* History Actions - Responsive */
  .history-actions {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .history-actions {
      flex-direction: column;
      gap: 12px;
    }
  }

  /* Edit Notice */
  .edit-notice {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid rgba(14, 165, 233, 0.3);
    backdrop-filter: blur(10px);
  }

  .edit-notice i {
    font-size: 16px;
    opacity: 0.9;
  }

  /* History Section - Responsive */
  .history-container {
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 24px;
    padding: 32px;
    margin-top: 32px;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(148, 163, 184, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .history-container {
      padding: 24px 20px;
      margin-top: 24px;
      border-radius: 20px;
    }
  }

  .history-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(6, 182, 212, 0.5),
      transparent
    );
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .history-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .refresh-btn {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    width: 40px;
    height: 40px;
    border-radius: 12px;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
    color: #06b6d4;
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 16px rgba(6, 182, 212, 0.2);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-state,
  .empty-state,
  .error-state {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }

  .loading-state i,
  .empty-state i {
    font-size: 40px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: pulse 2s infinite;
  }

  .error-state i {
    font-size: 40px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .loading-state p,
  .empty-state p {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .error-state h4 {
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .error-state p {
    margin: 0 0 20px 0;
    font-size: 16px;
    color: #94a3b8;
  }

  .setup-info {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    padding: 20px;
    margin: 20px 0;
    text-align: left;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .setup-info h5 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .setup-info ul {
    margin: 0 0 16px 0;
    padding-left: 24px;
  }

  .setup-info li {
    font-size: 14px;
    color: #94a3b8;
    margin-bottom: 6px;
  }

  .setup-info small {
    font-size: 13px;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 600;
  }

  .retry-btn {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 16px rgba(6, 182, 212, 0.3);
  }

  .retry-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(6, 182, 212, 0.4);
  }

  .empty-state small {
    font-size: 16px;
    color: #94a3b8;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .history-item {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 20px;
    padding: 24px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .history-item {
      padding: 20px 16px;
      border-radius: 16px;
    }
  }

  .history-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(6, 182, 212, 0.3),
      transparent
    );
  }

  .history-item:hover {
    border-color: rgba(6, 182, 212, 0.4);
    transform: translateY(-2px);
    box-shadow:
      0 12px 24px rgba(6, 182, 212, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .history-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 12px;
  }

  @media (max-width: 640px) {
    .history-header-row {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
  }

  .history-date {
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .history-date i {
    color: #06b6d4;
    font-size: 18px;
  }

  .history-status {
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 12px;
    backdrop-filter: blur(8px);
  }

  .history-details {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detail-row {
    display: flex;
    gap: 12px;
    font-size: 15px;
    align-items: flex-start;
  }

  @media (max-width: 640px) {
    .detail-row {
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }
  }

  .detail-label {
    font-weight: 600;
    background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    min-width: 100px;
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .detail-label {
      min-width: auto;
      font-size: 13px;
      opacity: 0.8;
    }
  }

  .detail-value {
    color: #f1f5f9;
    flex: 1;
    font-weight: 500;
  }

  .rejection-reason {
    background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
    font-weight: 600;
  }

  .note-adjustment {
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
    font-weight: 600;
  }

  .foto-attachment {
    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .foto-attachment i {
    color: #8b5cf6;
  }

  /* Approval Timeline Styles */
  .approval-timeline {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 16px;
    padding: 20px;
    margin-top: 16px;
    backdrop-filter: blur(20px);
  }

  .approval-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .approval-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .overall-status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .approval-stages {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .approval-stage {
    display: flex;
    gap: 16px;
    position: relative;
  }

  .stage-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .stage-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(30, 41, 59, 0.8);
    border: 2px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    position: relative;
    z-index: 2;
  }

  .stage-connector {
    width: 2px;
    height: 40px;
    background: rgba(148, 163, 184, 0.3);
    margin-top: 8px;
    transition: background-color 0.3s ease;
  }

  .stage-connector.active {
    background: linear-gradient(to bottom, #10b981, #059669);
  }

  .stage-content {
    flex: 1;
    padding-top: 4px;
  }

  .stage-title {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 8px;
  }

  .stage-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stage-info {
    display: flex;
    align-items: center;
  }

  .approval-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .approval-status.approved {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .approval-status.rejected {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .approval-status.processed {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .approver-info,
  .approval-date {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #94a3b8;
  }

  .approver-info i,
  .approval-date i {
    width: 14px;
    text-align: center;
    color: #64748b;
  }

  .rejection-reason {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    padding: 8px 12px;
    border-radius: 8px;
    border-left: 3px solid #ef4444;
    margin-top: 4px;
  }

  .rejection-reason i {
    color: #ef4444;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .stage-pending {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #fbbf24;
    font-style: italic;
  }

  .final-approval {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-top: 16px;
  }

  .final-approval-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #10b981;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .final-approval-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .final-approver,
  .final-date {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
  }

  .final-approver i,
  .final-date i {
    color: #10b981;
    width: 16px;
  }

  .final-rejection {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-top: 16px;
  }

  .final-rejection-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ef4444;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .final-rejection-reason {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #fca5a5;
  }

  .final-rejection-reason i {
    color: #ef4444;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .no-approval-data {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: #64748b;
    font-size: 14px;
    font-style: italic;
    text-align: center;
  }

  .no-approval-data i {
    color: #94a3b8;
  }

  /* Responsive for approval timeline */
  @media (max-width: 640px) {
    .approval-timeline {
      padding: 16px;
    }

    .approval-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .approval-stage {
      gap: 12px;
    }

    .stage-icon {
      width: 32px;
      height: 32px;
      font-size: 14px;
    }

    .stage-connector {
      height: 32px;
      margin-top: 6px;
    }

    .stage-title {
      font-size: 13px;
    }

    .final-approval,
    .final-rejection {
      padding: 12px;
    }

    .final-approval-details {
      gap: 6px;
    }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .main-content {
      padding: 20px;
    }

    .form-container,
    .history-container {
      padding: 24px;
      border-radius: 20px;
    }

    .header {
      padding: 16px 20px;
    }

    .header h1 {
      font-size: 20px;
    }

    .history-header h3 {
      font-size: 18px;
    }

    .history-item {
      padding: 20px;
      border-radius: 16px;
    }

    .history-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .detail-row {
      flex-direction: column;
      gap: 4px;
    }

    .detail-label {
      min-width: auto;
    }

    .time-range-row {
      flex-direction: column;
      gap: 12px;
    }

    .time-separator {
      display: none;
    }

    .pengajuan-status {
      flex-direction: column;
      text-align: center;
      gap: 8px;
    }

    .pengajuan-status i {
      font-size: 24px;
    }

    .info-notice {
      flex-direction: column;
      text-align: center;
      gap: 8px;
    }

    .file-upload-container {
      flex-direction: column;
      align-items: stretch;
    }

    .file-upload-btn {
      min-height: 80px;
      flex-direction: column;
      gap: 8px;
    }

    .remove-file-btn {
      align-self: center;
      margin-top: 8px;
    }
  }

  /* Animations */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: 200px 0;
    }
  }

  .history-item.editing {
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .editing-banner {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 1;
  }

  .editing-banner i {
    animation: pulse 2s infinite;
  }
</style>
