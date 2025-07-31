<script lang="ts">
  import { onMount } from "svelte";
  import { user, loading } from "$lib/auth";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { initHolidayMonitoring } from "$lib/holiday-notifications";

  onMount(() => {
    // Redirect ke login jika belum login dan bukan di halaman login
    const unsubscribe = user.subscribe(($user) => {
      if (!$loading && !$user && $page.route.id !== "/login") {
        goto("/login");
      } else if ($user && $page.route.id !== "/login") {
        // Initialize holiday monitoring when user is logged in
        console.log("🔔 User logged in, initializing holiday monitoring...");
        initHolidayMonitoring();
      }
    });

    return unsubscribe;
  });
</script>

{#if $loading}
  <div class="loading-container">
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Memuat...</p>
    </div>
  </div>
{:else}
  <main>
    <slot />
  </main>
{/if}

<style>
  .loading-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .loading-spinner {
    text-align: center;
    color: white;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
