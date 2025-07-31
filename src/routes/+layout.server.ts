export const load = async ({ url }: { url: URL }) => {
  // Halaman yang tidak memerlukan autentikasi
  const publicRoutes = ["/login"];

  // Jika sedang di halaman login, tidak perlu redirect
  if (publicRoutes.includes(url.pathname)) {
    return {};
  }

  // Untuk sekarang, kita akan handle autentikasi di client side
  // Karena Firebase Auth berjalan di client
  return {};
};
