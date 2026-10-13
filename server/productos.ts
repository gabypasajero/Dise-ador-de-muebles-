// Obtiene el catálogo directamente desde detoditooutlet.cl. La tienda publica
// en su config.js la URL y la clave publicable (solo lectura de productos
// activos), así que el servidor la lee de ahí, guarda una caché y usa una
// copia local de respaldo si la tienda no responde.
import fs from 'node:fs';
import { clasificarProducto } from '../shared/catalogo';
import type { CategoriaTienda, ProductoCatalogo, ProductoTienda } from '../shared/tipos';
import { config } from './config';

const CAMPOS = 'id,nombre,categoria,descripcion,medidas,precio,precio_oferta,imagen_url,personalizable,destacado,orden';

const CATEGORIAS_RESPALDO: CategoriaTienda[] = [
  { id: 'cocina', nombre: 'Muebles de cocina' },
  { id: 'closets', nombre: 'Clósets' },
  { id: 'comodas', nombre: 'Cómodas' },
  { id: 'tocadores', nombre: 'Tocadores' },
  { id: 'tocadores-infantiles', nombre: 'Tocadores infantiles' },
  { id: 'escritorios', nombre: 'Escritorios' },
  { id: 'cocinas-infantiles', nombre: 'Cocinas infantiles' },
];

export interface RespuestaCatalogo {
  fuente: 'tienda' | 'respaldo';
  actualizado: string;
  tienda: string;
  whatsapp: string;
  categorias: CategoriaTienda[];
  productos: ProductoCatalogo[];
}

interface ConfigTienda {
  supabaseUrl: string;
  supabaseKey: string;
  whatsapp: string;
  categorias: CategoriaTienda[];
}

type Fetch = typeof fetch;

/** Extrae la configuración pública de la tienda desde su config.js. */
export function leerConfigTienda(js: string): Partial<ConfigTienda> {
  const texto = (clave: string) => js.match(new RegExp(`${clave}\\s*:\\s*['"]([^'"]+)['"]`))?.[1];
  const categorias: CategoriaTienda[] = [];
  const bloque = js.match(/categorias\s*:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  for (const m of bloque.matchAll(/id\s*:\s*['"]([^'"]+)['"]\s*,\s*nombre\s*:\s*['"]([^'"]+)['"]/g)) {
    categorias.push({ id: m[1], nombre: m[2] });
  }
  return {
    supabaseUrl: texto('supabaseUrl'),
    supabaseKey: texto('supabaseKey'),
    whatsapp: texto('whatsapp'),
    categorias: categorias.length ? categorias : undefined,
  };
}

function conTiempo(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function configTienda(f: Fetch): Promise<ConfigTienda> {
  const respaldo: ConfigTienda = {
    supabaseUrl: config.tiendaSupabaseUrl,
    supabaseKey: config.tiendaSupabaseKey,
    whatsapp: config.whatsapp,
    categorias: CATEGORIAS_RESPALDO,
  };
  try {
    const r = await f(`${config.tiendaUrl}/config.js`, { signal: conTiempo(8000) });
    if (!r.ok) return respaldo;
    const leida = leerConfigTienda(await r.text());
    return {
      supabaseUrl: leida.supabaseUrl ?? respaldo.supabaseUrl,
      supabaseKey: leida.supabaseKey ?? respaldo.supabaseKey,
      whatsapp: process.env.WHATSAPP ?? leida.whatsapp ?? respaldo.whatsapp,
      categorias: leida.categorias ?? respaldo.categorias,
    };
  } catch {
    return respaldo;
  }
}

export async function descargarProductos(f: Fetch = fetch): Promise<{ productos: ProductoTienda[]; tienda: ConfigTienda }> {
  const tienda = await configTienda(f);
  const url =
    `${tienda.supabaseUrl}/rest/v1/productos?select=${CAMPOS}` +
    '&activo=eq.true&order=destacado.desc,orden.asc,nombre.asc';
  const r = await f(url, {
    headers: { apikey: tienda.supabaseKey, Authorization: `Bearer ${tienda.supabaseKey}` },
    signal: conTiempo(12000),
  });
  if (!r.ok) throw new Error(`La tienda respondió ${r.status}`);
  const datos = (await r.json()) as ProductoTienda[];
  if (!Array.isArray(datos) || datos.length === 0) throw new Error('La tienda no devolvió productos');
  return { productos: datos, tienda };
}

function ordenar(productos: ProductoCatalogo[], categorias: CategoriaTienda[]): ProductoCatalogo[] {
  // Los muebles de cocina primero: son los más pedidos a medida.
  const prioridad = ['cocina', 'closets', 'comodas', 'tocadores', 'escritorios', 'tocadores-infantiles', 'cocinas-infantiles'];
  const pos = (c: string) => {
    const i = prioridad.indexOf(c);
    return i >= 0 ? i : prioridad.length + categorias.findIndex((x) => x.id === c);
  };
  return [...productos].sort(
    (a, b) =>
      pos(a.categoria) - pos(b.categoria) ||
      Number(b.destacado) - Number(a.destacado) ||
      (a.orden ?? 999) - (b.orden ?? 999) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export function crearCatalogo(f: Fetch = fetch) {
  let cache: RespuestaCatalogo | null = null;
  let vence = 0;
  let enCurso: Promise<RespuestaCatalogo> | null = null;

  function respaldo(): RespuestaCatalogo {
    const productos = JSON.parse(fs.readFileSync(config.rutaRespaldo, 'utf8')) as ProductoTienda[];
    return {
      fuente: 'respaldo',
      actualizado: fs.statSync(config.rutaRespaldo).mtime.toISOString(),
      tienda: config.tiendaUrl,
      whatsapp: config.whatsapp,
      categorias: CATEGORIAS_RESPALDO,
      productos: ordenar(productos.map(clasificarProducto), CATEGORIAS_RESPALDO),
    };
  }

  async function cargar(): Promise<RespuestaCatalogo> {
    try {
      const { productos, tienda } = await descargarProductos(f);
      const categorias = tienda.categorias;
      return {
        fuente: 'tienda',
        actualizado: new Date().toISOString(),
        tienda: config.tiendaUrl,
        whatsapp: tienda.whatsapp,
        categorias,
        productos: ordenar(productos.map(clasificarProducto), categorias),
      };
    } catch (e) {
      console.warn('[catálogo] usando respaldo local:', (e as Error).message);
      return respaldo();
    }
  }

  return {
    async obtener(): Promise<RespuestaCatalogo> {
      const ahora = Date.now();
      if (cache && ahora < vence) return cache;
      if (!enCurso) {
        enCurso = cargar().finally(() => (enCurso = null));
      }
      const r = await enCurso;
      cache = r;
      // Si falló la tienda reintenta antes.
      vence = ahora + (r.fuente === 'tienda' ? config.cacheProductosMs : 60_000);
      return r;
    },
    invalidar() {
      cache = null;
      vence = 0;
    },
  };
}
