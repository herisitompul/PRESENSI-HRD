// src/lib/services.ts
// This file centralizes all service initialization and provides helper functions
import { initDirectus } from "./directus";
import { user } from "./auth";
import { get } from "svelte/store";

// Initialize all services
export async function initServices() {
  try {
    const directusInitialized = await initDirectus();

    if (!directusInitialized) {
      throw new Error("Failed to initialize Directus");
    }

    return true;
  } catch (error) {
    console.error("Error initializing services:", error);
    return false;
  }
}

// Helper function to get current user
export function getCurrentUser() {
  return get(user);
}

// Helper function to check if user is authenticated
export function isAuthenticated() {
  const currentUser = get(user);
  return currentUser !== null;
}

// Helper function to require authentication
export function requireAuth() {
  const currentUser = get(user);
  if (!currentUser) {
    throw new Error("User tidak terautentikasi");
  }
  return currentUser;
}

// Helper function to format Indonesian date
export function formatIndonesianDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Helper function to format Indonesian time
export function formatIndonesianTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// Helper function to format Indonesian date and time
export function formatIndonesianDateTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Helper function to calculate days between dates
export function calculateDaysBetween(
  startDate: string,
  endDate: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
}

// Helper function to get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Helper function to get current Jakarta time
export function getCurrentJakartaTime(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
}

// Helper function for safe user display name
export function getUserDisplayName(user: any): string {
  return user?.nama_lengkap || user?.email || "User";
}

// Helper function for safe user greeting
export function getUserGreeting(user: any): string {
  const firstName = user?.nama_lengkap?.split(" ")[0];
  return firstName ? firstName.toUpperCase() : "USER";
}

// Helper function for safe user division
export function getUserDivision(user: any): string {
  return user?.divisi || "PT. Eltama Prima Indo";
}
