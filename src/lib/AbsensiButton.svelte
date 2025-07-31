<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import CameraModal from "./CameraModal.svelte";
  import { absensiMasuk, absensiKeluar } from "$lib/absensi";
  import { toast } from "$lib/toast";

  export let type: "masuk" | "keluar" = "masuk";
  export let disabled = false;
  export let loading = false;

  const dispatch = createEventDispatcher();

  let showModal = false;
  let processing = false;

  function openModal() {
    if (disabled || loading) return;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleAbsensiSubmit(event: CustomEvent) {
    const { foto, lokasi, keterangan } = event.detail;

    processing = true;

    try {
      if (type === "masuk") {
        await absensiMasuk({
          foto,
          lokasi,
          keterangan,
        });
        toast.success("Absensi masuk berhasil dicatat!");
      } else {
        await absensiKeluar({
          foto,
          lokasi,
          keterangan,
        });
        toast.success("Absensi keluar berhasil dicatat!");
      }

      dispatch("success", { type });
      showModal = false;
    } catch (error) {
      console.error("Absensi error:", error);
      toast.error(
        error instanceof Error ? error.message : "Gagal mencatat absensi"
      );
    } finally {
      processing = false;
    }
  }

  $: buttonText = type === "masuk" ? "Absensi Masuk" : "Absensi Keluar";
  $: buttonIcon = type === "masuk" ? "🟢" : "🔴";
  $: buttonClass = type === "masuk" ? "btn-masuk" : "btn-keluar";
</script>

<button
  class="absensi-btn {buttonClass}"
  on:click={openModal}
  disabled={disabled || loading || processing}
>
  {#if processing}
    ⏳ Memproses...
  {:else if loading}
    🔄 Loading...
  {:else}
    {buttonIcon} {buttonText}
  {/if}
</button>

<CameraModal
  bind:isOpen={showModal}
  {type}
  on:submit={handleAbsensiSubmit}
  on:close={closeModal}
/>

<style>
  .absensi-btn {
    width: 100%;
    padding: 20px 24px;
    border: none;
    border-radius: 20px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 70px;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    position: relative;
    overflow: hidden;
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
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.6s;
  }

  .absensi-btn:hover::before {
    left: 100%;
  }

  .btn-masuk {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow:
      0 8px 32px rgba(16, 185, 129, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-masuk:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(16, 185, 129, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .btn-keluar {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow:
      0 8px 32px rgba(239, 68, 68, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-keluar:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-3px);
    box-shadow:
      0 12px 40px rgba(239, 68, 68, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .absensi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .absensi-btn:disabled::before {
    display: none;
  }

  .absensi-btn:active:not(:disabled) {
    transform: translateY(-1px);
  }

  @media (max-width: 480px) {
    .absensi-btn {
      padding: 18px 20px;
      font-size: 15px;
      min-height: 65px;
      gap: 10px;
    }
  }
</style>
