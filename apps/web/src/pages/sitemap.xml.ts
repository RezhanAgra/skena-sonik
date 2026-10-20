import type { APIRoute } from 'astro';

// Situs ini satu halaman; tambahkan path baru ke daftar ini kalau ada halaman lain
const PATHS = ['/'];

export const GET: APIRoute = ({ site, url }) => {
  const urls = PATHS.map(p => `  <url><loc>${new URL(p, site ?? url).href}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
  );
};
