// @ts-check
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

const isBuild = process.argv.includes('build');
const env = loadEnv(isBuild ? 'production' : 'development', process.cwd(), '');
const apiUrl = env.API_URL || 'http://localhost:4000';

// https://astro.build/config
export default defineConfig({
  // URL publik situs (untuk canonical, Open Graph, sitemap). Diisi lewat env saat build.
  site: env.SITE_URL || undefined,
  // halaman dirender di server setiap request supaya selalu memakai data terbaru dari database
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: { port: 4321 },
  env: {
    schema: {
      // alamat API yang dipanggil server Astro saat SSR, dibaca saat runtime (bukan saat build)
      API_URL: envField.string({ context: 'server', access: 'secret', default: 'http://localhost:4000' })
    }
  },
  vite: {
    plugins: [tailwindcss()],
    // dev: browser memanggil /api di domain yang sama seperti di produksi; Vite meneruskannya ke API
    server: { proxy: { '/api': apiUrl } },
    // build produksi: masukkan semua dependency ke bundle server supaya image Docker tidak butuh node_modules
    ssr: isBuild ? { noExternal: true } : undefined
  }
});
