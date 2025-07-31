<!-- src/lib/LemburAbsensiMandiri.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { user } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import LemburAbsensiButton from "$lib/LemburAbsensiButton.svelte";
  import LemburAbsensiData from "$lib/LemburAbsensiData.svelte";
  import {
    getAbsensiLemburMandiri,
    canAbsensiMasuk,
    canAbsensiKeluar,
    type AbsensiLembur,
  } from "$lib/absensi-lembur";
  import type { Akun } from "$lib/directus";

  let currentUser: Akun | null = null;
  let currentAbsensiLembur: AbsensiLembur | null = null;
  let isLoadingAbsensi = false;
  let canAbsensiMasukLembur = false;
  let canAbsensiKeluarLembur = false;

  // Subscribe to user store
  user.subscribe((value) => {
    currentUser = value;
  });

  onMount(() => {
    if (currentUser) {
      loadAbsensiLemburMandiri();
    }
  });

  async function loadAbsensiLemburMandiri() {
    if (!currentUser) return;

    isLoadingAbsensi = true;
    try {
      currentAbsensiLembur = await getAbsensiLemburMandiri();

      // Update state untuk tombol absensi
      canAbsensiMasukLembur = canAbsensiMasuk(currentAbsensiLembur);
      canAbsensiKeluarLembur = canAbsensiKeluar(currentAbsensiLembur);
    } catch (error) {
      console.error("Error loading absensi lembur mandiri:", error);
      showToast("Gagal memuat data absensi lembur mandiri", "error");
    } finally {
      isLoadingAbsensi = false;
    }
  }

  function handleLemburAbsensiSuccess(event: CustomEvent) {
    const { type } = event.detail;
    showToast(`Absensi ${type} lembur berhasil!`, "success");

    // Reload data absensi
    loadAbsensiLemburMandiri();
  }

  function formatTime(timeString?: string): string {
    if (!timeString) return "-";
    return timeString.substring(0, 5); // HH:MM
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
</script>

<div class="lembur-absensi-mandiri">
  <div class="section-header">
    <h3>📸 Absensi Lembur Mandiri</h3>
    <p>Lakukan absensi lembur langsung tanpa pengajuan terlebih dahulu</p>
  </div>

  {#if isLoadingAbsensi}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Memuat data absensi...</span>
    </div>
  {:else}
    <div class="absensi-content">
      <!-- Status Absensi Hari Ini -->
      <div class="absensi-status">
        <h4>📅 Status Absensi Hari Ini</h4>
        <div class="status-info">
          <div class="date-info">
            <span class="date">{formatDate(new Date().toISOString())}</span>
          </div>

          {#if currentAbsensiLembur}
            <div class="status-details">
              <div class="status-item">
                <span class="label">Waktu Masuk:</span>
                <span class="value"
                  >{formatTime(currentAbsensiLembur.waktu_masuk)}</span
                >
              </div>
              <div class="status-item">
                <span class="label">Waktu Keluar:</span>
                <span class="value"
                  >{formatTime(currentAbsensiLembur.waktu_keluar)}</span
                >
              </div>
              <div class="status-item">
                <span class="label">Status:</span>
                <span
                  class="value status-{currentAbsensiLembur.status_absensi}"
                >
                  {#if currentAbsensiLembur.status_absensi === "belum_mulai"}
                    Belum Mulai
                  {:else if currentAbsensiLembur.status_absensi === "sedang_lembur"}
                    Sedang Lembur
                  {:else if currentAbsensiLembur.status_absensi === "selesai"}
                    Selesai
                  {/if}
                </span>
              </div>
              {#if currentAbsensiLembur.durasi_aktual_jam !== undefined && currentAbsensiLembur.durasi_aktual_menit !== undefined}
                <div class="status-item">
                  <span class="label">Durasi:</span>
                  <span class="value"
                    >{currentAbsensiLembur.durasi_aktual_jam} jam {currentAbsensiLembur.durasi_aktual_menit}
                    menit</span
                  >
                </div>
              {/if}
            </div>
          {:else}
            <div class="no-absensi">
              <p>Belum ada absensi lembur hari ini</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Tombol Absensi -->
      <div class="absensi-actions">
        {#if canAbsensiMasukLembur}
          <LemburAbsensiButton
            type="masuk"
            lemburId="mandiri"
            isMandiri={true}
            loading={isLoadingAbsensi}
            on:success={handleLemburAbsensiSuccess}
          />
        {:else if canAbsensiKeluarLembur}
          <LemburAbsensiButton
            type="keluar"
            lemburId="mandiri"
            isMandiri={true}
            loading={isLoadingAbsensi}
            on:success={handleLemburAbsensiSuccess}
          />
        {:else if currentAbsensiLembur && currentAbsensiLembur.is_completed}
          <div class="absensi-completed">
            <div class="completed-icon">✅</div>
            <span>Absensi Lembur Hari Ini Sudah Selesai</span>
          </div>
        {:else}
          <div class="absensi-info">
            <i class="fas fa-info-circle"></i>
            <span>Silakan mulai absensi lembur</span>
          </div>
        {/if}
      </div>

      <!-- Preview Data Absensi -->
      {#if currentAbsensiLembur}
        <div class="absensi-preview">
          <h4>📋 Detail Absensi</h4>
          <LemburAbsensiData absensi={currentAbsensiLembur} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ===== DISABLE ALL ANIMATIONS & TRANSITIONS ===== */
  * {
    animation: none !important;
    transition: none !important;
  }

  /* Remove hover effects */
  button:hover,
  .btn:hover {
    transform: none !important;
    transition: none !important;
  }

  /* Remove all keyframes */
  @keyframes spin {
  }
  /* ================================================= */

  .lembur-absensi-mandiri {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }

  .section-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .section-header h3 {
    margin: 0 0 8px;
    color: #1a365d;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .section-header p {
    margin: 0;
    color: #4a5568;
    font-size: 0.95rem;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: #4a5568;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #3182ce;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .absensi-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .absensi-status {
    background: #f7fafc;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e2e8f0;
  }

  .absensi-status h4 {
    margin: 0 0 16px;
    color: #2d3748;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .date-info {
    text-align: center;
    margin-bottom: 16px;
  }

  .date {
    font-size: 1.1rem;
    font-weight: 600;
    color: #2d3748;
  }

  .status-details {
    display: grid;
    gap: 12px;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-item .label {
    font-weight: 500;
    color: #4a5568;
  }

  .status-item .value {
    font-weight: 600;
    color: #2d3748;
  }

  .value.status-belum_mulai {
    color: #718096;
  }

  .value.status-sedang_lembur {
    color: #d69e2e;
  }

  .value.status-selesai {
    color: #38a169;
  }

  .no-absensi {
    text-align: center;
    padding: 20px;
    color: #718096;
  }

  .absensi-actions {
    display: flex;
    justify-content: center;
    padding: 20px;
  }

  .absensi-completed {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    background: #f0fff4;
    border: 2px solid #9ae6b4;
    border-radius: 8px;
    color: #38a169;
    font-weight: 600;
  }

  .completed-icon {
    font-size: 1.5rem;
  }

  .absensi-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    background: #edf2f7;
    border-radius: 8px;
    color: #4a5568;
    font-weight: 500;
  }

  .absensi-preview {
    background: #f7fafc;
    border-radius: 8px;
    padding: 20px;
    border: 1px solid #e2e8f0;
  }

  .absensi-preview h4 {
    margin: 0 0 16px;
    color: #2d3748;
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .lembur-absensi-mandiri {
      padding: 16px;
      margin-bottom: 16px;
    }

    .section-header h3 {
      font-size: 1.3rem;
    }

    .absensi-content {
      gap: 16px;
    }

    .status-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
