// Catálogo de la tienda: productos activos desde Supabase (la misma tabla que
// usa detoditooutlet.cl) con una copia local de respaldo si no hay conexión.
import { clasificarProducto } from '../../shared/catalogo';
import type { CatalogoMateriales, CategoriaTienda, ProductoCatalogo, ProductoTienda } from '../../shared/tipos';
import { backend } from './index';

export interface RespuestaCatalogo {
  fuente: 'tienda' | 'respaldo';
  categorias: CategoriaTienda[];
  productos: ProductoCatalogo[];
}

// Mismas categorías que publica la tienda, con los muebles de cocina primero (los más pedidos a medida).
export const CATEGORIAS: CategoriaTienda[] = [
  { id: 'cocina', nombre: 'Muebles de cocina' },
  { id: 'closets', nombre: 'Clósets' },
  { id: 'comodas', nombre: 'Cómodas' },
  { id: 'tocadores', nombre: 'Tocadores' },
  { id: 'escritorios', nombre: 'Escritorios' },
  { id: 'tocadores-infantiles', nombre: 'Tocadores infantiles' },
  { id: 'cocinas-infantiles', nombre: 'Cocinas infantiles' },
  { id: 'camas', nombre: 'Camas de transición' },
  { id: 'veladores', nombre: 'Veladores' },
  { id: 'otros', nombre: 'Otros' },
];

export function ordenarProductos(productos: ProductoCatalogo[]): ProductoCatalogo[] {
  const pos = (c: string) => {
    const i = CATEGORIAS.findIndex((x) => x.id === c);
    return i >= 0 ? i : CATEGORIAS.length;
  };
  return [...productos].sort(
    (a, b) =>
      pos(a.categoria) - pos(b.categoria) ||
      Number(b.destacado) - Number(a.destacado) ||
      (a.orden ?? 999) - (b.orden ?? 999) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

async function respaldo(): Promise<ProductoTienda[]> {
  const r = await fetch('/datos/productos-respaldo.json');
  if (!r.ok) throw new Error('No se pudo cargar el catálogo');
  return r.json();
}

export async function obtenerCatalogo(): Promise<RespuestaCatalogo> {
  let fuente: RespuestaCatalogo['fuente'] = 'tienda';
  let lista: ProductoTienda[];
  try {
    lista = await backend.productos();
  } catch (e) {
    console.warn('[catálogo] usando la copia local:', (e as Error).message);
    fuente = 'respaldo';
    lista = await respaldo();
  }
  return { fuente, categorias: CATEGORIAS, productos: ordenarProductos(lista.map(clasificarProducto)) };
}

export async function obtenerMateriales(): Promise<CatalogoMateriales> {
  const r = await fetch('/datos/materiales.json');
  if (!r.ok) throw new Error('No se pudieron cargar los colores');
  return r.json();
}
