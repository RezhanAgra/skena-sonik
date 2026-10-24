import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url).href;
  // halaman pesanan (berisi e-tiket) dan scanner petugas tidak untuk mesin pencari
  return new Response(`User-agent: *\nAllow: /\nDisallow: /pesanan/\nDisallow: /gate\nDisallow: /gelang\nDisallow: /akun\nDisallow: /dashboard\nDisallow: /masuk\nDisallow: /daftar\nDisallow: /lupa-password\nDisallow: /reset-password\nDisallow: /verifikasi\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
