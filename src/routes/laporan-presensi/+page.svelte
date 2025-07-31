<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { user } from "$lib/auth";
  import {
    getAbsensiHistory,
    formatKeterlambatan,
    type AbsensiKaryawan,
  } from "$lib/absensi";
  import { toast } from "$lib/toast";
  import type { Akun } from "$lib/directus";

  let currentUser: Akun | null = null;
  let absensiHistory: AbsensiKaryawan[] = [];
  let loading = true;
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let filteredData: AbsensiKaryawan[] = [];

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  onMount(() => {
    const unsubscribe = user.subscribe(async ($user) => {
      if (!$user) {
        // Clear all data when user logs out
        currentUser = null;
        absensiHistory = [];
        filteredData = [];
        loading = false;
        goto("/login");
        return;
      }

      // Reset data when new user logs in
      if (currentUser?.id !== $user.id) {
        absensiHistory = [];
        filteredData = [];
        loading = true;
      }

      currentUser = $user;
      await loadAbsensiData();
    });

    return unsubscribe;
  });

  async function loadAbsensiData() {
    try {
      loading = true;
      // Load more history for reports (last 50 records)
      absensiHistory = await getAbsensiHistory(50);
      filterByMonth();
    } catch (error) {
      console.error("Error loading absensi data:", error);
      toast.error("Gagal memuat data absensi");
    } finally {
      loading = false;
    }
  }

  function filterByMonth() {
    filteredData = absensiHistory.filter((absensi) => {
      const date = new Date(absensi.tanggal);
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    });
  }

  function handleMonthChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    currentMonth = parseInt(target.value);
    filterByMonth();
  }

  function handleYearChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    currentYear = parseInt(target.value);
    filterByMonth();
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

  function getTotalWorkingDays(): number {
    return filteredData.length;
  }

  function getCompleteDays(): number {
    return filteredData.filter(
      (absensi) => absensi.waktu_masuk && absensi.waktu_keluar
    ).length;
  }

  function getIncompleteDays(): number {
    return filteredData.filter(
      (absensi) => absensi.waktu_masuk && !absensi.waktu_keluar
    ).length;
  }

  function getTotalWorkingHours(): string {
    let totalMinutes = 0;

    filteredData.forEach((absensi) => {
      if (absensi.waktu_masuk && absensi.waktu_keluar) {
        const start = new Date(absensi.waktu_masuk);
        const end = new Date(absensi.waktu_keluar);
        const diff = end.getTime() - start.getTime();
        totalMinutes += Math.floor(diff / (1000 * 60));
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}j ${minutes}m`;
  }

  function getLateDays(): number {
    return filteredData.filter((absensi) => absensi.terlambat).length;
  }

  function getTotalLateMinutes(): number {
    return filteredData.reduce((total, absensi) => {
      return total + (absensi.menit_keterlambatan || 0);
    }, 0);
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

  function goBack() {
    goto("/");
  }

  // Generate year options (current year and 2 years back)
  $: yearOptions = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );
</script>

<svelte:head>
  <title>Laporan Presensi - Aplikasi Absensi</title>
</svelte:head>

<div class="container">
  <header class="header">
    <button
      class="back-btn"
      on:click={goBack}
      aria-label="Kembali ke dashboard"
    >
      <i class="fas fa-arrow-left"></i>
    </button>
    <div class="header-content">
      <h1>📊 Laporan Presensi</h1>
      {#if currentUser}
        <p>{currentUser.nama_lengkap || currentUser.email}</p>
      {/if}
    </div>
  </header>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Memuat laporan...</p>
    </div>
  {:else}
    <!-- Filter Section -->
    <div class="filter-section">
      <h2>Filter Periode</h2>
      <div class="filter-controls">
        <div class="filter-item">
          <label for="month">Bulan:</label>
          <select
            id="month"
            bind:value={currentMonth}
            on:change={handleMonthChange}
          >
            {#each months as month, index}
              <option value={index}>{month}</option>
            {/each}
          </select>
        </div>
        <div class="filter-item">
          <label for="year">Tahun:</label>
          <select
            id="year"
            bind:value={currentYear}
            on:change={handleYearChange}
          >
            {#each yearOptions as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Summary Statistics -->
    <div class="summary-section">
      <h2>Ringkasan {months[currentMonth]} {currentYear}</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <h3>{getTotalWorkingDays()}</h3>
            <p>Total Hari Kerja</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <h3>{getCompleteDays()}</h3>
            <p>Absensi Lengkap</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-content">
            <h3>{getIncompleteDays()}</h3>
            <p>Belum Keluar</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-content">
            <h3>{getTotalWorkingHours()}</h3>
            <p>Total Jam Kerja</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🕒</div>
          <div class="stat-content">
            <h3>{getLateDays()}</h3>
            <p>Hari Terlambat</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-content">
            <h3>
              {Math.floor(getTotalLateMinutes() / 60)}j {getTotalLateMinutes() %
                60}m
            </h3>
            <p>Total Keterlambatan</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-content">
            <h3>
              {Math.floor(getTotalLateMinutes() / 60)}j{" "}
              {getTotalLateMinutes() % 60}m
            </h3>
            <p>Total Menit Terlambat</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed History -->
    <div class="history-section">
      <h2>Detail Absensi</h2>
      {#if filteredData.length > 0}
        <div class="history-list">
          {#each filteredData as absensi}
            <div class="history-item">
              <div class="history-header">
                <div class="date-info">
                  <h3>{formatDate(absensi.tanggal)}</h3>
                  <div class="status-badges">
                    {#if absensi.waktu_masuk}
                      <span class="badge masuk">Masuk</span>
                    {/if}
                    {#if absensi.waktu_keluar}
                      <span class="badge keluar">Keluar</span>
                    {:else if absensi.waktu_masuk}
                      <span class="badge incomplete">Belum Keluar</span>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="history-details">
                {#if absensi.waktu_masuk}
                  <div class="detail-row">
                    <div class="detail-item">
                      <span class="detail-label">🟢 Waktu Masuk:</span>
                      <span class="detail-value"
                        >{formatTime(absensi.waktu_masuk)}</span
                      >
                    </div>
                    <div class="location-info">
                      <span class="location-label">📍 Lokasi:</span>
                      <span class="location-text"
                        >{getLocationDisplay(
                          absensi.lokasi,
                          absensi.lokasi_keluar
                        ).masuk}</span
                      >
                    </div>
                  </div>
                  <!-- Informasi Keterlambatan -->
                  <div class="detail-row">
                    <div class="lateness-info">
                      <span class="lateness-label">⏰ Status Kehadiran:</span>
                      <span
                        class="lateness-value"
                        class:late={absensi.terlambat}
                      >
                        {formatKeterlambatan(absensi.menit_keterlambatan || 0)}
                      </span>
                    </div>
                  </div>
                {/if}

                {#if absensi.waktu_keluar}
                  <div class="detail-row">
                    <div class="detail-item">
                      <span class="detail-label">🔴 Waktu Keluar:</span>
                      <span class="detail-value"
                        >{formatTime(absensi.waktu_keluar)}</span
                      >
                    </div>
                    <div class="location-info">
                      <span class="location-label">📍 Lokasi:</span>
                      <span class="location-text"
                        >{getLocationDisplay(
                          absensi.lokasi,
                          absensi.lokasi_keluar
                        ).keluar || "Lokasi tidak tersedia"}</span
                      >
                    </div>
                  </div>
                  <div class="duration-info">
                    <span class="duration-label">⏱️ Durasi Kerja:</span>
                    <span class="duration-value"
                      >{getWorkDuration(
                        absensi.waktu_masuk!,
                        absensi.waktu_keluar
                      )}</span
                    >
                  </div>
                {/if}

                {#if absensi.keterangan}
                  <div class="keterangan-info">
                    <span class="keterangan-label">📝 Keterangan:</span>
                    <span class="keterangan-text">{absensi.keterangan}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="no-data">
          <div class="no-data-icon">📋</div>
          <h3>Tidak Ada Data</h3>
          <p>
            Belum ada data absensi untuk periode {months[currentMonth]}
            {currentYear}
          </p>
        </div>
      {/if}
    </div>
  {/if}
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

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    background: transparent;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 32px;
    padding: 24px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
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
      rgba(59, 130, 246, 0.05) 0%,
      rgba(168, 85, 247, 0.03) 50%,
      rgba(16, 185, 129, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .back-btn {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    border: none;
    border-radius: 16px;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 20px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.3),
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
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(59, 130, 246, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .header-content h1 {
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .header-content p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 15px;
    font-weight: 500;
  }

  .loading {
    text-align: center;
    padding: 80px 40px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading p {
    color: rgba(226, 232, 240, 0.8);
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }

  .spinner {
    border: 4px solid rgba(59, 130, 246, 0.2);
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
    margin: 0 auto 24px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .filter-section,
  .summary-section,
  .history-section {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 28px;
    margin-bottom: 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .filter-section::before,
  .summary-section::before,
  .history-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.05) 0%,
      rgba(168, 85, 247, 0.03) 50%,
      rgba(16, 185, 129, 0.05) 100%
    );
    border-radius: 24px;
    z-index: -1;
  }

  .filter-section:hover,
  .summary-section:hover,
  .history-section:hover {
    transform: translateY(-2px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .filter-section h2,
  .summary-section h2,
  .history-section h2 {
    margin: 0 0 24px 0;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .filter-controls {
    display: flex;
    gap: 20px;
  }

  .filter-item {
    flex: 1;
  }

  .filter-item label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
    font-size: 14px;
    letter-spacing: 0.5px;
  }

  .filter-item select {
    width: 100%;
    padding: 16px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    font-size: 15px;
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px);
    color: #f1f5f9;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .filter-item select:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 4px rgba(59, 130, 246, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(30, 41, 59, 0.9);
  }

  .filter-item select:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(30, 41, 59, 0.9);
  }

  .filter-item select option {
    background: #1e293b;
    color: #f1f5f9;
    padding: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
  }

  .stat-card {
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(20px) saturate(150%);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.2),
      0 8px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stat-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(168, 85, 247, 0.05) 50%,
      rgba(16, 185, 129, 0.1) 100%
    );
    border-radius: 20px;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .stat-card:hover::before {
    opacity: 1;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .stat-icon {
    font-size: 36px;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.3));
  }

  .stat-content h3 {
    margin: 0 0 6px 0;
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .stat-content p {
    margin: 0;
    font-size: 13px;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
      rgba(59, 130, 246, 0.05) 0%,
      rgba(168, 85, 247, 0.03) 50%,
      rgba(16, 185, 129, 0.05) 100%
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
    border-color: rgba(255, 255, 255, 0.2);
  }

  .history-header {
    margin-bottom: 20px;
  }

  .date-info h3 {
    margin: 0 0 12px 0;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .status-badges {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .badge {
    padding: 6px 14px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  }

  .badge.masuk {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.2) 0%,
      rgba(16, 185, 129, 0.3) 100%
    );
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .badge.keluar {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2) 0%,
      rgba(220, 38, 38, 0.3) 100%
    );
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .badge.incomplete {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.2) 0%,
      rgba(217, 119, 6, 0.3) 100%
    );
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  .history-details {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-row {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(10px);
    padding: 16px 20px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
  }

  .detail-row:hover {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .detail-label {
    font-size: 14px;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 500;
  }

  .detail-value {
    font-size: 14px;
    color: #f1f5f9;
    font-weight: 600;
  }

  .location-info,
  .duration-info,
  .keterangan-info,
  .lateness-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .location-label,
  .duration-label,
  .keterangan-label,
  .lateness-label {
    font-size: 13px;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 500;
    white-space: nowrap;
  }

  .location-text,
  .duration-value,
  .keterangan-text,
  .lateness-value {
    font-size: 13px;
    color: #f1f5f9;
    text-align: right;
    flex: 1;
    font-weight: 500;
  }

  .lateness-value {
    font-weight: 600;
    color: #22c55e;
    text-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }

  .lateness-value.late {
    color: #ef4444;
    text-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }

  .no-data {
    text-align: center;
    padding: 80px 40px;
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

  .no-data::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.03) 0%,
      rgba(168, 85, 247, 0.02) 50%,
      rgba(16, 185, 129, 0.03) 100%
    );
    border-radius: 20px;
    z-index: -1;
  }

  .no-data-icon {
    font-size: 80px;
    margin-bottom: 24px;
    opacity: 0.6;
    filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.2));
  }

  .no-data h3 {
    margin: 0 0 12px 0;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .no-data p {
    margin: 0;
    color: rgba(226, 232, 240, 0.6);
    font-size: 15px;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .container {
      padding: 16px;
    }

    .header {
      padding: 20px;
      margin-bottom: 24px;
    }

    .header-content h1 {
      font-size: 24px;
    }

    .back-btn {
      width: 48px;
      height: 48px;
      font-size: 18px;
    }

    .filter-section,
    .summary-section,
    .history-section {
      padding: 24px 20px;
      margin-bottom: 20px;
    }

    .filter-controls {
      flex-direction: column;
      gap: 16px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .stat-card {
      padding: 20px;
    }

    .stat-icon {
      font-size: 32px;
    }

    .stat-content h3 {
      font-size: 20px;
    }

    .history-item {
      padding: 20px;
    }

    .detail-item,
    .location-info,
    .duration-info,
    .keterangan-info,
    .lateness-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .location-text,
    .duration-value,
    .keterangan-text {
      text-align: left;
    }

    .no-data {
      padding: 60px 24px;
    }

    .no-data-icon {
      font-size: 64px;
    }

    .no-data h3 {
      font-size: 20px;
    }
  }

  @media (max-width: 480px) {
    .container {
      padding: 12px;
    }

    .header {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }

    .back-btn {
      align-self: flex-start;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .stat-card {
      flex-direction: column;
      text-align: center;
      padding: 20px 16px;
    }

    .detail-row {
      padding: 16px;
    }
  }
</style>
