import { writable } from "svelte/store";
import { authenticateUser, clearDirectusCache, type Akun } from "./directus";

// User store - now using Akun interface instead of Firebase User
export const user = writable<Akun | null>(null);
export const loading = writable(false);

// Function to get current user from localStorage
function getCurrentUserFromStorage(): Akun | null {
  if (typeof window === "undefined") return null;

  try {
    const userData = localStorage.getItem("currentUser");
    return userData ? JSON.parse(userData) : null;
  } catch {
    return null;
  }
}

// Function to set current user in localStorage
function setCurrentUserToStorage(userData: Akun | null) {
  if (typeof window === "undefined") return;

  if (userData) {
    localStorage.setItem("currentUser", JSON.stringify(userData));
  } else {
    localStorage.removeItem("currentUser");
  }
}

// Initialize user from localStorage
if (typeof window !== "undefined") {
  const storedUser = getCurrentUserFromStorage();
  if (storedUser) {
    user.set(storedUser);
  }
}

export const login = async (email: string, password: string) => {
  try {
    loading.set(true);

    const result = await authenticateUser(email, password);

    if (result.success && result.user) {
      // Set user data in store and localStorage
      user.set(result.user);
      setCurrentUserToStorage(result.user);

      return { success: true, user: result.user };
    } else {
      return { success: false, error: result.error || "Login gagal" };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    loading.set(false);
  }
};

export const logout = async () => {
  try {
    // Clear user data
    user.set(null);
    setCurrentUserToStorage(null);

    // Clear any cached data
    clearUserCache();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Function to clear user-specific cached data
export function clearUserCache() {
  // Clear localStorage if any user data is stored there
  if (typeof window !== "undefined") {
    // Clear any localStorage keys that might contain user data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes("user") ||
          key.includes("absensi") ||
          key.includes("izin") ||
          key.includes("lembur") ||
          key.includes("kasbon"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear sessionStorage as well
    sessionStorage.clear();

    console.log("User cache cleared");
  }
}
