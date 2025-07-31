<script lang="ts">
  import type { AbsensiLembur } from "$lib/absensi-lembur";

  export let lemburAbsensiData: {
    masuk?: {
      foto: string;
      lokasi: { latitude: number; longitude: number; address?: string };
      timestamp: string;
    };
    keluar?: {
      foto: string;
      lokasi: { latitude: number; longitude: number; address?: string };
      timestamp: string;
    };
  } = {};

  // New prop for AbsensiLembur object
  export let absensi: AbsensiLembur | null = null;

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatTimeHHMM(timeString?: string): string {
    if (!timeString) return "-";
    return timeString.substring(0, 5); // HH:MM
  }

  function formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
</script>

{#if absensi}
  <!-- Display AbsensiLembur object data -->
  <div class="lembur-absensi-data">
    <div class="data-header">
      <h3>📸 Data Absensi Lembur</h3>
      <p>Detail absensi lembur yang tercatat</p>
    </div>

    <div class="absensi-records">
      <!-- Absensi Masuk -->
      {#if absensi.waktu_masuk}
        <div class="record-card masuk">
          <div class="record-header">
            <div class="record-icon">
              <i class="fas fa-sign-in-alt"></i>
            </div>
            <div class="record-info">
              <h4>Absensi Masuk Lembur</h4>
              <p class="timestamp">
                {absensi.tanggal} - {formatTimeHHMM(absensi.waktu_masuk)}
              </p>
            </div>
          </div>

          <div class="record-content">
            <!-- Lokasi -->
            <div class="location-section">
              <div class="location-label">
                <i class="fas fa-map-marker-alt"></i>
                Lokasi Saat Masuk
              </div>
              <div class="location-info">
                {#if absensi.lokasi_masuk_address}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      {absensi.lokasi_masuk_address}
                    </span>
                  </div>
                {:else if absensi.lokasi_masuk_lat && absensi.lokasi_masuk_lng}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      Koordinat: {absensi.lokasi_masuk_lat.toFixed(6)}, {absensi.lokasi_masuk_lng.toFixed(
                        6
                      )}
                    </span>
                  </div>
                {/if}
                {#if absensi.keterangan_masuk}
                  <div class="keterangan">
                    <span class="keterangan-label">Keterangan:</span>
                    <span class="keterangan-value">
                      {absensi.keterangan_masuk}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Absensi Keluar -->
      {#if absensi.waktu_keluar}
        <div class="record-card keluar">
          <div class="record-header">
            <div class="record-icon">
              <i class="fas fa-sign-out-alt"></i>
            </div>
            <div class="record-info">
              <h4>Absensi Keluar Lembur</h4>
              <p class="timestamp">
                {absensi.tanggal} - {formatTimeHHMM(absensi.waktu_keluar)}
              </p>
            </div>
          </div>

          <div class="record-content">
            <!-- Lokasi -->
            <div class="location-section">
              <div class="location-label">
                <i class="fas fa-map-marker-alt"></i>
                Lokasi Saat Keluar
              </div>
              <div class="location-info">
                {#if absensi.lokasi_keluar_address}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      {absensi.lokasi_keluar_address}
                    </span>
                  </div>
                {:else if absensi.lokasi_keluar_lat && absensi.lokasi_keluar_lng}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      Koordinat: {absensi.lokasi_keluar_lat.toFixed(6)}, {absensi.lokasi_keluar_lng.toFixed(
                        6
                      )}
                    </span>
                  </div>
                {/if}
                {#if absensi.keterangan_keluar}
                  <div class="keterangan">
                    <span class="keterangan-label">Keterangan:</span>
                    <span class="keterangan-value">
                      {absensi.keterangan_keluar}
                    </span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Durasi Lembur -->
            {#if absensi.durasi_aktual_jam !== undefined && absensi.durasi_aktual_menit !== undefined}
              <div class="duration-section">
                <div class="duration-label">
                  <i class="fas fa-clock"></i>
                  Total Durasi Lembur
                </div>
                <div class="duration-value">
                  {absensi.durasi_aktual_jam} jam {absensi.durasi_aktual_menit} menit
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else if lemburAbsensiData.masuk || lemburAbsensiData.keluar}
  <div class="lembur-absensi-data">
    <div class="data-header">
      <h3>📸 Data Absensi Lembur</h3>
      <p>Preview foto dan lokasi yang telah diambil</p>
    </div>

    <div class="absensi-records">
      <!-- Absensi Masuk -->
      {#if lemburAbsensiData.masuk}
        <div class="record-card masuk">
          <div class="record-header">
            <div class="record-icon">
              <i class="fas fa-sign-in-alt"></i>
            </div>
            <div class="record-info">
              <h4>Absensi Masuk Lembur</h4>
              <p class="timestamp">
                {formatDate(lemburAbsensiData.masuk.timestamp)} - {formatTime(
                  lemburAbsensiData.masuk.timestamp
                )}
              </p>
            </div>
          </div>

          <div class="record-content">
            <!-- Foto -->
            <div class="photo-section">
              <div class="photo-label">
                <i class="fas fa-camera"></i>
                Foto Saat Masuk
              </div>
              <div class="photo-container">
                <img
                  src={lemburAbsensiData.masuk.foto}
                  alt="Foto absensi masuk lembur"
                  class="absensi-photo"
                />
              </div>
            </div>

            <!-- Lokasi -->
            <div class="location-section">
              <div class="location-label">
                <i class="fas fa-map-marker-alt"></i>
                Lokasi Saat Masuk
              </div>
              <div class="location-info">
                {#if lemburAbsensiData.masuk.lokasi.address}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      {lemburAbsensiData.masuk.lokasi.address}
                    </span>
                  </div>
                {:else}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      Koordinat: {lemburAbsensiData.masuk.lokasi.latitude.toFixed(
                        6
                      )}, {lemburAbsensiData.masuk.lokasi.longitude.toFixed(6)}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Absensi Keluar -->
      {#if lemburAbsensiData.keluar}
        <div class="record-card keluar">
          <div class="record-header">
            <div class="record-icon">
              <i class="fas fa-sign-out-alt"></i>
            </div>
            <div class="record-info">
              <h4>Absensi Keluar Lembur</h4>
              <p class="timestamp">
                {formatDate(lemburAbsensiData.keluar.timestamp)} - {formatTime(
                  lemburAbsensiData.keluar.timestamp
                )}
              </p>
            </div>
          </div>

          <div class="record-content">
            <!-- Foto -->
            <div class="photo-section">
              <div class="photo-label">
                <i class="fas fa-camera"></i>
                Foto Saat Keluar
              </div>
              <div class="photo-container">
                <img
                  src={lemburAbsensiData.keluar.foto}
                  alt="Foto absensi keluar lembur"
                  class="absensi-photo"
                />
              </div>
            </div>

            <!-- Lokasi -->
            <div class="location-section">
              <div class="location-label">
                <i class="fas fa-map-marker-alt"></i>
                Lokasi Saat Keluar
              </div>
              <div class="location-info">
                {#if lemburAbsensiData.keluar.lokasi.address}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      {lemburAbsensiData.keluar.lokasi.address}
                    </span>
                  </div>
                {:else}
                  <div class="address">
                    <span class="address-label">📍 Lokasi:</span>
                    <span class="address-value">
                      Koordinat: {lemburAbsensiData.keluar.lokasi.latitude.toFixed(
                        6
                      )}, {lemburAbsensiData.keluar.lokasi.longitude.toFixed(6)}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .lembur-absensi-data {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(20px);
    margin-top: 24px;
  }

  .data-header {
    margin-bottom: 20px;
  }

  .data-header h3 {
    margin: 0 0 8px 0;
    color: #f1f5f9;
    font-size: 20px;
    font-weight: 600;
  }

  .data-header p {
    margin: 0;
    color: #94a3b8;
    font-size: 14px;
  }

  .absensi-records {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .record-card {
    background: rgba(30, 41, 59, 0.6);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .record-card.masuk {
    border-left: 4px solid #3b82f6;
  }

  .record-card.keluar {
    border-left: 4px solid #dc2626;
  }

  .record-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .record-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .record-card.masuk .record-icon {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .record-card.keluar .record-icon {
    background: rgba(220, 38, 38, 0.2);
    color: #dc2626;
  }

  .record-info h4 {
    margin: 0 0 4px 0;
    color: #f1f5f9;
    font-size: 16px;
    font-weight: 600;
  }

  .timestamp {
    margin: 0;
    color: #94a3b8;
    font-size: 13px;
  }

  .record-content {
    display: grid;
    gap: 16px;
  }

  .photo-section,
  .location-section {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 16px;
  }

  .photo-label,
  .location-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #f1f5f9;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
  }

  .photo-container {
    display: flex;
    justify-content: center;
  }

  .absensi-photo {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .location-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .address {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .address-label {
    color: #94a3b8;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .address-value {
    color: #f1f5f9;
    font-size: 14px;
    font-family: inherit;
  }

  /* Additional styles for AbsensiLembur display */
  .keterangan {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
  }

  .keterangan-label {
    font-weight: 600;
    color: #cbd5e1;
    letter-spacing: 0.5px;
  }

  .keterangan-value {
    color: #f1f5f9;
    font-size: 14px;
    text-align: right;
    max-width: 60%;
    word-wrap: break-word;
  }

  .duration-section {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
  }

  .duration-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #22c55e;
    margin-bottom: 8px;
  }

  .duration-label i {
    font-size: 16px;
  }

  .duration-value {
    font-size: 18px;
    font-weight: 700;
    color: #22c55e;
    text-align: center;
  }

  @media (min-width: 768px) {
    .record-content {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 480px) {
    .lembur-absensi-data {
      padding: 16px;
    }

    .record-card {
      padding: 16px;
    }

    .record-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .record-icon {
      width: 32px;
      height: 32px;
      font-size: 14px;
    }

    .absensi-photo {
      max-height: 150px;
    }
  }
</style>
