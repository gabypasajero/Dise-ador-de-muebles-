// Empaqueta el motor (shared/) para la función de Vercel api/asistente.ts.
//
// Las funciones de Vercel compilan cada archivo .ts por separado como módulo ES, y Node no
// encuentra los import sin extensión que usa shared/ («./reglas»): la función fallaría con
// ERR_MODULE_NOT_FOUND. Por eso el motor va en un solo archivo, api/_motor.mjs (generado,
// fuera de git; los archivos con «_» no son funciones), que se arma en `npm run build`
// antes de que Vercel prepare las funciones. Los tipos vienen de api/_motor.d.mts.
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

await build({
  root: raiz,
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    ssr: 'shared/asistente.ts',
    outDir: 'api',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: false,
    sourcemap: false,
    target: 'node20',
    rollupOptions: { output: { format: 'es', entryFileNames: '_motor.mjs' } },
  },
});
console.log('api/_motor.mjs listo');
