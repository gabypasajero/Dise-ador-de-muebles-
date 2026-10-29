import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Archivos de public/ (rutas desde la raíz del sitio). */
function archivosPublicos(dir = 'public', base = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivosPublicos(path.join(dir, e.name), `${base}/${e.name}`) : [`${base}/${e.name}`],
  );
}

/** Genera /sw.js con la lista de todo lo que se guarda en la tablet para usar la app sin internet. */
function sinConexion(): Plugin {
  return {
    name: 'dto-sin-conexion',
    apply: 'build',
    generateBundle(_, bundle) {
      const archivos = [...Object.keys(bundle).map((f) => `/${f}`), ...archivosPublicos()].filter((f) => !f.endsWith('.map'));
      const version = createHash('sha1').update(archivos.join('|')).digest('hex').slice(0, 12);
      const codigo = fs.readFileSync('scripts/sw-plantilla.js', 'utf8').replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(archivos));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: codigo });
    },
  };
}

export default defineConfig({
  plugins: [react(), sinConexion()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['jspdf'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
} as never);
