// Marcas con las que se emite una cotización: De Todito Outlet y Muebles y Hogar Molina.
// La marca elegida se guarda con la cotización (columna `marca`) y se usa en la vista
// previa, la lista, el PDF del cliente, la hoja del maestro y los mensajes.
import { textoCotizacion } from '../../shared/resumen';
import type { Cotizacion } from '../../shared/tipos';

export type Marca = 'dto' | 'molina';

// Pendiente para el motor: mover `marca` e `imagen` a shared/tipos.ts. Mientras tanto se
// agregan a los tipos compartidos desde aquí (opcionales: las cotizaciones viejas no las traen).
declare module '../../shared/tipos' {
  interface Cotizacion {
    /** Marca con la que se emitió (sin marca = De Todito Outlet). */
    marca?: Marca;
    /** Imagen grande del mueble para los documentos (solo al pedir una cotización puntual). */
    imagen?: string | null;
  }
  interface DatosCotizacion {
    marca?: Marca;
    imagen?: string | null;
  }
}

export interface InfoMarca {
  id: Marca;
  nombre: string;
  /** Línea bajo el nombre en los documentos. */
  lema: string;
  /** Sitio web (sin https://), o null si no hay uno confirmado. */
  web: string | null;
  /** Logo para la interfaz (servido desde public/). */
  logo: string;
}

export const MARCAS: Record<Marca, InfoMarca> = {
  dto: {
    id: 'dto',
    nombre: 'De Todito Outlet',
    lema: 'Muebles a medida',
    web: 'detoditooutlet.cl',
    logo: '/marcas/de-todito-outlet.svg',
  },
  molina: {
    id: 'molina',
    nombre: 'Muebles y Hogar Molina',
    lema: 'Muebles a medida',
    // Dominio donde la tienda publica las fotos de sus productos (catálogo de productos).
    web: 'mueblesyhogarmolina.cl',
    logo: '/marcas/muebles-y-hogar-molina.png',
  },
};

export const LISTA_MARCAS: InfoMarca[] = [MARCAS.dto, MARCAS.molina];

export function esMarca(x: unknown): x is Marca {
  return x === 'dto' || x === 'molina';
}

/** Marca de una cotización: las anteriores a la elección de marca son De Todito Outlet. */
export function marcaDe(c: { marca?: unknown } | null | undefined): Marca {
  return esMarca(c?.marca) ? c.marca : 'dto';
}

const claveMarca = (vendedor: string | null | undefined) => `dto-ultima-marca:${vendedor ?? 'anonimo'}`;

/** Última marca que usó el vendedor en este navegador (De Todito Outlet si nunca eligió). */
export function ultimaMarca(vendedor: string | null | undefined): Marca {
  try {
    const m = localStorage.getItem(claveMarca(vendedor));
    return esMarca(m) ? m : 'dto';
  } catch {
    return 'dto';
  }
}

export function recordarMarca(vendedor: string | null | undefined, marca: Marca) {
  try {
    localStorage.setItem(claveMarca(vendedor), marca);
  } catch {
    // Sin almacenamiento (modo privado): la próxima vez parte en De Todito Outlet.
  }
}

/** Texto plano de la cotización (copiar, WhatsApp, correo) con el nombre de su marca. */
export function textoCotizacionMarca(c: Pick<Cotizacion, 'numero' | 'cliente' | 'detalle' | 'observaciones' | 'vendedor' | 'fecha' | 'valor' | 'marca'>): string {
  const m = MARCAS[marcaDe(c)];
  // shared/resumen escribe siempre la línea de De Todito Outlet: se reemplaza por la de la marca.
  return textoCotizacion(c).replace('De Todito Outlet · Muebles a medida', `${m.nombre} · ${m.lema}`);
}
