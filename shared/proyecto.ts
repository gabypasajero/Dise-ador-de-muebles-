// Proyecto con varios muebles: el mueble principal (el de siempre) más islas y muebles en línea.
// Cada mueble adicional es una cocina completa con su posición en la planta; el precio del
// proyecto es la suma de todos y cada uno guarda sus propias correcciones del desglose.
import { nuevoId } from './catalogo';
import { disenoLibre } from './catalogo';
import { dimensionesTotales, extremosPrincipal } from './layout';
import { aplicarAjustes, ejecutar, formatear, precioDiseno, type Operacion, type PrecioAjustado } from './reglas';
import { detalleCotizacion } from './resumen';
import { precioCocina, precioIsla } from './tarifas';
import type { CatalogoMateriales, Diseno, LineaDetalle, MuebleAdicional, ProductoCatalogo, Unidad } from './tipos';

/** Medidas estándar de la isla (todas se pueden editar). */
export const ISLA_ESTANDAR = { ancho: 1500, alto: 900, profundidad: 900 };
/** Mueble en línea al agregarlo: otro tramo de cocina sin equipos. */
export const LINEA_ESTANDAR = { ancho: 1200 };
/** Pasillo entre el mueble principal y la isla al agregarla. */
export const PASILLO_ISLA = 1100;

export const NOMBRE_TIPO_ADICIONAL: Record<MuebleAdicional['tipo'], string> = { isla: 'Isla', linea: 'Mueble en línea' };

/** Aplica operaciones del motor en orden; las que no se pueden se saltan. */
function aplicar(d: Diseno, ops: Operacion[]): Diseno {
  return ops.reduce((x, op) => {
    const r = ejecutar(x, op);
    return r.ok ? r.diseno : x;
  }, d);
}

/** Cocina sin equipos ni aéreos, con los colores del mueble principal. */
function cocinaVacia(principal: Diseno): Diseno {
  let d = disenoLibre('cocina');
  for (const e of [...d.equipos]) d = aplicar(d, [{ op: 'quitarEquipo', id: e.id }]);
  // Sin hornos: los módulos de horno pasan a ser de puertas.
  for (const c of d.cuerpos.filter((x) => x.tipo === 'horno')) d = aplicar(d, [{ op: 'actualizarModulo', tramo: 'base', modulo: c.id, cambios: { tipo: 'frentes', puertas: 2 } }]);
  d = aplicar(d, [{ op: 'activarAereos', activo: false }]);
  return { ...d, materiales: { ...principal.materiales }, tirador: principal.tirador, cierreSuave: principal.cierreSuave };
}

/** Diseño de una isla estándar: 150 × 90 × 90 cm, sin copete (va suelta, sin muro). */
export function disenoIsla(principal: Diseno): Diseno {
  const d = aplicar(cocinaVacia(principal), [
    { op: 'fijarAncho', ancho: ISLA_ESTANDAR.ancho },
    { op: 'fijarProfundidad', profundidad: ISLA_ESTANDAR.profundidad },
    { op: 'fijarAlto', alto: ISLA_ESTANDAR.alto },
  ]);
  return { ...d, nombreModelo: 'Isla', productoId: null, cocina: { ...d.cocina, copete: false } };
}

/** Diseño de un mueble en línea estándar (120 cm), con el fondo y el alto del principal. */
export function disenoLinea(principal: Diseno): Diseno {
  const d = aplicar(cocinaVacia(principal), [
    { op: 'fijarAncho', ancho: LINEA_ESTANDAR.ancho },
    { op: 'fijarProfundidad', profundidad: principal.profundidad },
    { op: 'fijarAlto', alto: principal.alto },
  ]);
  return { ...d, nombreModelo: 'Mueble en línea', productoId: null };
}

/** Nombre libre para el siguiente mueble de ese tipo: «Isla», «Isla 2»… */
function nombreLibre(p: Diseno, tipo: MuebleAdicional['tipo']): string {
  const base = NOMBRE_TIPO_ADICIONAL[tipo];
  const usados = new Set((p.adicionales ?? []).map((a) => a.nombre));
  if (!usados.has(base)) return base;
  for (let k = 2; ; k++) if (!usados.has(`${base} ${k}`)) return `${base} ${k}`;
}

/**
 * Mueble nuevo para el proyecto, ya ubicado: la isla al frente del mueble principal (con un pasillo
 * de 110 cm) y el mueble en línea a la derecha, contra el mismo muro, después de los que ya hay.
 */
export function nuevoAdicional(p: Diseno, tipo: MuebleAdicional['tipo']): MuebleAdicional {
  const otros = p.adicionales ?? [];
  if (tipo === 'isla') {
    const d = disenoIsla(p);
    const islas = otros.filter((a) => a.tipo === 'isla').length;
    const fondo = dimensionesTotales(p).fondo;
    return { id: nuevoId('m'), tipo, nombre: nombreLibre(p, tipo), x: islas * (d.ancho + 600), z: Math.round(fondo + PASILLO_ISLA + d.profundidad / 2), giro: 0, diseno: d };
  }
  const d = disenoLinea(p);
  const [, x1] = extremosPrincipal(p);
  const derecha = otros.filter((a) => a.tipo === 'linea' && a.giro === 0 && a.z === Math.round(a.diseno.profundidad / 2)).reduce((m, a) => Math.max(m, a.x + a.diseno.ancho / 2), x1);
  return { id: nuevoId('m'), tipo, nombre: nombreLibre(p, tipo), x: Math.round(derecha + d.ancho / 2), z: Math.round(d.profundidad / 2), giro: 0, diseno: d };
}

/**
 * Centro (mm) de la planta de un mueble en sus propias coordenadas: el punto sobre el que gira y que
 * se ubica en (x, z) del proyecto.
 */
export function centroPlanta(d: Diseno): { x: number; z: number } {
  const c = dimensionesTotales(d);
  return { x: (c.x0 + c.x1) / 2, z: c.fondo / 2 };
}

/** Un mueble del proyecto, con su ubicación (el principal está en el origen). */
export interface MuebleProyecto {
  /** null: el mueble principal. */
  id: string | null;
  tipo: 'principal' | MuebleAdicional['tipo'];
  nombre: string;
  diseno: Diseno;
  x: number;
  z: number;
  giro: number;
}

/** Todos los muebles del proyecto, el principal primero. */
export function mueblesProyecto(p: Diseno, nombrePrincipal = 'Mueble principal'): MuebleProyecto[] {
  const { adicionales, ...principal } = p;
  return [
    { id: null, tipo: 'principal', nombre: nombrePrincipal, diseno: principal, x: 0, z: 0, giro: 0 },
    ...(adicionales ?? []).map((a) => ({ id: a.id, tipo: a.tipo, nombre: a.nombre, diseno: a.diseno, x: a.x, z: a.z, giro: a.giro })),
  ];
}

/** Precio de un mueble adicional con sus correcciones: la isla por metro de isla, el mueble en línea como una cocina. */
export function precioAdicional(a: Pick<MuebleAdicional, 'tipo' | 'diseno'>): PrecioAjustado | null {
  const p = a.tipo === 'isla' ? precioIsla(a.diseno) : precioCocina(a.diseno);
  return aplicarAjustes({ total: p.total, metodo: 'oficial', lineas: p.lineas }, a.diseno.ajustesPrecio);
}

export interface PrecioProyecto {
  total: number;
  /** El precio de cada mueble (null si no tiene referencia). */
  partes: { id: string | null; nombre: string; precio: PrecioAjustado | null }[];
}

/** Precio del proyecto completo: el mueble principal (con su producto de la tienda) más cada adicional. */
export function precioProyecto(p: Diseno, producto: ProductoCatalogo | null, disenoBase: Diseno | null, nombrePrincipal = 'Mueble principal'): PrecioProyecto {
  const { adicionales, ...principal } = p;
  const partes: PrecioProyecto['partes'] = [
    { id: null, nombre: nombrePrincipal, precio: aplicarAjustes(precioDiseno(principal, producto, disenoBase), principal.ajustesPrecio) },
    ...(adicionales ?? []).map((a) => ({ id: a.id, nombre: a.nombre, precio: precioAdicional(a) })),
  ];
  return { total: partes.reduce((s, x) => s + (x.precio?.total ?? 0), 0), partes };
}

/**
 * Detalle de la cotización de todo el proyecto: el del mueble principal y, a continuación, el de
 * cada isla o mueble en línea (con su nombre delante de cada línea).
 */
export function detalleProyecto(p: Diseno, producto: ProductoCatalogo | null, unidad: Unidad, materiales: CatalogoMateriales | null): LineaDetalle[] {
  const { adicionales, ...principal } = p;
  const lineas = detalleCotizacion(principal, producto, unidad, materiales);
  for (const a of adicionales ?? []) {
    const d = a.diseno;
    lineas.push({
      etiqueta: a.nombre,
      valor: `${NOMBRE_TIPO_ADICIONAL[a.tipo]} de ${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)${a.tipo === 'isla' ? ', con respaldo terminado' : ''}`,
    });
    for (const l of detalleCotizacion(d, null, unidad, materiales)) {
      if (l.etiqueta === 'Modelo base' || l.etiqueta === 'Medidas') continue;
      lineas.push({ ...l, etiqueta: `${a.nombre} · ${l.etiqueta}` });
    }
  }
  return lineas;
}
