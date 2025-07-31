<script lang="ts">
  import { onMount } from "svelte";
  import { user } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import { goto } from "$app/navigation";
  import {
    submitKasbon,
    getKasbonHistory,
    formatRupiah,
    updateKasbon,
    getKasbonApprovalStages,
    getCurrentKasbonApprovalStatus,
    formatKasbonApprovalDate,
    getKasbonApprovalStatusColor,
    getKasbonApprovalStatusIcon,
    getPaymentProgress,
    getPaymentStatusText,
    getPaymentStatusColor,
    getPaymentStatusIcon,
    getPaymentMethodText,
    type Kasbon,
    type PaymentProgress,
  } from "$lib/kasbon";
  import type { Akun } from "$lib/directus";

  let currentUser: Akun | null = null;

  // Edit mode variables
  let editMode = false;
  let editingItemId: string | null = null;
  let originalFormData: any = null;

  // Form data untuk Kasbon
  let formDataKasbon = {
    tanggal: "",
    nominal: "",
    tenor: "",
    keterangan: "",
  };

  let isSubmitting = false;
  let hasSetupIssue = false;

  // Riwayat pengajuan kasbon
  let kasbonHistory: Kasbon[] = [];
  let isLoadingHistory = false;
  let historyError: string | null = null;

  // Progress pembayaran untuk setiap kasbon
  let paymentProgresses: Map<string, PaymentProgress> = new Map();

  onMount(() => {
    const unsubscribe = user.subscribe(($user) => {
      // Clear data when user changes
      if (currentUser?.id !== $user?.id) {
        kasbonHistory = [];
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

      // Load kasbon history on mount
      loadKasbonHistory();
    });

    return unsubscribe;
  });

  async function loadKasbonHistory() {
    try {
      isLoadingHistory = true;
      historyError = null;

      const result = await getKasbonHistory();
      kasbonHistory = result;

      console.log("Kasbon history loaded:", kasbonHistory);

      // Load payment progress for approved kasbon
      const progressMap = new Map();
      for (const kasbon of kasbonHistory) {
        if (kasbon.status === "approved" && kasbon.id) {
          try {
            const progress = await getPaymentProgress(kasbon);
            progressMap.set(kasbon.id, progress);
          } catch (error) {
            console.error(
              `Error loading progress for kasbon ${kasbon.id}:`,
              error
            );
            // Continue loading other progress even if one fails
          }
        }
      }
      paymentProgresses = progressMap;
    } catch (error) {
      console.error("Error loading kasbon history:", error);
      historyError =
        error instanceof Error ? error.message : "Gagal memuat riwayat kasbon";
    } finally {
      isLoadingHistory = false;
    }
  }

  async function handleSubmit() {
    if (editMode) {
      return await handleUpdateKasbon();
    } else {
      return await handleSubmitKasbon();
    }
  }

  async function handleSubmitKasbon() {
    if (!validateForm()) return;

    try {
      isSubmitting = true;

      const kasbonData = {
        tanggal: formDataKasbon.tanggal,
        nominal: parseFloat(formDataKasbon.nominal.replace(/[^\d]/g, "")),
        tenor: parseInt(formDataKasbon.tenor),
        keterangan: formDataKasbon.keterangan,
      };

      console.log("Kasbon submission data:", kasbonData);

      await submitKasbon(kasbonData);

      showToast("Pengajuan kasbon berhasil dikirim! 💰", "success");

      // Reset form
      resetForm();

      // Reload riwayat kasbon setelah berhasil submit
      await loadKasbonHistory();
    } catch (error) {
      console.error("Submit kasbon error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal mengirim pengajuan kasbon";

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
    if (!formDataKasbon.tanggal) {
      showToast("Tanggal kasbon harus diisi", "error");
      return false;
    }

    if (
      !formDataKasbon.nominal ||
      parseFloat(formDataKasbon.nominal.replace(/[^\d]/g, "")) <= 0
    ) {
      showToast("Nominal kasbon harus diisi dan lebih dari 0", "error");
      return false;
    }

    if (!formDataKasbon.tenor || parseInt(formDataKasbon.tenor) <= 0) {
      showToast("Tenor kasbon harus diisi dan lebih dari 0 bulan", "error");
      return false;
    }

    if (!formDataKasbon.keterangan.trim()) {
      showToast("Keterangan kasbon harus diisi", "error");
      return false;
    }

    if (formDataKasbon.keterangan.trim().length < 10) {
      showToast("Keterangan minimal 10 karakter", "error");
      return false;
    }

    return true;
  }

  function resetForm() {
    if (editMode) return; // Jangan reset form saat dalam edit mode

    formDataKasbon = {
      tanggal: "",
      nominal: "",
      tenor: "",
      keterangan: "",
    };
  }

  // Edit mode functions
  function startEdit(item: Kasbon) {
    if (item.status !== "pending") {
      showToast(
        "Hanya pengajuan dengan status pending yang dapat diedit",
        "error"
      );
      return;
    }

    editMode = true;
    editingItemId = item.id || null;
    originalFormData = { ...formDataKasbon };

    formDataKasbon = {
      tanggal: item.tanggal,
      nominal: formatRupiah(item.nominal),
      tenor: item.tenor.toString(),
      keterangan: item.keterangan,
    };

    // Scroll to form
    document
      .querySelector(".form-container")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    editMode = false;
    editingItemId = null;

    if (originalFormData) {
      formDataKasbon = originalFormData;
      originalFormData = null;
    } else {
      // Reset form to empty state
      formDataKasbon = {
        tanggal: "",
        nominal: "",
        tenor: "",
        keterangan: "",
      };
    }
  }

  async function handleUpdateKasbon() {
    if (!validateForm()) return;

    isSubmitting = true;

    try {
      // Parse nominal dari format rupiah ke number
      const nominalValue = parseInt(
        formDataKasbon.nominal.replace(/[^\d]/g, "")
      );

      await updateKasbon(editingItemId!, {
        tanggal: formDataKasbon.tanggal,
        nominal: nominalValue,
        tenor: parseInt(formDataKasbon.tenor),
        keterangan: formDataKasbon.keterangan,
      });

      showToast("Pengajuan kasbon berhasil diperbarui!", "success");
      cancelEdit();
      // Reload riwayat kasbon setelah berhasil update
      await loadKasbonHistory();
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal memperbarui pengajuan kasbon";

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

  function goBack() {
    goto("/");
  }

  // Format currency input
  function formatCurrency(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^\d]/g, "");

    if (value) {
      const number = parseInt(value);
      const formatted = new Intl.NumberFormat("id-ID").format(number);
      formDataKasbon.nominal = `Rp ${formatted}`;
    } else {
      formDataKasbon.nominal = "";
    }
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

  function formatDateShort(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getDaysUntilDue(dueDate: Date): number {
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
    <h1>Kasbon</h1>
    <div class="spacer"></div>
  </header>

  <!-- Content -->
  <main class="main-content">
    <!-- Form Kasbon -->
    <div class="form-container">
      <div class="form-header">
        {#if editMode}
          <h2>✏️ Edit Pengajuan Kasbon</h2>
          <p>Perbarui data pengajuan kasbon Anda</p>
          <div class="edit-notice">
            <i class="fas fa-info-circle"></i>
            Anda sedang mengedit pengajuan yang masih pending
          </div>
        {:else}
          <h2>💰 Pengajuan Kasbon</h2>
          <p>Ajukan kasbon untuk kebutuhan finansial darurat</p>
        {/if}
      </div>

      {#if hasSetupIssue}
        <div class="setup-warning">
          <div class="setup-warning-header">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Setup Diperlukan</strong>
          </div>
          <p>
            Collection "kasbon" belum dikonfigurasi di Directus. Form masih bisa
            digunakan untuk testing, namun data mungkin tidak tersimpan.
          </p>
          <small
            >📖 Lihat file <code>DIRECTUS_KASBON_SETUP.md</code> untuk panduan setup
            lengkap</small
          >
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="kasbon-form">
        <!-- Tanggal Kasbon -->
        <div class="form-group">
          <label for="tanggal-kasbon" class="form-label">
            <i class="fas fa-calendar-alt"></i>
            Tanggal Pengajuan *
          </label>
          <input
            type="date"
            id="tanggal-kasbon"
            bind:value={formDataKasbon.tanggal}
            class="form-input"
            min={new Date().toISOString().split("T")[0]}
            required
          />
        </div>

        <!-- Nominal Kasbon -->
        <div class="form-group">
          <label for="nominal-kasbon" class="form-label">
            <i class="fas fa-money-bill-wave"></i>
            Nominal Kasbon *
          </label>
          <input
            type="text"
            id="nominal-kasbon"
            value={formDataKasbon.nominal}
            on:input={formatCurrency}
            class="form-input currency-input"
            placeholder="Rp 0"
            required
          />
          <small class="form-hint">Masukkan jumlah kasbon yang dibutuhkan</small
          >
        </div>

        <!-- Tenor Kasbon -->
        <div class="form-group">
          <label for="tenor-kasbon" class="form-label">
            <i class="fas fa-calendar-week"></i>
            Tenor Kasbon *
          </label>
          <select
            id="tenor-kasbon"
            bind:value={formDataKasbon.tenor}
            class="form-select"
            required
          >
            <option value="">Pilih tenor kasbon</option>
            <option value="1">1 Bulan</option>
            <option value="2">2 Bulan</option>
            <option value="3">3 Bulan</option>
            <option value="6">6 Bulan</option>
            <option value="12">12 Bulan</option>
          </select>
          <small class="form-hint">Pilih jangka waktu pengembalian kasbon</small
          >
        </div>

        <!-- Keterangan -->
        <div class="form-group">
          <label for="keterangan-kasbon" class="form-label">
            <i class="fas fa-comment"></i>
            Keterangan/Keperluan *
          </label>
          <textarea
            id="keterangan-kasbon"
            bind:value={formDataKasbon.keterangan}
            class="form-textarea"
            placeholder="Jelaskan keperluan kasbon (contoh: biaya pengobatan, renovasi rumah, dll)..."
            rows="4"
            required
          ></textarea>
          <small class="form-hint">Minimal 10 karakter</small>
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

    <!-- Riwayat Pengajuan Kasbon -->
    <div class="history-container">
      <div class="history-header">
        <h3>📋 Riwayat Pengajuan Kasbon</h3>
        <button
          class="refresh-btn"
          on:click={loadKasbonHistory}
          disabled={isLoadingHistory}
          aria-label="Muat ulang riwayat"
        >
          <i class="fas fa-sync-alt {isLoadingHistory ? 'fa-spin' : ''}"></i>
        </button>
      </div>

      {#if isLoadingHistory}
        <div class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Memuat riwayat kasbon...</p>
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
                <li>Buat collection "kasbon" di Directus</li>
                <li>Atur permissions untuk Public role</li>
                <li>Ikuti panduan di DIRECTUS_KASBON_SETUP.md</li>
              </ul>
              <small
                >💡 Fitur pengajuan kasbon tetap bisa digunakan meskipun riwayat
                belum tersedia</small
              >
            </div>
          {/if}
          <button class="retry-btn" on:click={loadKasbonHistory}>
            <i class="fas fa-redo"></i>
            Coba Lagi
          </button>
        </div>
      {:else if kasbonHistory.length === 0}
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>Belum ada pengajuan kasbon</p>
          <small>Pengajuan yang Anda buat akan muncul di sini</small>
        </div>
      {:else}
        <div class="history-list">
          {#each kasbonHistory as kasbon}
            <div class="history-item">
              <div class="history-header-row">
                <div class="history-date">
                  <i class="fas fa-calendar"></i>
                  {formatDate(kasbon.tanggal)}
                </div>
                <div
                  class="history-status"
                  style="color: {getStatusColor(kasbon.status)}"
                >
                  <i class={getStatusIcon(kasbon.status)}></i>
                  {getStatusText(kasbon.status)}
                </div>
              </div>

              <div class="history-details">
                <div class="detail-row">
                  <span class="detail-label">Nominal:</span>
                  <span class="detail-value nominal">
                    <strong>{formatRupiah(kasbon.nominal)}</strong>
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Tenor:</span>
                  <span class="detail-value">
                    <strong>{kasbon.tenor} Bulan</strong>
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Keterangan:</span>
                  <span class="detail-value">{kasbon.keterangan}</span>
                </div>
                {#if kasbon.rejection_reason}
                  <div class="detail-row">
                    <span class="detail-label">Alasan Ditolak:</span>
                    <span class="detail-value rejection-reason"
                      >{kasbon.rejection_reason}</span
                    >
                  </div>
                {/if}
                <div class="detail-row">
                  <span class="detail-label">Diajukan:</span>
                  <span class="detail-value">
                    {kasbon.tanggal_pengajuan
                      ? new Date(kasbon.tanggal_pengajuan).toLocaleDateString(
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
                  {#if kasbon.status}
                    <div
                      class="overall-status-badge {kasbon.status}"
                      style="background-color: {getStatusColor(kasbon.status)}"
                    >
                      <i class={getStatusIcon(kasbon.status)}></i>
                      {getStatusText(kasbon.status)}
                    </div>
                  {/if}
                </div>

                <div class="approval-stages">
                  {#each getKasbonApprovalStages(kasbon) as stage, index}
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
                          style="color: {getKasbonApprovalStatusColor(
                            stage.completed,
                            stage.approved
                          )}"
                        >
                          <i
                            class={getKasbonApprovalStatusIcon(
                              stage.completed,
                              stage.approved
                            )}
                          ></i>
                        </div>
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
                                  >{formatKasbonApprovalDate(stage.date)}</span
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
                {#if kasbon.final_approved_by && kasbon.final_approved_date}
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
                            >{kasbon.final_approved_by}</strong
                          ></span
                        >
                      </div>
                      <div class="final-date">
                        <i class="fas fa-calendar-check"></i>
                        <span
                          >{formatKasbonApprovalDate(
                            kasbon.final_approved_date
                          )}</span
                        >
                      </div>
                    </div>
                  </div>
                {:else if kasbon.final_rejection_reason}
                  <div class="final-rejection">
                    <div class="final-rejection-header">
                      <i class="fas fa-ban"></i>
                      <strong>Pengajuan Ditolak</strong>
                    </div>
                    <div class="final-rejection-reason">
                      <i class="fas fa-comment"></i>
                      <span>{kasbon.final_rejection_reason}</span>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Payment Progress (for approved kasbon) -->
              {#if kasbon.status === "approved" && kasbon.id && paymentProgresses.has(kasbon.id)}
                {@const progress = paymentProgresses.get(kasbon.id)}
                <div class="payment-progress-section">
                  <div class="progress-header">
                    <h4>💳 Progress Pembayaran</h4>
                    <div
                      class="payment-status-badge"
                      style="color: {getPaymentStatusColor(
                        progress.paymentStatus
                      )}"
                    >
                      <i class={getPaymentStatusIcon(progress.paymentStatus)}
                      ></i>
                      {getPaymentStatusText(progress.paymentStatus)}
                    </div>
                  </div>

                  <!-- Progress Bar -->
                  <div class="progress-bar-container">
                    <div class="progress-bar">
                      <div
                        class="progress-fill {progress.paymentStatus}"
                        style="width: {progress.progressPercentage}%"
                      ></div>
                    </div>
                    <span class="progress-percentage"
                      >{progress.progressPercentage.toFixed(1)}%</span
                    >
                  </div>

                  <!-- Payment Summary -->
                  <div class="payment-summary">
                    <div class="summary-grid">
                      <div class="summary-item">
                        <span class="summary-label">Total Kasbon:</span>
                        <span class="summary-value"
                          >{formatRupiah(progress.kasbon.nominal)}</span
                        >
                      </div>
                      <div class="summary-item">
                        <span class="summary-label">Sudah Dibayar:</span>
                        <span class="summary-value paid"
                          >{formatRupiah(progress.kasbon.total_paid || 0)}</span
                        >
                      </div>
                      <div class="summary-item">
                        <span class="summary-label">Sisa Tagihan:</span>
                        <span class="summary-value remaining"
                          >{formatRupiah(progress.remainingAmount)}</span
                        >
                      </div>
                      <div class="summary-item">
                        <span class="summary-label">Cicilan/Bulan:</span>
                        <span class="summary-value"
                          >{formatRupiah(
                            progress.kasbon.monthly_payment ||
                              progress.kasbon.nominal / progress.kasbon.tenor
                          )}</span
                        >
                      </div>
                    </div>

                    <!-- Timeline Information -->
                    <div class="payment-timeline">
                      <div class="timeline-row">
                        <div class="timeline-item">
                          <i class="fas fa-calendar-alt"></i>
                          <span>Tenor: {progress.kasbon.tenor} bulan</span>
                        </div>
                        <div class="timeline-item">
                          <i class="fas fa-clock"></i>
                          <span
                            >Bulan ke-{progress.monthsPassed} dari {progress
                              .kasbon.tenor}</span
                          >
                        </div>
                      </div>

                      {#if progress.nextPaymentDue}
                        <div class="next-payment-due">
                          <i class="fas fa-bell"></i>
                          <span>
                            <strong>Jatuh tempo berikutnya:</strong>
                            {formatDateShort(
                              progress.nextPaymentDue.toISOString()
                            )}
                            <span class="days-remaining">
                              ({getDaysUntilDue(progress.nextPaymentDue)} hari lagi)
                            </span>
                          </span>
                        </div>
                      {/if}
                    </div>

                    <!-- Recent Payments -->
                    {#if progress.payments.length > 0}
                      <div class="recent-payments">
                        <h5>📋 Pembayaran Terakhir</h5>
                        <div class="payments-list">
                          {#each progress.payments.slice(0, 2) as payment, index}
                            <div class="payment-record">
                              <div class="payment-info">
                                <div class="payment-date">
                                  <i class="fas fa-calendar"></i>
                                  {formatDateShort(payment.payment_date)}
                                  {#if index === 0}
                                    <span class="latest-badge">Terbaru</span>
                                  {/if}
                                </div>
                                <div class="payment-amount">
                                  {formatRupiah(payment.amount)}
                                </div>
                              </div>
                              <div class="payment-meta">
                                <!-- <span class="payment-method">{getPaymentMethodText(payment.payment_method)}</span> -->
                                {#if payment.notes}
                                  <span class="payment-notes"
                                    >{payment.notes}</span
                                  >
                                {/if}
                              </div>
                            </div>
                          {/each}

                          {#if progress.payments.length > 2}
                            <div class="more-payments">
                              <span
                                >+{progress.payments.length - 2} pembayaran lainnya</span
                              >
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else if progress.paymentStatus !== "not_started"}
                      <div class="no-payments">
                        <i class="fas fa-info-circle"></i>
                        <span>Belum ada riwayat pembayaran</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Action buttons for pending status -->
              {#if kasbon.status === "pending"}
                <div class="history-actions">
                  <button
                    class="edit-btn"
                    on:click={() => startEdit(kasbon)}
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
  .page-container {
    max-width: 100%;
    margin: 0 auto;
    background: linear-gradient(
      135deg,
      #0f172a 0%,
      #1e293b 25%,
      #0f172a 50%,
      #1e293b 75%,
      #0f172a 100%
    );
    background-size: 400% 400%;
    background-attachment: fixed;
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
  }

  .page-container::before {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
        circle at 20% 80%,
        rgba(6, 182, 212, 0.15) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 20%,
        rgba(59, 130, 246, 0.15) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 40% 40%,
        rgba(139, 92, 246, 0.1) 0%,
        transparent 50%
      );
    pointer-events: none;
    z-index: 0;
  }

  @media (min-width: 480px) {
    .page-container {
      max-width: 420px;
    }
  }

  /* Header */
  .header {
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    padding: 20px 24px;
    color: white;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    z-index: 10;
  }

  .back-btn {
    background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
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

  .back-btn,
  .spacer {
    width: 44px;
    height: 44px;
  }

  .back-btn {
    font-size: 18px;
  }

  .back-btn:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 16px rgba(6, 182, 212, 0.2);
  }

  .header h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    flex: 1;
  }

  .spacer {
    width: 44px;
  }

  /* Main Content */
  .main-content {
    padding: 24px;
    position: relative;
    z-index: 5;
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
      rgba(139, 92, 246, 0.5),
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
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .form-header p {
    margin: 0;
    color: #94a3b8;
    font-size: 16px;
  }

  /* Setup Warning */
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

  /* Form Styles */
  .kasbon-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
    color: #8b5cf6;
    width: 18px;
    font-size: 16px;
  }

  .form-input,
  .form-select {
    padding: 16px 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    font-size: 16px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    color: #f1f5f9;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(139, 92, 246, 0.1),
      0 0 24px rgba(139, 92, 246, 0.2);
    transform: translateY(-1px);
  }

  .form-input::placeholder {
    color: #64748b;
  }

  .currency-input {
    font-weight: 600;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
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
    border-color: rgba(139, 92, 246, 0.6);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 4px rgba(139, 92, 246, 0.1),
      0 0 24px rgba(139, 92, 246, 0.2);
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

  /* Submit Button */
  .submit-btn {
    width: 100%;
    padding: 18px 32px;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%);
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
      0 20px 25px -5px rgba(139, 92, 246, 0.4),
      0 10px 10px -5px rgba(99, 102, 241, 0.2);
    position: relative;
    overflow: hidden;
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
      0 25px 50px -12px rgba(139, 92, 246, 0.5),
      0 20px 25px -5px rgba(99, 102, 241, 0.3);
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

  /* Form Actions Layout */
  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
    margin-top: 16px;
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

  /* History Section */
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
      rgba(139, 92, 246, 0.5),
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
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .refresh-btn {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 10px 16px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #8b5cf6;
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 16px rgba(139, 92, 246, 0.2);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Loading, Error, Empty States */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #94a3b8;
  }

  .loading-state i,
  .empty-state i {
    font-size: 40px;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
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
    margin: 0 0 16px 0;
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
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 600;
  }

  .retry-btn {
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3);
  }

  .retry-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(139, 92, 246, 0.4);
  }

  .empty-state small {
    font-size: 16px;
    color: #94a3b8;
  }

  /* History List */
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
      rgba(139, 92, 246, 0.3),
      transparent
    );
  }

  .history-item:hover {
    border-color: rgba(139, 92, 246, 0.4);
    transform: translateY(-2px);
    box-shadow:
      0 12px 24px rgba(139, 92, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .history-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .history-date {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .history-date i {
    color: #8b5cf6;
    font-size: 16px;
  }

  .history-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
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
    align-items: flex-start;
    gap: 12px;
  }

  .detail-label {
    font-size: 14px;
    font-weight: 600;
    background: linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    min-width: 100px;
    flex-shrink: 0;
  }

  .detail-value {
    font-size: 14px;
    color: #f1f5f9;
    flex: 1;
    font-weight: 500;
  }

  .detail-value.nominal {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 16px;
    font-weight: 700;
  }

  .rejection-reason {
    background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
    font-weight: 600;
  }

  /* Responsive Design */
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

  /* Payment Progress Styles */
  .payment-progress-section {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 16px;
    padding: 20px;
    margin-top: 16px;
    backdrop-filter: blur(20px);
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }

  .progress-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .payment-status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(51, 65, 85, 0.6);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
    background: linear-gradient(90deg, #059669, #10b981);
  }

  .progress-fill.completed {
    background: linear-gradient(90deg, #059669, #10b981);
  }

  .progress-fill.partial {
    background: linear-gradient(90deg, #d97706, #f59e0b);
  }

  .progress-fill.overdue {
    background: linear-gradient(90deg, #dc2626, #ef4444);
  }

  .progress-percentage {
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    min-width: 45px;
    text-align: right;
  }

  .payment-summary {
    background: rgba(51, 65, 85, 0.4);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .summary-label {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 500;
  }

  .summary-value {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .summary-value.paid {
    color: #10b981;
  }

  .summary-value.remaining {
    color: #f59e0b;
  }

  .payment-timeline {
    margin-top: 16px;
  }

  .timeline-row {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .timeline-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
  }

  .timeline-item i {
    color: #8b5cf6;
    width: 16px;
    text-align: center;
  }

  .next-payment-due {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #fbbf24;
  }

  .next-payment-due i {
    color: #f59e0b;
  }

  .days-remaining {
    font-weight: 600;
    color: #fbbf24;
  }

  .recent-payments {
    margin-top: 16px;
  }

  .recent-payments h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .payments-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .payment-record {
    background: rgba(71, 85, 105, 0.3);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .payment-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .payment-date {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #94a3b8;
  }

  .payment-date i {
    color: #8b5cf6;
    width: 14px;
  }

  .latest-badge {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .payment-amount {
    font-size: 14px;
    font-weight: 600;
    color: #10b981;
  }

  .payment-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .payment-method {
    font-size: 12px;
    color: #64748b;
    background: rgba(100, 116, 139, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .payment-notes {
    font-size: 12px;
    color: #94a3b8;
    font-style: italic;
  }

  .more-payments {
    text-align: center;
    padding: 8px;
    color: #64748b;
    font-size: 12px;
    font-style: italic;
  }

  .no-payments {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: #64748b;
    font-size: 13px;
    font-style: italic;
  }

  .no-payments i {
    color: #6366f1;
  }

  /* Responsive Design for Payment Progress */
  @media (max-width: 768px) {
    .payment-progress-section {
      padding: 16px;
    }

    .progress-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .payment-status-badge {
      font-size: 11px;
      padding: 4px 10px;
    }

    .summary-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .timeline-row {
      flex-direction: column;
      gap: 8px;
    }

    .timeline-item {
      font-size: 12px;
    }

    .next-payment-due {
      font-size: 12px;
      padding: 8px 10px;
    }

    .payment-record {
      padding: 10px;
    }

    .payment-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .payment-meta {
      gap: 8px;
    }
  }
</style>
