<!-- Camera Modal Component -->
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

  onMount(() => {
    if (isOpen) {
      startCamera();
      getLocationAutomatically();
      validateTimeOnOpen();
    }

    return () => {
      stopCamera();
    };
  });

  $: if (isOpen) {
    startCamera();
    getLocationAutomatically();
    validateTimeOnOpen();
  } else {
    stopCamera();
    resetModal();
  }

  async function validateTimeOnOpen() {
    isValidatingTime = true;
    timeSecurityWarning = "";

    try {
      // Validate client time against server time
      const timeValidation = await validateClientTime();
      if (!timeValidation.isValid) {
        timeSecurityWarning = `⚠️ PERINGATAN KEAMANAN: ${timeValidation.message}`;
        return;
      }

      // Check working hours
      const { serverTime } = await getSecureTimestamp();
      const workingHoursCheck = isWithinWorkingHours(serverTime);
      if (!workingHoursCheck.isValid) {
        timeSecurityWarning = `⚠️ PERINGATAN: ${workingHoursCheck.message}`;
        return;
      }

      console.log("✅ Time security validation passed");
    } catch (err) {
      console.error("Time validation error:", err);
      timeSecurityWarning =
        "⚠️ Tidak dapat memvalidasi waktu sistem. Pastikan koneksi internet stabil.";
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
      error = "Gagal mengakses kamera. Pastikan browser memiliki izin kamera.";
      console.error("Camera error:", err);
    }
  }

  function stopCamera() {
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
        "Gagal mendapatkan lokasi. Pastikan GPS aktif dan izin lokasi diberikan.";
      console.error("Location error:", err);
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

  async function submitAbsensi() {
    if (!capturedPhoto || !locationData) {
      error = "Foto dan lokasi diperlukan untuk absensi";
      return;
    }

    // Block submission if there's a time security warning
    if (timeSecurityWarning) {
      error =
        "Tidak dapat melakukan absensi karena ada masalah dengan waktu sistem. Silakan sinkronkan waktu perangkat Anda.";
      return;
    }

    isProcessing = true;

    try {
      // Convert captured photo to File object
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const file = new File([blob], `absensi-${type}-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      dispatch("submit", {
        type,
        foto: file,
        lokasi: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address,
          accuracy: locationData.accuracy,
        },
        keterangan: `Absensi ${type} otomatis`,
      });

      closeModal();
    } catch (err) {
      error = "Gagal memproses absensi. Silakan coba lagi.";
      console.error("Submit error:", err);
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
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-overlay"
    on:click={closeModal}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="modal-content" on:click|stopPropagation role="document">
      <div class="modal-header">
        <h2>📷 Absensi {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
        <button class="close-btn" on:click={closeModal}>✕</button>
      </div>

      <div class="modal-body">
        {#if error}
          <div class="error-message">
            ⚠️ {error}
          </div>
        {/if}

        <!-- Time Security Status -->
        {#if isValidatingTime}
          <div class="time-validation-status validating">
            <div class="loading-spinner-small"></div>
            🔒 Memvalidasi keamanan waktu...
          </div>
        {:else if timeSecurityWarning}
          <div class="time-validation-status warning">
            {timeSecurityWarning}
          </div>
        {:else}
          <div class="time-validation-status success">
            ✅ Waktu sistem valid dan aman
          </div>
        {/if}

        <!-- Location Status -->
        <div class="location-status">
          {#if locationData}
            <div class="location-success">
              <div class="location-header">
                <i class="fas fa-map-marker-alt"></i>
                <span class="location-title">Lokasi Terdeteksi</span>
              </div>
              <div class="location-details">
                <div class="location-address">
                  {locationData.address ||
                    `Koordinat: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`}
                </div>
              </div>
            </div>
          {:else}
            <div class="location-loading">
              <div class="loading-spinner"></div>
              <span>Mendapatkan lokasi GPS...</span>
            </div>
          {/if}
        </div>

        <!-- Camera Section -->
        <div class="camera-section">
          {#if !capturedPhoto}
            <div class="video-container">
              <!-- svelte-ignore a11y-media-has-caption -->
              <video
                bind:this={videoElement}
                autoplay
                muted
                playsinline
                class="camera-video"
              ></video>

              <div class="camera-overlay">
                <div class="camera-frame"></div>
                <div class="instructions">Posisikan wajah di dalam frame</div>
              </div>
            </div>

            <div class="camera-controls">
              <button
                class="capture-btn"
                on:click={capturePhoto}
                disabled={isCapturing || !locationData}
              >
                {isCapturing ? "📸 Mengambil..." : "📸 Ambil Foto"}
              </button>
            </div>
          {:else}
            <div class="photo-preview">
              <img src={capturedPhoto} alt="Foto absensi yang diambil" />

              <div class="photo-controls">
                <button class="retake-btn" on:click={retakePhoto}>
                  🔄 Ambil Ulang
                </button>
                <button
                  class="submit-btn"
                  on:click={submitAbsensi}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "⏳ Memproses..."
                    : `✅ Konfirmasi Absensi ${type.charAt(0).toUpperCase() + type.slice(1)}`}
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
  /* .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  } */

  .modal-content {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 2px solid #f0f0f0;
  }

  .modal-header h2 {
    margin: 0;
    color: #2c3e50;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: #c0392b;
  }

  .modal-body {
    padding: 20px;
  }

  .error-message {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 15px;
    font-size: 14px;
  }

  /* Time Security Status Styles */
  .time-validation-status {
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 15px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-validation-status.validating {
    background: #e3f2fd;
    border: 1px solid #90caf9;
    color: #1565c0;
  }

  .time-validation-status.warning {
    background: #fff3e0;
    border: 1px solid #ffb74d;
    color: #e65100;
  }

  .time-validation-status.success {
    background: #e8f5e8;
    border: 1px solid #81c784;
    color: #2e7d32;
  }

  .loading-spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #e3f2fd;
    border-top: 2px solid #1565c0;
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

  .location-status {
    margin-bottom: 20px;
    padding: 15px;
    border-radius: 12px;
    font-size: 14px;
  }

  .location-success {
    background: linear-gradient(135deg, #d4edda, #c3e6cb);
    border: 1px solid #c3e6cb;
    color: #155724;
  }

  .location-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .location-header i {
    color: #27ae60;
    font-size: 16px;
  }

  .location-title {
    font-weight: 600;
    color: #155724;
  }

  .location-details {
    margin-left: 24px;
  }

  .location-address {
    font-weight: 500;
    color: #155724;
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .location-loading {
    background: linear-gradient(135deg, #fff3cd, #ffeaa7);
    border: 1px solid #ffeaa7;
    color: #856404;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f4f6;
    border-top: 2px solid #856404;
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

  .camera-section {
    text-align: center;
  }

  .video-container {
    position: relative;
    display: inline-block;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .camera-video {
    width: 100%;
    max-width: 400px;
    height: auto;
    display: block;
  }

  .camera-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .camera-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 250px;
    border: 3px solid #3498db;
    border-radius: 12px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
  }

  .instructions {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }

  .camera-controls {
    display: flex;
    justify-content: center;
  }

  .capture-btn {
    background: #27ae60;
    color: white;
    border: none;
    padding: 15px 30px;
    border-radius: 25px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
  }

  .capture-btn:hover:not(:disabled) {
    background: #229954;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
  }

  .capture-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .photo-preview img {
    width: 100%;
    max-width: 400px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .photo-controls {
    display: flex;
    gap: 15px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .retake-btn {
    background: #f39c12;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .retake-btn:hover {
    background: #d68910;
  }

  .submit-btn {
    background: #27ae60;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
    flex: 1;
    max-width: 200px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #229954;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .modal-content {
      width: 95%;
      margin: 10px;
    }

    .modal-header,
    .modal-body {
      padding: 15px;
    }

    .camera-frame {
      width: 150px;
      height: 200px;
    }

    .photo-controls {
      flex-direction: column;
      align-items: center;
    }

    .submit-btn {
      max-width: none;
      width: 100%;
    }
  }
</style>
