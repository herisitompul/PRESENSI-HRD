<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { user, login } from "$lib/auth";
  import { showToast } from "$lib/toast";

  let email = "";
  let password = "";
  let isLoading = false;
  let showPassword = false;

  // Redirect if already logged in
  onMount(() => {
    const unsubscribe = user.subscribe(($user) => {
      if ($user) {
        goto("/");
      }
    });

    return unsubscribe;
  });

  async function handleLogin() {
    if (!email || !password) {
      showToast("Email dan password harus diisi", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showToast("Format email tidak valid", "error");
      return;
    }

    isLoading = true;

    try {
      const result = await login(email, password);

      if (result.success) {
        showToast("Login berhasil! Selamat datang.", "success");
        goto("/");
      } else {
        showToast(result.error || "Login gagal", "error");
      }
    } catch (error) {
      showToast("Terjadi kesalahan saat login", "error");
    } finally {
      isLoading = false;
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleKeyPress(event) {
    if (event.key === "Enter") {
      handleLogin();
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<svelte:head>
  <title>Login - Sistem Presensi</title>
  <meta
    name="description"
    content="Login ke sistem presensi PT. Eltama Prima Indo"
  />
</svelte:head>

<div class="login-container">
  <!-- Login Card -->
  <div class="login-card">
    <!-- Header -->
    <div class="login-header">
      <div class="company-logo">
        <i class="fas fa-building"></i>
      </div>
      <h1>Sistem Presensi</h1>
      <p class="company-name">PT. Eltama Prima Indo</p>
      <p class="welcome-text">Masuk ke akun Anda untuk melakukan presensi</p>
    </div>

    <!-- Login Form -->
    <form class="login-form" on:submit|preventDefault={handleLogin}>
      <!-- Email Field -->
      <div class="form-group">
        <label for="email" class="form-label">
          <i class="fas fa-envelope"></i>
          Email
        </label>
        <div class="input-wrapper">
          <input
            id="email"
            type="email"
            bind:value={email}
            on:keypress={handleKeyPress}
            placeholder="Masukkan email Anda"
            class="form-input"
            class:error={email && !isValidEmail(email)}
            disabled={isLoading}
            autocomplete="email"
            required
          />
          {#if email && !isValidEmail(email)}
            <div class="input-error">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
          {/if}
        </div>
        {#if email && !isValidEmail(email)}
          <span class="error-message">Format email tidak valid</span>
        {/if}
      </div>

      <!-- Password Field -->
      <div class="form-group">
        <label for="password" class="form-label">
          <i class="fas fa-lock"></i>
          Password
        </label>
        <div class="input-wrapper">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            bind:value={password}
            on:keypress={handleKeyPress}
            placeholder="Masukkan password Anda"
            class="form-input"
            disabled={isLoading}
            autocomplete="current-password"
            required
          />
          <button
            type="button"
            class="password-toggle"
            on:click={togglePasswordVisibility}
            aria-label={showPassword
              ? "Sembunyikan password"
              : "Tampilkan password"}
            disabled={isLoading}
          >
            <i class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
        </div>
      </div>

      <!-- Login Button -->
      <button
        type="submit"
        class="login-button"
        disabled={isLoading || !email || !password}
        aria-label="Login ke sistem"
      >
        {#if isLoading}
          <div class="button-loading">
            <div class="loading-spinner"></div>
            <span>Memproses...</span>
          </div>
        {:else}
          <i class="fas fa-sign-in-alt"></i>
          <span>Masuk</span>
        {/if}
      </button>
    </form>

    <!-- Footer -->
    <div class="login-footer">
      <!-- <div class="divider">
        <span>atau</span>
      </div> -->

      <!-- <div class="help-links">
        <button class="link-button" disabled>
          <i class="fas fa-question-circle"></i>
          Bantuan
        </button>
        <button class="link-button" disabled>
          <i class="fas fa-key"></i>
          Lupa Password
        </button>
      </div> -->

      <div class="version-info">
        <span>Sistem Presensi v1.0</span>
        <span>© 2025 PT. Eltama Prima Indo</span>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    background: #1e293b;
    min-height: 100vh;
    position: relative;
  }

  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    position: relative;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  }

  .login-card {
    background: rgba(30, 41, 59, 0.95);
    border-radius: 20px;
    padding: 32px 24px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(59, 130, 246, 0.2);
    position: relative;
    z-index: 10;
    transition: transform 0.2s ease;
  }

  .login-card:hover {
    transform: translateY(-2px);
  }

  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .company-logo {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    color: white;
    font-size: 28px;
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  }

  .login-header h1 {
    margin: 0 0 12px 0;
    font-size: 28px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .company-name {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #3b82f6;
    letter-spacing: 0.01em;
  }

  .welcome-text {
    margin: 0;
    font-size: 14px;
    color: rgba(226, 232, 240, 0.8);
    line-height: 1.5;
    font-weight: 400;
  }

  .login-form {
    margin-bottom: 32px;
  }

  .form-group {
    margin-bottom: 24px;
    position: relative;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.9);
  }

  .form-label i {
    color: #3b82f6;
    width: 16px;
    font-size: 14px;
  }

  .input-wrapper {
    position: relative;
  }

  .form-input {
    width: 100%;
    padding: 16px 50px 16px 16px;
    border: 2px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
    font-size: 16px;
    font-weight: 500;
    background: rgba(30, 41, 59, 0.8);
    transition: all 0.2s ease;
    box-sizing: border-box;
    color: #ffffff;
  }

  .form-input::placeholder {
    color: rgba(148, 163, 184, 0.7);
    font-weight: 400;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(30, 41, 59, 0.9);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .form-input.error {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  .form-input:disabled {
    background: rgba(15, 23, 42, 0.5);
    color: #64748b;
    cursor: not-allowed;
  }

  .input-error {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #ef4444;
    font-size: 16px;
  }

  .password-toggle {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
    font-size: 16px;
  }

  .password-toggle:hover {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .password-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .error-message {
    display: block;
    margin-top: 8px;
    font-size: 13px;
    color: #ef4444;
    font-weight: 500;
  }

  .login-button {
    width: 100%;
    padding: 16px 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .login-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
  }

  .login-button:active:not(:disabled) {
    transform: translateY(-1px);
  }

  .login-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  .button-loading {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .loading-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .login-footer {
    text-align: center;
  }

  .version-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: rgba(148, 163, 184, 0.6);
    font-weight: 400;
  }

  /* Mobile Responsive - Optimized for mobile-first */
  @media (max-width: 480px) {
    .login-container {
      padding: 12px;
    }

    .login-card {
      padding: 28px 20px;
      border-radius: 16px;
      max-width: 100%;
    }

    .login-header h1 {
      font-size: 24px;
    }

    .company-logo {
      width: 56px;
      height: 56px;
      font-size: 24px;
      margin-bottom: 20px;
    }

    .company-name {
      font-size: 15px;
    }

    .welcome-text {
      font-size: 13px;
    }

    .form-input {
      padding: 14px 45px 14px 14px;
      font-size: 16px; /* Prevent zoom on iOS */
    }

    .login-button {
      padding: 14px 16px;
      font-size: 15px;
    }

    .form-label {
      font-size: 13px;
      margin-bottom: 10px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .login-header {
      margin-bottom: 28px;
    }

    .login-form {
      margin-bottom: 28px;
    }
  }

  /* Tablet */
  @media (max-width: 768px) and (min-width: 481px) {
    .login-card {
      max-width: 380px;
      padding: 36px 28px;
    }
  }

  /* Desktop - minimal changes needed */
  @media (min-width: 769px) {
    .login-card {
      max-width: 400px;
    }
  }

  /* Accessibility - Reduced motion for better performance */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
      transition: none !important;
    }
  }

  /* Focus visible for accessibility */
  .login-button:focus-visible,
  .form-input:focus-visible,
  .password-toggle:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
</style>
