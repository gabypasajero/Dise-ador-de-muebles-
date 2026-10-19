// Tramos del mueble (principal, lados de la L/U y aéreos) y rol de cada módulo
// para el reparto con largo fijo.
import { esCocinaAdulta, esTramoAereo, ladoDeTramo } from './layout';
import type { Limite } from './reparto';
import type { Cuerpo, Diseno, Lado, Plantilla, Tramo, TramoAereo, TramoBase, TramoId } from './tipos';

export const ANCHO_MIN_CUERPO = 150;
export const ANCHO_MIN_HUECO = 100;
/** El horno empotrado mide siempre 60 cm (cocina y compacto). */
export const ANCHO_HORNO = 600;
/** El especiero mide siempre 20 cm. */
export const ANCHO_ESPECIERO = 200;
/** Ancho máximo de una cajonera (módulo solo de cajones) de cocina. */
export const ANCHO_MAX_CAJONERA = 900;
/** Ancho del módulo aéreo que aloja una campana. */
export const ANCHO_CAMPANA = 600;
/** Ancho base de un módulo por cada puerta al agregarlo (cocina y compacto). */
export const ANCHO_POR_PUERTA = 350;

/** Lados de la L o U del mueble base: largo exterior (desde el muro principal) y fondo. */
export const LIMITES_LADO = { largo: [900, 3000] as [number, number], profundidad: [450, 700] as [number, number] };
export const LIMITES_AEREOS = {
  alto: [300, 1000] as [number, number],
  profundidad: [250, 450] as [number, number],
  elevacion: [1200, 1800] as [number, number],
  /** Compacto: alto del mueble base hasta la cubierta. */
  base: [750, 1000] as [number, number],
  /** Largo del aéreo principal. */
  ancho: [300, 5000] as [number, number],
  /** Largo exterior de un lado del aéreo (desde el muro principal). */
  ladoLargo: [500, 3000] as [number, number],
};

export const TRAMOS_BASE: TramoBase[] = ['base', 'izq', 'der'];
export const TRAMOS_AEREOS: TramoAereo[] = ['aereos', 'aereos-izq', 'aereos-der'];

/** Tramo real al que se refiere `t` (el alias 'retorno' es el único lado de la L), o null si no existe. */
export function resolverTramo(d: Diseno, t: Tramo): TramoId | null {
  if (t === 'retorno') return d.lados?.izq ? 'izq' : d.lados?.der ? 'der' : null;
  if (t === 'izq' || t === 'der') return d.lados?.[t] ? t : null;
  if (t === 'aereos-izq' || t === 'aereos-der') return d.aereos.lados?.[ladoDeTramo(t)!] ? t : null;
  return t;
}

/** Datos del lado (de la L/U del base o de los aéreos) de un tramo lateral. */
export function ladoDe(d: Diseno, t: TramoId): Lado | null {
  const lado = ladoDeTramo(t);
  if (!lado) return null;
  return (esTramoAereo(t) ? d.aereos.lados?.[lado] : d.lados?.[lado]) ?? null;
}

/** Módulos de un tramo (lista vacía si el tramo no existe). */
export function cuerposDe(d: Diseno, tramo: Tramo): Cuerpo[] {
  const t = resolverTramo(d, tramo);
  if (!t) return [];
  if (t === 'base') return d.cuerpos;
  if (t === 'aereos') return d.aereos.cuerpos;
  return ladoDe(d, t)?.cuerpos ?? [];
}

/** Tramos que existen en el diseño: el principal, los lados de la L/U y, si están activos, los aéreos con sus lados. */
export function tramosDe(d: Diseno): TramoId[] {
  const out: TramoId[] = ['base'];
  if (d.lados?.izq) out.push('izq');
  if (d.lados?.der) out.push('der');
  if (d.aereos.activo) {
    out.push('aereos');
    if (d.aereos.lados?.izq) out.push('aereos-izq');
    if (d.aereos.lados?.der) out.push('aereos-der');
  }
  return out;
}

export function sepDe(d: Diseno, t: TramoId): number {
  return t === 'base' ? d.separacionCuerpos : 0;
}

/** Largo que ocupan hoy los módulos del tramo (con la separación entre ellos en el principal). */
export function largoTramo(d: Diseno, tramo: Tramo): number {
  const t = resolverTramo(d, tramo);
  if (!t) return 0;
  const cs = cuerposDe(d, t);
  return cs.reduce((s, c) => s + c.ancho, 0) + sepDe(d, t) * Math.max(0, cs.length - 1);
}

/** Largo que deben sumar los módulos del tramo (sin separaciones): lo fija la medida del mueble. */
export function largoObjetivo(d: Diseno, t: TramoId): number {
  const n = cuerposDe(d, t).length;
  switch (t) {
    case 'base':
      return d.ancho - d.separacionCuerpos * Math.max(0, n - 1);
    case 'izq':
    case 'der':
      return Math.max(0, (d.lados?.[t]?.largo ?? 0) - d.profundidad);
    case 'aereos':
      return d.plantilla === 'compacto' ? d.ancho : d.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0);
    default:
      return Math.max(0, (ladoDe(d, t)?.largo ?? 0) - d.aereos.profundidad);
  }
}

/** Cajonera: módulo solo de cajones. */
export function esCajonera(c: Cuerpo): boolean {
  return c.tipo === 'frentes' && c.cajones > 0 && c.puertas === 0;
}

/** Módulos de medida fija: el horno empotrado (60 cm) y el especiero (20 cm). */
export function anchoFijo(p: Plantilla, c: Pick<Cuerpo, 'tipo'>): number | null {
  if (c.tipo === 'horno' && (p === 'cocina' || p === 'compacto')) return ANCHO_HORNO;
  if (c.tipo === 'especiero') return ANCHO_ESPECIERO;
  return null;
}

/**
 * Rol de un módulo en el reparto:
 * - fijo: horno y especiero, nunca cambian de ancho.
 * - equipado: lleva encimera o lavaplatos (o aloja la campana en los aéreos), o es un espacio
 *   libre (refrigerador, lavadora, ventana): conserva su ancho cuando se agregan, quitan, mueven
 *   o reparten otros módulos.
 * - ajustable: cede o toma espacio para mantener el largo del tramo.
 */
export type Rol = 'fijo' | 'equipado' | 'ajustable';

export function rolModulo(d: Diseno, t: TramoId, c: Cuerpo): Rol {
  if (anchoFijo(d.plantilla, c) != null) return 'fijo';
  // El espacio libre mide lo que el equipo que va en él: no entra al reparto parejo.
  if (c.tipo === 'hueco') return 'equipado';
  if (esTramoAereo(t)) return c.tipo === 'campana' && c.campanaDe ? 'equipado' : 'ajustable';
  return (d.equipos ?? []).some((e) => e.tramo === t && e.modulo === c.id) ? 'equipado' : 'ajustable';
}

/** Ancho mínimo y máximo de un módulo en su tramo. */
export function limitesModulo(d: Diseno, t: TramoId, c: Cuerpo): Limite {
  const fijo = anchoFijo(d.plantilla, c);
  if (fijo != null) return { min: fijo, max: fijo };
  if (esTramoAereo(t) && c.tipo === 'campana' && c.campanaDe) {
    return { min: Math.min(ANCHO_CAMPANA, Math.max(ANCHO_MIN_CUERPO, largoObjetivo(d, t))), max: Infinity };
  }
  const min = c.tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
  const max = !esTramoAereo(t) && esCocinaAdulta(d) && esCajonera(c) ? ANCHO_MAX_CAJONERA : Infinity;
  return { min, max };
}
