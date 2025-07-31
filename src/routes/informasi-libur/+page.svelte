<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { user } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import {
    getHolidays,
    getHolidaysForYear,
    getUpcomingHolidays,
    type Holiday,
  } from "$lib/directus";
  import type { Akun } from "$lib/directus";

  let currentUser: Akun | null = null;
  let allHolidays: Holiday[] = [];
  let upcomingHolidays: Holiday[] = [];
  let currentYearHolidays: Holiday[] = [];
  let isLoading = true;
  let hasError = false;
  let errorMessage = "";
  let selectedYear = new Date().getFullYear();
  let availableYears: number[] = [];
  let filterType: "all" | "upcoming" | "year" = "upcoming";

  onMount(() => {
    const unsubscribe = user.subscribe(async ($user) => {
      if (!$user) {
        goto("/login");
        return;
      }

      currentUser = $user;
      await loadHolidayData();
    });

    return unsubscribe;
  });

  async function loadHolidayData() {
    try {
      isLoading = true;
      hasError = false;
      errorMessage = "";

      // Load all holidays to get available years
      allHolidays = await getHolidays();

      // Get upcoming holidays
      upcomingHolidays = await getUpcomingHolidays();

      // Get current year holidays
      currentYearHolidays = await getHolidaysForYear(selectedYear);

      // Extract available years from all holidays
      availableYears = [...new Set(allHolidays.map((h) => h.year))].sort(
        (a, b) => b - a
      );

      console.log("Holiday data loaded:", {
        allHolidays: allHolidays.length,
        upcomingHolidays: upcomingHolidays.length,
        currentYearHolidays: currentYearHolidays.length,
        availableYears,
      });
    } catch (error) {
      console.error("Error loading holiday data:", error);
      hasError = true;
      errorMessage =
        error instanceof Error ? error.message : "Gagal memuat data libur";

      // Check if this is a setup issue
      if (
        errorMessage.includes("Collection") ||
        errorMessage.includes("Akses ditolak")
      ) {
        errorMessage = "Collection 'holidays' belum dikonfigurasi di Directus";
      }
    } finally {
      isLoading = false;
    }
  }

  async function handleYearChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedYear = parseInt(target.value);

    try {
      currentYearHolidays = await getHolidaysForYear(selectedYear);
    } catch (error) {
      console.error("Error loading holidays for year:", error);
      showToast("Gagal memuat data libur untuk tahun tersebut", "error");
    }
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

  function formatDateShort(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case "public":
        return "#ef4444"; // Red
      case "special":
        return "#10b981"; // Green
      case "company":
        return "#3b82f6"; // Blue
      default:
        return "#6b7280"; // Gray
    }
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case "public":
        return "Hari Libur Nasional";
      case "special":
        return "Libur Khusus";
      case "company":
        return "Libur Perusahaan";
      default:
        return "Lainnya";
    }
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case "national":
        return "fas fa-flag";
      case "religious":
        return "fas fa-mosque";
      case "company":
        return "fas fa-building";
      default:
        return "fas fa-calendar";
    }
  }

  function isUpcoming(dateString: string): boolean {
    const today = new Date();
    const holidayDate = new Date(dateString);
    return holidayDate >= today;
  }

  function getDisplayedHolidays(): Holiday[] {
    switch (filterType) {
      case "upcoming":
        return upcomingHolidays;
      case "year":
        return currentYearHolidays;
      case "all":
      default:
        return allHolidays;
    }
  }

  function goBack() {
    goto("/");
  }

  function getNextHoliday(): Holiday | null {
    const today = new Date();
    const upcoming = allHolidays.filter((h) => new Date(h.date) >= today);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  function getDaysUntilHoliday(dateString: string): number {
    const today = new Date();
    const holidayDate = new Date(dateString);
    const diffTime = holidayDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
</script>

<svelte:head>
  <title>Informasi Libur - Aplikasi Absensi</title>
</svelte:head>

<div class="page-container">
  <!-- Header -->
  <header class="header">
    <button class="back-btn" on:click={goBack} aria-label="Kembali">
      <i class="fas fa-arrow-left"></i>
    </button>
    <h1>🏖️ Informasi Libur</h1>
    <div class="spacer"></div>
  </header>

  {#if isLoading}
    <div class="loading-container">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Memuat informasi libur...</p>
      </div>
    </div>
  {:else if hasError}
    <div class="error-container">
      <div class="error-card">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Tidak Dapat Memuat Data</h3>
        <p>{errorMessage}</p>
        {#if errorMessage.includes("Collection")}
          <div class="setup-info">
            <h4>📋 Setup yang Diperlukan:</h4>
            <ul>
              <li>Buat collection "holidays" di Directus</li>
              <li>Atur permissions untuk Public role</li>
              <li>Tambahkan field sesuai struktur data</li>
            </ul>
          </div>
        {/if}
        <button class="retry-btn" on:click={loadHolidayData}>
          <i class="fas fa-redo"></i>
          Coba Lagi
        </button>
      </div>
    </div>
  {:else}
    <main class="main-content">
      <!-- Quick Info Card -->
      {#if getNextHoliday()}
        <div class="next-holiday-card">
          <div class="card-header">
            <h2>🎉 Libur Berikutnya</h2>
          </div>
          <div class="card-content">
            <h3>{getNextHoliday()?.name}</h3>
            <p class="date">{formatDate(getNextHoliday()?.date || "")}</p>
            <div class="countdown">
              <span class="days"
                >{getDaysUntilHoliday(getNextHoliday()?.date || "")}</span
              >
              <span class="label">hari lagi</span>
            </div>
            <div
              class="type-badge"
              style="background-color: {getTypeColor(
                getNextHoliday()?.type || ''
              )};"
            >
              <i class={getTypeIcon(getNextHoliday()?.type || "")}></i>
              {getTypeLabel(getNextHoliday()?.type || "")}
            </div>
          </div>
        </div>
      {/if}

      <!-- Filter Section -->
      <div class="filter-section">
        <div class="filter-tabs">
          <button
            class="filter-tab {filterType === 'upcoming' ? 'active' : ''}"
            on:click={() => (filterType = "upcoming")}
          >
            <i class="fas fa-clock"></i>
            Mendatang
          </button>
          <button
            class="filter-tab {filterType === 'year' ? 'active' : ''}"
            on:click={() => (filterType = "year")}
          >
            <i class="fas fa-calendar-year"></i>
            Per Tahun
          </button>
          <button
            class="filter-tab {filterType === 'all' ? 'active' : ''}"
            on:click={() => (filterType = "all")}
          >
            <i class="fas fa-list"></i>
            Semua
          </button>
        </div>

        {#if filterType === "year"}
          <div class="year-selector">
            <label for="year-select">Tahun:</label>
            <select
              id="year-select"
              bind:value={selectedYear}
              on:change={handleYearChange}
            >
              {#each availableYears as year}
                <option value={year}>{year}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <!-- Holiday List -->
      <div class="holiday-list">
        {#if getDisplayedHolidays().length === 0}
          <div class="empty-state">
            <i class="fas fa-calendar-times"></i>
            <h3>Tidak Ada Data Libur</h3>
            <p>
              {#if filterType === "upcoming"}
                Belum ada libur yang akan datang dalam 30 hari ke depan
              {:else if filterType === "year"}
                Belum ada data libur untuk tahun {selectedYear}
              {:else}
                Belum ada data libur yang tersedia
              {/if}
            </p>
          </div>
        {:else}
          {#each getDisplayedHolidays() as holiday}
            <div
              class="holiday-card {isUpcoming(holiday.date)
                ? 'upcoming'
                : 'past'}"
            >
              <div class="holiday-header">
                <div class="holiday-date">
                  <span class="day">{new Date(holiday.date).getDate()}</span>
                  <span class="month"
                    >{new Date(holiday.date).toLocaleDateString("id-ID", {
                      month: "short",
                    })}</span
                  >
                </div>
                <div class="holiday-info">
                  <h3 class="holiday-name">{holiday.name}</h3>
                  <p class="holiday-full-date">
                    {formatDateShort(holiday.date)}
                  </p>
                  <div
                    class="holiday-type"
                    style="color: {getTypeColor(holiday.type)};"
                  >
                    <i class={getTypeIcon(holiday.type)}></i>
                    {getTypeLabel(holiday.type)}
                  </div>
                </div>
                {#if isUpcoming(holiday.date)}
                  <div class="countdown-badge">
                    <span class="countdown-number"
                      >{getDaysUntilHoliday(holiday.date)}</span
                    >
                    <span class="countdown-text">hari</span>
                  </div>
                {/if}
              </div>

              {#if holiday.description}
                <div class="holiday-description">
                  <p>{holiday.description}</p>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </main>
  {/if}
</div>

<style>
  .page-container {
    min-height: 100vh;
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
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  @keyframes gradientMove {
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
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(71, 85, 105, 0.3);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .back-btn {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
    border-radius: 12px;
    padding: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: rgba(59, 130, 246, 0.3);
    transform: translateY(-2px);
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f1f5f9;
    flex: 1;
  }

  .spacer {
    width: 40px;
  }

  /* Loading */
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  .loading-spinner {
    text-align: center;
    color: #94a3b8;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(148, 163, 184, 0.3);
    border-top: 4px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Error */
  .error-container {
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  .error-card {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    max-width: 400px;
    backdrop-filter: blur(20px);
  }

  .error-card i {
    font-size: 3rem;
    color: #ef4444;
    margin-bottom: 16px;
  }

  .error-card h3 {
    margin: 0 0 12px 0;
    font-size: 1.25rem;
    color: #f1f5f9;
  }

  .setup-info {
    margin: 16px 0;
    padding: 16px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .setup-info h4 {
    margin: 0 0 8px 0;
    color: #60a5fa;
  }

  .setup-info ul {
    text-align: left;
    margin: 8px 0;
    padding-left: 16px;
  }

  .setup-info li {
    margin: 4px 0;
    color: #cbd5e1;
  }

  .retry-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    border: none;
    color: white;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px auto 0;
  }

  .retry-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
  }

  /* Main Content */
  .main-content {
    padding: 20px;
  }

  /* Next Holiday Card */
  .next-holiday-card {
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.2),
      rgba(5, 150, 105, 0.2)
    );
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 24px;
    backdrop-filter: blur(20px);
  }

  .card-header h2 {
    margin: 0 0 16px 0;
    color: #10b981;
    font-size: 1.25rem;
  }

  .card-content h3 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    color: #f1f5f9;
  }

  .card-content .date {
    color: #cbd5e1;
    margin: 0 0 16px 0;
  }

  .countdown {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 16px;
  }

  .countdown .days {
    font-size: 2rem;
    font-weight: 700;
    color: #10b981;
  }

  .countdown .label {
    color: #94a3b8;
  }

  .type-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
  }

  /* Filter Section */
  .filter-section {
    margin-bottom: 24px;
  }

  .filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .filter-tab {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(71, 85, 105, 0.3);
    color: #cbd5e1;
    border-radius: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .filter-tab:hover {
    background: rgba(15, 23, 42, 0.8);
    transform: translateY(-1px);
  }

  .filter-tab.active {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border-color: #3b82f6;
  }

  .year-selector {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .year-selector label {
    color: #cbd5e1;
    font-weight: 500;
  }

  .year-selector select {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.3);
    color: #f1f5f9;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.875rem;
  }

  /* Holiday List */
  .holiday-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }

  .empty-state i {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
  }

  .holiday-card {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(71, 85, 105, 0.3);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(20px);
    transition: all 0.3s ease;
  }

  .holiday-card.upcoming {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.05);
  }

  .holiday-card.past {
    opacity: 0.7;
  }

  .holiday-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .holiday-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .holiday-date {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    min-width: 60px;
  }

  .holiday-date .day {
    font-size: 1.5rem;
    font-weight: 700;
    color: #60a5fa;
    line-height: 1;
  }

  .holiday-date .month {
    font-size: 0.75rem;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 500;
  }

  .holiday-info {
    flex: 1;
  }

  .holiday-name {
    margin: 0 0 4px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .holiday-full-date {
    margin: 0 0 8px 0;
    color: #94a3b8;
    font-size: 0.875rem;
  }

  .holiday-type {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .countdown-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 8px 12px;
    min-width: 60px;
  }

  .countdown-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: #10b981;
    line-height: 1;
  }

  .countdown-text {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 500;
  }

  .holiday-description {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
  }

  .holiday-description p {
    margin: 0;
    color: #cbd5e1;
    line-height: 1.5;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .filter-tabs {
      flex-wrap: wrap;
    }

    .holiday-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .holiday-date {
      align-self: flex-start;
    }

    .countdown-badge {
      align-self: flex-start;
    }
  }
</style>
