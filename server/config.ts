import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const produccion = process.env.NODE_ENV === 'production';

if (produccion && !process.env.JWT_SECRET) {
  throw new Error('Define JWT_SECRET en producción para firmar las sesiones.');
}

export const config = {
  produccion,
  puerto: Number(process.env.PORT ?? 3001),
  raiz,
  jwtSecreto: process.env.JWT_SECRET ?? 'solo-desarrollo-cambiar-en-produccion',
  rutaDb: process.env.DB_PATH ?? path.join(raiz, 'server', 'data', 'disenador.db'),
  /** Sitio de la tienda del que se obtienen los productos. */
  tiendaUrl: (process.env.TIENDA_URL ?? 'https://detoditooutlet.cl').replace(/\/$/, ''),
  /** Valores de respaldo si no se puede leer config.js de la tienda. */
  tiendaSupabaseUrl: process.env.TIENDA_SUPABASE_URL ?? 'https://bmxmqhbkgvgyqpwsuazm.supabase.co',
  tiendaSupabaseKey: process.env.TIENDA_SUPABASE_KEY ?? 'sb_publishable_C4bwkSAfBBHNg8z523_qpw_P-PDzciI',
  whatsapp: process.env.WHATSAPP ?? '56931719740',
  cacheProductosMs: Number(process.env.CACHE_PRODUCTOS_MS ?? 15 * 60 * 1000),
  rutaRespaldo: path.join(raiz, 'server', 'data', 'productos-respaldo.json'),
  rutaMateriales: path.join(raiz, 'server', 'data', 'materiales.json'),
};
