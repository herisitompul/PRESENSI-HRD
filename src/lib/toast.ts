// Toast notification utility
export function showToast(
  message: string,
  type: "success" | "error" | "info" | "holiday" = "info",
  duration: number = 3000
) {
  // Buat element toast
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${getToastIcon(type)}"></i>
      <span>${message}</span>
    </div>
  `;

  // Style untuk toast
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: getToastBackground(type),
    color: "white",
    padding: "12px 16px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    zIndex: "10000",
    minWidth: "300px",
    maxWidth: "400px",
    animation: "slideIn 0.3s ease-out forwards",
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
  });

  // Tambah CSS animation jika belum ada
  if (!document.querySelector("#toast-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "toast-styles";
    styleSheet.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .toast-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // Tambahkan ke body
  document.body.appendChild(toast);

  // Hapus setelah durasi yang ditentukan
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out forwards";
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }, duration);
}

function getToastIcon(type: string): string {
  switch (type) {
    case "success":
      return "fa-check-circle";
    case "error":
      return "fa-exclamation-circle";
    case "info":
      return "fa-info-circle";
    case "holiday":
      return "fa-calendar-day";
    default:
      return "fa-info-circle";
  }
}

function getToastBackground(type: string): string {
  switch (type) {
    case "success":
      return "linear-gradient(135deg, #10b981, #059669)";
    case "error":
      return "linear-gradient(135deg, #ef4444, #dc2626)";
    case "info":
      return "linear-gradient(135deg, #3b82f6, #2563eb)";
    case "holiday":
      return "linear-gradient(135deg, #16a34a, #15803d)";
    default:
      return "linear-gradient(135deg, #3b82f6, #2563eb)";
  }
}

// Export toast object for easier usage
export const toast = {
  success: (message: string, duration?: number) =>
    showToast(message, "success", duration),
  error: (message: string, duration?: number) =>
    showToast(message, "error", duration),
  info: (message: string, duration?: number) =>
    showToast(message, "info", duration),
  holiday: (message: string, duration?: number) =>
    showToast(message, "holiday", duration || 5000),
};
