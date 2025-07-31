<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { user } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import { goto } from "$app/navigation";
  import {
    submitIzinHari,
    getIzinHariHistory,
    updateIzinHari,
    getIzinApprovalStages,
    getCurrentIzinApprovalStatus,
    formatIzinApprovalDate,
    getIzinApprovalStatusIcon,
    getIzinApprovalStatusColor,
    type IzinHari,
    type IzinApprovalStageInfo,
  } from "$lib/izin";
  import type { Akun } from "$lib/directus";
  import { directus } from "$lib/directus";
  import { readItems } from "@directus/sdk";

  let currentUser: Akun | null = null;

  // Edit mode variables
  let editMode = false;
  let editingItemId: string | null = null;
  let originalFormData: any = null;

  // Riwayat pengajuan izin hari
  let izinHariHistory: IzinHari[] = [];
  let isLoadingHistory = false;
  let historyError: string | null = null;

  // Kategori izin
  let kategoriIzinList: any[] = [];
  let isLoadingKategori = false;

  // Cuti Tahunan
  let cutiTahunanRemaining = 12;
  let cutiTahunanUsed = 0;
  let isLoadingCutiData = false;
  let selectedKategoriNama = "";
  let isCutiTahunan = false;

  // Form data untuk Izin Hari
  let formDataHari = {
    kategori: "" as string | number,
    tanggalMulai: "",
    tanggalSelesai: "",
    totalHari: 0,
    keterangan: "",
    lampiran: null as File | null,
  };

  let isSubmitting = false;
  let hasSetupIssue = false;
  let filePreviewUrl: string | null = null;
  let filePreviewType: "image" | "pdf" | "existing" | null = null;
  let existingFileName: string | null = null;

  onMount(() => {
    const unsubscribe = user.subscribe(($user) => {
      // Clear data when user changes
      if (currentUser?.id !== $user?.id) {
        izinHariHistory = [];
        isLoadingHistory = false;
        historyError = null;
        hasSetupIssue = false;
        resetForm();
      }

      currentUser = $user;
      if (!$user) {
        goto("/login");
      } else {
        loadKategoriIzin();
        loadIzinHistory();
      }
    });

    return unsubscribe;
  });

  onDestroy(() => {
    // Cleanup file preview URL when component is destroyed
    clearFilePreview();
  });

  async function loadKategoriIzin() {
    try {
      isLoadingKategori = true;
      const response = await directus.request(
        readItems("kategori_izin" as any, {
          fields: ["id", "nama"],
          sort: ["nama"],
        })
      );
      kategoriIzinList = response;
      // Load cuti tahunan data after categories are loaded
      await loadCutiTahunanData();
    } catch (error) {
      console.error("Error loading kategori izin:", error);
      showToast("Gagal memuat kategori izin", "error");
    } finally {
      isLoadingKategori = false;
    }
  }

  async function loadCutiTahunanData() {
    if (!currentUser) return;
    
    try {
      isLoadingCutiData = true;
      
      // Get current year range (1 Jan - 31 Dec)
      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      
      // Find "Cuti Tahunan" category ID
      const cutiTahunanKategori = kategoriIzinList.find(k => 
        k.nama.toLowerCase().includes('cuti tahunan')
      );
      
      if (cutiTahunanKategori) {
        // Get approved cuti tahunan requests for current year
        const response = await directus.request(
          readItems("izin_hari" as any, {
            filter: {
              user_id: { _eq: currentUser.id },
              kategori: { _eq: cutiTahunanKategori.id },
              status: { _eq: "approved" },
              tanggal_mulai: { _gte: startOfYear },
              tanggal_selesai: { _lte: endOfYear }
            },
            fields: ["total_hari"],
          })
        );
        
        // Calculate total used days
        cutiTahunanUsed = response.reduce((total: number, item: any) => 
          total + (item.total_hari || 0), 0
        );
        
        // Calculate remaining days (12 days per year)
        cutiTahunanRemaining = Math.max(0, 12 - cutiTahunanUsed);
      }
    } catch (error) {
      console.error("Error loading cuti tahunan data:", error);
      // Don't show error toast for this, just log it
    } finally {
      isLoadingCutiData = false;
    }
  }

  function onKategoriChange() {
    const selectedKategori = kategoriIzinList.find(k => k.id == formDataHari.kategori);
    selectedKategoriNama = selectedKategori?.nama || "";
    isCutiTahunan = selectedKategoriNama.toLowerCase().includes('cuti tahunan');
    
    // Load cuti tahunan data when category is selected
    if (isCutiTahunan) {
      loadCutiTahunanData();
    }
  }
  async function loadIzinHistory() {
    try {
      isLoadingHistory = true;
      historyError = null;

      izinHariHistory = await getIzinHariHistory();
      // Reload cuti tahunan data after history is loaded
      await loadCutiTahunanData();
    } catch (error) {
      console.error("Error loading history:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Gagal memuat riwayat izin";
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
    if (editMode) return; // Jangan reset form saat dalam edit mode

    formDataHari = {
      kategori: "",
      tanggalMulai: "",
      tanggalSelesai: "",
      totalHari: 0,
      keterangan: "",
      lampiran: null as File | null,
    };

    // Reset file preview
    clearFilePreview();
  }

  // Edit mode functions
  function startEdit(item: IzinHari) {
    if (item.status !== "pending") {
      showToast(
        "Hanya pengajuan dengan status pending yang dapat diedit",
        "error"
      );
      return;
    }

    editMode = true;
    editingItemId = item.id || null;

    const izinHari = item as IzinHari;
    originalFormData = { ...formDataHari };
    formDataHari = {
      kategori: izinHari.kategori,
      tanggalMulai: izinHari.tanggal_mulai,
      tanggalSelesai: izinHari.tanggal_selesai,
      totalHari: izinHari.total_hari,
      keterangan: izinHari.keterangan,
      lampiran: null as File | null, // File akan dimuat ulang jika ada
    };

    // Clear any existing preview since we're starting fresh in edit mode
    clearFilePreview();

    // If there's an existing attachment, show a placeholder or info
    if (izinHari.lampiran) {
      // We can't recreate the file object, but we can show that there's an existing file
      showExistingFileInfo(izinHari.lampiran);
    }

    // Update kategori info for cuti tahunan
    onKategoriChange();

    // Scroll to form
    document
      .querySelector(".form-container")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function showExistingFileInfo(fileName: string) {
    // Create a visual indicator that there's an existing file
    filePreviewType = "existing";
    existingFileName = fileName;
    // We'll handle this in the template
  }

  function cancelEdit() {
    editMode = false;
    editingItemId = null;

    if (originalFormData) {
      formDataHari = originalFormData;
      originalFormData = null;
    } else {
      // Reset form to empty state
      formDataHari = {
        kategori: "",
        tanggalMulai: "",
        tanggalSelesai: "",
        totalHari: 0,
        keterangan: "",
        lampiran: null as File | null,
      };
    }

    // Reset file preview
    clearFilePreview();
    
    // Reset cuti tahunan status
    selectedKategoriNama = "";
    isCutiTahunan = false;
  }

  // Fungsi untuk menghitung total hari
  function calculateTotalDays() {
    if (formDataHari.tanggalMulai && formDataHari.tanggalSelesai) {
      const startDate = new Date(formDataHari.tanggalMulai);
      const endDate = new Date(formDataHari.tanggalSelesai);

      if (endDate >= startDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 karena termasuk hari mulai
        formDataHari.totalHari = dayDiff;

        // Show warning for Cuti Tahunan if exceeds available days
        if (isCutiTahunan && dayDiff > cutiTahunanRemaining) {
          showToast(
            `Perhatian: Anda mengajukan ${dayDiff} hari, tetapi sisa cuti tahunan hanya ${cutiTahunanRemaining} hari.`,
            "warning"
          );
        }
      } else {
        formDataHari.totalHari = 0;
      }
    } else {
      formDataHari.totalHari = 0;
    }
  }

  function handleFileUploadHari(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // Validasi ukuran file (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file maksimal 5MB", "error");
        target.value = "";
        clearFilePreview();
        return;
      }

      // Validasi tipe file
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        showToast("Tipe file harus JPG, PNG, atau PDF", "error");
        target.value = "";
        clearFilePreview();
        return;
      }

      formDataHari.lampiran = file;
      generateFilePreview(file);
    } else {
      formDataHari.lampiran = null;
      clearFilePreview();
    }
  }

  function generateFilePreview(file: File) {
    // Clear previous preview
    clearFilePreview();

    const url = URL.createObjectURL(file);
    filePreviewUrl = url;

    if (file.type.startsWith("image/")) {
      filePreviewType = "image";
    } else if (file.type === "application/pdf") {
      filePreviewType = "pdf";
    }
  }

  function clearFilePreview() {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    filePreviewUrl = null;
    filePreviewType = null;
    existingFileName = null;
  }

  function removeFile() {
    formDataHari.lampiran = null;
    clearFilePreview();

    // Reset file input
    const fileInput = document.getElementById(
      "lampiran-hari"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }

    // In edit mode, if user removes file, they must upload a new one
    if (editMode) {
      showToast("File dihapus. Anda harus mengunggah file baru.", "info");
    }
  }

  async function handleSubmit() {
    if (editMode) {
      return await handleUpdateIzinHari();
    } else {
      return await handleSubmitIzinHari();
    }
  }

  async function handleSubmitIzinHari() {
    if (!validateFormIzinHari()) return;

    isSubmitting = true;

    try {
      await submitIzinHari({
        kategori: formDataHari.kategori.toString(),
        tanggalMulai: formDataHari.tanggalMulai,
        tanggalSelesai: formDataHari.tanggalSelesai,
        totalHari: formDataHari.totalHari,
        keterangan: formDataHari.keterangan,
        lampiran: formDataHari.lampiran || undefined,
      });

      showToast("Pengajuan izin hari berhasil dikirim!", "success");
      resetForm();
      // Reload riwayat izin setelah berhasil submit
      await loadIzinHistory();
    } catch (error) {
      console.error("Submit error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal mengirim pengajuan izin";

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

  function validateFormIzinHari() {
    if (!formDataHari.kategori) {
      showToast("Kategori izin harus dipilih", "error");
      return false;
    }

    if (!formDataHari.tanggalMulai) {
      showToast("Tanggal mulai harus diisi", "error");
      return false;
    }

    if (!formDataHari.tanggalSelesai) {
      showToast("Tanggal selesai harus diisi", "error");
      return false;
    }

    const startDate = new Date(formDataHari.tanggalMulai);
    const endDate = new Date(formDataHari.tanggalSelesai);

    if (endDate < startDate) {
      showToast(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai",
        "error"
      );
      return false;
    }

    if (formDataHari.totalHari <= 0) {
      showToast("Durasi izin harus lebih dari 0 hari", "error");
      return false;
    }

    if (!formDataHari.keterangan.trim()) {
      showToast("Keterangan harus diisi", "error");
      return false;
    }

    // For edit mode, lampiran is only required if no existing file and no new file uploaded
    if (!editMode && !formDataHari.lampiran) {
      showToast("Lampiran harus diunggah", "error");
      return false;
    }

    // In edit mode, if user removed existing file, they must upload new one
    if (editMode && !formDataHari.lampiran && filePreviewType !== "existing") {
      showToast("Lampiran harus diunggah", "error");
      return false;
    }

    // Validate Cuti Tahunan limits
    if (isCutiTahunan) {
      // Check if requesting more days than available
      if (formDataHari.totalHari > cutiTahunanRemaining) {
        showToast(
          `Sisa cuti tahunan Anda hanya ${cutiTahunanRemaining} hari. Anda mengajukan ${formDataHari.totalHari} hari.`,
          "error"
        );
        return false;
      }

      // Check if the date range is within current year
      const currentYear = new Date().getFullYear();
      const startYear = new Date(formDataHari.tanggalMulai).getFullYear();
      const endYear = new Date(formDataHari.tanggalSelesai).getFullYear();
      
      if (startYear !== currentYear || endYear !== currentYear) {
        showToast(
          `Cuti tahunan hanya berlaku untuk tahun ${currentYear}. Pastikan tanggal mulai dan selesai dalam tahun yang sama.`,
          "error"
        );
        return false;
      }
    }

    return true;
  }

  function goBack() {
    goto("/");
  }

  // Helper function untuk mendapatkan nama kategori berdasarkan ID
  function getKategoriNama(kategoriId: string | number): string {
    if (!kategoriId) return "";
    const kategori = kategoriIzinList.find((k) => k.id == kategoriId);
    return kategori ? kategori.nama : kategoriId.toString();
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

  function formatTime(timeString: string): string {
    return timeString.substring(0, 5); // Remove seconds if present
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "approved":
        return "#22c55e";
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

  async function handleUpdateIzinHari() {
    if (!validateFormIzinHari()) return;

    isSubmitting = true;

    try {
      await updateIzinHari(editingItemId!, {
        kategori: formDataHari.kategori.toString(),
        tanggalMulai: formDataHari.tanggalMulai,
        tanggalSelesai: formDataHari.tanggalSelesai,
        totalHari: formDataHari.totalHari,
        keterangan: formDataHari.keterangan,
        lampiran: formDataHari.lampiran || undefined,
      });

      showToast("Pengajuan izin hari berhasil diperbarui!", "success");
      cancelEdit();
      // Reload riwayat izin setelah berhasil update
      await loadIzinHistory();
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal memperbarui pengajuan izin";

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
</script>

<div class="page-container">
  <!-- Header -->
  <header class="header">
    <button class="back-btn" on:click={goBack} aria-label="Kembali">
      <i class="fas fa-arrow-left"></i>
    </button>
    <h1>Izin & Cuti</h1>
    <div class="spacer"></div>
  </header>

  <!-- Content -->
  <main class="main-content">
    <!-- Form Izin Hari -->
    <div class="form-container">
      <div class="form-header">
        {#if editMode}
          <h2>✏️ Edit Pengajuan Izin</h2>
          <p>Perbarui data pengajuan izin Anda</p>
          <div class="edit-notice">
            <i class="fas fa-info-circle"></i>
            Anda sedang mengedit pengajuan yang masih pending
          </div>
        {:else}
          <h2>📅 Pengajuan Izin</h2>
          <!-- <p>Ajukan izin untuk beberapa hari kerja</p> -->
        {/if}
      </div>

      {#if hasSetupIssue}
        <div class="setup-warning">
          <div class="setup-warning-header">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Setup Diperlukan</strong>
          </div>
          <p>
            Collection "izin_hari" belum dikonfigurasi di Directus. Form masih
            bisa digunakan untuk testing, namun data mungkin tidak tersimpan.
          </p>
          <small
            >📖 Lihat file <code>DIRECTUS_IZIN_HARI_SETUP.md</code> untuk panduan
            setup lengkap</small
          >
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="izin-form">
        <!-- Kategori Izin -->
        <div class="form-group">
          <label for="kategori-hari" class="form-label">
            <i class="fas fa-tag"></i>
            Kategori Izin *
          </label>
          <select
            id="kategori-hari"
            bind:value={formDataHari.kategori}
            on:change={onKategoriChange}
            class="form-select"
            required
            disabled={isLoadingKategori}
          >
            <option value="">
              {isLoadingKategori ? "Memuat kategori..." : "Pilih Kategori"}
            </option>
            {#each kategoriIzinList as kategori}
              <option value={kategori.id}>{kategori.nama}</option>
            {/each}
          </select>
        </div>

        <!-- Informasi Cuti Tahunan -->
        {#if isCutiTahunan}
          <div class="cuti-tahunan-info">
            <div class="cuti-info-header">
              <i class="fas fa-calendar-check"></i>
              <span>Informasi Cuti Tahunan {new Date().getFullYear()}</span>
            </div>
            <div class="cuti-info-content">
              {#if isLoadingCutiData}
                <div class="loading-indicator">
                  <i class="fas fa-spinner fa-spin"></i>
                  Memuat data cuti...
                </div>
              {:else}
                <div class="cuti-info-grid">
                  <div class="cuti-info-item">
                    <span class="cuti-label">Total Alokasi:</span>
                    <span class="cuti-value total">12 hari</span>
                  </div>
                  <div class="cuti-info-item">
                    <span class="cuti-label">Sudah Digunakan:</span>
                    <span class="cuti-value used">{cutiTahunanUsed} hari</span>
                  </div>
                  <div class="cuti-info-item">
                    <span class="cuti-label">Sisa Tersedia:</span>
                    <span class="cuti-value remaining {cutiTahunanRemaining <= 0 ? 'empty' : ''}">{cutiTahunanRemaining} hari</span>
                  </div>
                </div>
                {#if cutiTahunanRemaining <= 0}
                  <div class="cuti-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    Cuti tahunan Anda sudah habis untuk tahun {new Date().getFullYear()}
                  </div>
                {:else if cutiTahunanRemaining <= 3}
                  <div class="cuti-warning low">
                    <i class="fas fa-info-circle"></i>
                    Sisa cuti tahunan Anda tinggal sedikit ({cutiTahunanRemaining} hari)
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Tanggal Mulai & Selesai -->
        <div class="form-row">
          <div class="form-group half">
            <label for="tanggal-mulai" class="form-label">
              <i class="fas fa-calendar-alt"></i>
              Tanggal Mulai *
            </label>
            <input
              type="date"
              id="tanggal-mulai"
              bind:value={formDataHari.tanggalMulai}
              on:change={calculateTotalDays}
              class="form-input"
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div class="form-group half">
            <label for="tanggal-selesai" class="form-label">
              <i class="fas fa-calendar-check"></i>
              Tanggal Selesai *
            </label>
            <input
              type="date"
              id="tanggal-selesai"
              bind:value={formDataHari.tanggalSelesai}
              on:change={calculateTotalDays}
              class="form-input"
              min={formDataHari.tanggalMulai ||
                new Date().toISOString().split("T")[0]}
              required
            />
          </div>
        </div>

        <!-- Total Hari -->
        <div class="form-group">
          <label for="total-hari" class="form-label">
            <i class="fas fa-calendar-days"></i>
            Total Hari
          </label>
          <div class="total-days-display">
            <span class="days-number {isCutiTahunan && formDataHari.totalHari > cutiTahunanRemaining ? 'warning' : ''}">{formDataHari.totalHari}</span>
            <span class="days-text">hari kerja</span>
            {#if isCutiTahunan && formDataHari.totalHari > 0}
              <span class="cuti-indicator">
                ({formDataHari.totalHari > cutiTahunanRemaining ? 'Melebihi sisa cuti' : `${cutiTahunanRemaining - formDataHari.totalHari} hari tersisa`})
              </span>
            {/if}
          </div>
          <small class="form-hint">
            Otomatis dihitung dari tanggal mulai dan selesai
            {#if isCutiTahunan}
              <br><strong>Sisa cuti tahunan: {cutiTahunanRemaining} hari</strong>
            {/if}
          </small>
        </div>

        <!-- Keterangan -->
        <div class="form-group">
          <label for="keterangan-hari" class="form-label">
            <i class="fas fa-comment"></i>
            Keterangan *
          </label>
          <textarea
            id="keterangan-hari"
            bind:value={formDataHari.keterangan}
            class="form-textarea"
            placeholder="Jelaskan alasan izin hari..."
            rows="4"
            required
          ></textarea>
        </div>

        <!-- Lampiran -->
        <div class="form-group">
          <label for="lampiran-hari" class="form-label">
            <i class="fas fa-paperclip"></i>
            Lampiran *
          </label>
          <div class="file-upload">
            <input
              type="file"
              id="lampiran-hari"
              on:change={handleFileUploadHari}
              class="file-input"
              accept=".jpg,.jpeg,.png,.pdf"
              required={!editMode || filePreviewType !== "existing"}
            />
            <label for="lampiran-hari" class="file-label">
              <i class="fas fa-upload"></i>
              {formDataHari.lampiran
                ? formDataHari.lampiran.name
                : editMode && filePreviewType === "existing"
                  ? "Ganti File (Opsional)"
                  : "Pilih File (JPG, PNG, PDF) *"}
            </label>
          </div>
          <small class="file-hint">
            Maksimal 5MB - Format: JPG, PNG, PDF
            {editMode && filePreviewType === "existing"
              ? "(Ganti file jika diperlukan)"
              : "(Wajib)"}
          </small>

          <!-- File Preview -->
          {#if filePreviewUrl && (filePreviewType === "image" || filePreviewType === "pdf")}
            <div class="file-preview">
              <div class="preview-header">
                <span class="preview-title">
                  <i class="fas fa-eye"></i>
                  Pratinjau File {editMode ? "Baru" : ""}
                </span>
                <button
                  type="button"
                  class="remove-file-btn"
                  on:click={removeFile}
                  title="Hapus file"
                  aria-label="Hapus file"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>

              <div class="preview-content">
                {#if filePreviewType === "image"}
                  <div class="image-preview">
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      class="preview-image"
                      loading="lazy"
                    />
                  </div>
                {:else if filePreviewType === "pdf"}
                  <div class="pdf-preview">
                    <div class="pdf-info">
                      <i class="fas fa-file-pdf"></i>
                      <span>File PDF: {formDataHari.lampiran?.name}</span>
                    </div>
                    <iframe
                      src={filePreviewUrl}
                      class="pdf-iframe"
                      title="PDF Preview"
                    ></iframe>
                  </div>
                {/if}
              </div>
            </div>
          {:else if filePreviewType === "existing" && existingFileName}
            <!-- Show existing file info in edit mode -->
            <div class="file-preview existing-file">
              <div class="preview-header">
                <span class="preview-title">
                  <i class="fas fa-file"></i>
                  File Saat Ini
                </span>
                <button
                  type="button"
                  class="remove-file-btn"
                  on:click={removeFile}
                  title="Hapus file dan ganti dengan file baru"
                  aria-label="Hapus file dan ganti dengan file baru"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>

              <div class="preview-content">
                <div class="existing-file-info">
                  <div class="file-icon">
                    <i class="fas fa-file-alt"></i>
                  </div>
                  <div class="file-details">
                    <span class="file-name">{existingFileName}</span>
                    <small class="file-status">File yang sudah tersimpan</small>
                  </div>
                </div>
                <div class="existing-file-note">
                  <i class="fas fa-info-circle"></i>
                  <span
                    >Anda dapat mengganti file ini dengan mengunggah file baru</span
                  >
                </div>
              </div>
            </div>
          {/if}
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

    <!-- Riwayat Pengajuan Izin Hari -->
    <div class="history-container">
      <div class="history-header">
        <h3>📋 Riwayat Pengajuan Izin</h3>
        <button
          class="refresh-btn"
          on:click={loadIzinHistory}
          disabled={isLoadingHistory}
          aria-label="Muat ulang riwayat"
        >
          <i class="fas fa-sync-alt {isLoadingHistory ? 'fa-spin' : ''}"></i>
        </button>
      </div>

      {#if isLoadingHistory}
        <div class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Memuat riwayat izin...</p>
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
                <li>Buat collection "izin_hari" di Directus</li>
                <li>Atur permissions untuk Public role</li>
                <li>Ikuti panduan di DIRECTUS_IZIN_HARI_SETUP.md</li>
              </ul>
              <small
                >💡 Fitur pengajuan izin tetap bisa digunakan meskipun riwayat
                belum tersedia</small
              >
            </div>
          {/if}
          <button class="retry-btn" on:click={loadIzinHistory}>
            <i class="fas fa-redo"></i>
            Coba Lagi
          </button>
        </div>
      {:else if izinHariHistory.length === 0}
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Belum ada pengajuan izin hari</p>
          <small>Pengajuan yang Anda buat akan muncul di sini</small>
        </div>
      {:else}
        <div class="history-list">
          {#each izinHariHistory as izinHari}
            <div class="history-item">
              <div class="history-header-row">
                <div class="history-date">
                  <i class="fas fa-calendar-days"></i>
                  {formatDate(izinHari.tanggal_mulai)} - {formatDate(
                    izinHari.tanggal_selesai
                  )}
                </div>
                <div
                  class="history-status"
                  style="color: {getStatusColor(izinHari.status)}"
                >
                  <i class={getStatusIcon(izinHari.status)}></i>
                  {getStatusText(izinHari.status)}
                </div>
              </div>

              <div class="history-details">
                <div class="detail-row">
                  <span class="detail-label">Kategori:</span>
                  <span class="detail-value kategori-{izinHari.kategori}"
                    >{getKategoriNama(izinHari.kategori)}</span
                  >
                </div>
                <div class="detail-row">
                  <span class="detail-label">Durasi:</span>
                  <span class="detail-value">
                    <strong>{izinHari.total_hari}</strong> hari kerja
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Periode:</span>
                  <span class="detail-value">
                    {new Date(izinHari.tanggal_mulai).toLocaleDateString(
                      "id-ID"
                    )} -
                    {new Date(izinHari.tanggal_selesai).toLocaleDateString(
                      "id-ID"
                    )}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Keterangan:</span>
                  <span class="detail-value">{izinHari.keterangan}</span>
                </div>
                {#if izinHari.lampiran}
                  <div class="detail-row">
                    <span class="detail-label">Lampiran:</span>
                    <span class="detail-value">
                      <i class="fas fa-paperclip"></i>
                      Ada lampiran
                    </span>
                  </div>
                {/if}
                <div class="detail-row">
                  <span class="detail-label">Diajukan:</span>
                  <span class="detail-value"
                    >{new Date(izinHari.tanggal_pengajuan).toLocaleDateString(
                      "id-ID"
                    )}</span
                  >
                </div>
              </div>

              <!-- Approval Timeline -->
              <div class="approval-timeline">
                <div class="approval-header">
                  <h4>📋 Status Persetujuan</h4>
                  {#if izinHari.status}
                    <div
                      class="overall-status-badge {izinHari.status}"
                      style="background-color: {getStatusColor(
                        izinHari.status
                      )}"
                    >
                      <i class={getStatusIcon(izinHari.status)}></i>
                      {getStatusText(izinHari.status)}
                    </div>
                  {/if}
                </div>

                {#if izinHari.approval_stage || izinHari.hrd_admin_approved_by || izinHari.manager_hrd_approved_by || izinHari.direktur_approved_by || izinHari.manager_divisi_approved_by}
                  <div class="approval-stages">
                    {#each getIzinApprovalStages(izinHari) as stage, index}
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
                            style="color: {getIzinApprovalStatusColor(
                              stage.completed,
                              stage.approved
                            )}"
                          >
                            <i
                              class={getIzinApprovalStatusIcon(
                                stage.completed,
                                stage.approved
                              )}
                            ></i>
                          </div>
                          {#if index < getIzinApprovalStages(izinHari).length - 1}
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
                                  <span
                                    >{formatIzinApprovalDate(stage.date)}</span
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
                  {#if izinHari.final_approved_by && izinHari.final_approved_date}
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
                              >{izinHari.final_approved_by}</strong
                            ></span
                          >
                        </div>
                        <div class="final-date">
                          <i class="fas fa-calendar-check"></i>
                          <span
                            >{formatIzinApprovalDate(
                              izinHari.final_approved_date
                            )}</span
                          >
                        </div>
                      </div>
                    </div>
                  {:else if izinHari.final_rejection_reason}
                    <div class="final-rejection">
                      <div class="final-rejection-header">
                        <i class="fas fa-ban"></i>
                        <strong>Pengajuan Ditolak</strong>
                      </div>
                      <div class="final-rejection-reason">
                        <i class="fas fa-comment"></i>
                        <span>{izinHari.final_rejection_reason}</span>
                      </div>
                    </div>
                  {/if}
                {/if}
              </div>

              <!-- Action buttons for pending status -->
              {#if izinHari.status === "pending"}
                <div class="history-actions">
                  <button
                    class="edit-btn"
                    on:click={() => startEdit(izinHari)}
                    disabled={editMode}
                    title="Edit pengajuan"
                  >
                    <i class="fas fa-edit"></i>
                    Edit
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
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
    background-size: 400% 400%;
    animation: gradientMove 25s ease infinite;
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

  @media (min-width: 480px) {
    .page-container {
      max-width: 900px;
    }
  }

  /* Header */
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

  .header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.1) 0%,
      rgba(101, 163, 13, 0.05) 50%,
      rgba(77, 124, 15, 0.1) 100%
    );
    z-index: -1;
  }

  .back-btn {
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
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
      0 8px 32px rgba(132, 204, 22, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
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
    background: linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(132, 204, 22, 0.4),
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

  .spacer {
    width: 52px;
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

  /* Form Actions Layout */
  .form-actions {
    display: flex;
    flex-direction: column; /* Tambahkan ini untuk layout vertikal */
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    text-align: center;
    width: 100%; /* Opsional */
  }

  /* History Actions */
  .history-actions {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
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

  /* Main Content */
  .main-content {
    padding: 24px;
  }

  .form-container {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 28px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .form-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.05) 0%,
      rgba(101, 163, 13, 0.03) 50%,
      rgba(77, 124, 15, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .form-container:hover {
    transform: translateY(-2px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .form-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .form-header h2 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .form-header p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 15px;
    font-weight: 500;
  }

  /* Setup Warning */
  .setup-warning {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.15) 0%,
      rgba(217, 119, 6, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }

  .setup-warning::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.1) 0%,
      rgba(217, 119, 6, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .setup-warning-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .setup-warning-header i {
    color: #f59e0b;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.3));
  }

  .setup-warning-header strong {
    color: #fbbf24;
    font-size: 16px;
    font-weight: 700;
  }

  .setup-warning p {
    margin: 0 0 12px 0;
    color: rgba(251, 191, 36, 0.9);
    font-size: 14px;
    line-height: 1.5;
  }

  .setup-warning small {
    color: rgba(251, 191, 36, 0.8);
    font-size: 13px;
    font-weight: 500;
  }

  .setup-warning code {
    background: rgba(245, 158, 11, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: "JetBrains Mono", "Courier New", monospace;
    font-size: 12px;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  /* Form Styles */
  .izin-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group.half {
    flex: 1;
  }

  .form-label {
    font-size: 15px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
    display: flex;
    align-items: center;
    gap: 12px;
    letter-spacing: 0.5px;
  }

  .form-label i {
    color: #84cc16;
    width: 18px;
    text-align: center;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .form-input,
  .form-select {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-input:hover,
  .form-select:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-select option {
    background: #1e293b;
    color: #f1f5f9;
    padding: 12px;
  }

  .form-textarea {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-textarea:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea::placeholder {
    color: rgba(226, 232, 240, 0.5);
  }

  /* File Upload */
  .file-upload {
    position: relative;
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .file-label {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border: 2px dashed rgba(132, 204, 22, 0.3);
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 15px;
    color: rgba(226, 232, 240, 0.8);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .file-label:hover {
    border-color: rgba(132, 204, 22, 0.5);
    background: rgba(30, 41, 59, 0.8);
    color: #84cc16;
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .file-label i {
    color: #84cc16;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .file-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    margin-top: 8px;
    font-weight: 500;
  }

  /* Total Days Display */
  .total-days-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.15) 0%,
      rgba(14, 165, 233, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    margin-bottom: 8px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  .total-days-display::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(14, 165, 233, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .days-number {
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    letter-spacing: -0.02em;
  }

  .days-text {
    font-size: 16px;
    font-weight: 600;
    color: rgba(59, 130, 246, 0.9);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .form-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    font-style: italic;
    font-weight: 500;
  }

  /* Time Duration Styling */
  .time-duration-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 4px;
  }

  .time-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .time-label {
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
  }

  .time-select {
    padding: 10px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    background: white;
    transition: all 0.2s ease;
  }

  .time-select:focus {
    outline: none;
    border-color: #84cc16;
    box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.1);
  }

  .time-separator {
    font-size: 20px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 8px;
  }

  /* Submit Button */
  .form-actions {
    margin-top: 12px;
  }

  .submit-btn {
    width: 100%;
    padding: 18px 32px;
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow:
      0 8px 32px rgba(132, 204, 22, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    letter-spacing: 0.5px;
    text-transform: uppercase;
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
    transition: left 0.6s;
  }

  .submit-btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(132, 204, 22, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .submit-btn i {
    font-size: 18px;
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

  /* Main Content */
  .main-content {
    padding: 24px;
  }

  .form-container {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 28px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .form-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.05) 0%,
      rgba(101, 163, 13, 0.03) 50%,
      rgba(77, 124, 15, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .form-container:hover {
    transform: translateY(-2px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .form-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .form-header h2 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .form-header p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 15px;
    font-weight: 500;
  }

  /* Setup Warning */
  .setup-warning {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.15) 0%,
      rgba(217, 119, 6, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }

  .setup-warning::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.1) 0%,
      rgba(217, 119, 6, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .setup-warning-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .setup-warning-header i {
    color: #f59e0b;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.3));
  }

  .setup-warning-header strong {
    color: #fbbf24;
    font-size: 16px;
    font-weight: 700;
  }

  .setup-warning p {
    margin: 0 0 12px 0;
    color: rgba(251, 191, 36, 0.9);
    font-size: 14px;
    line-height: 1.5;
  }

  .setup-warning small {
    color: rgba(251, 191, 36, 0.8);
    font-size: 13px;
    font-weight: 500;
  }

  .setup-warning code {
    background: rgba(245, 158, 11, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: "JetBrains Mono", "Courier New", monospace;
    font-size: 12px;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  /* Form Styles */
  .izin-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group.half {
    flex: 1;
  }

  .form-label {
    font-size: 15px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
    display: flex;
    align-items: center;
    gap: 12px;
    letter-spacing: 0.5px;
  }

  .form-label i {
    color: #84cc16;
    width: 18px;
    text-align: center;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .form-input,
  .form-select {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-input:hover,
  .form-select:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-select option {
    background: #1e293b;
    color: #f1f5f9;
    padding: 12px;
  }

  .form-textarea {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-textarea:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea::placeholder {
    color: rgba(226, 232, 240, 0.5);
  }

  /* File Upload */
  .file-upload {
    position: relative;
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .file-label {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border: 2px dashed rgba(132, 204, 22, 0.3);
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 15px;
    color: rgba(226, 232, 240, 0.8);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .file-label:hover {
    border-color: rgba(132, 204, 22, 0.5);
    background: rgba(30, 41, 59, 0.8);
    color: #84cc16;
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .file-label i {
    color: #84cc16;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .file-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    margin-top: 8px;
    font-weight: 500;
  }

  /* Total Days Display */
  .total-days-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.15) 0%,
      rgba(14, 165, 233, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    margin-bottom: 8px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  .total-days-display::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(14, 165, 233, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .days-number {
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    letter-spacing: -0.02em;
  }

  .days-text {
    font-size: 16px;
    font-weight: 600;
    color: rgba(59, 130, 246, 0.9);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .form-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    font-style: italic;
    font-weight: 500;
  }

  /* Time Duration Styling */
  .time-duration-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 4px;
  }

  .time-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .time-label {
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
  }

  .time-select {
    padding: 10px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    background: white;
    transition: all 0.2s ease;
  }

  .time-select:focus {
    outline: none;
    border-color: #84cc16;
    box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.1);
  }

  .time-separator {
    font-size: 20px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 8px;
  }

  /* Submit Button */
  .form-actions {
    margin-top: 12px;
  }

  .submit-btn {
    width: 100%;
    padding: 18px 32px;
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow:
      0 8px 32px rgba(132, 204, 22, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    letter-spacing: 0.5px;
    text-transform: uppercase;
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
    transition: left 0.6s;
  }

  .submit-btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(132, 204, 22, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .submit-btn i {
    font-size: 18px;
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

  /* Main Content */
  .main-content {
    padding: 24px;
  }

  .form-container {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 28px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .form-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.05) 0%,
      rgba(101, 163, 13, 0.03) 50%,
      rgba(77, 124, 15, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .form-container:hover {
    transform: translateY(-2px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .form-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .form-header h2 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .form-header p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 15px;
    font-weight: 500;
  }

  /* Setup Warning */
  .setup-warning {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.15) 0%,
      rgba(217, 119, 6, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }

  .setup-warning::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.1) 0%,
      rgba(217, 119, 6, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .setup-warning-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .setup-warning-header i {
    color: #f59e0b;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.3));
  }

  .setup-warning-header strong {
    color: #fbbf24;
    font-size: 16px;
    font-weight: 700;
  }

  .setup-warning p {
    margin: 0 0 12px 0;
    color: rgba(251, 191, 36, 0.9);
    font-size: 14px;
    line-height: 1.5;
  }

  .setup-warning small {
    color: rgba(251, 191, 36, 0.8);
    font-size: 13px;
    font-weight: 500;
  }

  .setup-warning code {
    background: rgba(245, 158, 11, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-family: "JetBrains Mono", "Courier New", monospace;
    font-size: 12px;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  /* Form Styles */
  .izin-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group.half {
    flex: 1;
  }

  .form-label {
    font-size: 15px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
    display: flex;
    align-items: center;
    gap: 12px;
    letter-spacing: 0.5px;
  }

  .form-label i {
    color: #84cc16;
    width: 18px;
    text-align: center;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .form-input,
  .form-select {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-input:hover,
  .form-select:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-select option {
    background: #1e293b;
    color: #f1f5f9;
    padding: 12px;
  }

  .form-textarea {
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .form-textarea:focus {
    outline: none;
    border-color: rgba(132, 204, 22, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(132, 204, 22, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .form-textarea::placeholder {
    color: rgba(226, 232, 240, 0.5);
  }

  /* File Upload */
  .file-upload {
    position: relative;
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .file-label {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border: 2px dashed rgba(132, 204, 22, 0.3);
    border-radius: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 15px;
    color: rgba(226, 232, 240, 0.8);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .file-label:hover {
    border-color: rgba(132, 204, 22, 0.5);
    background: rgba(30, 41, 59, 0.8);
    color: #84cc16;
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .file-label i {
    color: #84cc16;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .file-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    margin-top: 8px;
    font-weight: 500;
  }

  /* Total Days Display */
  .total-days-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.15) 0%,
      rgba(14, 165, 233, 0.1) 100%
    );
    backdrop-filter: blur(10px);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 16px;
    margin-bottom: 8px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  .total-days-display::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(14, 165, 233, 0.05) 100%
    );
    border-radius: 16px;
    z-index: -1;
  }

  .days-number {
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    letter-spacing: -0.02em;
  }

  .days-text {
    font-size: 16px;
    font-weight: 600;
    color: rgba(59, 130, 246, 0.9);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .form-hint {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.6);
    font-style: italic;
    font-weight: 500;
  }

  /* Time Duration Styling */
  .time-duration-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 4px;
  }

  .time-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .time-label {
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
  }

  .time-select {
    padding: 10px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    background: white;
    transition: all 0.2s ease;
  }

  .time-select:focus {
    outline: none;
    border-color: #84cc16;
    box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.1);
  }

  .time-separator {
    font-size: 20px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 8px;
  }

  /* Submit Button */
  .form-actions {
    margin-top: 12px;
  }

  .submit-btn {
    width: 100%;
    padding: 18px 32px;
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow:
      0 8px 32px rgba(132, 204, 22, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    letter-spacing: 0.5px;
    text-transform: uppercase;
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
    transition: left 0.6s;
  }

  .submit-btn:hover:not(:disabled)::before {
    left: 100%;
  }

  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(132, 204, 22, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .submit-btn i {
    font-size: 18px;
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

  /* History Section */
  .history-container {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 28px;
    margin-top: 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .history-container::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.05) 0%,
      rgba(101, 163, 13, 0.03) 50%,
      rgba(77, 124, 15, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .history-container:hover {
    transform: translateY(-2px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .history-header h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.01em;
  }

  .refresh-btn {
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: rgba(226, 232, 240, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(30, 41, 59, 0.9);
    color: #84cc16;
    transform: translateY(-2px);
    border-color: rgba(132, 204, 22, 0.3);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-state,
  .empty-state,
  .error-state {
    text-align: center;
    padding: 60px 32px;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  .loading-state::before,
  .empty-state::before,
  .error-state::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.03) 0%,
      rgba(101, 163, 13, 0.02) 50%,
      rgba(77, 124, 15, 0.03) 100%
    );
    border-radius: 20px;
    z-index: -1;
  }

  .loading-state i,
  .empty-state i {
    font-size: 48px;
    margin-bottom: 20px;
    color: rgba(132, 204, 22, 0.6);
    filter: drop-shadow(0 0 20px rgba(132, 204, 22, 0.2));
  }

  .error-state i {
    font-size: 48px;
    margin-bottom: 20px;
    color: rgba(239, 68, 68, 0.7);
    filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.2));
  }

  .loading-state p,
  .empty-state p,
  .error-state h4 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .error-state h4 {
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.01em;
  }

  .error-state p {
    margin: 0 0 20px 0;
    font-size: 15px;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 500;
  }

  .empty-state small {
    font-size: 15px;
    color: rgba(226, 232, 240, 0.6);
    font-weight: 500;
  }

  .setup-info {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    margin: 20px 0;
    text-align: left;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .setup-info h5 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
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
    color: rgba(226, 232, 240, 0.8);
    margin-bottom: 6px;
    font-weight: 500;
  }

  .setup-info small {
    font-size: 13px;
    color: #84cc16;
    font-weight: 600;
  }

  .retry-btn {
    background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(132, 204, 22, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
  }

  .retry-btn::before {
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

  .retry-btn:hover::before {
    left: 100%;
  }

  .retry-btn:hover {
    background: linear-gradient(135deg, #65a30d 0%, #4d7c0f 100%);
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(132, 204, 22, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .history-item {
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px) saturate(150%);
    border-radius: 20px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.2),
      0 8px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .history-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(132, 204, 22, 0.05) 0%,
      rgba(101, 163, 13, 0.03) 50%,
      rgba(77, 124, 15, 0.05) 100%
    );
    border-radius: 20px;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .history-item:hover::before {
    opacity: 1;
  }

  .history-item:hover {
    transform: translateY(-3px);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    border-color: rgba(132, 204, 22, 0.2);
  }

  .history-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .history-date {
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    letter-spacing: -0.01em;
  }

  .history-date i {
    color: #84cc16;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .history-status {
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(10px);
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
  }

  .detail-row:hover {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 6px 20px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .detail-label {
    font-weight: 600;
    color: rgba(226, 232, 240, 0.7);
    min-width: 90px;
    flex-shrink: 0;
  }

  .detail-value {
    color: #f1f5f9;
    flex: 1;
    font-weight: 500;
  }

  .kategori-izin {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
  }

  .kategori-cuti {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
  }

  .kategori-sakit {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .main-content {
      padding: 20px;
    }

    .form-container,
    .history-container {
      padding: 24px 20px;
    }

    .form-row {
      flex-direction: column;
      gap: 20px;
    }

    .form-group.half {
      flex: none;
    }

    .header {
      padding: 18px 20px;
    }

    .header h1 {
      font-size: 22px;
    }

    .back-btn,
    .spacer {
      width: 48px;
      height: 48px;
    }

    .history-header h3 {
      font-size: 20px;
    }

    .history-item {
      padding: 20px;
    }

    .history-header-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .detail-row {
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
    }

    .detail-label {
      min-width: auto;
    }

    .total-days-display {
      padding: 16px 20px;
    }

    .days-number {
      font-size: 28px;
    }

    .days-text {
      font-size: 15px;
    }
  }

  @media (max-width: 480px) {
    .main-content {
      padding: 16px;
    }

    .form-container,
    .history-container {
      padding: 20px 16px;
    }

    .header {
      padding: 16px 18px;
    }

    .header h1 {
      font-size: 20px;
    }

    .back-btn,
    .spacer {
      width: 44px;
      height: 44px;
    }

    .back-btn {
      font-size: 18px;
    }

    .form-header h2 {
      font-size: 22px;
    }

    .form-header p {
      font-size: 14px;
    }

    .history-header h3 {
      font-size: 18px;
    }

    .refresh-btn {
      width: 40px;
      height: 40px;
    }

    .history-item {
      padding: 18px;
    }

    .history-date {
      font-size: 15px;
    }

    .history-status {
      font-size: 14px;
    }

    .detail-row {
      padding: 10px 12px;
      font-size: 14px;
    }

    .total-days-display {
      padding: 14px 18px;
    }

    .days-number {
      font-size: 24px;
    }

    .days-text {
      font-size: 14px;
    }

    .submit-btn {
      padding: 16px 24px;
      font-size: 16px;
    }

    .loading-state,
    .empty-state,
    .error-state {
      padding: 40px 20px;
    }

    .loading-state i,
    .empty-state i,
    .error-state i {
      font-size: 40px;
    }

    .loading-state p,
    .empty-state p,
    .error-state h4 {
      font-size: 16px;
    }
  }

  /* File Preview Styles */
  .file-preview {
    margin-top: 16px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .preview-header {
    padding: 16px 20px;
    background: rgba(15, 23, 42, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preview-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-title i {
    color: #84cc16;
    filter: drop-shadow(0 0 8px rgba(132, 204, 22, 0.3));
  }

  .remove-file-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 12px;
    box-shadow:
      0 4px 16px rgba(239, 68, 68, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .remove-file-btn:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-2px);
    box-shadow:
      0 6px 20px rgba(239, 68, 68, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .preview-content {
    padding: 20px;
  }

  .image-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 12px;
    padding: 16px;
    min-height: 200px;
  }

  .preview-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.2);
    object-fit: contain;
  }

  .pdf-preview {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 12px;
    overflow: hidden;
  }

  .pdf-info {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(30, 41, 59, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .pdf-info i {
    color: #ef4444;
    font-size: 18px;
    filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.3));
  }

  .pdf-info span {
    font-size: 14px;
    font-weight: 500;
    color: rgba(226, 232, 240, 0.9);
  }

  .pdf-iframe {
    width: 100%;
    height: 400px;
    border: none;
    background: white;
  }

  /* Responsive adjustments for file preview */
  @media (max-width: 768px) {
    .preview-header {
      padding: 12px 16px;
    }

    .preview-content {
      padding: 16px;
    }

    .pdf-iframe {
      height: 300px;
    }

    .preview-image {
      max-height: 250px;
    }
  }

  @media (max-width: 480px) {
    .preview-header {
      padding: 10px 14px;
    }

    .preview-title {
      font-size: 13px;
    }

    .remove-file-btn {
      width: 28px;
      height: 28px;
      font-size: 11px;
    }

    .preview-content {
      padding: 14px;
    }

    .pdf-iframe {
      height: 250px;
    }

    .preview-image {
      max-height: 200px;
    }

    .image-preview {
      min-height: 150px;
      padding: 12px;
    }
  }

  /* Existing file styles */
  .existing-file {
    border-color: rgba(76, 175, 80, 0.3);
    background: rgba(76, 175, 80, 0.05);
  }

  .existing-file .preview-header {
    background: rgba(76, 175, 80, 0.1);
    border-bottom-color: rgba(76, 175, 80, 0.2);
  }

  .existing-file .preview-title i {
    color: #4caf50;
    filter: drop-shadow(0 0 8px rgba(76, 175, 80, 0.3));
  }

  .existing-file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(76, 175, 80, 0.05);
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid rgba(76, 175, 80, 0.1);
  }

  .file-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
    border-radius: 12px;
    color: white;
    font-size: 20px;
    box-shadow:
      0 4px 16px rgba(76, 175, 80, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .file-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .file-name {
    color: rgba(226, 232, 240, 0.9);
    font-weight: 600;
    font-size: 14px;
    word-break: break-word;
  }

  .file-status {
    color: rgba(132, 204, 22, 0.8);
    font-size: 12px;
    font-weight: 500;
  }

  .existing-file-note {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 8px;
    color: #fbbf24;
    font-size: 13px;
    border: 1px solid rgba(251, 191, 36, 0.2);
    backdrop-filter: blur(10px);
  }

  .existing-file-note i {
    font-size: 14px;
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3));
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
    font-size: 14px;
    font-weight: 600;
    color: #10b981;
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
    text-align: center;
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
    font-size: 14px;
    font-weight: 600;
    color: #ef4444;
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

  @media (max-width: 768px) {
    .approval-timeline {
      padding: 16px;
    }

    .approval-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .overall-status-badge {
      font-size: 11px;
      padding: 4px 10px;
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

    .approval-status,
    .approver-info,
    .approval-date {
      font-size: 12px;
    }

    .rejection-reason {
      font-size: 12px;
      padding: 6px 10px;
    }

    .final-approval,
    .final-rejection {
      padding: 12px;
    }

    .final-approval-header,
    .final-rejection-header {
      font-size: 13px;
    }

    .final-approver,
    .final-date,
    .final-rejection-reason {
      font-size: 12px;
    }
  }

  /* Cuti Tahunan Info Styles */
  .cuti-tahunan-info {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    border: 1px solid #475569;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .cuti-info-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    color: #3b82f6;
    font-weight: 600;
    font-size: 15px;
  }

  .cuti-info-header i {
    font-size: 16px;
  }

  .cuti-info-content {
    color: #e2e8f0;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 14px;
  }

  .loading-indicator i {
    color: #3b82f6;
  }

  .cuti-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .cuti-info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cuti-label {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 500;
  }

  .cuti-value {
    font-size: 16px;
    font-weight: 700;
  }

  .cuti-value.total {
    color: #3b82f6;
  }

  .cuti-value.used {
    color: #f59e0b;
  }

  .cuti-value.remaining {
    color: #10b981;
  }

  .cuti-value.remaining.empty {
    color: #ef4444;
  }

  .cuti-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .cuti-warning.low {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .cuti-warning i {
    color: inherit;
  }

  @media (max-width: 768px) {
    .cuti-info-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    
    .cuti-info-item {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
    
    .cuti-tahunan-info {
      padding: 16px;
    }
  }

  /* Total Days Display Styles */
  .total-days-display {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .days-number {
    font-size: 24px;
    font-weight: 700;
    color: #3b82f6;
  }

  .days-number.warning {
    color: #ef4444;
  }

  .days-text {
    font-size: 14px;
    color: #94a3b8;
    font-weight: 500;
  }

  .cuti-indicator {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
  }

  .form-hint strong {
    color: #3b82f6;
  }
</style>
