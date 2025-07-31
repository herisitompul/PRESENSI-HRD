<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { user as userStore } from "$lib/auth";
  import { type Akun } from "$lib/directus";
  import { getTodayAbsensi, type AbsensiKaryawan } from "$lib/absensi";
  import { toast } from "$lib/toast";
  import AbsensiButton from "$lib/AbsensiButton.svelte";
  import AbsensiData from "$lib/AbsensiData.svelte";

  let user: Akun | null = null;
  let todayAbsensi: AbsensiKaryawan | null = null;
  let loading = true;
  let refreshCounter = 0;

  onMount(() => {
    // Subscribe to user store changes
    const unsubscribe = userStore.subscribe(async (currentUser) => {
      if (!currentUser) {
        // Clear data when user logs out
        user = null;
        todayAbsensi = null;
        loading = false;
        refreshCounter = 0;
        goto("/login");
        return;
      }

      // Reset data when new user logs in
      if (user?.id !== currentUser.id) {
        todayAbsensi = null;
        loading = true;
        refreshCounter = 0;
      }

      user = currentUser;
      await loadTodayData();
    });

    return unsubscribe;
  });

  async function loadTodayData() {
    try {
      loading = true;
      todayAbsensi = await getTodayAbsensi();
    } catch (error) {
      console.error("Error loading today data:", error);
      toast.error("Gagal memuat data absensi hari ini");
    } finally {
      loading = false;
    }
  }

  function handleAbsensiSuccess() {
    // Refresh data when absensi is successful
    loadTodayData();
    refreshCounter++; // Trigger refresh in AbsensiData component
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  $: canAbsensiMasuk = !loading && !todayAbsensi;
  $: canAbsensiKeluar =
    !loading &&
    todayAbsensi &&
    todayAbsensi.waktu_masuk &&
    !todayAbsensi.waktu_keluar;
</script>

<svelte:head>
  <title>Presensi - Aplikasi Absensi</title>
</svelte:head>

<div class="container">
  <header class="header">
    <h1>📍 Presensi Karyawan</h1>
    {#if user}
      <div class="user-info">
        <p>
          Selamat datang, <strong>{user.nama_lengkap || user.email}</strong>
        </p>
        <p class="date">Hari ini: {formatDate(new Date().toISOString())}</p>
      </div>
    {/if}
  </header>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Memuat data...</p>
    </div>
  {:else}
    <!-- Quick Action Buttons -->
    <div class="action-section">
      <h2>⚡ Aksi Cepat</h2>
      <div class="action-buttons">
        {#if canAbsensiMasuk}
          <AbsensiButton type="masuk" on:success={handleAbsensiSuccess} />
        {:else if canAbsensiKeluar}
          <AbsensiButton type="keluar" on:success={handleAbsensiSuccess} />
        {:else if todayAbsensi && todayAbsensi.waktu_keluar}
          <div class="completed-message">
            <div class="completed-icon">✅</div>
            <h3>Absensi Hari Ini Selesai</h3>
            <p>Terima kasih telah menyelesaikan absensi hari ini!</p>
          </div>
        {:else}
          <div class="loading-message">
            <div class="loading-icon">🔄</div>
            <p>Memuat status absensi...</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Absensi Data Display -->
    <AbsensiData bind:refreshTrigger={refreshCounter} />

    <!-- Navigation -->
    <div class="navigation">
      <a href="/" class="nav-link"> 🏠 Kembali ke Dashboard </a>
      <!-- <a href="/test" class="nav-link">
				🧪 Test Features
			</a> -->
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
    background: transparent;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  @media (min-width: 480px) {
    .container {
      max-width: 420px;
    }
  }

  .header {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    padding: 20px 24px;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
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
      rgba(59, 130, 246, 0.1) 0%,
      rgba(168, 85, 247, 0.05) 50%,
      rgba(16, 185, 129, 0.1) 100%
    );
    z-index: -1;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .user-info p {
    margin: 4px 0;
    text-align: center;
    font-size: 14px;
    opacity: 0.9;
  }

  .user-info strong {
    color: #60a5fa;
  }

  .date {
    font-size: 13px;
    opacity: 0.7;
    font-weight: 400;
  }

  .loading {
    text-align: center;
    padding: 60px 24px;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    margin: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .spinner {
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    width: 50px;
    height: 50px;
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

  .action-section {
    margin: 24px;
    margin-bottom: 32px;
  }

  .action-section h2 {
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

  .action-buttons {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    padding: 32px 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .completed-message {
    text-align: center;
    padding: 40px 20px;
    color: #10b981;
  }

  .completed-icon {
    font-size: 64px;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.3));
  }

  .completed-message h3 {
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 600;
    color: #10b981;
  }

  .completed-message p {
    margin: 0;
    color: #94a3b8;
    font-size: 14px;
    font-weight: 400;
  }

  .loading-message {
    text-align: center;
    padding: 40px 20px;
    color: #94a3b8;
  }

  .loading-icon {
    font-size: 48px;
    margin-bottom: 16px;
    animation: spin 2s linear infinite;
    filter: drop-shadow(0 0 20px rgba(148, 163, 184, 0.3));
  }

  .navigation {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin: 40px 24px 24px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-link {
    color: #60a5fa;
    text-decoration: none;
    font-weight: 600;
    padding: 16px 24px;
    border-radius: 20px;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 14px;
    position: relative;
    overflow: hidden;
  }

  .nav-link::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(96, 165, 250, 0.2),
      transparent
    );
    transition: left 0.6s;
  }

  .nav-link:hover::before {
    left: 100%;
  }

  .nav-link:hover {
    background: linear-gradient(
      135deg,
      rgba(96, 165, 250, 0.2) 0%,
      rgba(167, 139, 250, 0.1) 100%
    );
    color: #f1f5f9;
    transform: translateY(-2px);
    box-shadow:
      0 12px 40px rgba(96, 165, 250, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 480px) {
    .container {
      max-width: 100%;
    }

    .action-section {
      margin: 16px;
    }

    .action-buttons {
      padding: 24px 20px;
    }

    .header {
      padding: 16px 20px;
    }

    .header h1 {
      font-size: 22px;
    }

    .navigation {
      flex-direction: column;
      gap: 12px;
      margin: 32px 16px 16px;
    }

    .nav-link {
      text-align: center;
      padding: 14px 20px;
    }

    .loading {
      margin: 16px;
      padding: 40px 20px;
    }
  }
</style>
