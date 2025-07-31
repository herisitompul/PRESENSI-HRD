<!-- Security Dashboard for Admin -->
<script lang="ts">
  import { onMount } from "svelte";
  import { getAbsensiHistory } from "$lib/absensi";
  import { validateClientTime, getSecureTimestamp } from "$lib/time-security";

  interface SecurityAlert {
    id: string;
    userId: string;
    userName: string;
    timestamp: Date;
    type:
      | "TIME_MANIPULATION"
      | "SUSPICIOUS_PATTERN"
      | "OUT_OF_HOURS"
      | "LOCATION_ANOMALY";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
    metadata: any;
  }

  let securityAlerts: SecurityAlert[] = [];
  let timeValidationResults: any = null;
  let isLoading = true;
  let serverTime = "";
  let systemHealth = {
    timeValidation: "unknown",
    externalApis: "unknown",
    database: "unknown",
  };

  onMount(async () => {
    await loadSecurityDashboard();
    await checkSystemHealth();

    // Refresh every 30 seconds
    setInterval(async () => {
      await checkSystemHealth();
    }, 30000);
  });

  async function loadSecurityDashboard() {
    isLoading = true;

    try {
      // Get current time validation status
      timeValidationResults = await validateClientTime();

      // Get secure server timestamp
      const { serverTime: st } = await getSecureTimestamp();
      serverTime = st.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Simulate loading security alerts (replace with actual API call)
      await loadSecurityAlerts();
    } catch (error) {
      console.error("Error loading security dashboard:", error);
    } finally {
      isLoading = false;
    }
  }

  async function loadSecurityAlerts() {
    // This would typically come from your backend API
    // For demo purposes, we'll simulate some alerts
    securityAlerts = [
      {
        id: "1",
        userId: "user123",
        userName: "John Doe",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        type: "TIME_MANIPULATION",
        severity: "HIGH",
        description: "Waktu perangkat berbeda 15 menit dari server",
        metadata: { timeDifference: 900000, userAgent: "Chrome/120.0" },
      },
      {
        id: "2",
        userId: "user456",
        userName: "Jane Smith",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        type: "SUSPICIOUS_PATTERN",
        severity: "MEDIUM",
        description: "Absensi selalu pada waktu yang sama persis (8:00:00)",
        metadata: { pattern: "exact_timing", frequency: 5 },
      },
      {
        id: "3",
        userId: "user789",
        userName: "Bob Wilson",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        type: "OUT_OF_HOURS",
        severity: "MEDIUM",
        description: "Absensi di luar jam kerja (23:30)",
        metadata: { attemptTime: "23:30:00" },
      },
    ];
  }

  async function checkSystemHealth() {
    try {
      // Check time validation
      const timeCheck = await validateClientTime();
      systemHealth.timeValidation = timeCheck.isValid ? "healthy" : "warning";

      // Check external APIs (simplified)
      try {
        await fetch("https://worldtimeapi.org/api/timezone/Asia/Jakarta", {
          signal: AbortSignal.timeout(5000),
        });
        systemHealth.externalApis = "healthy";
      } catch {
        systemHealth.externalApis = "error";
      }

      // Database health would be checked via backend
      systemHealth.database = "healthy";
    } catch (error) {
      console.error("System health check failed:", error);
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case "CRITICAL":
        return "#dc2626";
      case "HIGH":
        return "#ea580c";
      case "MEDIUM":
        return "#d97706";
      case "LOW":
        return "#65a30d";
      default:
        return "#6b7280";
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "TIME_MANIPULATION":
        return "⏰";
      case "SUSPICIOUS_PATTERN":
        return "🔍";
      case "OUT_OF_HOURS":
        return "🕐";
      case "LOCATION_ANOMALY":
        return "📍";
      default:
        return "⚠️";
    }
  }

  function formatTimestamp(date: Date) {
    return date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="security-dashboard">
  <div class="dashboard-header">
    <h1>🔒 Security Dashboard</h1>
    <div class="current-time">
      <span class="label">Server Time (WIB):</span>
      <span class="time">{serverTime}</span>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>Loading security data...</span>
    </div>
  {:else}
    <!-- System Health Status -->
    <div class="health-section">
      <h2>🏥 System Health</h2>
      <div class="health-grid">
        <div class="health-item">
          <div class="health-icon {systemHealth.timeValidation}">
            {systemHealth.timeValidation === "healthy" ? "✅" : "⚠️"}
          </div>
          <div class="health-details">
            <div class="health-title">Time Validation</div>
            <div class="health-status {systemHealth.timeValidation}">
              {systemHealth.timeValidation === "healthy"
                ? "Healthy"
                : "Warning"}
            </div>
          </div>
        </div>

        <div class="health-item">
          <div class="health-icon {systemHealth.externalApis}">
            {systemHealth.externalApis === "healthy"
              ? "✅"
              : systemHealth.externalApis === "error"
                ? "❌"
                : "⚠️"}
          </div>
          <div class="health-details">
            <div class="health-title">External APIs</div>
            <div class="health-status {systemHealth.externalApis}">
              {systemHealth.externalApis === "healthy"
                ? "Healthy"
                : systemHealth.externalApis === "error"
                  ? "Error"
                  : "Unknown"}
            </div>
          </div>
        </div>

        <div class="health-item">
          <div class="health-icon {systemHealth.database}">
            {systemHealth.database === "healthy" ? "✅" : "❌"}
          </div>
          <div class="health-details">
            <div class="health-title">Database</div>
            <div class="health-status {systemHealth.database}">
              {systemHealth.database === "healthy" ? "Healthy" : "Error"}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Time Validation Status -->
    {#if timeValidationResults}
      <div class="validation-section">
        <h2>⏱️ Time Validation Status</h2>
        <div
          class="validation-card {timeValidationResults.isValid
            ? 'valid'
            : 'invalid'}"
        >
          <div class="validation-header">
            <span class="validation-icon">
              {timeValidationResults.isValid ? "✅" : "❌"}
            </span>
            <span class="validation-title">
              {timeValidationResults.isValid
                ? "Time Synchronization Valid"
                : "Time Synchronization Issue"}
            </span>
          </div>
          <div class="validation-details">
            <div class="detail-item">
              <span class="label">Client Time:</span>
              <span class="value"
                >{timeValidationResults.clientTime.toLocaleString(
                  "id-ID"
                )}</span
              >
            </div>
            <div class="detail-item">
              <span class="label">Server Time:</span>
              <span class="value"
                >{timeValidationResults.serverTime.toLocaleString(
                  "id-ID"
                )}</span
              >
            </div>
            <div class="detail-item">
              <span class="label">Time Difference:</span>
              <span class="value"
                >{Math.round(timeValidationResults.timeDifference / 1000)} seconds</span
              >
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Security Alerts -->
    <div class="alerts-section">
      <h2>🚨 Security Alerts</h2>
      {#if securityAlerts.length === 0}
        <div class="no-alerts">
          <div class="no-alerts-icon">🛡️</div>
          <div class="no-alerts-text">
            No security alerts. System is secure.
          </div>
        </div>
      {:else}
        <div class="alerts-list">
          {#each securityAlerts as alert}
            <div
              class="alert-card"
              style="border-left-color: {getSeverityColor(alert.severity)}"
            >
              <div class="alert-header">
                <div class="alert-title">
                  <span class="alert-icon">{getTypeIcon(alert.type)}</span>
                  <span class="alert-user">{alert.userName}</span>
                  <span class="alert-type">{alert.type.replace("_", " ")}</span>
                </div>
                <div
                  class="alert-severity"
                  style="color: {getSeverityColor(alert.severity)}"
                >
                  {alert.severity}
                </div>
              </div>
              <div class="alert-description">{alert.description}</div>
              <div class="alert-timestamp">
                {formatTimestamp(alert.timestamp)}
              </div>
              {#if alert.metadata}
                <div class="alert-metadata">
                  <details>
                    <summary>Technical Details</summary>
                    <pre>{JSON.stringify(alert.metadata, null, 2)}</pre>
                  </details>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .security-dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e7eb;
  }

  .dashboard-header h1 {
    margin: 0;
    color: #1f2937;
    font-size: 28px;
    font-weight: 700;
  }

  .current-time {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .current-time .label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .current-time .time {
    font-size: 16px;
    color: #1f2937;
    font-weight: 600;
    font-family: "Courier New", monospace;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: #6b7280;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .health-section,
  .validation-section,
  .alerts-section {
    margin-bottom: 40px;
  }

  .health-section h2,
  .validation-section h2,
  .alerts-section h2 {
    margin: 0 0 20px 0;
    color: #1f2937;
    font-size: 20px;
    font-weight: 600;
  }

  .health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .health-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .health-icon {
    font-size: 24px;
  }

  .health-title {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 4px;
  }

  .health-status {
    font-size: 14px;
    font-weight: 500;
  }

  .health-status.healthy {
    color: #059669;
  }
  .health-status.warning {
    color: #d97706;
  }
  .health-status.error {
    color: #dc2626;
  }

  .validation-card {
    padding: 24px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .validation-card.valid {
    border-left: 4px solid #059669;
  }

  .validation-card.invalid {
    border-left: 4px solid #dc2626;
  }

  .validation-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .validation-icon {
    font-size: 20px;
  }

  .validation-title {
    font-weight: 600;
    color: #1f2937;
  }

  .validation-details {
    display: grid;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-item .label {
    color: #6b7280;
    font-weight: 500;
  }

  .detail-item .value {
    color: #1f2937;
    font-weight: 600;
    font-family: "Courier New", monospace;
  }

  .no-alerts {
    text-align: center;
    padding: 60px;
    color: #6b7280;
  }

  .no-alerts-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .no-alerts-text {
    font-size: 18px;
    font-weight: 500;
  }

  .alerts-list {
    display: grid;
    gap: 16px;
  }

  .alert-card {
    padding: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-left: 4px solid #6b7280;
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .alert-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .alert-icon {
    font-size: 20px;
  }

  .alert-user {
    font-weight: 600;
    color: #1f2937;
  }

  .alert-type {
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 500;
  }

  .alert-severity {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
  }

  .alert-description {
    color: #4b5563;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .alert-timestamp {
    font-size: 12px;
    color: #6b7280;
    font-family: "Courier New", monospace;
  }

  .alert-metadata {
    margin-top: 12px;
  }

  .alert-metadata details {
    cursor: pointer;
  }

  .alert-metadata summary {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .alert-metadata pre {
    margin-top: 8px;
    background: #f9fafb;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    overflow-x: auto;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
