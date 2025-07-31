<script lang="ts">
  import { onMount } from "svelte";
  import { user, logout } from "$lib/auth";
  import { showToast } from "$lib/toast";
  import { goto } from "$app/navigation";
  import {
    getUserDisplayName,
    getUserGreeting,
    getUserDivision,
  } from "$lib/services";
  import {
    getUpcomingHolidaysForDashboard,
    holidayNotifications,
    clearNotificationById,
    clearAllNotifications,
    cleanupInactiveNotifications,
    refreshHolidayNotifications,
    markHolidayAsSeen,
    markAllHolidaysAsSeen,
  } from "$lib/holiday-notifications";
  import type { Akun, Holiday } from "$lib/directus";

  let currentTime = new Date();
  let currentUser: Akun | null = null;
  let upcomingHolidays: Holiday[] = [];
  let notifications: Holiday[] = [];
  let showNotificationPanel = false;

  onMount(() => {
    const timer = setInterval(() => {
      currentTime = new Date();
    }, 1000);

    // Add keyboard event listener
    document.addEventListener("keydown", handleNotificationKeydown);

    // Subscribe to user changes
    const unsubscribe = user.subscribe(async ($user) => {
      currentUser = $user;

      // Load upcoming holidays when user is available
      if ($user) {
        try {
          upcomingHolidays = await getUpcomingHolidaysForDashboard();
          // Also refresh holiday notifications to ensure they're up to date
          await refreshHolidayNotifications();
        } catch (error) {
          console.error("Error loading upcoming holidays:", error);
        }
      }
    });

    // Subscribe to holiday notifications
    const unsubscribeNotifications = holidayNotifications.subscribe(
      ($notifications) => {
        notifications = $notifications;
        console.log(
          `📱 Notification store updated: ${notifications.length} notifications`
        );
      }
    );

    // Clean up inactive notifications periodically
    const cleanupTimer = setInterval(() => {
      cleanupInactiveNotifications();
    }, 60000); // Every minute

    return () => {
      clearInterval(timer);
      clearInterval(cleanupTimer);
      document.removeEventListener("keydown", handleNotificationKeydown);
      unsubscribe();
      unsubscribeNotifications();
    };
  });

  function formatTime(date: Date) {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  }

  function formatHolidayDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  }

  function getDaysUntilHoliday(dateString: string) {
    const today = new Date();
    const holidayDate = new Date(dateString);
    const diffTime = holidayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  async function handleLogout() {
    const result = await logout();
    if (result.success) {
      showToast("Berhasil logout. Sampai jumpa!", "success");
    } else {
      showToast("Gagal logout: " + result.error, "error");
    }
  }

  function toggleNotificationPanel() {
    showNotificationPanel = !showNotificationPanel;
  }

  function clearNotification(holidayId: number) {
    markHolidayAsSeen(holidayId);
  }

  function clearAllNotificationsAndClosePanel() {
    markAllHolidaysAsSeen();
    showNotificationPanel = false;
  }

  function formatNotificationDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Enhanced notification panel functionality
  function animateNotificationItems() {
    const items = document.querySelectorAll(".notification-item");
    items.forEach((item, index) => {
      (item as HTMLElement).style.setProperty("--index", index.toString());
    });
  }

  // Call animation when notifications change
  $: if (notifications.length > 0) {
    setTimeout(animateNotificationItems, 100);
  }

  // Add keyboard navigation for notification panel
  function handleNotificationKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && showNotificationPanel) {
      toggleNotificationPanel();
    }
  }

  // Close notification panel when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (
      !target.closest(".notification-panel") &&
      !target.closest(".notification-btn") &&
      !target.closest(".notification-overlay")
    ) {
      showNotificationPanel = false;
    }
  }

  function handleMenuClick(item: {
    label: string;
    icon: string;
    color: string;
  }) {
    if (item.label === "Laporan\nPresensi") {
      goto("/laporan-presensi");
    } else if (item.label === "Izin/Cuti") {
      goto("/izin-cuti");
    } else if (item.label === "Lembur") {
      goto("/lembur");
    } else if (item.label === "Kasbon") {
      goto("/kasbon");
    } else if (item.label === "Informasi\nLibur") {
      goto("/informasi-libur");
    } else {
      showToast(
        `Fitur ${item.label.replace("\n", " ")} belum tersedia`,
        "info"
      );
    }
  }

  const menuItems = [
    { icon: "fas fa-chart-bar", label: "Laporan\nPresensi", color: "#3b82f6" },
    {
      icon: "fas fa-calendar-times",
      label: "Informasi\nLibur",
      color: "#10b981",
    },
    { icon: "fas fa-receipt", label: "Slip\nGaji", color: "#f59e0b" },
    { icon: "fas fa-user-cog", label: "Admin\nSistem", color: "#8b5cf6" },
    { icon: "fas fa-tasks", label: "Tugas", color: "#ef4444" },
    { icon: "fas fa-clock", label: "Lembur", color: "#06b6d4" },
    { icon: "fas fa-calendar-alt", label: "Izin/Cuti", color: "#84cc16" },
    { icon: "fas fa-money-bill", label: "Kasbon", color: "#f97316" },
  ];

  // Debug functions for testing (accessible via browser console)
  if (typeof window !== "undefined") {
    (window as any).testHolidayNotifications = {
      forceCheck: () =>
        import("$lib/holiday-notifications").then((m) =>
          m.forceCheckNewHolidays()
        ),
      clearSeen: () =>
        import("$lib/holiday-notifications").then((m) => m.clearSeenHolidays()),
      debug: () =>
        import("$lib/holiday-notifications").then((m) => m.debugHolidayState()),
      refresh: () =>
        import("$lib/holiday-notifications").then((m) =>
          m.refreshHolidayNotifications()
        ),
      initExisting: () =>
        import("$lib/holiday-notifications").then((m) =>
          m.initializeExistingNotifications()
        ),
      currentNotifications: () => notifications,
      markAsSeen: (id: number) => markHolidayAsSeen(id),
      markAllAsSeen: () => markAllHolidaysAsSeen(),
    };
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="app-container" on:click={handleClickOutside}>
  <!-- Header -->
  <header class="header">
    <div class="profile-section">
      <div class="profile-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="profile-info">
        <h3>{getUserDisplayName(currentUser)}</h3>
        <span class="badge">{getUserDivision(currentUser)}</span>
      </div>
      <div class="header-actions">
        <button
          class="notification-btn"
          aria-label="Notifikasi"
          on:click={toggleNotificationPanel}
          class:has-notifications={notifications.length > 0}
        >
          <i class="fas fa-bell"></i>
          {#if notifications.length > 0}
            <span class="notification-badge">{notifications.length}</span>
          {/if}
        </button>
        <button class="logout-btn" on:click={handleLogout} aria-label="Logout">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Notification Overlay for Mobile -->
  {#if showNotificationPanel}
    <div class="notification-overlay" on:click={toggleNotificationPanel}></div>
  {/if}

  <!-- Notification Panel -->
  {#if showNotificationPanel}
    <div class="notification-panel">
      <div class="notification-header">
        <h3>Notifikasi Libur</h3>
        <button
          class="close-btn"
          on:click={toggleNotificationPanel}
          aria-label="Tutup Panel Notifikasi"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="notification-content">
        {#if notifications.length === 0}
          <div class="no-notifications">
            <p>Tidak ada notifikasi baru.</p>
          </div>
        {:else}
          <div class="notification-list">
            {#each notifications as holiday (holiday.id)}
              <div class="notification-item">
                <div class="notification-details">
                  <h4>{holiday.name}</h4>
                  <p class="notification-date">
                    <i class="fas fa-calendar-alt"></i>
                    {formatNotificationDate(holiday.date)}
                    {#if getDaysUntilHoliday(holiday.date) >= 0}
                      <span class="notification-countdown">
                        {getDaysUntilHoliday(holiday.date)} hari lagi
                      </span>
                    {/if}
                  </p>
                  <p class="notification-type">
                    <i class="fas fa-tag"></i>
                    {holiday.type}
                  </p>
                </div>
                <button
                  class="btn-clear-notification"
                  on:click={() => clearNotification(holiday.id)}
                  aria-label="Hapus Notifikasi"
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      {#if notifications.length > 0}
        <div class="notification-footer">
          <button
            class="btn-clear-all"
            on:click={clearAllNotificationsAndClosePanel}
          >
            <i class="fas fa-trash-alt"></i>
            Hapus Semua Notifikasi
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Greeting Section -->
  <section class="greeting-section">
    <h1>
      Hallo 👋 {getUserGreeting(currentUser)}
    </h1>
    <p>Semangat Kerja ya!</p>
  </section>

  <!-- Attendance Card -->
  <section class="attendance-section">
    <div class="attendance-card">
      <div class="time-display">
        <h2>{formatTime(currentTime)} WIB</h2>
        <p>Jam kerja kamu pukul 08:00 - 17:00</p>
      </div>

      <div class="attendance-buttons">
        <button
          class="btn btn-primary-large"
          on:click={() => goto("/presensi")}
        >
          🟢 Absensi Masuk
        </button>
        <button class="btn btn-danger-large" on:click={() => goto("/presensi")}>
          🔴 Absensi Keluar
        </button>
      </div>
      <!-- <div class="info-section">
        <p class="info-text">
          <i class="fas fa-info-circle"></i>
          Klik tombol di atas untuk melakukan absensi dengan kamera dan GPS otomatis
        </p>
      </div> -->
    </div>
  </section>

  <!-- Menu Grid -->
  <section class="menu-section">
    <div class="menu-grid">
      {#each menuItems as item}
        <button class="menu-item" on:click={() => handleMenuClick(item)}>
          <div class="menu-icon" style="background-color: {item.color}">
            <i class={item.icon}></i>
          </div>
          <span class="menu-label">{item.label}</span>
        </button>
      {/each}
    </div>
  </section>
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
    /* background: linear-gradient(
      135deg,
      #0a0f1c 0%,
      #1a1f2e 25%,
      #2d1b69 50%,
      #11172b 75%,
      #0a0f1c 100%
    ); */
    /* background-size: 400% 400%;
    animation: gradientMove 25s ease infinite;
    color: #f1f5f9;
    min-height: 100vh;
    position: relative;
    overflow-x: hidden; */
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

  /* @keyframes cosmicDrift {
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
  } */

  .app-container {
    max-width: 100%;
    width: 100%;
    margin: 0 auto;
    background: transparent;
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  @media (min-width: 480px) {
    .app-container {
      max-width: 420px;
    }
  }

  /* Header */
  .header {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 24px 20px;
    color: white;
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

  .profile-section {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .notification-btn,
  .logout-btn {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: 44px;
    height: 44px;
    border-radius: 14px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .notification-btn::before,
  .logout-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transform: translateX(-100%);
    transition: transform 0.6s;
  }

  .notification-btn:hover::before,
  .logout-btn:hover::before {
    transform: translateX(100%);
  }

  .notification-btn:hover,
  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(255, 255, 255, 0.1);
  }

  .profile-avatar {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow:
      0 8px 32px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
  }

  /* .profile-avatar::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transform: rotate(45deg);
    animation: avatarShimmer 4s infinite;
  } */

  @keyframes avatarShimmer {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    50% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
    100% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
  }

  .profile-info {
    flex: 1;
  }

  .profile-info h3 {
    margin: 0 0 6px 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .badge {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
  }

  /* Greeting */
  .greeting-section {
    padding: 32px 20px 24px;
    text-align: center;
  }

  .greeting-section h1 {
    margin: 0 0 12px 0;
    font-size: 28px;
    font-weight: 800;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 80%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .greeting-section p {
    margin: 0;
    color: rgba(226, 232, 240, 0.8);
    font-size: 16px;
    font-weight: 500;
  }

  /* Attendance */
  .attendance-section {
    padding: 0 20px 32px;
  }

  .attendance-card {
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(40px) saturate(200%);
    border-radius: 24px;
    padding: 32px 24px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 16px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .attendance-card::before {
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

  .attendance-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 40px 80px rgba(0, 0, 0, 0.4),
      0 20px 40px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .time-display {
    text-align: center;
    margin-bottom: 28px;
  }

  .time-display h2 {
    margin: 0 0 12px 0;
    font-size: 32px;
    font-weight: 900;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .time-display p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 15px;
    font-weight: 500;
  }

  .attendance-buttons {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .btn {
    flex: 1;
    padding: 16px 20px;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .btn-primary-large {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    font-size: 17px;
    font-weight: 700;
    width: 100%;
    padding: 20px 24px;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(16, 185, 129, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-primary-large::before {
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

  .btn-primary-large:hover::before {
    left: 100%;
  }

  .btn-primary-large:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(16, 185, 129, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .btn-danger-large {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    font-size: 17px;
    font-weight: 700;
    width: 100%;
    padding: 20px 24px;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 8px 32px rgba(239, 68, 68, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-danger-large::before {
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

  .btn-danger-large:hover::before {
    left: 100%;
  }

  .btn-danger-large:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(239, 68, 68, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .info-section {
    text-align: center;
    margin-top: 20px;
  }

  .info-text {
    font-size: 14px;
    color: rgba(226, 232, 240, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 500;
  }

  .info-text i {
    color: #3b82f6;
    opacity: 0.8;
  }

  /* Menu Grid */
  .menu-section {
    padding: 0 20px 40px;
  }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .menu-item {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 16px;
    border-radius: 20px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    position: relative;
    overflow: hidden;
  }

  .menu-item::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
    border-radius: 20px;
    z-index: -1;
    transition: opacity 0.3s ease;
    opacity: 0;
  }

  .menu-item:hover::before {
    opacity: 1;
  }

  .menu-item:hover {
    background: rgba(15, 23, 42, 0.8);
    transform: translateY(-4px);
    box-shadow:
      0 16px 64px rgba(0, 0, 0, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .menu-item:active {
    transform: translateY(-2px);
  }

  .menu-icon {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  /* .menu-icon::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transform: rotate(45deg);
    animation: iconShimmer 3s infinite;
  } */

  @keyframes iconShimmer {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    50% {
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
    100% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
  }

  .menu-item:hover .menu-icon {
    transform: scale(1.05);
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .menu-label {
    font-size: 13px;
    text-align: center;
    line-height: 1.3;
    color: rgba(226, 232, 240, 0.9);
    white-space: pre-line;
    font-weight: 600;
    margin-top: 4px;
  }

  /* Notification Overlay */
  .notification-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 999;
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  @media (min-width: 481px) {
    .notification-overlay {
      display: none;
    }
  }

  /* Notification Panel */
  .notification-panel {
    position: absolute;
    top: 100px;
    right: 20px;
    width: 340px;
    max-width: calc(100vw - 40px);
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    box-shadow:
      0 32px 64px rgba(0, 0, 0, 0.4),
      0 16px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    z-index: 1000;
    transform: translateY(-10px);
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(168, 85, 247, 0.05) 100%
    );
    border-radius: 20px 20px 0 0;
  }

  .notification-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .notification-header h3::before {
    content: "🔔";
    font-size: 16px;
    filter: none;
    -webkit-text-fill-color: initial;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
    width: 32px;
    height: 32px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 14px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: scale(1.05);
  }

  .notification-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    max-height: 400px;
  }

  .notification-content::-webkit-scrollbar {
    width: 6px;
  }

  .notification-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  .notification-content::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.4);
    border-radius: 3px;
  }

  .notification-content::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.6);
  }

  .no-notifications {
    text-align: center;
    padding: 40px 24px;
    color: rgba(226, 232, 240, 0.6);
    font-size: 15px;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .no-notifications::before {
    content: "📭";
    font-size: 32px;
    opacity: 0.7;
  }

  .notification-list {
    padding: 8px 0;
  }

  .notification-item {
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: flex-start;
    gap: 16px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    animation: fadeInUp 0.3s ease forwards;
    animation-delay: calc(var(--index) * 0.1s);
    opacity: 0;
    transform: translateY(20px);
  }

  @keyframes fadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .notification-item:last-child {
    border-bottom: none;
  }

  .notification-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .notification-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 0 2px 2px 0;
  }

  .notification-details {
    flex: 1;
    min-width: 0;
  }

  .notification-details h4 {
    margin: 0 0 8px 0;
    font-size: 15px;
    font-weight: 700;
    color: white;
    line-height: 1.3;
    word-break: break-word;
  }

  .notification-date {
    margin: 0 0 6px 0;
    font-size: 13px;
    color: rgba(226, 232, 240, 0.8);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .notification-date i {
    color: #3b82f6;
    font-size: 11px;
    margin-right: 4px;
  }

  .notification-countdown {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .notification-type {
    margin: 0;
    font-size: 12px;
    color: rgba(226, 232, 240, 0.6);
    font-weight: 500;
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 8px;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .notification-type i {
    color: #8b5cf6;
    font-size: 10px;
    margin-right: 4px;
  }

  .btn-clear-notification {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: 14px;
    flex-shrink: 0;
  }

  .btn-clear-notification:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    transform: scale(1.05);
  }

  .notification-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0 0 20px 20px;
  }

  .btn-clear-all {
    width: 100%;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }

  .btn-clear-all:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
  }

  .notification-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    animation: pulse 2s infinite;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
  }

  .notification-btn.has-notifications {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .notification-btn.has-notifications:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Responsive adjustments for notification panel */
  @media (max-width: 480px) {
    .notification-panel {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 100%;
      border-radius: 0;
      max-height: 100vh;
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .notification-header {
      border-radius: 0;
      padding: 24px 20px 20px;
    }

    .notification-content {
      max-height: calc(100vh - 140px);
    }

    .notification-item {
      padding: 16px 20px;
    }

    .notification-footer {
      border-radius: 0;
      padding: 20px;
    }
  }

  @media (max-width: 360px) {
    .notification-header {
      padding: 20px 16px 16px;
    }

    .notification-item {
      padding: 14px 16px;
    }

    .notification-footer {
      padding: 16px;
    }
  }
</style>
