// Bundle API + semua dependency-nya menjadi satu file dist/server.js.
// Hasilnya bisa dijalankan tanpa node_modules, jadi image Docker produksi tetap kecil.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  minify: true,
  keepNames: true,
  legalComments: 'none',
  // dependency opsional milik `pg` yang tidak kita pakai
  external: ['pg-native'],
  // beberapa dependency masih CommonJS dan memanggil require(); sediakan require di bundle ESM
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
  },
  logLevel: 'info'
});
