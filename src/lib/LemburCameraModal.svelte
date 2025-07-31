<!-- Lembur Camera Modal Component - Dedicated for overtime attendance -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getCurrentLocation, type LocationData } from "$lib/absensi";
  import {
    validateClientTime,
    isWithinWorkingHours,
    getSecureTimestamp,
  } from "$lib/time-security";

  export let isOpen = false;
  export let type: "masuk" | "keluar" = "masuk";
  export let isMandiri = false; // New prop untuk mode lembur mandiri
  export let lemburDescription = ""; // Deskripsi pekerjaan lembur (opsional)

  const dispatch = createEventDispatcher();

  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let capturedPhoto: string | null = null;
  let locationData: LocationData | null = null;
  let isCapturing = false;
  let isProcessing = false;
  let error = "";
  let timeSecurityWarning = "";
  let isValidatingTime = false;
  let lemburNote = ""; // Catatan khusus lembur

  onMount(() => {
    if (isOpen) {
      initializeLemburModal();
    }

    return () => {
      cleanupModal();
    };
  });

  $: if (isOpen) {
    initializeLemburModal();
  } else {
    cleanupModal();
    resetModal();
  }

  async function initializeLemburModal() {
    startCamera();
    getLocationAutomatically();
    validateLemburTime();
  }

  async function validateLemburTime() {
    isValidatingTime = true;
    timeSecurityWarning = "";

    try {
      // Validate client time against server time
      const timeValidation = await validateClientTime();
      if (!timeValidation.isValid) {
        timeSecurityWarning = `⚠️ PERINGATAN KEAMANAN LEMBUR: ${timeValidation.message}`;
        return;
      }

      // Check if it's appropriate time for overtime (different from regular working hours)
      const { serverTime } = await getSecureTimestamp();
      const now = new Date(serverTime);
      const hour = now.getHours();

      // Lembur biasanya di luar jam kerja normal (sebelum 7 atau setelah 17)
      if (hour >= 7 && hour <= 17) {
        timeSecurityWarning = `⚠️ PERHATIAN: Absensi lembur pada jam kerja normal (${hour}:${now.getMinutes().toString().padStart(2, "0")}). Pastikan ini adalah lembur yang disetujui.`;
      }

      console.log("✅ Lembur time security validation passed");
    } catch (err) {
      console.error("Lembur time validation error:", err);
      timeSecurityWarning =
        "⚠️ Tidak dapat memvalidasi waktu sistem untuk lembur. Pastikan koneksi internet stabil.";
    } finally {
      isValidatingTime = false;
    }
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (err) {
      error =
        "Gagal mengakses kamera untuk absensi lembur. Pastikan browser memiliki izin kamera.";
      console.error("Lembur camera error:", err);
    }
  }

  function cleanupModal() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  async function getLocationAutomatically() {
    try {
      locationData = await getCurrentLocation();
    } catch (err) {
      error =
        "Gagal mendapatkan lokasi untuk absensi lembur. Pastikan GPS aktif dan izin lokasi diberikan.";
      console.error("Lembur location error:", err);
    }
  }

  function capturePhoto() {
    if (!videoElement || !canvasElement) return;

    isCapturing = true;

    // Set canvas size to match video
    const context = canvasElement.getContext("2d");
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // Draw video frame to canvas
    context?.drawImage(videoElement, 0, 0);

    // Convert to blob
    canvasElement.toBlob(
      (blob) => {
        if (blob) {
          capturedPhoto = URL.createObjectURL(blob);
          isCapturing = false;
        }
      },
      "image/jpeg",
      0.9
    );
  }

  function retakePhoto() {
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    capturedPhoto = null;
    error = "";
  }

  async function submitLemburAbsensi() {
    if (!capturedPhoto || !locationData) {
      error = "Foto dan lokasi diperlukan untuk absensi lembur";
      return;
    }

    // Block submission if there's a critical time security warning
    if (timeSecurityWarning && timeSecurityWarning.includes("KEAMANAN")) {
      error =
        "Tidak dapat melakukan absensi lembur karena ada masalah dengan waktu sistem. Silakan sinkronkan waktu perangkat Anda.";
      return;
    }

    isProcessing = true;

    try {
      // Convert captured photo to File object
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `lembur-absensi-${type}-${timestamp}.jpg`, {
        type: "image/jpeg",
      });

      const lemburKeterangan = isMandiri
        ? `Absensi ${type} lembur mandiri` +
          (lemburNote ? ` - ${lemburNote}` : "")
        : `Absensi ${type} lembur` +
          (lemburDescription ? ` - ${lemburDescription}` : "") +
          (lemburNote ? ` - ${lemburNote}` : "");

      dispatch("submit", {
        type,
        foto: file,
        lokasi: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address,
          accuracy: locationData.accuracy,
        },
        keterangan: lemburKeterangan,
        isMandiri,
        lemburNote,
      });

      closeModal();
    } catch (err) {
      error = "Gagal memproses absensi lembur. Silakan coba lagi.";
      console.error("Lembur submit error:", err);
    } finally {
      isProcessing = false;
    }
  }

  function closeModal() {
    dispatch("close");
    resetModal();
  }

  function resetModal() {
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    capturedPhoto = null;
    locationData = null;
    error = "";
    timeSecurityWarning = "";
    isCapturing = false;
    isProcessing = false;
    isValidatingTime = false;
    lemburNote = "";
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="lembur-modal-overlay"
    on:click={closeModal}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="lembur-modal-content" on:click|stopPropagation role="document">
      <div class="lembur-modal-header">
        <h2>
          🕐 Absensi Lembur {type.charAt(0).toUpperCase() + type.slice(1)}
          {#if isMandiri}
            <span class="mandiri-badge">Mandiri</span>
          {/if}
        </h2>
        <button class="lembur-close-btn" on:click={closeModal}>✕</button>
      </div>

      <div class="lembur-modal-body">
        {#if error}
          <div class="lembur-error-message">
            ⚠️ {error}
          </div>
        {/if}

        <!-- Lembur Time Security Status -->
        {#if isValidatingTime}
          <div class="lembur-time-validation-status validating">
            <div class="lembur-loading-spinner-small"></div>
            🔒 Memvalidasi waktu lembur...
          </div>
        {:else if timeSecurityWarning}
          <div class="lembur-time-validation-status warning">
            {timeSecurityWarning}
          </div>
        {:else}
          <div class="lembur-time-validation-status success">
            ✅ Waktu lembur valid dan terkonfirmasi
          </div>
        {/if}

        <!-- Lembur Context Info -->
        {#if lemburDescription}
          <div class="lembur-context-info">
            <div class="lembur-context-header">
              <i class="fas fa-briefcase"></i>
              <span>Deskripsi Pekerjaan Lembur</span>
            </div>
            <div class="lembur-context-text">{lemburDescription}</div>
          </div>
        {/if}

        <!-- Location Status -->
        <div class="lembur-location-status">
          {#if locationData}
            <div class="lembur-location-success">
              <div class="lembur-location-header">
                <i class="fas fa-map-marker-alt"></i>
                <span class="lembur-location-title"
                  >Lokasi Lembur Terdeteksi</span
                >
              </div>
              <div class="lembur-location-details">
                <div class="lembur-location-address">
                  {locationData.address ||
                    `Koordinat: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`}
                </div>
              </div>
            </div>
          {:else}
            <div class="lembur-location-loading">
              <div class="lembur-loading-spinner"></div>
              <span>Mendapatkan lokasi lembur...</span>
            </div>
          {/if}
        </div>

        <!-- Optional Note for Lembur -->
        <!-- <div class="lembur-note-section">
          <label for="lemburNote" class="lembur-note-label">
            💬 Catatan Tambahan (Opsional)
          </label>
          <textarea
            id="lemburNote"
            bind:value={lemburNote}
            placeholder="Contoh: Menyelesaikan laporan bulanan, overtime karena deadline project..."
            class="lembur-note-input"
            rows="2"
            maxlength="200"
          ></textarea>
          <div class="lembur-note-counter">{lemburNote.length}/200</div>
        </div> -->

        <!-- Camera Section -->
        <div class="lembur-camera-section">
          {#if !capturedPhoto}
            <div class="lembur-video-container">
              <!-- svelte-ignore a11y-media-has-caption -->
              <video
                bind:this={videoElement}
                autoplay
                muted
                playsinline
                class="lembur-camera-video"
              ></video>

              <div class="lembur-camera-overlay">
                <div class="lembur-camera-frame"></div>
                <div class="lembur-instructions">
                  Posisikan wajah untuk absensi lembur
                </div>
              </div>
            </div>

            <div class="lembur-camera-controls">
              <button
                class="lembur-capture-btn"
                on:click={capturePhoto}
                disabled={isCapturing || !locationData}
              >
                {isCapturing ? "📸 Mengambil..." : "📸 Ambil Foto Lembur"}
              </button>
            </div>
          {:else}
            <div class="lembur-photo-preview">
              <img src={capturedPhoto} alt="Foto absensi lembur yang diambil" />

              <div class="lembur-photo-controls">
                <button class="lembur-retake-btn" on:click={retakePhoto}>
                  🔄 Ambil Ulang
                </button>
                <button
                  class="lembur-submit-btn"
                  on:click={submitLemburAbsensi}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "⏳ Memproses..."
                    : `✅ Konfirmasi Absensi Lembur ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <canvas bind:this={canvasElement} style="display: none;"></canvas>
    </div>
  </div>
{/if}

<style>
  .lembur-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(26, 35, 126, 0.85); /* Different from regular modal */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001; /* Higher than regular modal */
    backdrop-filter: blur(6px);
  }

  .lembur-modal-content {
    background: linear-gradient(145deg, #ffffff, #f8f9fa);
    border-radius: 20px;
    width: 90%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 70px rgba(26, 35, 126, 0.4);
    border: 2px solid #e3f2fd;
  }

  .lembur-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 3px solid #1a237e;
    background: linear-gradient(135deg, #1a237e, #283593);
    color: white;
    border-radius: 20px 20px 0 0;
  }

  .lembur-modal-header h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mandiri-badge {
    background: #ff9800;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .lembur-close-btn {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.3s ease;
  }

  .lembur-close-btn:hover {
    background: #d32f2f;
    transform: scale(1.1);
  }

  .lembur-modal-body {
    padding: 24px;
  }

  .lembur-error-message {
    background: #ffebee;
    border: 2px solid #f44336;
    color: #c62828;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    font-size: 14px;
    font-weight: 500;
  }

  /* Lembur Time Security Status Styles */
  .lembur-time-validation-status {
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .lembur-time-validation-status.validating {
    background: linear-gradient(135deg, #e1f5fe, #b3e5fc);
    border: 2px solid #29b6f6;
    color: #0277bd;
  }

  .lembur-time-validation-status.warning {
    background: linear-gradient(135deg, #fff8e1, #ffecb3);
    border: 2px solid #ffb74d;
    color: #f57c00;
  }

  .lembur-time-validation-status.success {
    background: linear-gradient(135deg, #e8f5e8, #c8e6c9);
    border: 2px solid #66bb6a;
    color: #2e7d32;
  }

  .lembur-loading-spinner-small {
    width: 18px;
    height: 18px;
    border: 3px solid #e1f5fe;
    border-top: 3px solid #0277bd;
    border-radius: 50%;
    animation: lemburSpin 1s linear infinite;
  }

  @keyframes lemburSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .lembur-context-info {
    background: linear-gradient(135deg, #f3e5f5, #e1bee7);
    border: 2px solid #ba68c8;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .lembur-context-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    color: #6a1b9a;
    margin-bottom: 8px;
  }

  .lembur-context-text {
    color: #4a148c;
    font-weight: 500;
    line-height: 1.4;
  }

  .lembur-location-status {
    margin-bottom: 20px;
    padding: 18px;
    border-radius: 15px;
    font-size: 14px;
  }

  .lembur-location-success {
    background: linear-gradient(135deg, #e8f5e8, #c8e6c9);
    border: 2px solid #66bb6a;
    color: #1b5e20;
  }

  .lembur-location-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .lembur-location-header i {
    color: #2e7d32;
    font-size: 18px;
  }

  .lembur-location-title {
    font-weight: 700;
    color: #1b5e20;
  }

  .lembur-location-details {
    margin-left: 28px;
  }

  .lembur-location-address {
    font-weight: 600;
    color: #1b5e20;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .lembur-location-loading {
    background: linear-gradient(135deg, #fff8e1, #ffecb3);
    border: 2px solid #ffb74d;
    color: #e65100;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .lembur-loading-spinner {
    width: 22px;
    height: 22px;
    border: 3px solid #fff8e1;
    border-top: 3px solid #e65100;
    border-radius: 50%;
    animation: lemburSpin 1s linear infinite;
  }

  .lembur-note-section {
    margin-bottom: 24px;
  }

  .lembur-note-label {
    display: block;
    font-weight: 600;
    color: #1a237e;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .lembur-note-input {
    width: 100%;
    padding: 12px;
    border: 2px solid #c5cae9;
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.3s ease;
  }

  .lembur-note-input:focus {
    outline: none;
    border-color: #1a237e;
    box-shadow: 0 0 0 3px rgba(26, 35, 126, 0.1);
  }

  .lembur-note-counter {
    text-align: right;
    font-size: 12px;
    color: #757575;
    margin-top: 4px;
  }

  .lembur-camera-section {
    text-align: center;
  }

  .lembur-video-container {
    position: relative;
    display: inline-block;
    border-radius: 15px;
    overflow: hidden;
    margin-bottom: 24px;
    box-shadow: 0 8px 30px rgba(26, 35, 126, 0.2);
    border: 3px solid #1a237e;
  }

  .lembur-camera-video {
    width: 100%;
    max-width: 420px;
    height: auto;
    display: block;
  }

  .lembur-camera-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .lembur-camera-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 210px;
    height: 260px;
    border: 4px solid #ff9800;
    border-radius: 15px;
    box-shadow: 0 0 0 9999px rgba(26, 35, 126, 0.4);
  }

  .lembur-instructions {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 35, 126, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 25px;
    font-size: 13px;
    font-weight: 600;
  }

  .lembur-camera-controls {
    display: flex;
    justify-content: center;
  }

  .lembur-capture-btn {
    background: linear-gradient(135deg, #1a237e, #283593);
    color: white;
    border: none;
    padding: 18px 36px;
    border-radius: 30px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 6px 20px rgba(26, 35, 126, 0.4);
  }

  .lembur-capture-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #0d47a1, #1565c0);
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(26, 35, 126, 0.5);
  }

  .lembur-capture-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .lembur-photo-preview img {
    width: 100%;
    max-width: 420px;
    border-radius: 15px;
    margin-bottom: 24px;
    box-shadow: 0 8px 30px rgba(26, 35, 126, 0.2);
    border: 3px solid #1a237e;
  }

  .lembur-photo-controls {
    display: flex;
    gap: 20px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .lembur-retake-btn {
    background: linear-gradient(135deg, #ff9800, #ffb74d);
    color: white;
    border: none;
    padding: 15px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .lembur-retake-btn:hover {
    background: linear-gradient(135deg, #f57c00, #ff9800);
    transform: translateY(-2px);
  }

  .lembur-submit-btn {
    background: linear-gradient(135deg, #2e7d32, #4caf50);
    color: white;
    border: none;
    padding: 15px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    max-width: 220px;
  }

  .lembur-submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #1b5e20, #2e7d32);
    transform: translateY(-2px);
  }

  .lembur-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 480px) {
    .lembur-modal-content {
      width: 95%;
      margin: 10px;
    }

    .lembur-modal-header,
    .lembur-modal-body {
      padding: 18px;
    }

    .lembur-camera-frame {
      width: 160px;
      height: 210px;
    }

    .lembur-photo-controls {
      flex-direction: column;
      align-items: center;
    }

    .lembur-submit-btn {
      max-width: none;
      width: 100%;
    }

    .mandiri-badge {
      font-size: 10px;
    }
  }
</style>
