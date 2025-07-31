<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import LemburCameraModal from "./LemburCameraModal.svelte";
  import { showToast } from "$lib/toast";
  import {
    absensiMasukLembur,
    absensiKeluarLembur,
    absensiMasukLemburMandiri,
    absensiKeluarLemburMandiri,
    type AbsensiLemburData,
  } from "$lib/absensi-lembur";

  export let type: "masuk" | "keluar" = "masuk";
  export let disabled = false;
  export let loading = false;
  export let lemburId: string; // Required: ID pengajuan lembur atau "mandiri"
  export let isMandiri = false; // New prop untuk mode mandiri
  export let lemburDescription = ""; // Deskripsi pekerjaan lembur untuk ditampilkan di modal

  const dispatch = createEventDispatcher();

  let showModal = false;
  let processing = false;

  function openModal() {
    if (disabled || loading) {
      return;
    }
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleAbsensiSubmit(event: CustomEvent) {
    const {
      foto,
      lokasi,
      keterangan,
      isMandiri: modalIsMandiri,
      lemburNote,
    } = event.detail;

    processing = true;

    try {
      let fotoFile: File;

      // Check if foto is already a File object or base64 string
      if (foto instanceof File) {
        // Already a File object from CameraModal
        fotoFile = foto;
      } else if (typeof foto === "string") {
        // Base64 string, convert to File
        function dataURLtoFile(dataURL: string, filename: string): File {
          const arr = dataURL.split(",");
          const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new File([u8arr], filename, { type: mime });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `absensi-lembur-${type}-${timestamp}.jpg`;
        fotoFile = dataURLtoFile(foto, filename);
      } else {
        throw new Error("Format foto tidak valid");
      }

      const submissionData = {
        lembur_id: isMandiri ? undefined : lemburId,
        foto: fotoFile,
        lokasi,
        keterangan,
      };

      let result;

      if (isMandiri) {
        // Mode mandiri - gunakan fungsi khusus
        if (type === "masuk") {
          result = await absensiMasukLemburMandiri(submissionData);
          showToast(
            "Absensi masuk lembur mandiri berhasil dicatat!",
            "success"
          );
        } else {
          result = await absensiKeluarLemburMandiri(submissionData);
          showToast(
            "Absensi keluar lembur mandiri berhasil dicatat!",
            "success"
          );
        }
      } else {
        // Mode dengan pengajuan - convert File to base64 for legacy interface
        let fotoBase64: string;

        if (fotoFile instanceof File) {
          // Convert File to base64 for legacy AbsensiLemburData interface
          fotoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(fotoFile);
          });
        } else {
          fotoBase64 = fotoFile as string;
        }

        const absensiData: AbsensiLemburData = {
          type,
          foto: fotoBase64,
          lokasi,
          keterangan,
          timestamp: new Date().toISOString(),
        };

        if (type === "masuk") {
          result = await absensiMasukLembur(lemburId, absensiData);
          showToast("Absensi masuk lembur berhasil dicatat!", "success");
        } else {
          result = await absensiKeluarLembur(lemburId, absensiData);
          showToast("Absensi keluar lembur berhasil dicatat!", "success");
        }
      }

      dispatch("success", { type, data: result });
      showModal = false;
    } catch (error) {
      console.error("Lembur absensi error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gagal melakukan absensi lembur";
      showToast(errorMessage, "error");
    } finally {
      processing = false;
    }
  }
</script>

{#if showModal}
  <LemburCameraModal
    isOpen={showModal}
    {type}
    {isMandiri}
    {lemburDescription}
    on:submit={handleAbsensiSubmit}
    on:close={closeModal}
  />
{/if}

<button
  class="absensi-btn {type} {disabled || loading || processing
    ? 'disabled'
    : ''}"
  {disabled}
  on:click={openModal}
  aria-label="Absensi {type === 'masuk' ? 'Masuk' : 'Keluar'} Lembur"
>
  <div class="btn-content">
    <div class="btn-icon">
      {#if loading || processing}
        <div class="spinner"></div>
      {:else if type === "masuk"}
        <i class="fas fa-sign-in-alt"></i>
      {:else}
        <i class="fas fa-sign-out-alt"></i>
      {/if}
    </div>
    <div class="btn-text">
      <h3>
        {#if processing}
          Memproses...
        {:else if type === "masuk"}
          Absensi Masuk Lembur
        {:else}
          Absensi Keluar Lembur
        {/if}
      </h3>
      <p>
        {#if processing}
          Sedang menyimpan data...
        {:else if type === "masuk"}
          Foto + Lokasi saat mulai lembur
        {:else}
          Foto + Lokasi saat selesai lembur
        {/if}
      </p>
    </div>
  </div>
</button>

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

  .absensi-btn {
    width: 100%;
    padding: 20px;
    border: none;
    border-radius: 16px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow:
      0 4px 20px rgba(59, 130, 246, 0.3),
      0 0 0 1px rgba(59, 130, 246, 0.1);
    position: relative;
    overflow: hidden;
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .absensi-btn.keluar {
    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
    box-shadow:
      0 4px 20px rgba(220, 38, 38, 0.3),
      0 0 0 1px rgba(220, 38, 38, 0.1);
  }

  .absensi-btn:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 8px 30px rgba(59, 130, 246, 0.4),
      0 0 0 1px rgba(59, 130, 246, 0.2);
  }

  .absensi-btn.keluar:hover:not(.disabled) {
    box-shadow:
      0 8px 30px rgba(220, 38, 38, 0.4),
      0 0 0 1px rgba(220, 38, 38, 0.2);
  }

  .absensi-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .absensi-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.5s ease;
  }

  .absensi-btn:hover:not(.disabled)::before {
    left: 100%;
  }

  .btn-content {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    z-index: 1;
    position: relative;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    flex-shrink: 0;
  }

  .btn-icon i {
    font-size: 20px;
  }

  .btn-text {
    text-align: left;
    flex: 1;
  }

  .btn-text h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }

  .btn-text p {
    margin: 0;
    font-size: 14px;
    opacity: 0.9;
    line-height: 1.3;
  }

  .spinner {
    width: 20px;
    height: 20px;
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

  @media (max-width: 768px) {
    .absensi-btn {
      padding: 16px;
      min-height: 70px;
    }

    .btn-content {
      gap: 12px;
    }

    .btn-icon {
      width: 40px;
      height: 40px;
    }

    .btn-icon i {
      font-size: 18px;
    }

    .btn-text h3 {
      font-size: 16px;
    }

    .btn-text p {
      font-size: 13px;
    }
  }
</style>
