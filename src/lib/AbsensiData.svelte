<script lang="ts">
  import { onMount } from "svelte";
  import {
    getTodayAbsensi,
    getAbsensiHistory,
    type AbsensiKaryawan,
  } from "$lib/absensi";
  import { directus, initDirectus } from "$lib/directus";

  export let refreshTrigger = 0; // External trigger to refresh data

  let todayAbsensi: AbsensiKaryawan | null = null;
  let absensiHistory: AbsensiKaryawan[] = [];
  let loading = true;
  let error = "";

  onMount(() => {
    loadAbsensiData();
  });

  // Refresh data when trigger changes
  $: if (refreshTrigger > 0) {
    loadAbsensiData();
  }

  async function loadAbsensiData() {
    try {
      loading = true;
      error = "";

      const [today, history] = await Promise.all([
        getTodayAbsensi(),
        getAbsensiHistory(10),
      ]);

      todayAbsensi = today;
      absensiHistory = history;
    } catch (err) {
      console.error("Error loading absensi data:", err);
      error = "Gagal memuat data absensi";
    } finally {
      loading = false;
    }
  }

  function formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getWorkDuration(masuk: string, keluar: string): string {
    const start = new Date(masuk);
    const end = new Date(keluar);
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}j ${minutes}m`;
  }

  function getLocationDisplay(
    lokasiMasuk: string | undefined,
    lokasiKeluar: string | undefined
  ): {
    masuk: string;
    keluar?: string;
  } {
    const masuk = parseLocationAddress(lokasiMasuk) || "Tidak ada data lokasi";
    const keluar = parseLocationAddress(lokasiKeluar);

    return { masuk, keluar };
  }

  function parseLocationAddress(
    locationData: string | undefined
  ): string | undefined {
    if (!locationData) return undefined;

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(locationData);
      if (parsed && typeof parsed === "object" && parsed.address) {
        return parsed.address;
      }
    } catch (e) {
      // If not JSON, return the string as is (might be plain address text)
      return locationData;
    }

    // If JSON but no address field, return undefined
    return undefined;
  }

  function getPhotoUrl(photoId: string): string {
    if (!photoId) return "";
    // Get Directus public URL for photos from environment variable
    const baseUrl = import.meta.env.VITE_DIRECTUS_URL;
    return `${baseUrl}/assets/${photoId}`;
  }
</script>

<div class="absensi-data">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Memuat data absensi...</p>
    </div>
  {:else if error}
    <div class="error">
      ⚠️ {error}
      <button on:click={loadAbsensiData}>Coba Lagi</button>
    </div>
  {:else}
    <!-- Today's Status -->
    <div class="today-status">
      <h2>📊 Status Hari Ini</h2>
      <div class="today-card">
        {#if todayAbsensi}
          <div class="status-complete">
            <!-- Absensi Masuk -->
            {#if todayAbsensi.waktu_masuk}
              <div class="status-item masuk">
                <div class="status-icon">🟢</div>
                <div class="status-info">
                  <h3>Masuk</h3>
                  <p class="time">{formatTime(todayAbsensi.waktu_masuk)}</p>
                  <p class="location">
                    📍 {getLocationDisplay(
                      todayAbsensi.lokasi,
                      todayAbsensi.lokasi_keluar
                    ).masuk}
                  </p>
                  {#if todayAbsensi.foto}
                    <div class="foto-container">
                      <img
                        src={getPhotoUrl(todayAbsensi.foto)}
                        alt="Foto Absensi Masuk"
                        class="foto-absensi"
                      />
                      <span class="foto-label">Foto Masuk</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Absensi Keluar -->
            {#if todayAbsensi.waktu_keluar}
              <div class="status-item keluar">
                <div class="status-icon">🔴</div>
                <div class="status-info">
                  <h3>Keluar</h3>
                  <p class="time">{formatTime(todayAbsensi.waktu_keluar)}</p>
                  <p class="location">
                    📍 {getLocationDisplay(
                      todayAbsensi.lokasi,
                      todayAbsensi.lokasi_keluar
                    ).keluar || "Lokasi tidak tersedia"}
                  </p>
                  {#if todayAbsensi.foto_keluar}
                    <div class="foto-container">
                      <img
                        src={getPhotoUrl(todayAbsensi.foto_keluar)}
                        alt="Foto Absensi Keluar"
                        class="foto-absensi"
                      />
                      <span class="foto-label">Foto Keluar</span>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Work Duration -->
              <div class="work-duration">
                <span class="duration-icon">⏰</span>
                <span class="duration-text">
                  Durasi Kerja: {getWorkDuration(
                    todayAbsensi.waktu_masuk!,
                    todayAbsensi.waktu_keluar
                  )}
                </span>
              </div>
            {:else if todayAbsensi.waktu_masuk}
              <div class="status-item pending">
                <div class="status-icon">⏱️</div>
                <div class="status-info">
                  <h3>Menunggu Absensi Keluar</h3>
                  <p class="note">Jangan lupa absensi keluar</p>
                </div>
              </div>
            {/if}

            {#if todayAbsensi.keterangan}
              <div class="keterangan">
                <strong>Keterangan:</strong>
                {todayAbsensi.keterangan}
              </div>
            {/if}
          </div>
        {:else}
          <div class="status-empty">
            <div class="empty-icon">📝</div>
            <h3>Belum Ada Absensi Hari Ini</h3>
            <p>Silakan lakukan absensi masuk untuk memulai</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- History -->
    {#if absensiHistory.length > 0}
      <div class="history-section">
        <h2>📅 Riwayat Absensi</h2>
        <div class="history-list">
          {#each absensiHistory as absensi, index}
            <div
              class="history-item"
              class:today={index === 0 &&
                todayAbsensi &&
                absensi.id === todayAbsensi.id}
            >
              <div class="history-header">
                <div class="date">
                  <span class="day">{formatDate(absensi.tanggal)}</span>
                  {#if index === 0 && todayAbsensi && absensi.id === todayAbsensi.id}
                    <span class="today-badge">Hari Ini</span>
                  {/if}
                </div>
                <div class="status-badges">
                  {#if absensi.waktu_masuk}
                    <span class="badge masuk">Masuk</span>
                  {/if}
                  {#if absensi.waktu_keluar}
                    <span class="badge keluar">Keluar</span>
                  {:else if absensi.waktu_masuk}
                    <span class="badge pending">Belum Keluar</span>
                  {/if}
                </div>
              </div>

              <div class="history-details">
                {#if absensi.waktu_masuk}
                  <div class="detail-item">
                    <span class="detail-label">🟢 Masuk:</span>
                    <span class="detail-value"
                      >{formatTime(absensi.waktu_masuk)}</span
                    >
                  </div>
                  {#if absensi.lokasi}
                    <div class="detail-item">
                      <span class="detail-label">📍 Lokasi Masuk:</span>
                      <span class="detail-value"
                        >{parseLocationAddress(absensi.lokasi) ||
                          absensi.lokasi}</span
                      >
                    </div>
                  {/if}
                {/if}

                {#if absensi.waktu_keluar}
                  <div class="detail-item">
                    <span class="detail-label">🔴 Keluar:</span>
                    <span class="detail-value"
                      >{formatTime(absensi.waktu_keluar)}</span
                    >
                  </div>
                  {#if absensi.lokasi_keluar}
                    <div class="detail-item">
                      <span class="detail-label">📍 Lokasi Keluar:</span>
                      <span class="detail-value"
                        >{parseLocationAddress(absensi.lokasi_keluar) ||
                          absensi.lokasi_keluar}</span
                      >
                    </div>
                  {/if}
                  <div class="detail-item">
                    <span class="detail-label">⏰ Durasi:</span>
                    <span class="detail-value"
                      >{getWorkDuration(
                        absensi.waktu_masuk!,
                        absensi.waktu_keluar
                      )}</span
                    >
                  </div>
                {/if}

                {#if absensi.keterangan}
                  <div class="detail-item">
                    <span class="detail-label">📝 Keterangan:</span>
                    <span class="detail-value">{absensi.keterangan}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="no-history">
        <p>📋 Belum ada riwayat absensi</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .absensi-data {
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    margin: 0 24px;
  }

  .loading {
    text-align: center;
    padding: 40px 20px;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f1f5f9;
  }

  .spinner {
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 20px;
    border-radius: 20px;
    text-align: center;
    margin-bottom: 20px;
    backdrop-filter: blur(20px) saturate(180%);
  }

  .error button {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 12px;
    cursor: pointer;
    margin-top: 12px;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .error button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
  }

  .today-status {
    margin-bottom: 32px;
  }

  .today-status h2 {
    color: #f1f5f9;
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .today-card {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    padding: 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-complete {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .status-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }

  .status-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
  }

  .status-item.masuk {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .status-item.masuk::before {
    background: linear-gradient(180deg, #10b981 0%, #059669 100%);
  }

  .status-item.keluar {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .status-item.keluar::before {
    background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  }

  .status-item.pending {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .status-item.pending::before {
    background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
  }

  .status-icon {
    font-size: 28px;
    line-height: 1;
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
  }

  .status-info h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .time {
    font-size: 20px;
    font-weight: 700;
    color: #60a5fa;
    margin-bottom: 8px;
  }

  .location {
    font-size: 14px;
    color: #94a3b8;
    font-weight: 400;
    line-height: 1.4;
  }

  .work-duration {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 16px;
    border: 1px solid rgba(59, 130, 246, 0.2);
    margin-top: 8px;
  }

  .duration-icon {
    font-size: 24px;
    filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.5));
  }

  .duration-text {
    font-weight: 600;
    color: #60a5fa;
    font-size: 16px;
  }

  .keterangan {
    background: rgba(71, 85, 105, 0.3);
    border: 1px solid rgba(71, 85, 105, 0.5);
    border-radius: 16px;
    padding: 16px;
    font-size: 14px;
    color: #cbd5e1;
    line-height: 1.5;
  }

  .keterangan strong {
    color: #f1f5f9;
  }

  .foto-container {
    margin-top: 16px;
    text-align: center;
  }

  .foto-absensi {
    width: 100px;
    height: 100px;
    border-radius: 16px;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .foto-absensi:hover {
    transform: scale(1.1);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    border-color: rgba(96, 165, 250, 0.5);
  }

  .foto-label {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .status-empty {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 20px rgba(148, 163, 184, 0.3));
  }

  .status-empty h3 {
    margin: 0 0 12px 0;
    color: #f1f5f9;
    font-size: 18px;
    font-weight: 600;
  }

  .status-empty p {
    font-size: 14px;
    opacity: 0.8;
  }

  .history-section {
    margin-bottom: 24px;
  }

  .history-section h2 {
    color: #f1f5f9;
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .history-item {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 20px;
    padding: 20px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .history-item:hover {
    transform: translateY(-2px);
    box-shadow:
      0 16px 48px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .history-item.today {
    border-left: 4px solid #60a5fa;
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .date {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .day {
    font-weight: 600;
    color: #f1f5f9;
    font-size: 16px;
  }

  .today-badge {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .status-badges {
    display: flex;
    gap: 8px;
  }

  .badge {
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid;
  }

  .badge.masuk {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .badge.keluar {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .badge.pending {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .history-details {
    display: grid;
    gap: 12px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-size: 14px;
    color: #94a3b8;
    font-weight: 500;
  }

  .detail-value {
    font-size: 14px;
    color: #f1f5f9;
    font-weight: 600;
  }

  .no-history {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 480px) {
    .absensi-data {
      margin: 0 16px;
    }

    .today-card,
    .history-item {
      padding: 16px;
    }

    .status-item {
      padding: 16px;
      gap: 12px;
    }

    .history-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .detail-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .work-duration {
      flex-direction: column;
      text-align: center;
      gap: 8px;
    }

    .foto-absensi {
      width: 80px;
      height: 80px;
    }
  }
</style>
