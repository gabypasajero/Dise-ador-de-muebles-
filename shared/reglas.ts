// Reglas de negocio: límites de medidas, unidades, operaciones sobre el diseño,
// advertencias de fabricación y precio referencial.
import { cuerpo as nuevoCuerpo, repartir } from './catalogo';
import { calcularLayout, calcularLayoutAereos, calcularLayoutTocador, centroCuerpo, disenoRetorno, esCocina, extremosPrincipal } from './layout';
import type { Cuerpo, Diseno, Plantilla, ProductoCatalogo, Unidad } from './tipos';

export interface Limites {
  ancho: [number, number];
  alto: [number, number];
  profundidad: [number, number];
}

export const LIMITES: Record<Plantilla, Limites> = {
  cocina: { ancho: [400, 3600], alto: [700, 1000], profundidad: [450, 700] },
  compacto: { ancho: [600, 2400], alto: [1500, 2300], profundidad: [350, 650] },
  'cocina-infantil': { ancho: [500, 1500], alto: [800, 1300], profundidad: [250, 450] },
  closet: { ancho: [400, 3000], alto: [1200, 2600], profundidad: [300, 650] },
  comoda: { ancho: [400, 2000], alto: [500, 1400], profundidad: [300, 600] },
  tocador: { ancho: [600, 1800], alto: [1000, 2000], profundidad: [300, 600] },
  escritorio: { ancho: [700, 2600], alto: [500, 2400], profundidad: [350, 700] },
};

export const ANCHO_MIN_CUERPO = 150;
export const ANCHO_MIN_HUECO = 100;

// ---------- Unidades ----------

export function aUnidad(mm: number, unidad: Unidad): number {
  return unidad === 'cm' ? Math.round(mm) / 10 : Math.round(mm);
}

export function deUnidad(valor: number, unidad: Unidad): number {
  return Math.round(unidad === 'cm' ? valor * 10 : valor);
}

export function formatear(mm: number, unidad: Unidad, conUnidad = true): string {
  const v = aUnidad(mm, unidad);
  const texto = unidad === 'cm' ? v.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : String(v);
  return conUnidad ? `${texto} ${unidad}` : texto;
}

export function limitar(v: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, v));
}

// ---------- Operaciones ----------

/**
 * Tramos de un mueble: el principal (base), el retorno de una cocina en L y
 * los aéreos (o el mueble superior del compacto).
 */
export type Tramo = 'base' | 'retorno' | 'aereos';

export const LIMITES_RETORNO = { largo: [900, 3000] as [number, number], profundidad: [450, 700] as [number, number] };
export const LIMITES_AEREOS = {
  alto: [300, 1000] as [number, number],
  profundidad: [250, 450] as [number, number],
  elevacion: [1200, 1800] as [number, number],
  /** Compacto: alto del mueble base hasta la cubierta. */
  base: [750, 1000] as [number, number],
  ancho: [300, 4200] as [number, number],
};

function clonar(d: Diseno): Diseno {
  return {
    ...d,
    cuerpos: d.cuerpos.map((c) => ({ ...c })),
    materiales: { ...d.materiales },
    cocina: { ...d.cocina },
    tocador: { ...d.tocador },
    aereos: { ...d.aereos, cuerpos: d.aereos.cuerpos.map((c) => ({ ...c })) },
    retorno: d.retorno ? { ...d.retorno, cuerpos: d.retorno.cuerpos.map((c) => ({ ...c })) } : null,
  };
}

/** Ancho de un horno empotrado estándar: su módulo no se agranda ni se achica. */
export const ANCHO_HORNO = 600;

/** Módulos de medida fija: el horno empotrado de la cocina mide siempre 60 cm. */
export function anchoFijo(p: Plantilla, c: Cuerpo): number | null {
  return c.tipo === 'horno' && (p === 'cocina' || p === 'compacto') ? ANCHO_HORNO : null;
}

function minCuerpo(c: Cuerpo, p?: Plantilla): number {
  const fijo = p ? anchoFijo(p, c) : null;
  if (fijo != null) return fijo;
  return c.tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
}

export function cuerposDe(d: Diseno, tramo: Tramo): Cuerpo[] {
  if (tramo === 'retorno') return d.retorno?.cuerpos ?? [];
  if (tramo === 'aereos') return d.aereos.cuerpos;
  return d.cuerpos;
}

function sepDe(d: Diseno, tramo: Tramo): number {
  return tramo === 'base' ? d.separacionCuerpos : 0;
}

/** Largo que ocupan hoy los módulos del tramo. */
export function largoTramo(d: Diseno, tramo: Tramo): number {
  const cs = cuerposDe(d, tramo);
  return cs.reduce((s, c) => s + c.ancho, 0) + sepDe(d, tramo) * Math.max(0, cs.length - 1);
}

/** Largo máximo de los módulos del tramo (el ancho máximo del mueble en el principal). */
export function maximoTramo(d: Diseno, tramo: Tramo): number {
  if (tramo === 'retorno') return LIMITES_RETORNO.largo[1] - d.profundidad;
  if (tramo === 'aereos') {
    if (d.plantilla === 'compacto') return d.ancho;
    // En la L los aéreos no pueden pasar el muro lateral donde se apoya el retorno.
    if (d.retorno) {
      const [x0, x1] = extremosPrincipal(d);
      return Math.min(LIMITES_AEREOS.ancho[1], Math.round(x1 - x0));
    }
    return LIMITES_AEREOS.ancho[1];
  }
  return LIMITES[d.plantilla].ancho[1];
}

/** Vuelve a calcular los totales del tramo después de cambiar sus módulos. */
function recalcular(out: Diseno, tramo: Tramo) {
  if (tramo === 'base') out.ancho = largoTramo(out, 'base');
  else if (tramo === 'retorno' && out.retorno) out.retorno.largo = out.profundidad + largoTramo(out, 'retorno');
}

/**
 * Reparte un largo entre módulos de forma proporcional, respetando los
 * mínimos. Los módulos de medida fija (horno) conservan su ancho y la
 * diferencia la absorben los demás.
 */
function repartirModulos(cs: Cuerpo[], total: number, p?: Plantilla) {
  if (!cs.length) return;
  const fijos = p ? cs.filter((c) => anchoFijo(p, c) != null) : [];
  fijos.forEach((c) => (c.ancho = anchoFijo(p!, c)!));
  const libres = cs.filter((c) => !fijos.includes(c));
  if (!libres.length) return;
  const resto = total - fijos.reduce((s, c) => s + c.ancho, 0);
  const partes = repartir(resto, libres.map((c) => c.ancho));
  libres.forEach((c, i) => (c.ancho = partes[i]));
  for (const c of libres) {
    const falta = minCuerpo(c) - c.ancho;
    if (falta > 0) {
      const mayor = libres.reduce((a, b) => (b.ancho > a.ancho ? b : a));
      mayor.ancho -= falta;
      c.ancho += falta;
    }
  }
}

/** En el compacto el mueble superior tiene el mismo ancho que el base. */
function ajustarSuperiorCompacto(out: Diseno) {
  if (out.plantilla !== 'compacto' || !out.aereos.cuerpos.length) return;
  if (largoTramo(out, 'aereos') !== out.ancho) repartirModulos(out.aereos.cuerpos, out.ancho);
}

/** El tramo en L conserva su largo exterior: si cambia el fondo del principal se reparten sus módulos. */
function ajustarRetorno(out: Diseno) {
  const r = out.retorno;
  if (!r || !r.cuerpos.length) return;
  const minimo = r.cuerpos.reduce((s, c) => s + minCuerpo(c), 0);
  r.largo = limitar(r.largo, [Math.max(LIMITES_RETORNO.largo[0], out.profundidad + minimo), LIMITES_RETORNO.largo[1]]);
  const util = r.largo - out.profundidad;
  if (largoTramo(out, 'retorno') !== util) repartirModulos(r.cuerpos, util);
}

/** Cambia el ancho total y reparte la diferencia entre los cuerpos proporcionalmente. */
export function fijarAncho(d: Diseno, ancho: number): Diseno {
  const out = clonar(d);
  const n = out.cuerpos.length;
  const p = out.plantilla;
  const minimo = out.cuerpos.reduce((s, c) => s + minCuerpo(c, p), 0) + out.separacionCuerpos * Math.max(0, n - 1);
  let objetivo = Math.max(limitar(Math.round(ancho), LIMITES[d.plantilla].ancho), minimo);
  // Si todos los módulos son de medida fija (solo hornos), el ancho no puede cambiar.
  if (n > 0 && out.cuerpos.every((c) => anchoFijo(p, c) != null)) objetivo = minimo;
  out.ancho = objetivo;
  if (n === 0) return out;
  repartirModulos(out.cuerpos, objetivo - out.separacionCuerpos * (n - 1), p);
  out.ancho = largoTramo(out, 'base');
  ajustarSuperiorCompacto(out);
  return out;
}

export function fijarAlto(d: Diseno, alto: number): Diseno {
  const out = clonar(d);
  out.alto = limitar(Math.round(alto), LIMITES[d.plantilla].alto);
  if (out.plantilla === 'tocador') out.tocador.altoCubierta = Math.min(out.tocador.altoCubierta, out.alto - 400);
  if (out.plantilla === 'compacto') {
    // Entre la cubierta y el mueble superior quedan al menos 30 cm libres.
    out.aereos.elevacion = Math.min(out.aereos.elevacion, out.alto - 300 - LIMITES_AEREOS.alto[0]);
    out.aereos.alto = limitar(out.aereos.alto, [LIMITES_AEREOS.alto[0], out.alto - out.aereos.elevacion - 300]);
  }
  out.cuerpos.forEach((c) => {
    if (c.alto > out.alto) c.alto = out.alto;
  });
  return out;
}

export function fijarProfundidad(d: Diseno, profundidad: number): Diseno {
  const out = clonar(d);
  out.profundidad = limitar(Math.round(profundidad), LIMITES[d.plantilla].profundidad);
  if (out.plantilla === 'compacto') out.aereos.profundidad = Math.min(out.aereos.profundidad, out.profundidad);
  ajustarRetorno(out);
  return out;
}

/** Cambia el ancho de un cuerpo; el largo del tramo pasa a ser la suma (en el compacto, los demás superiores se ajustan). */
export function fijarAnchoCuerpo(d: Diseno, indice: number, ancho: number, tramo: Tramo = 'base'): Diseno {
  const out = clonar(d);
  const cs = cuerposDe(out, tramo);
  const c = cs[indice];
  if (!c) return out;
  if (tramo === 'aereos' && out.plantilla === 'compacto') {
    const otros = cs.filter((x) => x !== c);
    const minOtros = otros.reduce((s, x) => s + minCuerpo(x), 0);
    c.ancho = limitar(Math.round(ancho), [minCuerpo(c), Math.max(minCuerpo(c), out.ancho - minOtros)]);
    repartirModulos(otros, out.ancho - c.ancho);
    return out;
  }
  const resto = largoTramo(out, tramo) - c.ancho;
  const fijo = anchoFijo(out.plantilla, c);
  c.ancho = fijo ?? Math.max(minCuerpo(c), Math.min(Math.round(ancho), maximoTramo(out, tramo) - resto));
  recalcular(out, tramo);
  if (tramo === 'base') ajustarSuperiorCompacto(out);
  return out;
}

export function fijarSeparacion(d: Diseno, separacion: number): Diseno {
  const out = clonar(d);
  const sep = Math.max(0, Math.min(200, Math.round(separacion)));
  const n = out.cuerpos.length;
  out.separacionCuerpos = sep;
  out.ancho = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + sep * Math.max(0, n - 1);
  if (out.ancho > LIMITES[d.plantilla].ancho[1]) return fijarAncho(out, LIMITES[d.plantilla].ancho[1]);
  ajustarSuperiorCompacto(out);
  return out;
}

export function actualizarCuerpo(d: Diseno, indice: number, cambios: Partial<Cuerpo>, tramo: Tramo = 'base'): Diseno {
  const out = clonar(d);
  const c = cuerposDe(out, tramo)[indice];
  if (!c) return out;
  const { ancho, ...resto } = cambios;
  Object.assign(c, resto);
  c.puertas = Math.max(0, Math.min(4, Math.round(c.puertas)));
  c.cajones = Math.max(0, Math.min(12, Math.round(c.cajones)));
  c.repisas = Math.max(0, Math.min(8, Math.round(c.repisas)));
  if (c.tipo === 'campana') {
    c.cajones = 0;
    c.puertas = Math.max(1, c.puertas);
  } else if (c.tipo === 'nicho') {
    c.cajones = 0;
    c.puertas = 1;
    c.abatible = true;
  } else if (c.tipo !== 'frentes') {
    c.puertas = 0;
    c.cajones = 0;
  }
  if (tramo === 'aereos') c.cajones = 0;
  if (typeof ancho === 'number') return fijarAnchoCuerpo(out, indice, ancho, tramo);
  const fijo = anchoFijo(out.plantilla, c);
  if (fijo != null && c.ancho !== fijo) return fijarAnchoCuerpo(out, indice, fijo, tramo);
  return out;
}

/** Nombre corto de un módulo según lo que tiene (para la tira y el visor). */
export function nombreModulo(c: Cuerpo): string {
  if (c.tipo !== 'frentes') return NOMBRE_CORTO[c.tipo];
  if (c.abatible) return 'Abatible';
  const puertas = c.puertas > 0 ? `${c.puertas} ${c.puertas === 1 ? 'puerta' : 'puertas'}` : '';
  const cajones = c.cajones > 0 ? `${c.cajones} ${c.cajones === 1 ? 'cajón' : 'cajones'}` : '';
  if (puertas && cajones) return c.cajonesArriba ? `${cajones} + ${puertas}` : `${puertas} + ${cajones}`;
  return puertas || cajones || 'Abierto';
}

const NOMBRE_CORTO: Record<Exclude<Cuerpo['tipo'], 'frentes'>, string> = {
  horno: 'Horno',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
  campana: 'Campana',
  nicho: 'Nicho microondas',
};

/** Módulo listo para agregar desde el panel «Módulos y espacios». */
export interface PresetModulo {
  id: string;
  texto: string;
  ayuda: string;
  tipo: Cuerpo['tipo'];
  ancho: number;
  /** Ancho bajo el cual no sirve (horno empotrado); por defecto el mínimo de fabricación. */
  anchoMinimo?: number;
  cambios: Partial<Cuerpo>;
}

const P = {
  puerta: (ancho = 450): PresetModulo => ({ id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } }),
  dosPuertas: (ancho = 800): PresetModulo => ({ id: 'dos-puertas', texto: 'Módulo 2 puertas', ayuda: 'Dos puertas con repisa interior', tipo: 'frentes', ancho, cambios: { puertas: 2, repisas: 1 } }),
  cajonera: (ancho = 450): PresetModulo => ({ id: 'cajonera', texto: 'Cajonera', ayuda: '3 cajones', tipo: 'frentes', ancho, cambios: { cajones: 3 } }),
  cajonPuerta: (ancho = 450): PresetModulo => ({ id: 'cajon-puerta', texto: 'Cajón y puerta', ayuda: '1 cajón arriba y 1 puerta abajo', tipo: 'frentes', ancho, cambios: { cajones: 1, puertas: 1, bisagra: 'der', cajonesArriba: true, repisas: 1 } }),
  horno: (): PresetModulo => ({ id: 'horno', texto: 'Horno empotrado', ayuda: 'Módulo de 60 cm para horno', tipo: 'horno', ancho: 600, anchoMinimo: 600, cambios: {} }),
  hueco: (): PresetModulo => ({ id: 'hueco', texto: 'Espacio libre', ayuda: 'Para refrigerador, lavadora u otro equipo', tipo: 'hueco', ancho: 600, cambios: {} }),
};

/** Módulos y espacios que se pueden agregar según el tipo de mueble y el tramo. */
export function presetsModulo(p: Plantilla, tramo: Tramo = 'base'): PresetModulo[] {
  if (tramo === 'aereos') {
    const aereos: PresetModulo[] = [
      { id: 'aereo-puerta', texto: 'Aéreo 1 puerta', ayuda: 'Una puerta con repisa', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
      { id: 'aereo-dos', texto: 'Aéreo 2 puertas', ayuda: 'Dos puertas con repisa', tipo: 'frentes', ancho: 800, cambios: { puertas: 2, repisas: 1 } },
      { id: 'abatible', texto: 'Abatible', ayuda: 'Puerta que se abre hacia arriba', tipo: 'frentes', ancho: 600, cambios: { puertas: 1, abatible: true, repisas: 0 } },
      { id: 'nicho', texto: 'Nicho microondas', ayuda: 'Abatible arriba y nicho abierto con repisa', tipo: 'nicho', ancho: 600, cambios: { puertas: 1, abatible: true, repisas: 0 } },
    ];
    if (p === 'compacto') return aereos;
    return [
      ...aereos,
      { id: 'campana', texto: 'Campana', ayuda: 'Mueble bajo con espacio para la campana', tipo: 'campana', ancho: 600, cambios: { puertas: 2, repisas: 0 } },
      { id: 'hueco', texto: 'Espacio libre', ayuda: 'Sin mueble (ventana, extractor…)', tipo: 'hueco', ancho: 600, cambios: {} },
    ];
  }
  if (tramo === 'retorno') return [P.puerta(), P.dosPuertas(), P.cajonera(), P.cajonPuerta(), P.hueco()];
  switch (p) {
    case 'cocina':
      return [P.puerta(), P.dosPuertas(), P.cajonera(), P.cajonPuerta(), P.horno(), P.hueco()];
    case 'compacto':
      return [P.puerta(), P.dosPuertas(600), P.cajonera(), P.cajonPuerta()];
    case 'cocina-infantil':
      return [
        { id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho: 300, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
        { id: 'horno', texto: 'Horno de juguete', ayuda: 'Puerta con ventana', tipo: 'horno', ancho: 300, cambios: {} },
      ];
    case 'closet':
      return [
        { id: 'colgar', texto: 'Módulo para colgar', ayuda: 'Puerta y barra para colgar', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', colgador: true, repisas: 1 } },
        { id: 'repisas', texto: 'Módulo con repisas', ayuda: 'Puerta y 4 repisas', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', repisas: 4 } },
        { id: 'cajones', texto: 'Módulo con cajones', ayuda: 'Puerta arriba y 3 cajones abajo', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', cajones: 3, repisas: 1 } },
        { id: 'abierto', texto: 'Módulo abierto', ayuda: 'Repisas a la vista, sin puerta', tipo: 'frentes', ancho: 400, cambios: { repisas: 4 } },
      ];
    case 'escritorio':
      return [
        { id: 'colgar', texto: 'Módulo para colgar', ayuda: 'Puerta y barra para colgar', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', colgador: true, repisas: 2 } },
        { id: 'cajones', texto: 'Módulo con cajones', ayuda: '3 cajones', tipo: 'frentes', ancho: 450, cambios: { cajones: 3, repisas: 2 } },
        { id: 'abierto', texto: 'Módulo abierto', ayuda: 'Repisas a la vista, sin puerta', tipo: 'frentes', ancho: 400, cambios: { repisas: 4 } },
        { id: 'escritorio', texto: 'Escritorio', ayuda: 'Cubierta de trabajo de 75 cm de alto', tipo: 'escritorio', ancho: 800, cambios: { alto: 750 } },
      ];
    case 'comoda':
      return [{ id: 'cajones', texto: 'Módulo de cajones', ayuda: '4 cajones', tipo: 'frentes', ancho: 450, cambios: { cajones: 4 } }];
    case 'tocador':
      return [];
  }
}

/** Ancho que puede tener un módulo nuevo sin pasar el máximo del tramo (null si no cabe). */
export function anchoDisponible(d: Diseno, tipo: Cuerpo['tipo'], deseado: number, anchoMinimo?: number, tramo: Tramo = 'base'): number | null {
  const minimo = Math.max(tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO, anchoMinimo ?? 0);
  if (tramo === 'aereos' && d.plantilla === 'compacto') {
    // El superior del compacto tiene el ancho del mueble: el nuevo módulo toma espacio de los demás.
    const cs = d.aereos.cuerpos;
    const libre = d.ancho - cs.reduce((s, c) => s + minCuerpo(c), 0);
    if (libre < minimo) return null;
    return Math.min(deseado, libre, Math.max(minimo, Math.round(d.ancho / (cs.length + 1))));
  }
  const n = cuerposDe(d, tramo).length;
  const libre = maximoTramo(d, tramo) - largoTramo(d, tramo) - (n > 0 ? sepDe(d, tramo) : 0);
  if (libre < minimo) return null;
  return Math.min(deseado, libre);
}

/** En la cocina infantil el primer módulo es la despensa alta: nada se pone delante de ella. */
export function posicionMinima(d: Diseno, tramo: Tramo = 'base'): number {
  return tramo === 'base' && d.plantilla === 'cocina-infantil' && d.cuerpos.length > 0 ? 1 : 0;
}

/**
 * Agrega un módulo en la posición indicada (por defecto al final). El largo
 * del tramo crece con el módulo; si no cabe completo se agrega con el ancho
 * que queda y si no queda espacio el diseño no cambia.
 */
export function agregarCuerpo(
  d: Diseno,
  tipo: Cuerpo['tipo'] = 'frentes',
  posicion?: number,
  opciones: { cambios?: Partial<Cuerpo>; ancho?: number; anchoMinimo?: number; tramo?: Tramo } = {},
): Diseno {
  const { cambios, tramo = 'base' } = opciones;
  const fijo = tramo === 'base' ? anchoFijo(d.plantilla, { tipo } as Cuerpo) : null;
  const anchoDeseado = fijo ?? opciones.ancho;
  const anchoMinimo = fijo ?? opciones.anchoMinimo;
  if (tramo === 'retorno' && !d.retorno) return d;
  const base =
    cambios ??
    {
      puertas: tipo === 'frentes' ? (d.plantilla === 'comoda' ? 0 : 1) : 0,
      cajones: tipo === 'frentes' && d.plantilla === 'comoda' ? 4 : 0,
      bisagra: 'der' as const,
      colgador: d.plantilla === 'closet' && tipo === 'frentes',
    };
  const ancho = anchoDisponible(d, tipo, anchoDeseado ?? (tipo === 'horno' || tipo === 'hueco' ? 600 : 450), anchoMinimo, tramo);
  if (ancho == null) return d;
  const out = clonar(d);
  const cs = cuerposDe(out, tramo);
  const nuevo = nuevoCuerpo({ ...base, tipo, ancho, ...(tipo === 'frentes' || tipo === 'campana' || tipo === 'nicho' ? {} : { puertas: 0, cajones: 0 }) });
  const i = Math.max(posicionMinima(d, tramo), Math.min(cs.length, Math.round(posicion ?? cs.length)));
  if (tramo === 'aereos' && out.plantilla === 'compacto') {
    // Los demás superiores ceden el ancho del nuevo.
    repartirModulos(cs, out.ancho - ancho);
    cs.splice(i, 0, nuevo);
    return out;
  }
  cs.splice(i, 0, nuevo);
  recalcular(out, tramo);
  if (tramo === 'base') {
    // La encimera y el lavaplatos siguen en el mismo módulo.
    const correr = (v: number) => (v >= i ? v + 1 : v);
    if (cs.length > 1) {
      out.cocina.encimeraCuerpo = correr(out.cocina.encimeraCuerpo);
      out.cocina.lavaplatosCuerpo = correr(out.cocina.lavaplatosCuerpo);
    }
    ajustarSuperiorCompacto(out);
  }
  return out;
}

/** Agrega uno de los módulos de presetsModulo. */
export function agregarModulo(d: Diseno, preset: PresetModulo, posicion?: number, tramo: Tramo = 'base'): Diseno {
  return agregarCuerpo(d, preset.tipo, posicion, { cambios: preset.cambios, ancho: preset.ancho, anchoMinimo: preset.anchoMinimo, tramo });
}

/** Módulo más cercano a `cerca` que no sea `evitar`, prefiriendo el tipo indicado y evitando espacios libres. */
function moduloCercano(cuerpos: Cuerpo[], cerca: number, evitar: number, preferir: Cuerpo['tipo'], desde = 0): number {
  let mejor = -1;
  let puntaje = Infinity;
  cuerpos.forEach((c, i) => {
    if (i === evitar || i < desde) return;
    const p = Math.abs(i - cerca) + (c.tipo === preferir ? 0 : c.tipo === 'hueco' ? 200 : 100);
    if (p < puntaje) {
      puntaje = p;
      mejor = i;
    }
  });
  return mejor >= 0 ? mejor : Math.min(cuerpos.length - 1, Math.max(desde, cerca));
}

export function quitarCuerpo(d: Diseno, indice: number, tramo: Tramo = 'base'): Diseno {
  const actuales = cuerposDe(d, tramo);
  if (actuales.length <= 1 || indice < 0 || indice >= actuales.length) return d;
  const out = clonar(d);
  const cs = cuerposDe(out, tramo);
  cs.splice(indice, 1);
  if (tramo === 'aereos') {
    ajustarSuperiorCompacto(out);
    return out;
  }
  if (tramo === 'retorno') {
    recalcular(out, 'retorno');
    ajustarRetorno(out);
    return out;
  }
  const n = out.cuerpos.length;
  // La encimera y el lavaplatos del módulo quitado pasan al módulo más adecuado y cercano.
  const { encimeraCuerpo: enc, lavaplatosCuerpo: lav } = d.cocina;
  const correr = (v: number) => Math.min(n - 1, v > indice ? v - 1 : v);
  let e = correr(enc);
  let w = correr(lav);
  const desde = d.plantilla === 'cocina-infantil' && n > 1 ? 1 : 0;
  if (enc === indice) e = moduloCercano(out.cuerpos, indice, lav === indice ? -1 : w, 'horno', desde);
  if (lav === indice) w = moduloCercano(out.cuerpos, indice, e, 'frentes', desde);
  out.cocina.encimeraCuerpo = e;
  out.cocina.lavaplatosCuerpo = w;
  out.ancho = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + out.separacionCuerpos * (n - 1);
  if (out.ancho < LIMITES[d.plantilla].ancho[0]) return fijarAncho(out, LIMITES[d.plantilla].ancho[0]);
  ajustarSuperiorCompacto(out);
  return out;
}

export function moverCuerpo(d: Diseno, indice: number, delta: -1 | 1, tramo: Tramo = 'base'): Diseno {
  const destino = indice + delta;
  if (destino < 0 || destino >= cuerposDe(d, tramo).length) return d;
  if (Math.min(indice, destino) < posicionMinima(d, tramo)) return d;
  const out = clonar(d);
  const cs = cuerposDe(out, tramo);
  const [c] = cs.splice(indice, 1);
  cs.splice(destino, 0, c);
  if (tramo === 'base') {
    const remapear = (v: number) => (v === indice ? destino : v === destino ? indice : v);
    out.cocina.encimeraCuerpo = remapear(out.cocina.encimeraCuerpo);
    out.cocina.lavaplatosCuerpo = remapear(out.cocina.lavaplatosCuerpo);
  }
  return out;
}

// ---------- Cocina en L y aéreos ----------

/** Aéreos apagados por defecto (o el mueble superior del compacto). */
export function aereosVacios(plantilla: Plantilla): Diseno['aereos'] {
  return plantilla === 'compacto'
    ? { activo: true, montaje: 'apoyado', alto: 580, profundidad: 300, elevacion: 880, alineacion: 'centro', cuerpos: [] }
    : { activo: false, montaje: 'mural', alto: 600, profundidad: 330, elevacion: 1450, alineacion: 'centro', cuerpos: [] };
}

/** Aéreos sugeridos sobre todo el tramo principal (con un módulo de campana sobre la encimera). */
export function aereosPorDefecto(d: Diseno): Diseno['aereos'] {
  const [sx0, sx1] = extremosPrincipal(d);
  const largo = Math.min(LIMITES_AEREOS.ancho[1], Math.round(sx1 - sx0));
  const n = Math.max(1, Math.round(largo / 750));
  const anchos = repartir(largo, Array(n).fill(1));
  const cuerpos = anchos.map((ancho) => nuevoCuerpo({ ancho, puertas: ancho >= 550 ? 2 : 1, bisagra: 'der', repisas: 1 }));
  if (d.plantilla === 'cocina' && d.cocina.encimera !== 'ninguna' && d.cuerpos.length) {
    const l = calcularLayout(d);
    const xEnc = centroCuerpo(l, d.cocina.encimeraCuerpo);
    let cursor = sx0;
    let mejor = 0;
    let dist = Infinity;
    cuerpos.forEach((c, i) => {
      const dx = Math.abs(cursor + c.ancho / 2 - xEnc);
      if (dx < dist) {
        dist = dx;
        mejor = i;
      }
      cursor += c.ancho;
    });
    Object.assign(cuerpos[mejor], { tipo: 'campana', puertas: 2, repisas: 0 });
  }
  return { ...aereosVacios(d.plantilla), activo: true, alineacion: 'izq', cuerpos };
}

export function activarAereos(d: Diseno, activo: boolean): Diseno {
  if (d.plantilla === 'compacto') return d;
  const out = clonar(d);
  if (activo && !out.aereos.cuerpos.length) out.aereos = aereosPorDefecto(out);
  out.aereos.activo = activo;
  return out;
}

export function fijarAereos(d: Diseno, cambios: Partial<Pick<Diseno['aereos'], 'alto' | 'profundidad' | 'elevacion' | 'alineacion'>>): Diseno {
  const out = clonar(d);
  const a = out.aereos;
  Object.assign(a, cambios);
  a.profundidad = limitar(Math.round(a.profundidad), [LIMITES_AEREOS.profundidad[0], Math.min(LIMITES_AEREOS.profundidad[1], out.plantilla === 'compacto' ? out.profundidad : 999)]);
  if (out.plantilla === 'compacto') {
    a.elevacion = limitar(Math.round(a.elevacion), [LIMITES_AEREOS.base[0], Math.min(LIMITES_AEREOS.base[1], out.alto - 300 - LIMITES_AEREOS.alto[0])]);
    a.alto = limitar(Math.round(a.alto), [LIMITES_AEREOS.alto[0], out.alto - a.elevacion - 300]);
  } else {
    a.alto = limitar(Math.round(a.alto), LIMITES_AEREOS.alto);
    a.elevacion = limitar(Math.round(a.elevacion), LIMITES_AEREOS.elevacion);
  }
  return out;
}

/** Cambia el largo total de los aéreos repartiéndolo entre sus módulos. */
export function fijarAnchoAereos(d: Diseno, ancho: number): Diseno {
  if (d.plantilla === 'compacto' || !d.aereos.cuerpos.length) return d;
  const out = clonar(d);
  const minimo = out.aereos.cuerpos.reduce((s, c) => s + minCuerpo(c), 0);
  repartirModulos(out.aereos.cuerpos, Math.max(minimo, limitar(Math.round(ancho), [LIMITES_AEREOS.ancho[0], maximoTramo(out, 'aereos')])));
  return out;
}

/** Tramo en L sugerido: 120 cm de largo exterior con módulos de puertas. */
export function retornoPorDefecto(d: Diseno, lado: 'izq' | 'der'): NonNullable<Diseno['retorno']> {
  const largo = Math.max(1200, d.profundidad + 400);
  const util = largo - d.profundidad;
  const cuerpos = util > 900 ? repartir(util, [1, 1]).map((ancho) => nuevoCuerpo({ ancho, puertas: 1, bisagra: 'der', repisas: 1 })) : [nuevoCuerpo({ ancho: util, puertas: util >= 550 ? 2 : 1, repisas: 1 })];
  return { lado, largo, profundidad: d.profundidad, cuerpos };
}

/** Cambia la forma de la cocina: lineal (null) o en L hacia un lado. */
export function fijarForma(d: Diseno, lado: 'izq' | 'der' | null): Diseno {
  if (d.plantilla !== 'cocina') return d;
  const out = clonar(d);
  if (!lado) out.retorno = null;
  else if (out.retorno) out.retorno.lado = lado;
  else out.retorno = retornoPorDefecto(out, lado);
  if (out.retorno && out.aereos.cuerpos.length && largoTramo(out, 'aereos') > maximoTramo(out, 'aereos')) {
    repartirModulos(out.aereos.cuerpos, maximoTramo(out, 'aereos'));
  }
  return out;
}

export function fijarRetorno(d: Diseno, cambios: Partial<Pick<NonNullable<Diseno['retorno']>, 'largo' | 'profundidad'>>): Diseno {
  if (!d.retorno) return d;
  const out = clonar(d);
  const r = out.retorno!;
  if (cambios.profundidad != null) r.profundidad = limitar(Math.round(cambios.profundidad), LIMITES_RETORNO.profundidad);
  if (cambios.largo != null) r.largo = Math.round(cambios.largo);
  ajustarRetorno(out);
  return out;
}

/** Asegura que un diseño cargado (o recibido del servidor) sea consistente. */
export function normalizar(d: Diseno): Diseno {
  // Los diseños guardados antes de los aéreos y la L no traen esos campos.
  let out = clonar({ ...d, aereos: d.aereos ?? aereosVacios(d.plantilla), retorno: d.retorno ?? null });
  const lim = LIMITES[out.plantilla];
  out.alto = limitar(out.alto, lim.alto);
  out.profundidad = limitar(out.profundidad, lim.profundidad);
  out.luzFrentes = limitar(out.luzFrentes, [1, 10]);
  out.zocalo = limitar(out.zocalo, [0, 200]);
  out.espesor = out.espesor === 18 ? 18 : 15;
  const n = out.cuerpos.length;
  // El horno empotrado siempre mide lo mismo (diseños guardados con otro ancho se corrigen).
  for (const c of out.cuerpos) {
    const fijo = anchoFijo(out.plantilla, c);
    if (fijo != null) c.ancho = fijo;
  }
  const suma = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + out.separacionCuerpos * Math.max(0, n - 1);
  if (suma !== out.ancho) out = fijarAncho(out, out.ancho);
  out.cocina.encimeraCuerpo = limitar(out.cocina.encimeraCuerpo, [0, Math.max(0, n - 1)]);
  out.cocina.lavaplatosCuerpo = limitar(out.cocina.lavaplatosCuerpo, [0, Math.max(0, n - 1)]);
  if (out.plantilla !== 'cocina') out.retorno = null;
  if (out.retorno) {
    out.retorno.profundidad = limitar(out.retorno.profundidad, LIMITES_RETORNO.profundidad);
    ajustarRetorno(out);
  }
  if (out.plantilla === 'compacto') {
    out.aereos.activo = true;
    out.aereos.montaje = 'apoyado';
    out = fijarAereos(out, {});
    ajustarSuperiorCompacto(out);
  }
  return out;
}

// ---------- Advertencias de fabricación ----------

export interface Advertencia {
  nivel: 'info' | 'aviso';
  texto: string;
}

export function advertencias(d: Diseno, unidad: Unidad = 'cm'): Advertencia[] {
  const out: Advertencia[] = [];
  const f = (mm: number) => formatear(mm, unidad);
  if (d.plantilla === 'tocador') {
    const l = calcularLayoutTocador(d);
    if (l.frentes.some((c) => c.rect.y1 - c.rect.y0 < 90)) out.push({ nivel: 'aviso', texto: `Hay cajones de menos de ${f(90)} de alto: reduce la cantidad de cajones.` });
    return out;
  }
  const l = calcularLayout(d);
  const dr = disenoRetorno(d);
  const la = calcularLayoutAereos(d);
  const todos = [
    ...l.frentes.map((fr) => ({ fr, nombre: fr.cuerpo >= 0 ? `módulo ${fr.cuerpo + 1}` : 'fila superior' })),
    ...(dr ? calcularLayout(dr).frentes.map((fr) => ({ fr, nombre: `módulo ${fr.cuerpo + 1} de la L` })) : []),
    ...(la ? la.frentes.map((fr) => ({ fr, nombre: `${d.plantilla === 'compacto' ? 'mueble superior' : 'aéreo'} ${fr.cuerpo + 1}` })) : []),
  ];
  for (const { fr, nombre } of todos) {
    const ancho = fr.rect.x1 - fr.rect.x0;
    const alto = fr.rect.y1 - fr.rect.y0;
    if (fr.tipo === 'puerta' && fr.bisagra === 'arriba') {
      if (ancho > 1000) out.push({ nivel: 'aviso', texto: `La puerta abatible del ${nombre} mide ${f(ancho)} de ancho; sobre ${f(1000)} conviene dividir el módulo.` });
      continue;
    }
    if (fr.tipo === 'puerta' && ancho > 620) {
      out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} mide ${f(ancho)} de ancho; sobre ${f(600)} se recomienda dividirla en 2 puertas.` });
    }
    if (fr.tipo === 'puerta' && ancho < 200) {
      out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} muy angosta (${f(ancho)}).` });
    }
    if (fr.tipo === 'cajon' && alto < 90) {
      out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} con frente de ${f(alto)}: el mínimo fabricable es ${f(90)}.` });
    }
    if (fr.tipo === 'cajon' && ancho > 1000) {
      out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} de ${f(ancho)} de ancho: sobre ${f(1000)} conviene dividir en 2 columnas.` });
    }
  }
  if (esCocina(d)) {
    d.cuerpos.forEach((c, i) => {
      if (c.tipo === 'horno' && d.plantilla === 'cocina' && c.ancho < 600) {
        out.push({ nivel: 'aviso', texto: `El horno empotrado estándar necesita un módulo de ${f(600)} (módulo ${i + 1} mide ${f(c.ancho)}).` });
      }
    });
    const lav = d.cuerpos[d.cocina.lavaplatosCuerpo];
    if (d.cocina.lavaplatos !== 'ninguno' && lav) {
      const necesita = d.cocina.lavaplatos === 'doble' ? 800 : 450;
      if (lav.ancho < necesita) out.push({ nivel: 'aviso', texto: `El lavaplatos ${d.cocina.lavaplatos} necesita un módulo de al menos ${f(necesita)}.` });
    }
    const enc = d.cuerpos[d.cocina.encimeraCuerpo];
    if (d.cocina.encimera !== 'ninguna' && enc && enc.ancho < (d.cocina.encimera === '4' ? 580 : d.plantilla === 'cocina' ? 400 : 250)) {
      out.push({ nivel: 'info', texto: `La encimera sobresale del módulo ${d.cocina.encimeraCuerpo + 1}; la cubierta igual la soporta.` });
    }
    if (
      d.cocina.encimera !== 'ninguna' &&
      d.cocina.lavaplatos !== 'ninguno' &&
      (d.plantilla === 'cocina-infantil'
        ? Math.max(1, d.cocina.encimeraCuerpo) === Math.max(1, d.cocina.lavaplatosCuerpo)
        : d.cocina.encimeraCuerpo === d.cocina.lavaplatosCuerpo)
    ) {
      out.push({ nivel: 'aviso', texto: 'La encimera y el lavaplatos están sobre el mismo módulo: elige módulos distintos.' });
    }
  }
  if (la && la.montaje === 'mural' && d.retorno) {
    const [x0, x1] = extremosPrincipal(d);
    if (la.x0 < x0 - 1 || la.x1 > x1 + 1) out.push({ nivel: 'aviso', texto: `Los aéreos pasan del muro de la cocina en L (${f(x1 - x0)}): acorta sus módulos o cambia la alineación.` });
  }
  if (la && la.montaje === 'mural') {
    const libre = la.y0 - d.alto;
    if (libre < 450) out.push({ nivel: 'aviso', texto: `Entre la cubierta y los aéreos quedan ${f(libre)}: se recomiendan al menos ${f(550)}.` });
    if (d.cocina.encimera !== 'ninguna' && !d.aereos.cuerpos.some((c) => c.tipo === 'campana' || c.tipo === 'hueco')) {
      out.push({ nivel: 'info', texto: 'Sobre la encimera conviene un módulo de campana o un espacio libre en los aéreos.' });
    }
  }
  if (la && la.montaje === 'apoyado' && la.y0 - la.yCubierta < 350) {
    out.push({ nivel: 'info', texto: `Entre la cubierta y el mueble superior quedan ${f(la.y0 - la.yCubierta)}: es poco para un hervidor o una cafetera (ideal ${f(400)}).` });
  }
  if (d.plantilla === 'closet' && d.profundidad < 500 && d.cuerpos.some((c) => c.colgador)) {
    out.push({ nivel: 'info', texto: `Con ${f(d.profundidad)} de fondo los ganchos quedan algo justos (ideal ${f(550)}).` });
  }
  return out;
}

// ---------- Resumen de piezas ----------

export function contarFrentes(d: Diseno): { puertas: number; cajones: number } {
  if (d.plantilla === 'tocador') {
    return { puertas: 0, cajones: d.tocador.cajonesIzq + d.tocador.cajonesDer + d.tocador.cajonesCentro };
  }
  const dr = disenoRetorno(d);
  const frentes = [...calcularLayout(d).frentes, ...(dr ? calcularLayout(dr).frentes : []), ...(calcularLayoutAereos(d)?.frentes ?? [])];
  return {
    puertas: frentes.filter((f) => f.tipo === 'puerta').length,
    cajones: frentes.filter((f) => f.tipo === 'cajon').length,
  };
}

// ---------- Precio referencial ----------

function superficie(ancho: number, alto: number, prof: number): number {
  return ancho * alto + 2 * prof * alto + ancho * prof;
}

/** Superficie de melamina aproximada de todo el conjunto (tramo principal, L y aéreos). */
function superficieTotal(d: Diseno): number {
  const alto = d.plantilla === 'compacto' ? d.aereos.elevacion : d.alto;
  let s = superficie(d.ancho, alto, d.profundidad);
  if (d.retorno) s += superficie(d.retorno.largo, d.alto, d.retorno.profundidad);
  const la = calcularLayoutAereos(d);
  if (la) s += superficie(la.x1 - la.x0, la.montaje === 'apoyado' ? la.y1 - la.yCubierta : la.y1 - la.y0, la.profundidad);
  return s;
}

/**
 * Precio referencial: escala el precio del producto base según la superficie de
 * melamina y suma o resta frentes. Es solo una guía; la cotización final la da la tienda.
 */
export function precioReferencial(d: Diseno, base: ProductoCatalogo | null, disenoBase: Diseno | null): number | null {
  if (!base || !disenoBase) return null;
  const precioBase = base.precio_oferta ?? base.precio;
  if (!precioBase) return null;
  const s0 = superficieTotal(disenoBase);
  const s1 = superficieTotal(d);
  let precio = precioBase * (0.45 + 0.55 * (s1 / s0));
  const f0 = contarFrentes(disenoBase);
  const f1 = contarFrentes(d);
  precio += (f1.cajones - f0.cajones) * 14000 + (f1.puertas - f0.puertas) * 9000;
  if (esCocina(d)) {
    const extra = (x: string) => (x === '4' ? 2 : x === '3' ? 1 : x === '2' ? 0.6 : 0);
    precio += (extra(d.cocina.encimera) - extra(disenoBase.cocina.encimera)) * 45000;
    const lav = (x: string) => (x === 'doble' ? 1.6 : x === 'simple' ? 1 : 0);
    precio += (lav(d.cocina.lavaplatos) - lav(disenoBase.cocina.lavaplatos)) * 60000;
    const hornos = (x: Diseno) => x.cuerpos.filter((c) => c.tipo === 'horno').length;
    if (d.plantilla === 'cocina') precio += (hornos(d) - hornos(disenoBase)) * 150000;
  }
  if (d.imagenFrontal) precio += 15000;
  precio = Math.max(precioBase * 0.4, precio);
  return Math.round(precio / 1000) * 1000 - 10;
}

export function formatoPrecio(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
