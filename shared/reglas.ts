// Reglas de negocio: límites de medidas, unidades, operaciones sobre el diseño
// (todas dejan un diseño válido o se rechazan con un motivo), migración de los
// diseños guardados, advertencias de fabricación y precio.
import { cuerpo as nuevoCuerpo, disenoLibre, encimera as nuevaEncimera, lavaplatos as nuevoLavaplatos, nuevoId, repartir } from './catalogo';
import {
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  calcularLayoutTocador,
  centroEncimera,
  disenoBase,
  disenoLado,
  esCocina,
  esCocinaAdulta,
  esTramoAereo,
  extremosPrincipal,
  formaDe,
  inicioAereoPrincipal,
  LADOS,
  ladoAereoActivo,
  ladoDeTramo,
  MODULO_MIN_LAVAPLATOS,
  posEnMundo,
  posEnTramo,
  posicionesModulos,
  retornoDe,
  tramoAereoDe,
  tramoBaseDe,
  type Frente,
  anchoTotalEquipo,
} from './layout';
import { absorberCercanos, ajustarSuma, holgura, repartirParejo, type Limite } from './reparto';
import {
  ANCHO_HORNO,
  ANCHO_MAX_CAJONERA,
  ANCHO_MIN_CUERPO,
  ANCHO_MAX_HUECO,
  ANCHO_MIN_HUECO,
  ANCHO_POR_PUERTA,
  ANCHO_SOBRE_REFRIGERADOR,
  alojaCampana,
  anchoFijo,
  cuerposDe,
  esModuloCampana,
  esCajonera,
  largoObjetivo,
  largoTramo,
  LIMITES_AEREOS,
  LIMITES_LADO,
  limitesModulo,
  resolverTramo,
  rolModulo,
  sepDe,
  SIN_TOPE,
  TRAMOS_AEREOS,
  TRAMOS_BASE,
} from './tramos';
import {
  aereoVisible,
  alinearCampanas,
  cabeEncimera,
  choqueEnModulo,
  elegirAnfitrion,
  esAdulta,
  largoAereoSinCortarCampanas,
  llevaEquipamiento,
  margenMaximo,
  motivoNoPuedeIr,
  moduloCampana,
  nombreModuloEn,
  nombreTramo,
  opcionesEquipo,
  repararEquipos,
  soltarCampanas,
  type Ctx,
} from './equipos';
import { revisarOperacion } from './operaciones';
import { contarModulos, lineasOpciones, NOMBRE_HORNO, NOMBRE_LAVAPLATOS, precioAereo, precioCocina, TARIFAS, type LineaPrecio } from './tarifas';
import type {
  AjustesPrecio,
  Aereos,
  Cuerpo,
  Diseno,
  DisenoGuardado,
  Encimera,
  EquipamientoCocina,
  Equipo,
  Forma,
  Lado,
  LadoId,
  Lavaplatos,
  Materiales,
  MuebleAdicional,
  Voladizo,
  Plantilla,
  ProductoCatalogo,
  Retorno,
  TipoTirador,
  Tramo,
  TramoAereo,
  TramoBase,
  TramoId,
  Unidad,
} from './tipos';

export { ALTO_REFRIGERADOR, altoSobreRefrigerador } from './layout';
export {
  ANCHO_SOBRE_REFRIGERADOR,
  ANCHO_CAMPANA,
  ANCHO_ESPECIERO,
  ANCHO_HORNO,
  ANCHO_MAX_CAJONERA,
  ANCHO_MIN_CUERPO,
  ANCHO_MIN_HUECO,
  ANCHO_POR_PUERTA,
  anchoFijo,
  cuerposDe,
  esCajonera,
  largoObjetivo,
  largoTramo,
  LIMITES_AEREOS,
  LIMITES_LADO,
  limitesModulo,
  resolverTramo,
  rolModulo,
  tramosDe,
  type Rol,
} from './tramos';
export { listarEquipamiento, moduloCampana, nombreModuloEn, nombreTramo, opcionesEquipo, type ItemEquipo } from './equipos';
export { NOMBRE_LAVAPLATOS, precioCocina, TARIFAS, type LineaPrecio, type PrecioCocina } from './tarifas';
export { describirOperaciones, OPERACIONES, revisarOperacion, type CampoOperacion, type DescripcionOperacion } from './operaciones';
export type { Forma, LadoId, Tramo, TramoAereo, TramoBase, TramoId } from './tipos';

export interface Limites {
  ancho: [number, number];
  alto: [number, number];
  profundidad: [number, number];
}

export const LIMITES: Record<Plantilla, Limites> = {
  cocina: { ancho: [400, SIN_TOPE], alto: [700, SIN_TOPE], profundidad: [450, SIN_TOPE] },
  compacto: { ancho: [600, SIN_TOPE], alto: [1500, SIN_TOPE], profundidad: [350, SIN_TOPE] },
  'cocina-infantil': { ancho: [500, SIN_TOPE], alto: [800, SIN_TOPE], profundidad: [250, SIN_TOPE] },
  closet: { ancho: [400, SIN_TOPE], alto: [1200, SIN_TOPE], profundidad: [300, SIN_TOPE] },
  comoda: { ancho: [300, SIN_TOPE], alto: [500, SIN_TOPE], profundidad: [300, SIN_TOPE] },
  tocador: { ancho: [600, SIN_TOPE], alto: [1000, SIN_TOPE], profundidad: [300, SIN_TOPE] },
  escritorio: { ancho: [700, SIN_TOPE], alto: [500, SIN_TOPE], profundidad: [350, SIN_TOPE] },
};

/** Nombre heredado de LIMITES_LADO. */
export const LIMITES_RETORNO = LIMITES_LADO;

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

const cm = (mm: number) => formatear(mm, 'cm');
const sumar = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------- Infraestructura de las operaciones ----------

/** Resultado de una operación: el diseño nuevo (o el mismo si se rechazó o no cambió nada) y por qué. */
export interface Resultado {
  ok: boolean;
  diseno: Diseno;
  /** Motivo del rechazo (null si se hizo). */
  motivo: string | null;
  /** Cosas que pasaron solas y conviene contar al vendedor (equipo reubicado, módulo más angosto…). */
  avisos: string[];
  /** Id del módulo o equipo creado por la operación, si creó uno. */
  id?: string;
}

interface CtxOp extends Ctx {
  id?: string;
  /** Equipos de módulos quitados: dónde estaban, para reubicarlos cerca. */
  cerca: Map<string, { tramo: TramoBase; indice: number }>;
}

class Rechazo extends Error {}

function rechazar(motivo: string): never {
  throw new Rechazo(motivo);
}

function clonarLado(l: Lado | null | undefined): Lado | null {
  return l ? { ...l, cuerpos: l.cuerpos.map((c) => ({ ...c })) } : null;
}

function clonar(d: Diseno): Diseno {
  return {
    ...d,
    cuerpos: d.cuerpos.map((c) => ({ ...c })),
    materiales: { ...d.materiales },
    cocina: { ...d.cocina },
    tocador: { ...d.tocador },
    aereos: {
      ...d.aereos,
      cuerpos: d.aereos.cuerpos.map((c) => ({ ...c })),
      lados: { izq: clonarLado(d.aereos.lados?.izq), der: clonarLado(d.aereos.lados?.der) },
    },
    lados: { izq: clonarLado(d.lados?.izq), der: clonarLado(d.lados?.der) },
    equipos: (d.equipos ?? []).map((e) => ({ ...e })),
  };
}

/** Compara dos diseños sin recorrer la imagen impresa (puede pesar mucho). */
function iguales(a: Diseno, b: Diseno): boolean {
  if (a.imagenFrontal !== b.imagenFrontal) return false;
  const sinImagen = (k: string, v: unknown) => (k === 'imagenFrontal' ? null : v);
  return JSON.stringify(a, sinImagen) === JSON.stringify(b, sinImagen);
}

function intentar(d: Diseno, f: (out: Diseno, ctx: CtxOp) => void): Resultado {
  const out = clonar(d);
  const ctx: CtxOp = { avisos: [], cerca: new Map() };
  try {
    f(out, ctx);
    finalizar(out, ctx);
  } catch (e) {
    if (e instanceof Rechazo) return { ok: false, diseno: d, motivo: e.message, avisos: [] };
    throw e;
  }
  if (iguales(out, d)) return { ok: true, diseno: d, motivo: null, avisos: ctx.avisos, id: ctx.id };
  return { ok: true, diseno: out, motivo: null, avisos: ctx.avisos, id: ctx.id };
}

/** Módulo indicado por su índice en el tramo o por su id. */
export type RefModulo = number | string;

function tramoO(d: Diseno, t: Tramo): TramoId {
  const r = resolverTramo(d, t);
  if (r) return r;
  if (esTramoAereo(t as TramoId)) rechazar('Los aéreos no tienen ese lado: cambia la forma de los aéreos.');
  rechazar(d.plantilla === 'cocina' ? 'El mueble no tiene ese lado: cámbialo a forma L o U.' : 'Este mueble no tiene lados.');
}

function tramoBaseO(d: Diseno, t: Tramo): TramoBase {
  const r = tramoO(d, t);
  if (esTramoAereo(r)) rechazar('El equipamiento va en el mueble base (tramo principal o lados de la L/U).');
  return r as TramoBase;
}

function indiceO(d: Diseno, t: TramoId, ref: RefModulo): number {
  const cs = cuerposDe(d, t);
  const i = typeof ref === 'number' ? Math.round(ref) : cs.findIndex((c) => c.id === ref);
  if (i < 0 || i >= cs.length) rechazar('Ese módulo no existe.');
  return i;
}

function limitesDe(d: Diseno, t: TramoId, cs: Cuerpo[], sinTope = false): Limite[] {
  return cs.map((c) => {
    const l = limitesModulo(d, t, c);
    return sinTope && l.min !== l.max ? { min: l.min, max: Infinity } : l;
  });
}

function ajustables(d: Diseno, t: TramoId, cs: Cuerpo[], excluir: Cuerpo[] = [], conEquipados = false): boolean[] {
  return cs.map((c) => !excluir.includes(c) && (rolModulo(d, t, c) === 'ajustable' || (conEquipados && rolModulo(d, t, c) === 'equipado' && c.tipo !== 'hueco' && !c.campanaDe)));
}

/** Espacio que pueden ceder (signo −1) o tomar (+1) los módulos ajustables del tramo. */
function capacidad(d: Diseno, t: TramoId, signo: 1 | -1, excluir: Cuerpo[] = [], conEquipados = false, sinTope = false): number {
  const cs = cuerposDe(d, t);
  return holgura(
    cs.map((c) => c.ancho),
    limitesDe(d, t, cs, sinTope),
    ajustables(d, t, cs, excluir, conEquipados),
    signo,
  );
}

/**
 * Da (delta > 0) o quita (delta < 0) espacio a los módulos ajustables del tramo más
 * cercanos a la posición `centro`. Si no alcanza, rechaza con `motivo` sin tocar nada.
 */
function absorber(d: Diseno, t: TramoId, delta: number, centro: number, excluir: Cuerpo[], motivo: string, conEquipados = false, sinTope = false) {
  if (delta === 0) return;
  const cs = cuerposDe(d, t);
  const lims = limitesDe(d, t, cs, sinTope);
  const cand = ajustables(d, t, cs, excluir, conEquipados);
  const anchos = cs.map((c) => c.ancho);
  if (holgura(anchos, lims, cand, delta > 0 ? 1 : -1) < Math.abs(delta)) rechazar(motivo);
  absorberCercanos(anchos, lims, cand, delta, centro);
  cs.forEach((c, i) => (c.ancho = anchos[i]));
}

/**
 * Lleva la suma de los módulos del tramo a `objetivo` en proporción: primero los
 * ajustables y, si no alcanza, también los equipados (nunca los de medida fija).
 * Devuelve lo que faltó repartir.
 */
function ajustarTramo(d: Diseno, t: TramoId, objetivo: number, conEquipados = true): number {
  const cs = cuerposDe(d, t);
  const lims = limitesDe(d, t, cs);
  const niveles = cs.map((c) => {
    const r = rolModulo(d, t, c);
    return r === 'ajustable' ? 1 : r === 'equipado' && conEquipados ? 2 : 0;
  });
  const anchos = cs.map((c) => c.ancho);
  const resto = ajustarSuma(anchos, lims, niveles, objetivo);
  cs.forEach((c, i) => (c.ancho = anchos[i]));
  return resto;
}

/**
 * Anchos de los módulos `cs` del tramo con los ajustables repartidos parejo en `total`
 * (suma de los anchos, sin separaciones): los fijos (horno, especiero), los equipados
 * (encimera, lavaplatos, campana) y los de `conservar` mantienen su ancho; los ajustables
 * quedan iguales salvo los que topan su máximo (cajonera de 90 cm) o su mínimo. `minimos`
 * sube el mínimo de algún módulo. null si los ajustables no caben o no alcanzan a llenarlo.
 */
function anchosParejos(d: Diseno, t: TramoId, cs: Cuerpo[], total: number, conservar: Cuerpo[] = [], minimos = new Map<Cuerpo, number>(), hastaNivel: 1 | 2 | 3 = 3): number[] | null {
  // Primero solo las cajoneras (o abatibles); si no alcanza, también los módulos de puertas
  // (sus 35 cm por puerta son el estándar, no un tope) y, al final, los que llevan equipamiento.
  for (const nivel of ([1, 2, 3] as const).filter((n) => n <= hastaNivel)) {
    const r = anchosParejosNivel(d, t, cs, total, conservar, minimos, nivel);
    if (r) return r;
  }
  return null;
}

/**
 * Al ceder espacio en una cocina: en el nivel 2 una puerta no baja de 30 cm (estándar 35); en el
 * nivel 3 todos pueden llegar a su mínimo, para que siempre se pueda agregar un módulo.
 */
function minimoRazonable(d: Diseno, t: TramoId, c: Cuerpo, nivel: 2 | 3 = 2): Limite {
  const l = limitesModulo(d, t, c);
  if (!esCocinaAdulta(d) || nivel === 3) return l;
  const min = c.tipo === 'frentes' && c.puertas > 0 ? 300 * c.puertas : l.min;
  return { min: Math.max(l.min, Math.min(min, c.ancho || min)), max: l.max };
}

/** Si el módulo entra al reparto en ese nivel: 1 cajoneras/abatibles, 2 + puertas, 3 + equipados. */
function entraAlReparto(d: Diseno, t: TramoId, c: Cuerpo, nivel: 1 | 2 | 3): boolean {
  if (absorbe(d, t, c)) return true;
  return nivel >= 2 && rolModulo(d, t, c) === 'ajustable';
}

function anchosParejosNivel(d: Diseno, t: TramoId, cs: Cuerpo[], total: number, conservar: Cuerpo[], minimos: Map<Cuerpo, number>, nivel: 1 | 2 | 3): number[] | null {
  const idx = cs.map((_, i) => i).filter((i) => !conservar.includes(cs[i]) && entraAlReparto(d, t, cs[i], nivel));
  const espacio = total - sumar(cs.filter((_, i) => !idx.includes(i)).map((c) => c.ancho));
  if (!idx.length) return espacio === 0 ? cs.map((c) => c.ancho) : null;
  const lims = idx.map((i) => {
    const l = absorbe(d, t, cs[i]) && nivel < 3 ? limitesReparto(d, t, cs[i]) : nivel === 1 ? limitesReparto(d, t, cs[i]) : minimoRazonable(d, t, cs[i], nivel);
    return { min: Math.max(l.min, minimos.get(cs[i]) ?? 0), max: l.max };
  });
  const parejos = repartirParejo(espacio, lims);
  if (!parejos) return null;
  const out = cs.map((c) => c.ancho);
  idx.forEach((i, j) => (out[i] = parejos[j]));
  return out;
}

/** En cocinas, lo único que se ajusta al agregar o quitar módulos: cajoneras (base) y abatibles (aéreos), de 60 a 90 cm. */
const AJUSTE_COCINA = { min: 600, max: ANCHO_MAX_CAJONERA };

/**
 * Si el módulo cede o toma espacio al agregar o quitar otros. En las cocinas la medida del
 * cliente no cambia y las puertas (35 cm cada una), el nicho, la campana, el horno y el
 * especiero conservan su medida: solo se ajustan las cajoneras del mueble y los abatibles de
 * los aéreos. En los demás muebles se ajustan todos los módulos ajustables.
 */
export function absorbe(d: Diseno, t: TramoId, c: Cuerpo): boolean {
  if (rolModulo(d, t, c) !== 'ajustable') return false;
  if (!esCocinaAdulta(d) || (t === 'aereos' && d.plantilla === 'compacto')) return true;
  return esTramoAereo(t) ? c.tipo === 'frentes' && !!c.abatible : esCajonera(c);
}

/** Límites de un módulo al repartir: en cocinas, de 60 a 90 cm (o su medida actual si ya es menor). */
export function limitesReparto(d: Diseno, t: TramoId, c: Cuerpo): Limite {
  const l = limitesModulo(d, t, c);
  if (!esCocinaAdulta(d) || (t === 'aereos' && d.plantilla === 'compacto')) return l;
  return { min: Math.max(l.min, Math.min(AJUSTE_COCINA.min, c.ancho || AJUSTE_COCINA.min)), max: Math.min(l.max, AJUSTE_COCINA.max) };
}

/**
 * Qué recomendarle al cliente cuando un cambio no cabe en su medida: cuánto sobra o falta y qué
 * módulos agregar o quitar (cajones o puertas) para cuadrar.
 */
function recomendacion(d: Diseno, t: TramoId, cs: Cuerpo[], total: number): string {
  const ajustan = cs.filter((c) => entraAlReparto(d, t, c, 3));
  const fijos = sumar(cs.filter((c) => !ajustan.includes(c)).map((c) => c.ancho));
  const lims = ajustan.map((c) => minimoRazonable(d, t, c, 3));
  const resto = total - fijos;
  if (!esCocinaAdulta(d)) return 'Quita un módulo o achica alguno a mano.';
  const que = esTramoAereo(t) ? 'un abatible' : 'una cajonera';
  const puertas = `puertas (${cm(ANCHO_POR_PUERTA)} cada una)`;
  if (resto < sumar(lims.map((l) => l.min))) {
    const sobra = sumar(lims.map((l) => l.min)) - resto;
    return `Faltan ${cm(sobra)} para que quepa: quita ${puertas} o ${que}, o elige módulos más angostos.`;
  }
  const falta = resto - sumar(lims.map((l) => l.max));
  return `Quedarían ${cm(falta)} sin cubrir: agrega ${que} (de ${cm(AJUSTE_COCINA.min)} a ${cm(AJUSTE_COCINA.max)}) o ${puertas}.`;
}


/** «a, b y c» */
function listaY(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/** «el tramo principal», «el lado derecho», «los aéreos», «el mueble superior»… */
function enTramo(d: Diseno, t: TramoId): string {
  const n = nombreTramo(d, t).toLowerCase();
  return t === 'aereos' && d.plantilla !== 'compacto' ? `los ${n}` : `el ${n}`;
}

/** «del tramo principal», «de los aéreos»… */
function delTramo(d: Diseno, t: TramoId): string {
  const e = enTramo(d, t);
  return e.startsWith('el ') ? `del ${e.slice(3)}` : `de ${e}`;
}

/** Equipamiento que hace que un módulo conserve su ancho, en palabras. */
function equipoDeModulo(d: Diseno, t: TramoId, c: Cuerpo): string {
  if (esTramoAereo(t)) return 'la campana';
  const tipos = new Set(d.equipos.filter((e) => e.tramo === t && e.modulo === c.id).map((e) => e.tipo));
  return listaY([...(tipos.has('encimera') ? ['la encimera'] : []), ...(tipos.has('lavaplatos') ? ['el lavaplatos'] : [])]) || 'equipamiento';
}

/**
 * Por qué los módulos de un tramo no pueden ceder (signo −1) o tomar (+1) espacio: cuáles
 * son de medida fija, cuáles tienen equipamiento y cuánto pueden dar los demás.
 */
function razonesRigidez(d: Diseno, t: TramoId, signo: 1 | -1, excluir: Cuerpo[]): string {
  const partes: string[] = [];
  cuerposDe(d, t).forEach((c, i) => {
    if (excluir.includes(c)) return;
    const n = nombreModuloEn(d, t, i);
    const rol = rolModulo(d, t, c);
    if (rol === 'fijo') partes.push(`el ${n} es ${c.tipo === 'horno' ? 'el horno' : 'el especiero'} (${cm(c.ancho)} fijos)`);
    else if (rol === 'equipado') partes.push(c.tipo === 'hueco' ? `el ${n} es un espacio libre (${cm(c.ancho)})` : `el ${n} tiene ${equipoDeModulo(d, t, c)}`);
    else {
      const l = limitesModulo(d, t, c);
      const libre = signo < 0 ? c.ancho - l.min : l.max - c.ancho;
      if (libre <= 0) partes.push(signo < 0 ? `el ${n} ya está en su mínimo (${cm(l.min)})` : `el ${n} ya está en su máximo (${cm(l.max)}${esCajonera(c) ? ', es cajonera' : ''})`);
      else partes.push(`el ${n} puede ${signo < 0 ? 'ceder' : 'tomar'} solo ${cm(libre)}`);
    }
  });
  if (!partes.length) return 'no hay otros módulos';
  return partes.length > 6 ? `${partes.slice(0, 5).join(', ')} y ${partes.length - 5} módulos más que no alcanzan` : listaY(partes);
}

/** Suma de los mínimos de un tramo aéreo contando los módulos de campana como módulos comunes. */
function minimoSinCampanas(d: Diseno, t: TramoAereo): number {
  return sumar(cuerposDe(d, t).map((c) => (alojaCampana(c) ? ANCHO_MIN_CUERPO : limitesModulo(d, t, c).min)));
}

/** Datos del lado (base o aéreo) de un tramo lateral, para cambiar su largo. */
function ladoMutable(d: Diseno, t: TramoId): Lado | null {
  const lado = ladoDeTramo(t);
  if (!lado) return null;
  return (esTramoAereo(t) ? d.aereos.lados[lado] : d.lados[lado]) ?? null;
}

// ---------- Tipos de módulo y presets ----------

const NOMBRE_TIPO: Record<Cuerpo['tipo'], string> = {
  frentes: 'Módulo de puertas o cajones',
  horno: 'Horno empotrado',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
  campana: 'Campana',
  nicho: 'Nicho microondas',
  especiero: 'Especiero',
  'espacio-campana': 'Espacio campana',
  refrigerador: 'Sobre refrigerador',
};

/** Tipos de módulo que acepta un tramo. */
export function tiposPermitidos(d: Diseno, tramo: Tramo): Cuerpo['tipo'][] {
  const t = resolverTramo(d, tramo) ?? 'base';
  const p = d.plantilla;
  if (esTramoAereo(t)) return p === 'compacto' ? ['frentes', 'nicho', 'campana', 'espacio-campana'] : ['frentes', 'campana', 'espacio-campana', 'nicho', 'refrigerador', 'hueco'];
  if (t !== 'base') return ['frentes', 'horno', 'hueco', 'especiero'];
  if (p === 'cocina') return ['frentes', 'horno', 'hueco', 'especiero'];
  if (p === 'compacto') return ['frentes', 'horno', 'especiero'];
  if (p === 'cocina-infantil') return ['frentes', 'horno'];
  if (p === 'escritorio') return ['frentes', 'escritorio'];
  return ['frentes'];
}

/** Nombre corto de un módulo según lo que tiene (para la tira y el visor). */
export function nombreModulo(c: Cuerpo): string {
  if (c.tipo === 'especiero') return `Especiero ${c.pisos ?? 2} pisos`;
  if (c.tipo !== 'frentes') return NOMBRE_CORTO[c.tipo];
  if (c.abatible) return 'Abatible';
  const puertas = c.puertas > 0 ? `${c.puertas} ${c.puertas === 1 ? 'puerta' : 'puertas'}` : '';
  const cajones = c.cajones > 0 ? `${c.cajones} ${c.cajones === 1 ? 'cajón' : 'cajones'}` : '';
  if (puertas && cajones) return c.cajonesArriba ? `${cajones} + ${puertas}` : `${puertas} + ${cajones}`;
  return puertas || cajones || 'Abierto';
}

const NOMBRE_CORTO: Record<Exclude<Cuerpo['tipo'], 'frentes' | 'especiero'>, string> = {
  horno: 'Horno',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
  campana: 'Campana',
  nicho: 'Nicho microondas',
  'espacio-campana': 'Espacio campana',
  refrigerador: 'Sobre refrigerador',
};

/** Módulo listo para agregar desde el panel «Módulos y espacios». */
export interface PresetModulo {
  id: string;
  texto: string;
  ayuda: string;
  tipo: Cuerpo['tipo'];
  ancho: number;
  /** Ancho bajo el cual no sirve (horno empotrado, especiero); por defecto el mínimo de fabricación. */
  anchoMinimo?: number;
  cambios: Partial<Cuerpo>;
}

const P = {
  puerta: (ancho = ANCHO_POR_PUERTA): PresetModulo => ({ id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } }),
  dosPuertas: (ancho = 2 * ANCHO_POR_PUERTA): PresetModulo => ({ id: 'dos-puertas', texto: 'Módulo 2 puertas', ayuda: 'Dos puertas con repisa interior', tipo: 'frentes', ancho, cambios: { puertas: 2, repisas: 1 } }),
  cajonera: (ancho = 450): PresetModulo => ({ id: 'cajonera', texto: 'Cajonera', ayuda: '3 cajones (máximo 90 cm de ancho)', tipo: 'frentes', ancho, cambios: { cajones: 3 } }),
  cajonPuerta: (ancho = ANCHO_POR_PUERTA): PresetModulo => ({ id: 'cajon-puerta', texto: 'Cajón y puerta', ayuda: '1 cajón arriba y 1 puerta abajo', tipo: 'frentes', ancho, cambios: { cajones: 1, puertas: 1, bisagra: 'der', cajonesArriba: true, repisas: 1 } }),
  especiero: (): PresetModulo => ({ id: 'especiero', texto: 'Especiero', ayuda: 'Cajón extraíble de 20 cm de alto completo, con 2 pisos', tipo: 'especiero', ancho: 200, anchoMinimo: 200, cambios: { pisos: 2 } }),
  horno: (): PresetModulo => ({ id: 'horno', texto: 'Horno empotrado', ayuda: 'Módulo de 60 cm para horno', tipo: 'horno', ancho: 600, anchoMinimo: 600, cambios: {} }),
  hueco: (): PresetModulo => ({ id: 'hueco', texto: 'Espacio libre', ayuda: 'Espacio sin mueble, de 20 a 50 cm', tipo: 'hueco', ancho: 500, cambios: {} }),
};

/** Módulos y espacios que se pueden agregar según el tipo de mueble y el tramo. */
export function presetsModulo(p: Plantilla, tramo: Tramo = 'base'): PresetModulo[] {
  if (tramo === 'aereos' || tramo === 'aereos-izq' || tramo === 'aereos-der') {
    const aereos: PresetModulo[] = [
      { id: 'aereo-puerta', texto: 'Aéreo 1 puerta', ayuda: 'Una puerta con repisa', tipo: 'frentes', ancho: ANCHO_POR_PUERTA, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
      { id: 'aereo-dos', texto: 'Aéreo 2 puertas', ayuda: 'Dos puertas con repisa', tipo: 'frentes', ancho: 2 * ANCHO_POR_PUERTA, cambios: { puertas: 2, repisas: 1 } },
      { id: 'abatible', texto: 'Abatible', ayuda: 'Puerta que se abre hacia arriba', tipo: 'frentes', ancho: 600, cambios: { puertas: 1, abatible: true, repisas: 0 } },
      { id: 'nicho', texto: 'Nicho microondas', ayuda: 'Abatible arriba y nicho abierto con repisa', tipo: 'nicho', ancho: 600, cambios: { puertas: 1, abatible: true, repisas: 0 } },
      { id: 'espacio-campana', texto: 'Espacio campana', ayuda: 'Hueco abierto de 60 cm para instalar la campana', tipo: 'espacio-campana', ancho: 600, cambios: { puertas: 0, repisas: 0 } },
      {
        id: 'sobre-refrigerador',
        texto: 'Sobre refrigerador',
        ayuda: 'Cajón arriba del refrigerador; abajo queda su espacio hasta el piso',
        tipo: 'refrigerador',
        ancho: ANCHO_SOBRE_REFRIGERADOR,
        cambios: { puertas: 0, cajones: 1, repisas: 0 },
      },
    ];
    if (p === 'compacto') return aereos;
    return [...aereos, { id: 'hueco', texto: 'Espacio libre', ayuda: 'Sin mueble, de 20 a 50 cm', tipo: 'hueco', ancho: 500, cambios: {} }];
  }
  if (tramo !== 'base') return [P.puerta(), P.dosPuertas(), P.cajonera(), P.cajonPuerta(), P.especiero(), P.horno(), P.hueco()];
  switch (p) {
    case 'cocina':
      return [P.puerta(), P.dosPuertas(), P.cajonera(), P.cajonPuerta(), P.especiero(), P.horno(), P.hueco()];
    case 'compacto':
      return [P.puerta(), P.dosPuertas(), P.cajonera(), P.cajonPuerta(), P.especiero(), P.horno()];
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

/** Ancho con que se agrega un módulo si no se indica: 35 cm por puerta en la cocina, 60 cm el horno… */
function anchoPorDefecto(d: Diseno, c: Cuerpo): number {
  const fijo = anchoFijo(d.plantilla, c);
  if (fijo != null) return fijo;
  if (c.tipo === 'hueco') return ANCHO_MAX_HUECO;
  if (c.tipo === 'campana' || c.tipo === 'nicho' || c.abatible) return 600;
  if (c.tipo === 'frentes' && esCocinaAdulta(d) && c.puertas > 0) return ANCHO_POR_PUERTA * c.puertas;
  return d.plantilla === 'cocina-infantil' ? 300 : 450;
}

/** Ajusta los valores de un módulo a lo que su tipo admite. */
function sanear(c: Cuerpo, t: TramoId) {
  const n = (v: unknown, a: number, b: number, defecto: number) => Math.max(a, Math.min(b, Math.round(Number.isFinite(v as number) ? (v as number) : defecto)));
  c.puertas = n(c.puertas, 0, 4, 0);
  c.cajones = n(c.cajones, 0, 12, 0);
  c.repisas = n(c.repisas, 0, 8, 1);
  c.altoCajon = n(c.altoCajon, 0, 2000, 0);
  c.alto = n(c.alto, 0, 3000, 0);
  c.columnasCajones = c.columnasCajones === 2 ? 2 : 1;
  c.bisagra = c.bisagra === 'der' ? 'der' : 'izq';
  c.colgador = !!c.colgador;
  if (c.tipo === 'campana') {
    c.cajones = 0;
    c.puertas = Math.max(1, c.puertas);
  } else if (c.tipo === 'nicho') {
    c.cajones = 0;
    c.puertas = 1;
    c.abatible = true;
  } else if (c.tipo === 'espacio-campana') {
    // Hueco abierto para la campana: sin puertas ni repisas.
    c.puertas = 0;
    c.cajones = 0;
    c.repisas = 0;
    c.abatible = false;
  } else if (c.tipo === 'refrigerador') {
    // Un solo frente: cajón (por defecto) o puerta abatible.
    c.abatible = !!c.abatible;
    c.puertas = c.abatible ? 1 : 0;
    c.cajones = c.abatible ? 0 : 1;
    c.repisas = 0;
  } else if (c.tipo === 'especiero') {
    c.puertas = 0;
    c.cajones = 0;
    c.abatible = false;
    c.pisos = n(c.pisos, 2, 3, 2);
  } else if (c.tipo !== 'frentes') {
    c.puertas = 0;
    c.cajones = 0;
  }
  if (c.tipo !== 'especiero') delete c.pisos;
  if (!esModuloCampana(c)) delete c.campanaDe;
  if (esTramoAereo(t) && c.tipo !== 'refrigerador') c.cajones = 0;
}

/** En la cocina infantil el primer módulo es la despensa alta: nada se pone delante de ella. */
export function posicionMinima(d: Diseno, tramo: Tramo = 'base'): number {
  return resolverTramo(d, tramo) === 'base' && d.plantilla === 'cocina-infantil' && d.cuerpos.length > 0 ? 1 : 0;
}

/** Largo máximo de los módulos del tramo (el ancho máximo del mueble en el principal). */
export function maximoTramo(d: Diseno, tramo: Tramo): number {
  const t = resolverTramo(d, tramo) ?? 'base';
  if (t === 'izq' || t === 'der') return LIMITES_LADO.largo[1] - d.profundidad;
  if (t === 'aereos-izq' || t === 'aereos-der') return LIMITES_AEREOS.ladoLargo[1] - d.aereos.profundidad;
  if (t === 'aereos') {
    if (d.plantilla === 'compacto') return d.ancho;
    const [x0, x1] = extremosPrincipal(d);
    return hayMuros(d) ? Math.min(LIMITES_AEREOS.ancho[1], Math.round(x1 - x0)) : LIMITES_AEREOS.ancho[1];
  }
  return LIMITES[d.plantilla].ancho[1];
}

/** Hay un muro lateral (una L o U en el base o en los aéreos): los aéreos no pueden pasarlo. */
function hayMuros(d: Diseno): boolean {
  return !!(d.lados?.izq || d.lados?.der || d.aereos.lados?.izq || d.aereos.lados?.der);
}

/**
 * Ancho que tendría un módulo nuevo agregado al tramo sin cambiar su largo: su medida fija
 * (horno, especiero) o su parte del reparto parejo con los ajustables. null si no cabe.
 * `deseado` solo cuenta en un tramo vacío (como tope); con módulos, el nuevo se reparte parejo.
 */
export function anchoDisponible(d: Diseno, tipo: Cuerpo['tipo'], deseado: number, anchoMinimo?: number, tramo: Tramo = 'base'): number | null {
  const t = resolverTramo(d, tramo);
  if (!t) return null;
  const cs = cuerposDe(d, t);
  const fijo = anchoFijo(d.plantilla, { tipo });
  const minimo = fijo ?? Math.max(tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO, anchoMinimo ?? 0);
  if (!cs.length) {
    const libre = largoObjetivo(d, t);
    return libre < minimo ? null : (fijo ?? Math.min(deseado, libre));
  }
  const nuevo = nuevoCuerpo({ tipo, ancho: fijo ?? 0 });
  const total = largoTramo(d, t) - sepDe(d, t) * cs.length;
  if (fijo == null && esCocinaAdulta(d) && !absorbe(d, t, nuevo)) {
    // En las cocinas el nuevo conserva su medida (como en opAgregar) y ceden las cajoneras.
    nuevo.ancho = Math.max(minimo, deseado);
    return anchosParejos(d, t, [...cs, nuevo], total, [nuevo]) ? nuevo.ancho : null;
  }
  const anchos = anchosParejos(d, t, [...cs, nuevo], total, [], new Map([[nuevo, minimo]]));
  return anchos ? anchos[cs.length] : null;
}

// ---------- Reparaciones y pasos finales de cada operación ----------

/** Compacto: suma de los mínimos del mueble superior (el base no puede quedar más angosto). */
function minimoSuperior(d: Diseno): number {
  return d.plantilla === 'compacto' ? sumar(d.aereos.cuerpos.map((c) => limitesModulo(d, 'aereos', c).min)) : 0;
}

/**
 * Medidas fijas y mínimos de un tramo. Los máximos (cajonera de 90 cm, espacio libre de 50 cm) solo
 * guían los ajustes automáticos: lo que el vendedor deja a mano no se corta ni se divide.
 */
function repararAnchos(d: Diseno, t: TramoId, _ctx: Ctx) {
  const cs = cuerposDe(d, t);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    c.ancho = Math.round(Number.isFinite(c.ancho) ? c.ancho : ANCHO_MIN_CUERPO);
    const l = limitesModulo(d, t, c);
    if (l.min === l.max) c.ancho = l.min;
    else if (c.ancho < l.min) c.ancho = l.min;
  }
}

function repararTramosBase(d: Diseno, ctx: Ctx) {
  repararAnchos(d, 'base', ctx);
  if (d.cuerpos.length) {
    const sep = d.separacionCuerpos * (d.cuerpos.length - 1);
    if (largoTramo(d, 'base') !== d.ancho && ajustarTramo(d, 'base', d.ancho - sep) !== 0) d.ancho = largoTramo(d, 'base');
  }
  for (const lado of LADOS) {
    const r = d.lados[lado];
    if (!r) continue;
    if (!r.cuerpos.length) r.cuerpos.push(nuevoCuerpo({ ancho: Math.max(ANCHO_MIN_CUERPO, r.largo - d.profundidad), puertas: 1, bisagra: 'der', repisas: 1 }));
    repararAnchos(d, lado, ctx);
    const objetivo = r.largo - d.profundidad;
    if (largoTramo(d, lado) !== objetivo && ajustarTramo(d, lado, objetivo) !== 0) r.largo = d.profundidad + largoTramo(d, lado);
  }
}

/** Lado nuevo de una L/U del base: 120 cm de largo exterior con módulos de puertas. */
export function ladoPorDefecto(d: Diseno, _lado: LadoId): Lado {
  const largo = Math.max(1200, d.profundidad + 400);
  const util = largo - d.profundidad;
  const cuerpos =
    util > 900
      ? repartir(util, [1, 1]).map((ancho) => nuevoCuerpo({ ancho, puertas: 1, bisagra: 'der', repisas: 1 }))
      : [nuevoCuerpo({ ancho: util, puertas: util >= 550 ? 2 : 1, bisagra: 'der', repisas: 1 })];
  return { largo, profundidad: d.profundidad, cuerpos };
}

/** Nombre heredado: tramo en L sugerido con su costado. */
export function retornoPorDefecto(d: Diseno, lado: LadoId): Retorno {
  return { ...ladoPorDefecto(d, lado), lado };
}

function modulosAereos(largo: number): Cuerpo[] {
  const n = Math.max(1, Math.round(largo / 750));
  return repartir(largo, Array(n).fill(1)).map((ancho) => nuevoCuerpo({ ancho, puertas: ancho >= 550 ? 2 : 1, bisagra: 'der', repisas: 1 }));
}

/** Lado nuevo del aéreo: del mismo largo que el lado del base (si lo hay). */
function ladoAereoPorDefecto(d: Diseno, lado: LadoId): Lado {
  const a = d.aereos;
  const largo = limitar(d.lados[lado]?.largo ?? Math.max(1200, a.profundidad + 600), [a.profundidad + ANCHO_MIN_CUERPO, LIMITES_AEREOS.ladoLargo[1]]);
  return { largo, profundidad: a.profundidad, cuerpos: modulosAereos(largo - a.profundidad) };
}

/** Aéreos apagados por defecto (o el mueble superior del compacto). */
export function aereosVacios(plantilla: Plantilla): Aereos {
  return plantilla === 'compacto'
    ? { activo: true, montaje: 'apoyado', alto: 580, profundidad: 300, elevacion: 880, alineacion: 'centro', cuerpos: [], lados: { izq: null, der: null }, cuadrado: false }
    : { activo: false, montaje: 'mural', alto: 600, profundidad: 300, elevacion: 1450, alineacion: 'centro', cuerpos: [], lados: { izq: null, der: null }, cuadrado: plantilla === 'cocina' };
}

/** Aéreos sugeridos: cuadrados con el base (mismo largo de muro a muro; los lados los agrega la sincronización). */
export function aereosPorDefecto(d: Diseno): Aereos {
  const [sx0, sx1] = extremosPrincipal(d);
  const largo = Math.min(LIMITES_AEREOS.ancho[1], Math.round(sx1 - sx0));
  return { ...aereosVacios(d.plantilla), activo: true, alineacion: 'izq', cuerpos: modulosAereos(largo), cuadrado: true };
}

/**
 * Aéreos coherentes con el base: cuadrados (misma forma y largos) si corresponde,
 * dentro de los muros, lados con su largo útil lleno y el superior del compacto del
 * ancho del base.
 */
function sincronizarAereos(d: Diseno, ctx: Ctx) {
  const a = d.aereos;
  a.lados = a.lados ?? { izq: null, der: null };
  if (d.plantilla === 'compacto') {
    Object.assign(a, { activo: true, montaje: 'apoyado', lados: { izq: null, der: null }, cuadrado: false });
    repararAnchos(d, 'aereos', ctx);
    if (a.cuerpos.length && largoTramo(d, 'aereos') !== d.ancho) {
      ajustarTramo(d, 'aereos', d.ancho);
      recortarAereos(d, 'aereos', d.ancho, ctx);
    }
    return;
  }
  if (d.plantilla !== 'cocina') {
    a.lados = { izq: null, der: null };
    return;
  }
  a.montaje = 'mural';
  if (a.activo && !a.cuerpos.length) Object.assign(a, aereosPorDefecto(d), { activo: true });
  if (a.activo && a.cuadrado) {
    for (const lado of LADOS) {
      const base = d.lados[lado];
      if (base && !a.lados[lado]) a.lados[lado] = ladoAereoPorDefecto(d, lado);
      else if (!base && a.lados[lado]) a.lados[lado] = null;
      else if (base && a.lados[lado]) a.lados[lado]!.largo = base.largo;
    }
  }
  for (const lado of LADOS) {
    const r = a.lados[lado];
    if (!r) continue;
    const t: TramoAereo = lado === 'izq' ? 'aereos-izq' : 'aereos-der';
    if (!r.cuerpos.length) r.cuerpos = modulosAereos(Math.max(ANCHO_MIN_CUERPO, r.largo - a.profundidad));
    r.profundidad = limitar(Math.round(r.profundidad), LIMITES_AEREOS.profundidad);
    repararAnchos(d, t, ctx);
    const minimo = sumar(r.cuerpos.map((c) => limitesModulo(d, t, c).min));
    const base = d.lados[lado];
    if (a.activo && a.cuadrado && base) {
      // Cuadrado: el lado del aéreo mide lo mismo que el del base; si sus módulos no caben, sobra alguno.
      r.largo = Math.max(base.largo, a.profundidad + ANCHO_MIN_CUERPO);
      if (minimo > r.largo - a.profundidad) recortarAereos(d, t, r.largo - a.profundidad, ctx);
    } else {
      r.largo = limitar(Math.round(r.largo), [Math.max(LIMITES_AEREOS.ladoLargo[0], a.profundidad + minimo), Math.max(LIMITES_AEREOS.ladoLargo[1], a.profundidad + minimo)]);
    }
    const objetivo = r.largo - a.profundidad;
    if (largoTramo(d, t) !== objetivo && ajustarTramo(d, t, objetivo) !== 0) r.largo = a.profundidad + largoTramo(d, t);
  }
  if (!a.cuerpos.length) return;
  // El largo del aéreo principal es la suma de sus módulos: se toma antes de corregir sus anchos.
  const actual = largoTramo(d, 'aereos');
  repararAnchos(d, 'aereos', ctx);
  const [x0, x1] = extremosPrincipal(d);
  const deMuroAMuro = Math.round(x1 - x0);
  let objetivo = actual;
  if ((a.activo && a.cuadrado) || (a.lados.izq && a.lados.der)) objetivo = deMuroAMuro;
  objetivo = Math.min(objetivo, hayMuros(d) ? deMuroAMuro : LIMITES_AEREOS.ancho[1]);
  if (a.lados.izq) a.alineacion = 'izq';
  else if (a.lados.der) a.alineacion = 'der';
  if (largoTramo(d, 'aereos') !== objetivo) {
    ajustarTramo(d, 'aereos', objetivo);
    recortarAereos(d, 'aereos', objetivo, ctx);
  }
}

/** Si un tramo aéreo no puede llegar a su largo (módulos en su mínimo) se quitan los que sobran. */
function recortarAereos(d: Diseno, t: TramoAereo, objetivo: number, ctx: Ctx) {
  const cs = cuerposDe(d, t);
  const minimo = () => sumar(cs.map((c) => limitesModulo(d, t, c).min));
  ajustarTramo(d, t, objetivo);
  while (cs.length > 1 && (largoTramo(d, t) > objetivo || minimo() > objetivo)) {
    const libres = cs.filter((c) => rolModulo(d, t, c) === 'ajustable');
    const quitar = (libres.length ? libres : cs).reduce((m, c) => (limitesModulo(d, t, c).min < limitesModulo(d, t, m).min ? c : m));
    cs.splice(cs.indexOf(quitar), 1);
    ctx.avisos.push(`Se quitó un ${t === 'aereos' && d.plantilla === 'compacto' ? 'módulo del mueble superior' : 'aéreo'}: no cabía en el largo.`);
    ajustarTramo(d, t, objetivo);
  }
  // Si después de quitar no se llega justo al largo, lo completa el último módulo ajustable.
  const falta = objetivo - largoTramo(d, t);
  if (falta !== 0 && cs.length) {
    const ajustables = cs.filter((c) => rolModulo(d, t, c) === 'ajustable');
    const c = ajustables.length ? ajustables[ajustables.length - 1] : cs[cs.length - 1];
    c.ancho = Math.max(1, c.ancho + falta);
  }
}

/** En L o U no queda un lado libre para el refrigerador: su mueble aéreo se quita (el aéreo se acorta). */
function quitarRefrigeradorSinLugar(d: Diseno, ctx: CtxOp) {
  const a = d.aereos;
  if (!a.cuerpos.some((c) => c.tipo === 'refrigerador')) return;
  const conLados = !!(d.lados?.izq || d.lados?.der || a.lados?.izq || a.lados?.der) || d.plantilla !== 'cocina';
  if (!conLados) return;
  const resto = a.cuerpos.filter((c) => c.tipo !== 'refrigerador');
  if (!resto.length) {
    // Era el único aéreo: queda como un abatible del mismo ancho.
    Object.assign(a.cuerpos[0], { tipo: 'frentes', puertas: 1, cajones: 0, abatible: true, alto: 0 });
    a.cuerpos = [a.cuerpos[0]];
  } else a.cuerpos = resto;
  ctx.avisos.push('Se quitó el mueble sobre el refrigerador: en L o U no queda espacio para el refrigerador.');
}

/**
 * Pasos que cierran toda operación: anchos, equipamiento, aéreos y campanas. Si dos
 * campanas no pueden quedar cada una sobre su encimera, la operación se rechaza (o, al
 * abrir un diseño guardado, la campana que sobra se quita y se avisa).
 */
function finalizar(d: Diseno, ctx: CtxOp, reparar = false) {
  if (d.plantilla !== 'cocina') d.lados = { izq: null, der: null };
  repararTramosBase(d, ctx);
  repararEquipos(d, ctx, ctx.cerca);
  quitarRefrigeradorSinLugar(d, ctx);
  sincronizarAereos(d, ctx);
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const conflictos = alinearCampanas(d, ctx);
    if (!conflictos.length) return;
    if (!reparar) rechazar('Las campanas no caben: quedarían topándose sobre encimeras muy juntas. Separa las encimeras (cada campana necesita 60 cm sobre la suya) o quita una campana.');
    for (const e of d.equipos) {
      if (e.tipo === 'encimera' && conflictos.includes(e.id)) e.campana = false;
    }
    ctx.avisos.push('Se quitó una campana que no cabía junto a otra sobre su encimera.');
  }
}

// ---------- Medidas generales ----------

function opFijarAncho(out: Diseno, ctx: Ctx, ancho: number) {
  const p = out.plantilla;
  const pedido = Math.round(ancho);
  const cs = out.cuerpos;
  const n = cs.length;
  let objetivo = limitar(pedido, LIMITES[p].ancho);
  if (!n) {
    out.ancho = objetivo;
    return;
  }
  const sep = out.separacionCuerpos * (n - 1);
  const lims = limitesDe(out, 'base', cs);
  const min = Math.max(sumar(lims.map((l) => l.min)) + sep, minimoSuperior(out));
  const max = sumar(lims.map((l) => l.max)) + sep;
  const limitado = Math.max(min, Math.min(max, objetivo));
  if (limitado !== objetivo || objetivo !== pedido) {
    const motivo =
      limitado < pedido
        ? limitado === max && max < LIMITES[p].ancho[1]
          ? 'las cajoneras miden hasta 90 cm y los demás módulos son de medida fija'
          : `es el ancho máximo de este mueble`
        : limitado === min && min > LIMITES[p].ancho[0]
          ? 'los módulos ya están en su mínimo'
          : 'es el ancho mínimo de este mueble';
    ctx.avisos.push(`El ancho quedó en ${cm(limitado)}: ${motivo}.`);
  }
  objetivo = limitado;
  ajustarTramo(out, 'base', objetivo - sep);
  out.ancho = largoTramo(out, 'base');
}

function opFijarAlto(out: Diseno, alto: number) {
  out.alto = limitar(Math.round(alto), LIMITES[out.plantilla].alto);
  if (out.plantilla === 'tocador') out.tocador.altoCubierta = Math.min(out.tocador.altoCubierta, out.alto - 400);
  if (out.plantilla === 'compacto') {
    // Entre la cubierta y el mueble superior quedan al menos 30 cm libres.
    out.aereos.elevacion = Math.min(out.aereos.elevacion, out.alto - 300 - LIMITES_AEREOS.alto[0]);
    out.aereos.alto = limitar(out.aereos.alto, [LIMITES_AEREOS.alto[0], out.alto - out.aereos.elevacion - 300]);
  }
  out.cuerpos.forEach((c) => {
    if (c.alto > out.alto) c.alto = out.alto;
  });
}

function opFijarProfundidad(out: Diseno, ctx: Ctx, profundidad: number) {
  out.profundidad = limitar(Math.round(profundidad), LIMITES[out.plantilla].profundidad);
  if (out.plantilla === 'compacto') out.aereos.profundidad = Math.min(out.aereos.profundidad, out.profundidad);
  // Cada lado de la L/U conserva su largo exterior: su largo útil cambia y se reparten sus módulos.
  for (const lado of LADOS) {
    const r = out.lados[lado];
    if (!r) continue;
    const minimo = sumar(limitesDe(out, lado, r.cuerpos).map((l) => l.min));
    const largoMin = Math.max(LIMITES_LADO.largo[0], out.profundidad + minimo);
    if (r.largo < largoMin) {
      r.largo = largoMin;
      ctx.avisos.push(`El lado ${lado === 'izq' ? 'izquierdo' : 'derecho'} se alargó a ${cm(largoMin)} para que quepan sus módulos.`);
    }
    if (ajustarTramo(out, lado, r.largo - out.profundidad) !== 0) r.largo = out.profundidad + largoTramo(out, lado);
  }
}

function opFijarSeparacion(out: Diseno, ctx: Ctx, separacion: number) {
  const pedida = Math.max(0, Math.min(200, Math.round(separacion)));
  const n = out.cuerpos.length;
  if (n <= 1) {
    out.separacionCuerpos = pedida;
    return;
  }
  const minimo = sumar(limitesDe(out, 'base', out.cuerpos).map((l) => l.min));
  const maxSep = Math.max(0, Math.floor((out.ancho - minimo) / (n - 1)));
  const sep = Math.min(pedida, maxSep);
  if (sep < pedida) ctx.avisos.push(`La separación quedó en ${cm(sep)}: los módulos ya están en su mínimo.`);
  out.separacionCuerpos = sep;
  if (ajustarTramo(out, 'base', out.ancho - sep * (n - 1)) !== 0) rechazar('No se puede cambiar la separación: los módulos no pueden crecer más (cajoneras de 90 cm o medidas fijas). Cambia el ancho del mueble.');
}

// ---------- Módulos ----------

interface OpcionesAgregar {
  cambios?: Partial<Cuerpo>;
  /** Ancho pedido para el módulo nuevo: lo conserva y los demás ajustables se reparten parejo el resto. */
  ancho?: number;
  /** Ancho del preset: solo se usa en un tramo vacío o con `ajustarLargo` (si no, se reparte parejo). */
  anchoSugerido?: number;
  anchoMinimo?: number;
  tramo?: Tramo;
  /**
   * Solo para uso programático (no se ofrece en la interfaz ni al asistente): agranda el mueble
   * con el módulo nuevo en vez de repartir el largo actual.
   */
  ajustarLargo?: boolean;
  /** Texto para los avisos. */
  texto?: string;
}

/** Hace crecer (o achicar) la medida de un tramo cuando se agrega o quita con ajustarLargo. */
function cambiarLargo(out: Diseno, t: TramoId, delta: number) {
  if (t === 'base') out.ancho += delta;
  else if (t === 'aereos') {
    if (out.aereos.cuadrado) out.aereos.cuadrado = false;
  } else {
    ladoMutable(out, t)!.largo += delta;
    if (esTramoAereo(t)) out.aereos.cuadrado = false;
  }
}

function opAgregar(out: Diseno, ctx: CtxOp, tramo: Tramo, tipo: Cuerpo['tipo'], posicion: number | undefined, o: OpcionesAgregar) {
  const t = tramoO(out, tramo);
  if (!tiposPermitidos(out, t).includes(tipo)) rechazar(`${NOMBRE_TIPO[tipo]} no va en ${enTramo(out, t)}.`);
  if (esTramoAereo(t) && tipo === 'campana') {
    // La campana es equipamiento: se pone sola sobre la encimera de ese lado.
    opAgregarEquipo(out, ctx, 'campana', { tramo: tramoBaseDe(t) });
    return;
  }
  const cs = cuerposDe(out, t);
  const n = cs.length;
  const base: Partial<Cuerpo> = o.cambios ?? {
    puertas: tipo === 'frentes' ? (out.plantilla === 'comoda' ? 0 : 1) : 0,
    cajones: tipo === 'frentes' && out.plantilla === 'comoda' ? 4 : 0,
    bisagra: 'der',
    colgador: out.plantilla === 'closet' && tipo === 'frentes',
  };
  const nuevo = nuevoCuerpo({ ...base, tipo, ancho: 0, ...(tipo === 'frentes' || tipo === 'campana' || tipo === 'nicho' || tipo === 'refrigerador' ? {} : { puertas: 0, cajones: 0 }) });
  delete nuevo.campanaDe;
  sanear(nuevo, t);
  const lim = limitesModulo(out, t, nuevo);
  const fijo = lim.min === lim.max ? lim.min : null;
  const deseado = Math.min(lim.max, fijo ?? Math.round(o.ancho ?? o.anchoSugerido ?? anchoPorDefecto(out, nuevo)));
  const minimo = fijo ?? Math.max(lim.min, o.anchoMinimo ?? 0);
  const sep = t === 'base' && n > 0 ? out.separacionCuerpos : 0;
  const i = Math.max(posicionMinima(out, t), Math.min(n, Math.round(posicion ?? n)));
  const texto = o.texto ?? nombreModulo(nuevo);
  const fijoTramo = t === 'aereos' && out.plantilla === 'compacto';
  if (tipo === 'refrigerador' && t !== 'aereos') rechazar('El mueble sobre el refrigerador va en el aéreo principal.');
  if (tipo === 'refrigerador' && t === 'aereos') {
    if (out.aereos.lados?.izq || out.aereos.lados?.der || out.lados?.izq || out.lados?.der)
      rechazar('El mueble sobre el refrigerador va en una cocina lineal, al lado libre del mueble: en L o U no queda espacio para el refrigerador.');
    // Va arriba del refrigerador, al lado del mueble base: el aéreo crece y los demás no cambian.
    nuevo.ancho = deseado;
    cs.splice(i, 0, nuevo);
    cambiarLargo(out, t, nuevo.ancho);
    if (!out.aereos.lados?.izq && !out.aereos.lados?.der) out.aereos.alineacion = i === 0 && n > 0 ? 'der' : 'izq';
  } else if (o.ajustarLargo && !fijoTramo) {
    const libre = maximoTramo(out, t) - largoTramo(out, t) - sep;
    if (libre < minimo) rechazar(`No cabe «${texto}»${fijo ? ` de ${cm(fijo)}` : ''}: ${t === 'base' ? `el ancho máximo es ${cm(maximoTramo(out, t))}` : `se alcanzó el largo máximo ${delTramo(out, t)}`}.`);
    nuevo.ancho = Math.min(deseado, libre);
    cs.splice(i, 0, nuevo);
    cambiarLargo(out, t, nuevo.ancho + sep);
  } else if (!n) {
    nuevo.ancho = Math.max(minimo, largoObjetivo(out, t));
    cs.splice(0, 0, nuevo);
  } else {
    // La medida del cliente no cambia: el nuevo conserva su medida (puertas de 35 cm, nicho,
    // horno…) y lo absorben las cajoneras (o los abatibles en los aéreos), parejas de 60 a 90 cm.
    const largo = largoTramo(out, t);
    const total = largo - sep * n;
    const minimos = new Map([[nuevo, minimo]]);
    nuevo.ancho = fijo ?? 0;
    cs.splice(i, 0, nuevo);
    let anchos: number[] | null = null;
    if (fijo == null && (o.ancho != null || !absorbe(out, t, nuevo))) {
      if (esCocinaAdulta(out)) nuevo.ancho = deseado;
      else {
        const resto = cs.filter((c) => c !== nuevo && absorbe(out, t, c));
        const libre = total - sumar(cs.filter((c) => c !== nuevo && !resto.includes(c)).map((c) => c.ancho)) - sumar(resto.map((c) => limitesReparto(out, t, c).min));
        nuevo.ancho = Math.max(minimo, Math.min(deseado, libre));
      }
      // El nuevo conserva su medida mientras basten cajoneras y puertas; si no, también se ajusta y
      // todos quedan parejos.
      anchos = anchosParejos(out, t, cs, total, [nuevo], undefined, 2);
    }
    anchos = anchos ?? anchosParejos(out, t, cs, total, [], minimos);
    if (!anchos) rechazar(`No cabe «${texto}» en la medida ${delTramo(out, t)} (${cm(largo)}). ${recomendacion(out, t, cs, total)}`);
    cs.forEach((c, k) => (c.ancho = anchos[k]));
  }
  ctx.id = nuevo.id;
}

function opQuitar(out: Diseno, ctx: CtxOp, tramo: Tramo, ref: RefModulo, ajustarLargo: boolean) {
  const t = tramoO(out, tramo);
  const cs = cuerposDe(out, t);
  const i = indiceO(out, t, ref);
  if (cs.length <= 1) {
    rechazar(
      t === 'base'
        ? 'El mueble necesita al menos un módulo.'
        : esTramoAereo(t)
          ? t === 'aereos'
            ? out.plantilla === 'compacto'
              ? 'El mueble superior necesita al menos un módulo.'
              : 'Es el único aéreo: para quitarlos apaga los muebles aéreos.'
            : 'Es el único módulo de ese lado del aéreo: para quitarlo cambia la forma de los aéreos.'
          : 'Es el único módulo de ese lado: para quitar el lado cambia la forma del mueble.',
    );
  }
  const c = cs[i];
  const nombre = nombreModuloEn(out, t, i);
  if (esTramoAereo(t) && alojaCampana(c)) {
    const e = (out.equipos.find((x) => x.id === c.campanaDe) as Encimera | undefined) ?? null;
    if (e?.campana) {
      e.campana = false;
      ctx.avisos.push('Se quitó la campana junto con su módulo.');
    }
  }
  const sep = t === 'base' ? out.separacionCuerpos : 0;
  const libera = c.ancho + sep;
  // Los motivos nombran los módulos con la numeración que ve el vendedor (antes de quitar).
  const largo = largoTramo(out, t);
  const total = largo - sep * Math.max(0, cs.length - 2);
  for (const e of out.equipos) if (e.tramo === t && e.modulo === c.id) ctx.cerca.set(e.id, { tramo: t as TramoBase, indice: Math.min(i, cs.length - 2) });
  cs.splice(i, 1);
  const fijoTramo = t === 'aereos' && out.plantilla === 'compacto';
  // Sin el refrigerador el aéreo se acorta: los demás módulos no cambian.
  if ((ajustarLargo || (t === 'aereos' && c.tipo === 'refrigerador')) && !fijoTramo) {
    if (t === 'base') {
      const minimo = Math.max(LIMITES[out.plantilla].ancho[0], minimoSuperior(out));
      if (out.ancho - libera < minimo) rechazar(`Sin el ${nombre} el mueble quedaría bajo su ancho mínimo (${cm(minimo)}).`);
    } else if (!esTramoAereo(t) && ladoMutable(out, t)!.largo - c.ancho < LIMITES_LADO.largo[0]) {
      rechazar(`Sin el ${nombre} el lado quedaría bajo su largo mínimo (${cm(LIMITES_LADO.largo[0])}).`);
    }
    cambiarLargo(out, t, -libera);
  } else {
    // Los ajustables que quedan se reparten parejo el largo del tramo.
    const anchos = anchosParejos(out, t, cs, total);
    if (!anchos) rechazar(`No se puede quitar el ${nombre} sin cambiar la medida ${delTramo(out, t)} (${cm(largo)}). ${recomendacion(out, t, cs, total)}`);
    cs.forEach((x, k) => (x.ancho = anchos[k]));
  }
}

function opMover(out: Diseno, tramo: Tramo, ref: RefModulo, delta: -1 | 1) {
  const t = tramoO(out, tramo);
  const cs = cuerposDe(out, t);
  const i = indiceO(out, t, ref);
  let j = i + delta;
  if (esTramoAereo(t)) {
    if (alojaCampana(cs[i])) rechazar('La campana va siempre sobre su encimera: para moverla, mueve la encimera.');
    // Los módulos se intercambian saltando las campanas, que no se mueven.
    while (j >= 0 && j < cs.length && alojaCampana(cs[j])) j += delta;
  }
  if (j < 0 || j >= cs.length) rechazar('El módulo ya está en la punta.');
  if (Math.min(i, j) < posicionMinima(out, t)) rechazar('La despensa va siempre primero.');
  [cs[i], cs[j]] = [cs[j], cs[i]];
}

function opActualizar(out: Diseno, ctx: CtxOp, tramo: Tramo, ref: RefModulo, cambios: Partial<Cuerpo>) {
  const t = tramoO(out, tramo);
  const cs = cuerposDe(out, t);
  const i = indiceO(out, t, ref);
  const c = cs[i];
  const antes = { ...c };
  const { ancho, id: _id, campanaDe: _campana, ...resto } = cambios;
  Object.assign(c, resto);
  if (!tiposPermitidos(out, t).includes(c.tipo)) rechazar(`${NOMBRE_TIPO[c.tipo]} no va en ${enTramo(out, t)}.`);
  if (esTramoAereo(t)) {
    if (c.tipo === 'campana' && !alojaCampana(antes)) {
      // Pasar un aéreo a campana es agregar la campana de la encimera que tiene debajo.
      const tb = tramoBaseDe(t);
      const db = disenoBase(out);
      let cursor = 0;
      for (let k = 0; k < i; k++) cursor += cs[k].ancho;
      const s = cursor + c.ancho / 2;
      const candidatas = out.equipos.filter((e): e is Encimera => e.tipo === 'encimera' && e.tramo === tb && esAdulta(out.plantilla));
      if (!candidatas.length) rechazar(`La campana va sobre una encimera: ${enTramo(out, tb)} no tiene encimera.`);
      const distancia = (e: Encimera) => {
        const sb = centroEncimera(db, e);
        return (e.campana ? 1e6 : 0) + (sb == null ? 1e7 : Math.abs(posEnTramo(out, t, posEnMundo(db, tb, sb)) - s));
      };
      const e = candidatas.reduce((a, b) => (distancia(b) < distancia(a) ? b : a));
      e.campana = true;
      c.campanaDe = e.id;
    } else if (esModuloCampana(antes) && !esModuloCampana(c) && antes.campanaDe) {
      const e = out.equipos.find((x) => x.id === antes.campanaDe) as Encimera | undefined;
      if (e?.campana) {
        e.campana = false;
        ctx.avisos.push('Se quitó la campana de la encimera.');
      }
    }
  }
  sanear(c, t);
  if (antes.campanaDe && esModuloCampana(c)) c.campanaDe = antes.campanaDe;
  const lim = limitesModulo(out, t, c);
  const objetivo = Math.max(lim.min, Math.min(lim.max, c.ancho));
  if (objetivo !== c.ancho) {
    const que = c.tipo === 'horno' ? `los ${cm(objetivo)} del horno` : c.tipo === 'especiero' ? `los ${cm(objetivo)} del especiero` : `el módulo con ${cm(objetivo)}`;
    absorber(out, t, -(objetivo - c.ancho), i, [c], `No caben ${que}: los demás módulos ${delTramo(out, t)} no tienen de dónde ceder o tomar espacio (${razonesRigidez(out, t, objetivo > c.ancho ? -1 : 1, [c])}). Achica otro módulo o cambia la medida del mueble.`);
    if (objetivo < c.ancho && esCajonera(c)) ctx.avisos.push(`La cajonera quedó en ${cm(objetivo)}: es su ancho máximo.`);
    c.ancho = objetivo;
  }
  if (typeof ancho === 'number') opAnchoModulo(out, ctx, t, i, ancho);
}

function opAnchoModulo(out: Diseno, ctx: Ctx, tramo: Tramo, ref: RefModulo, ancho: number) {
  const t = tramoO(out, tramo);
  const cs = cuerposDe(out, t);
  const i = indiceO(out, t, ref);
  const c = cs[i];
  const lim = limitesModulo(out, t, c);
  const nombre = nombreModuloEn(out, t, i);
  if (esTramoAereo(t) && alojaCampana(c)) {
    if (Math.round(ancho) === c.ancho) return;
    rechazar('El módulo de la campana se ajusta solo para quedar centrado sobre la encimera.');
  }
  if (lim.min === lim.max) {
    if (Math.round(ancho) === c.ancho) return;
    rechazar(`El ${nombre} (${nombreModulo(c).toLowerCase()}) mide siempre ${cm(lim.min)}.`);
  }
  const pedido = Math.round(ancho);
  // A mano el vendedor manda: sin tope máximo (la cajonera de 90 cm o el espacio libre de 50 cm
  // son la medida de los ajustes automáticos, no un límite para quien edita).
  const objetivo = Math.max(lim.min, pedido);
  if (objetivo !== pedido) ctx.avisos.push(`El ${nombre} mide al menos ${cm(lim.min)}.`);
  const delta = objetivo - c.ancho;
  if (delta === 0) return;
  // Primero ceden los módulos sin equipamiento; si no alcanza, también los que lo llevan.
  // Los vecinos se ajustan dentro de sus medidas normales; solo si no alcanza pasan su máximo
  // (por ejemplo, una cajonera sobre 90 cm): a mano el vendedor siempre puede.
  const signo = delta > 0 ? -1 : 1;
  const sinTope = capacidad(out, t, signo, [c], false) < Math.abs(delta) && capacidad(out, t, signo, [c], true) < Math.abs(delta);
  const conEquipados = capacidad(out, t, signo, [c], false, sinTope) < Math.abs(delta);
  const cap = capacidad(out, t, signo, [c], conEquipados, sinTope);
  if (cap <= 0) {
    rechazar(
      cs.length === 1
        ? `El ancho del ${nombre} es el largo ${delTramo(out, t)}: cambia la medida del mueble.`
        : delta > 0
          ? `El ${nombre} ya tiene todo el espacio disponible: los demás módulos están en su medida mínima. Para agrandarlo, quita un módulo o cambia la medida del mueble.`
          : `No hay módulos que puedan tomar ese espacio. Para achicar el ${nombre}, agrega un módulo o cambia la medida del mueble.`,
    );
  }
  const efectivo = Math.sign(delta) * Math.min(Math.abs(delta), cap);
  if (Math.abs(efectivo) < Math.abs(delta)) ctx.avisos.push(`El ${nombre} quedó en ${cm(c.ancho + efectivo)}: es lo que podían ${delta > 0 ? 'ceder' : 'tomar'} los demás módulos.`);
  absorber(out, t, -efectivo, i, [c], 'No hay espacio.', conEquipados, sinTope);
  c.ancho += efectivo;
}

// ---------- Equipamiento ----------

export interface OpcionesEquipo {
  /** Tramo del mueble base donde va (por defecto el principal). */
  tramo?: Tramo;
  /** Módulo que lo lleva (índice o id); si no se da, se elige el más adecuado. Horno: módulo que pasa a ser horno. */
  modulo?: RefModulo;
  /** Horno nuevo: posición donde se inserta su módulo de 60 cm. */
  posicion?: number;
  platos?: Encimera['platos'];
  modelo?: Lavaplatos['modelo'];
  llave?: boolean;
  /** Lavaplatos: centrado o pegado al borde izquierdo o derecho de su módulo. */
  ubicacion?: Lavaplatos['posicion'];
  /** Lavaplatos pegado a un borde: distancia en mm (mínimo 50). */
  margen?: number;
  /** Encimera o lavaplatos: solo el corte en la cubierta (el cliente trae el equipo). */
  soloCorte?: boolean;
  /** Campana o llave: id de la encimera o del lavaplatos al que se agrega. */
  para?: string;
}

export type TipoEquipoOp = 'encimera' | 'lavaplatos' | 'campana' | 'horno' | 'llave';

function buscarEquipo<T extends Equipo['tipo']>(d: Diseno, id: string, tipo: T): Extract<Equipo, { tipo: T }> | undefined {
  return d.equipos.find((e) => e.id === id && e.tipo === tipo) as Extract<Equipo, { tipo: T }> | undefined;
}

function opAgregarEquipo(out: Diseno, ctx: CtxOp, tipo: TipoEquipoOp, o: OpcionesEquipo = {}) {
  if (!llevaEquipamiento(out.plantilla)) rechazar('Este mueble no lleva equipamiento de cocina.');
  const opc = opcionesEquipo(out.plantilla);
  if (tipo === 'horno') {
    if (!opc.horno) rechazar('Este mueble no lleva horno empotrado.');
    const t = tramoBaseO(out, o.tramo ?? 'base');
    if (o.modulo == null) {
      // Con espacio se agrega un módulo nuevo de 60 cm; si no lo hay, el horno va bajo la
      // encimera de ese tramo (o en el módulo más ancho) sin cambiar el largo del mueble.
      if (anchoDisponible(out, 'horno', ANCHO_HORNO, ANCHO_HORNO, t) != null || !cuerposDe(out, t).length) {
        opAgregar(out, ctx, t, 'horno', o.posicion, { texto: 'Horno empotrado' });
        return;
      }
      const i = moduloParaHorno(out, t);
      if (i < 0) {
        opAgregar(out, ctx, t, 'horno', o.posicion, { texto: 'Horno empotrado' });
        return;
      }
      const c = cuerposDe(out, t)[i];
      hacerHorno(out, ctx, t, i, { ...c });
      ctx.avisos.push(`No había espacio para un módulo más: el horno quedó en el ${nombreModuloEn(out, t, i)}.`);
      ctx.id = c.id;
      return;
    }
    const i = indiceO(out, t, o.modulo);
    const c = cuerposDe(out, t)[i];
    if (c.tipo === 'horno') rechazar('Ese módulo ya tiene el horno.');
    if (out.equipos.some((e) => e.tipo === 'lavaplatos' && e.tramo === t && e.modulo === c.id)) rechazar(`El ${nombreModuloEn(out, t, i)} tiene el lavaplatos: muévelo antes de poner ahí el horno.`);
    hacerHorno(out, ctx, t, i, { ...c });
    ctx.id = c.id;
    return;
  }
  if (tipo === 'campana') {
    if (!opc.campana) rechazar('Este mueble no lleva campana.');
    const encimeras = out.equipos.filter((e): e is Encimera => e.tipo === 'encimera');
    if (!encimeras.length) rechazar('La campana va sobre la encimera: agrega primero una encimera.');
    const tb = o.tramo ? tramoBaseO(out, o.tramo) : null;
    const e = o.para
      ? buscarEquipo(out, o.para, 'encimera')
      : (encimeras.find((x) => !x.campana && (!tb || x.tramo === tb)) ?? encimeras.find((x) => !x.campana));
    if (!e) rechazar(o.para ? 'Esa encimera no existe.' : 'Todas las encimeras ya tienen campana.');
    if (e.campana) rechazar('Esa encimera ya tiene campana.');
    e.campana = true;
    ctx.id = `${e.id}:campana`;
    return;
  }
  if (tipo === 'llave') {
    if (!opc.llave) rechazar('Este mueble no lleva llave.');
    const lavs = out.equipos.filter((e): e is Lavaplatos => e.tipo === 'lavaplatos');
    const l = o.para ? buscarEquipo(out, o.para, 'lavaplatos') : lavs.find((x) => !x.llave);
    if (!l) rechazar(lavs.length ? (o.para ? 'Ese lavaplatos no existe.' : 'Todos los lavaplatos ya tienen llave.') : 'La llave va con un lavaplatos: agrega primero el lavaplatos.');
    if (l.llave) rechazar('Ese lavaplatos ya tiene llave.');
    if (l.soloCorte) rechazar(SOLO_CORTE_SIN_LLAVE);
    l.llave = true;
    ctx.id = `${l.id}:llave`;
    return;
  }
  let anfitrion: { tramo: TramoBase; modulo: string };
  if (o.modulo != null) {
    const t = tramoBaseO(out, o.tramo ?? 'base');
    const i = indiceO(out, t, o.modulo);
    const motivo = motivoNoPuedeIr(out, tipo, t, i);
    if (motivo) rechazar(motivo);
    anfitrion = { tramo: t, modulo: cuerposDe(out, t)[i].id };
  } else {
    const t = o.tramo ? tramoBaseO(out, o.tramo) : 'base';
    const elegido = elegirAnfitrion(out, tipo, [t, ...TRAMOS_BASE.filter((x) => x !== t)], null, undefined, o.modelo ?? 'simple');
    if (!elegido) rechazar(`No hay un módulo donde poner ${tipo === 'encimera' ? 'la encimera (puertas, cajones u horno)' : 'el lavaplatos (puertas o cajones)'} que no tenga ya ${tipo === 'encimera' ? 'una' : 'uno'}.`);
    anfitrion = elegido;
  }
  if (tipo === 'encimera') {
    const platos = o.platos ?? (esAdulta(out.plantilla) ? '4' : '2');
    if (!opc.platos.includes(platos)) rechazar(`La encimera de este mueble puede ser de ${opc.platos.join(' o ')} platos.`);
    const e = { ...nuevaEncimera(anfitrion.modulo, platos, anfitrion.tramo), soloCorte: o.soloCorte === true };
    out.equipos.push(e);
    ctx.id = e.id;
    const choque = choqueEnModulo(out, e);
    if (choque) rechazar(choque);
  } else {
    const modelo = o.modelo ?? 'simple';
    if (!opc.lavaplatos.includes(modelo)) rechazar('Este mueble lleva solo lavaplatos simple.');
    const soloCorte = o.soloCorte === true;
    if (soloCorte && o.llave === true) rechazar(SOLO_CORTE_SIN_LLAVE);
    const l = { ...nuevoLavaplatos(anfitrion.modulo, modelo, anfitrion.tramo), llave: opc.llave && !soloCorte && o.llave !== false, soloCorte };
    out.equipos.push(l);
    configurarLavaplatos(out, ctx, l, { posicion: o.ubicacion, margen: o.margen });
    ctx.id = l.id;
    const choque = choqueEnModulo(out, l);
    if (choque) rechazar(choque);
  }
}

function opQuitarEquipo(out: Diseno, ctx: CtxOp, id: string) {
  if (id.endsWith(':campana')) {
    const e = buscarEquipo(out, id.slice(0, -':campana'.length), 'encimera');
    if (!e?.campana) rechazar('Esa campana no existe.');
    e.campana = false;
    return;
  }
  if (id.endsWith(':llave')) {
    const l = buscarEquipo(out, id.slice(0, -':llave'.length), 'lavaplatos');
    if (!l?.llave) rechazar('Esa llave no existe.');
    l.llave = false;
    return;
  }
  const k = out.equipos.findIndex((e) => e.id === id);
  if (k >= 0) {
    const [e] = out.equipos.splice(k, 1);
    if (e.tipo === 'encimera' && e.campana) ctx.avisos.push('También se quitó su campana.');
    return;
  }
  for (const t of TRAMOS_BASE) {
    if (!resolverTramo(out, t)) continue;
    const i = cuerposDe(out, t).findIndex((c) => c.id === id);
    if (i < 0) continue;
    const c = cuerposDe(out, t)[i];
    if (c.tipo !== 'horno') rechazar('Ese módulo no tiene horno.');
    const puertas = c.ancho >= 2 * ANCHO_POR_PUERTA - 100 ? 2 : 1;
    opActualizar(out, ctx, t, i, { tipo: 'frentes', puertas, cajones: 0, repisas: 1, bisagra: 'der' });
    ctx.avisos.push(`El módulo del horno quedó como módulo de ${puertas} ${puertas === 1 ? 'puerta' : 'puertas'} de ${cm(c.ancho)}.`);
    return;
  }
  rechazar('Ese equipo no existe.');
}

const CONTENIDO: (keyof Cuerpo)[] = ['tipo', 'ancho', 'puertas', 'bisagra', 'cajones', 'columnasCajones', 'altoCajon', 'repisas', 'colgador', 'alto', 'abatible', 'cajonesArriba', 'pisos'];

function opMoverEquipo(out: Diseno, ctx: CtxOp, id: string, destino: { tramo: Tramo; modulo: RefModulo }) {
  if (id.endsWith(':campana')) rechazar('La campana va siempre sobre su encimera: mueve la encimera y la campana la sigue.');
  if (id.endsWith(':llave')) rechazar('La llave va con su lavaplatos: mueve el lavaplatos.');
  const t = tramoBaseO(out, destino.tramo);
  const i = indiceO(out, t, destino.modulo);
  const dest = cuerposDe(out, t)[i];
  const e = out.equipos.find((x) => x.id === id);
  if (e) {
    if (e.tramo === t && e.modulo === dest.id) return;
    const motivo = motivoNoPuedeIr(out, e.tipo, t, i, e.id);
    if (motivo) rechazar(motivo);
    e.tramo = t;
    e.modulo = dest.id;
    const choque = choqueEnModulo(out, e);
    if (choque) rechazar(choque);
    return;
  }
  // El horno se mueve intercambiando el contenido de los dos módulos (los ids, y con ellos el
  // equipamiento de cada posición, se quedan donde están).
  let origen: { t: TramoBase; i: number } | null = null;
  for (const tb of TRAMOS_BASE) {
    if (!resolverTramo(out, tb)) continue;
    const k = cuerposDe(out, tb).findIndex((c) => c.id === id);
    if (k >= 0) origen = { t: tb, i: k };
  }
  if (!origen) rechazar('Ese equipo no existe.');
  const o = cuerposDe(out, origen.t)[origen.i];
  if (o.tipo !== 'horno') rechazar('Ese módulo no tiene horno.');
  if (o === dest) return;
  if (dest.tipo === 'horno') rechazar('Ese módulo ya tiene horno.');
  if (out.equipos.some((x) => x.tipo === 'lavaplatos' && x.tramo === t && x.modulo === dest.id)) rechazar(`El ${nombreModuloEn(out, t, i)} tiene el lavaplatos: muévelo antes de poner ahí el horno.`);
  const copiaO = { ...o };
  const copiaD = { ...dest };
  const pasar = (de: Cuerpo, a: Cuerpo, conAncho: boolean) => {
    for (const k of CONTENIDO) if (conAncho || k !== 'ancho') delete (a as Partial<Cuerpo>)[k];
    for (const k of CONTENIDO) if ((conAncho || k !== 'ancho') && de[k] !== undefined) (a as unknown as Record<string, unknown>)[k] = de[k];
  };
  if (origen.t === t) {
    // En el mismo tramo los dos módulos se intercambian enteros (contenido y ancho): el largo no cambia.
    pasar(copiaD, o, true);
    pasar(copiaO, dest, true);
  } else {
    // Entre tramos, el módulo del horno conserva sus 60 cm y recibe lo que tenía el destino; el
    // destino pasa a horno (si sobra espacio y nadie lo toma, queda como un módulo aparte).
    pasar(copiaD, o, false);
    sanear(o, origen.t);
    const fijo = anchoFijo(out.plantilla, o);
    if (fijo != null && fijo !== o.ancho) {
      absorber(out, origen.t, o.ancho - fijo, origen.i, [o], `El ${nombreModulo(o).toLowerCase()} no cabe en el lugar del horno: ${razonesRigidez(out, origen.t, 1, [o])}.`);
      o.ancho = fijo;
    }
    hacerHorno(out, ctx, t, i, copiaD);
  }
  ctx.avisos.push(`El horno pasó al ${nombreModuloEn(out, t, i)}; el ${nombreModuloEn(out, origen.t, origen.i)} quedó con lo que tenía ese módulo.`);
}

/**
 * Pasa el módulo i del tramo a horno (60 cm) sin cambiar el largo del tramo: la diferencia
 * la dan o toman los ajustables más cercanos. Si sobra espacio y nadie lo puede tomar, lo que
 * sobra queda como un módulo aparte con el contenido que tenía (un módulo de 140 cm pasa a
 * horno de 60 cm + módulo de 80 cm).
 */
function hacerHorno(out: Diseno, ctx: CtxOp, t: TramoBase, i: number, resto: Cuerpo) {
  const cs = cuerposDe(out, t);
  const c = cs[i];
  const nombre = nombreModuloEn(out, t, i);
  const sobra = c.ancho - ANCHO_HORNO;
  for (const k of CONTENIDO) if (k !== 'ancho') delete (c as Partial<Cuerpo>)[k];
  Object.assign(c, { tipo: 'horno', puertas: 0, cajones: 0, bisagra: 'izq', columnasCajones: 1, altoCajon: 0, repisas: 0, colgador: false, alto: 0 });
  sanear(c, t);
  if (sobra === 0) return;
  if (sobra < 0) {
    absorber(out, t, sobra, i, [c], `No caben los ${cm(ANCHO_HORNO)} del horno en el ${nombre} (${cm(c.ancho)}): ${razonesRigidez(out, t, -1, [c])}. Elige un módulo más ancho o achica otro.`);
    c.ancho = ANCHO_HORNO;
    return;
  }
  const cap = capacidad(out, t, 1, [c]);
  if (cap >= sobra) {
    absorber(out, t, sobra, i, [c], 'No hay espacio.');
    c.ancho = ANCHO_HORNO;
    return;
  }
  // Nadie toma todo lo que sobra: queda un módulo aparte (de al menos 15 cm) junto al horno.
  const tipoResto = resto.tipo === 'hueco' ? 'hueco' : 'frentes';
  const minResto = tipoResto === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
  const ancho = Math.max(minResto, sobra - cap);
  const nuevo: Cuerpo = { ...resto, id: nuevoId(), tipo: tipoResto, ancho };
  if (tipoResto === 'frentes' && resto.tipo !== 'frentes') Object.assign(nuevo, { puertas: ancho >= 2 * ANCHO_POR_PUERTA - 100 ? 2 : 1, cajones: 0, repisas: 1, bisagra: 'der' });
  delete nuevo.campanaDe;
  sanear(nuevo, t);
  c.ancho = ANCHO_HORNO;
  const razones = razonesRigidez(out, t, -1, [c]);
  cs.splice(i + 1, 0, nuevo);
  const delta = sobra - ancho;
  absorber(out, t, delta, i + 1, [c, nuevo], `No caben los ${cm(ANCHO_HORNO)} del horno en el ${nombre}: ${razones}.`);
  ctx.avisos.push(`El horno ocupa ${cm(ANCHO_HORNO)} del ${nombre}; los ${cm(ancho)} que sobran quedaron como un módulo de ${nombreModulo(nuevo).toLowerCase()} a su lado.`);
}

/** Módulo que recibe un horno cuando no cabe uno nuevo: el de la encimera (si no tiene lavaplatos) o el más ancho que pueda. */
function moduloParaHorno(out: Diseno, t: TramoBase): number {
  const cs = cuerposDe(out, t);
  const conLavaplatos = (c: Cuerpo) => out.equipos.some((e) => e.tipo === 'lavaplatos' && e.tramo === t && e.modulo === c.id);
  const sirve = (c: Cuerpo, k: number) => c.tipo === 'frentes' && !conLavaplatos(c) && k >= posicionMinima(out, t);
  const enc = out.equipos.find((e) => e.tipo === 'encimera' && e.tramo === t && cs.some((c, k) => c.id === e.modulo && sirve(c, k)));
  if (enc) return cs.findIndex((c) => c.id === enc.modulo);
  let mejor = -1;
  cs.forEach((c, k) => {
    if (sirve(c, k) && (mejor < 0 || c.ancho > cs[mejor].ancho)) mejor = k;
  });
  return mejor;
}

function configurarLavaplatos(out: Diseno, ctx: Ctx, l: Lavaplatos, cambios: { posicion?: Lavaplatos['posicion']; margen?: number }) {
  if (cambios.posicion) l.posicion = cambios.posicion;
  if (cambios.margen != null) {
    const pedido = Math.round(cambios.margen);
    if (pedido < 50) ctx.avisos.push(`El lavaplatos queda al menos a ${cm(50)} del borde.`);
    l.margen = Math.max(50, pedido);
  }
  const c = cuerposDe(out, l.tramo).find((x) => x.id === l.modulo);
  if (c && l.margen > margenMaximo(c, l)) {
    l.margen = margenMaximo(c, l);
    ctx.avisos.push(`El margen del lavaplatos quedó en ${cm(l.margen)}: es lo que permite su módulo.`);
  }
}

export interface CambiosEquipo {
  platos?: Encimera['platos'];
  campana?: boolean;
  modelo?: Lavaplatos['modelo'];
  llave?: boolean;
  posicion?: Lavaplatos['posicion'];
  margen?: number;
  /** Solo el corte en la cubierta: el cliente trae el equipo (el lavaplatos queda sin llave). */
  soloCorte?: boolean;
}

const SOLO_CORTE_SIN_LLAVE = 'El lavaplatos es solo corte: el cliente trae su equipo, así que no lleva llave.';

function opConfigurarEquipo(out: Diseno, ctx: CtxOp, id: string, cambios: CambiosEquipo) {
  const opc = opcionesEquipo(out.plantilla);
  const e = out.equipos.find((x) => x.id === id);
  if (!e) rechazar('Ese equipo no existe.');
  // Solo se rechaza un choque que provoca este cambio (no uno que ya venía de antes).
  const yaChocaba = choqueEnModulo(out, e) != null;
  if (e.tipo === 'encimera') {
    if (cambios.platos) {
      if (!opc.platos.includes(cambios.platos)) rechazar(`La encimera de este mueble puede ser de ${opc.platos.join(' o ')} platos.`);
      e.platos = cambios.platos;
    }
    if (cambios.campana != null) {
      if (cambios.campana && !opc.campana) rechazar('Este mueble no lleva campana.');
      e.campana = cambios.campana;
    }
    if (cambios.soloCorte != null) e.soloCorte = cambios.soloCorte;
    const choque = choqueEnModulo(out, e);
    if (choque && !yaChocaba) rechazar(choque);
    return;
  }
  if (cambios.modelo) {
    if (!opc.lavaplatos.includes(cambios.modelo)) rechazar('Este mueble lleva solo lavaplatos simple.');
    e.modelo = cambios.modelo;
  }
  if (cambios.soloCorte != null) {
    e.soloCorte = cambios.soloCorte;
    if (e.soloCorte && e.llave && cambios.llave !== true) {
      e.llave = false;
      ctx.avisos.push('El lavaplatos queda solo con el corte: sin cubeta ni llave (el cliente trae su equipo).');
    }
  }
  if (cambios.llave != null) {
    if (cambios.llave && !opc.llave) rechazar('Este mueble no lleva llave.');
    if (cambios.llave && e.soloCorte) rechazar(SOLO_CORTE_SIN_LLAVE);
    e.llave = cambios.llave;
  }
  configurarLavaplatos(out, ctx, e, cambios);
  const choque = choqueEnModulo(out, e);
  if (choque && !yaChocaba) rechazar(choque);
}

// ---------- Forma ----------

function moverLado<T extends { izq: Lado | null; der: Lado | null }>(lados: T, de: LadoId, a: LadoId) {
  lados[a] = lados[de];
  lados[de] = null;
}

function formaPedida(forma: Forma | LadoId | null): Forma {
  return forma === 'izq' ? 'L-izq' : forma === 'der' ? 'L-der' : forma == null ? 'lineal' : forma;
}

function opFijarForma(out: Diseno, ctx: CtxOp, pedida: Forma | LadoId | null) {
  const forma = formaPedida(pedida);
  if (out.plantilla !== 'cocina') rechazar('Solo el mueble de cocina puede ser en L o en U.');
  const actual = formaDe(out.lados);
  if (actual === forma) return;
  const a = out.aereos;
  // Pasar la L al otro costado la mueve entera (con sus módulos y su equipamiento).
  if ((actual === 'L-izq' && forma === 'L-der') || (actual === 'L-der' && forma === 'L-izq')) {
    const de: LadoId = actual === 'L-izq' ? 'izq' : 'der';
    const hacia: LadoId = de === 'izq' ? 'der' : 'izq';
    moverLado(out.lados, de, hacia);
    out.equipos.forEach((e) => {
      if (e.tramo === de) e.tramo = hacia;
    });
    if (a.cuadrado && a.lados[de]) moverLado(a.lados, de, hacia);
    return;
  }
  const quiere = { izq: forma === 'L-izq' || forma === 'U', der: forma === 'L-der' || forma === 'U' };
  for (const lado of LADOS) {
    if (quiere[lado] && !out.lados[lado]) out.lados[lado] = ladoPorDefecto(out, lado);
    else if (!quiere[lado] && out.lados[lado]) {
      const n = out.lados[lado]!.cuerpos.length;
      out.equipos.forEach((e) => {
        if (e.tramo === lado) ctx.cerca.set(e.id, { tramo: 'base', indice: lado === 'izq' ? 0 : out.cuerpos.length - 1 });
      });
      out.lados[lado] = null;
      ctx.avisos.push(`Se quitó el lado ${lado === 'izq' ? 'izquierdo' : 'derecho'} ${n === 1 ? 'con su módulo' : `con sus ${n} módulos`}.`);
    }
  }
}

export interface CambiosLado {
  largo?: number;
  profundidad?: number;
}

function opFijarLado(out: Diseno, ctx: Ctx, lado: LadoId, cambios: CambiosLado) {
  const r = out.lados[lado];
  if (!r) rechazar(`El mueble no tiene lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}: cambia la forma a L o U.`);
  if (cambios.profundidad != null) r.profundidad = limitar(Math.round(cambios.profundidad), LIMITES_LADO.profundidad);
  if (cambios.largo != null) {
    const lims = limitesDe(out, lado, r.cuerpos);
    const min = Math.max(LIMITES_LADO.largo[0], out.profundidad + sumar(lims.map((l) => l.min)));
    const max = Math.min(LIMITES_LADO.largo[1], out.profundidad + sumar(lims.map((l) => l.max)));
    const pedido = Math.round(cambios.largo);
    r.largo = Math.max(min, Math.min(max, pedido));
    if (r.largo !== pedido) ctx.avisos.push(`El largo del lado quedó en ${cm(r.largo)}: ${r.largo > pedido ? 'es lo mínimo para sus módulos' : 'es su largo máximo'}.`);
  }
  if (ajustarTramo(out, lado, r.largo - out.profundidad) !== 0) r.largo = out.profundidad + largoTramo(out, lado);
}

// ---------- Aéreos ----------

function opActivarAereos(out: Diseno, activo: boolean) {
  if (out.plantilla === 'compacto') rechazar('El mueble superior del compacto va siempre.');
  if (out.plantilla !== 'cocina') rechazar('Solo el mueble de cocina lleva muebles aéreos.');
  if (activo && !out.aereos.cuerpos.length) out.aereos = aereosPorDefecto(out);
  out.aereos.activo = activo;
}

export type CambiosAereos = Partial<Pick<Aereos, 'alto' | 'profundidad' | 'elevacion' | 'alineacion'>>;

function opFijarAereos(out: Diseno, cambios: CambiosAereos) {
  const a = out.aereos;
  if (cambios.alto != null) a.alto = cambios.alto;
  if (cambios.elevacion != null) a.elevacion = cambios.elevacion;
  if (cambios.alineacion) a.alineacion = cambios.alineacion;
  if (cambios.profundidad != null) {
    a.profundidad = cambios.profundidad;
    // El fondo de los aéreos es común: sus lados lo siguen (cada lado se puede cambiar aparte).
    for (const lado of LADOS) if (a.lados[lado]) a.lados[lado]!.profundidad = cambios.profundidad;
  }
  a.profundidad = limitar(Math.round(a.profundidad), [LIMITES_AEREOS.profundidad[0], Math.min(LIMITES_AEREOS.profundidad[1], out.plantilla === 'compacto' ? out.profundidad : 999)]);
  for (const lado of LADOS) if (a.lados[lado]) a.lados[lado]!.profundidad = limitar(Math.round(a.lados[lado]!.profundidad), LIMITES_AEREOS.profundidad);
  if (out.plantilla === 'compacto') {
    a.elevacion = limitar(Math.round(a.elevacion), [LIMITES_AEREOS.base[0], Math.min(LIMITES_AEREOS.base[1], out.alto - 300 - LIMITES_AEREOS.alto[0])]);
    a.alto = limitar(Math.round(a.alto), [LIMITES_AEREOS.alto[0], out.alto - a.elevacion - 300]);
  } else {
    a.alto = limitar(Math.round(a.alto), LIMITES_AEREOS.alto);
    a.elevacion = limitar(Math.round(a.elevacion), LIMITES_AEREOS.elevacion);
  }
}

function opFormaAereos(out: Diseno, pedida: Forma) {
  if (out.plantilla !== 'cocina') rechazar('Solo los aéreos de cocina pueden ser en L o en U.');
  const a = out.aereos;
  if (!a.activo) opActivarAereos(out, true);
  const actual = formaDe(a.lados);
  if (actual === pedida) return;
  a.cuadrado = false;
  if ((actual === 'L-izq' && pedida === 'L-der') || (actual === 'L-der' && pedida === 'L-izq')) {
    moverLado(a.lados, actual === 'L-izq' ? 'izq' : 'der', actual === 'L-izq' ? 'der' : 'izq');
    return;
  }
  const quiere = { izq: pedida === 'L-izq' || pedida === 'U', der: pedida === 'L-der' || pedida === 'U' };
  for (const lado of LADOS) {
    if (quiere[lado] && !a.lados[lado]) a.lados[lado] = ladoAereoPorDefecto(out, lado);
    else if (!quiere[lado]) a.lados[lado] = null;
  }
}

function opLadoAereo(out: Diseno, ctx: Ctx, lado: LadoId, cambios: CambiosLado) {
  const a = out.aereos;
  const r = a.lados[lado];
  const t: TramoAereo = lado === 'izq' ? 'aereos-izq' : 'aereos-der';
  if (!r) rechazar(`Los aéreos no tienen lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}: cambia su forma.`);
  if (cambios.profundidad != null) r.profundidad = limitar(Math.round(cambios.profundidad), LIMITES_AEREOS.profundidad);
  if (cambios.largo != null) {
    const pedido = Math.round(cambios.largo);
    const max = LIMITES_AEREOS.ladoLargo[1];
    // Una campana no queda a medias: el largo se lleva al más cercano que la cubre o la deja fuera.
    const minSinCampanas = Math.max(LIMITES_AEREOS.ladoLargo[0], a.profundidad + minimoSinCampanas(out, t));
    const elegido = largoAereoSinCortarCampanas(out, t, pedido, [minSinCampanas, max]);
    soltarCampanas(out, t, elegido.fuera);
    const min = Math.max(LIMITES_AEREOS.ladoLargo[0], a.profundidad + sumar(limitesDe(out, t, r.cuerpos).map((l) => l.min)));
    const largo = limitar(elegido.largo, [min, max]);
    if (largo !== pedido) {
      const porCampana = largo === elegido.largo && elegido.largo !== limitar(pedido, [minSinCampanas, max]);
      ctx.avisos.push(`El largo del lado del aéreo quedó en ${cm(largo)}${porCampana ? `: con ${cm(pedido)} la campana quedaría a medias sobre la encimera` : ''}.`);
    }
    if (largo !== r.largo) a.cuadrado = false;
    r.largo = largo;
  }
  if (ajustarTramo(out, t, r.largo - a.profundidad) !== 0) r.largo = a.profundidad + largoTramo(out, t);
}

function opLargoAereos(out: Diseno, ctx: Ctx, largo: number) {
  const a = out.aereos;
  if (out.plantilla === 'compacto') rechazar('El mueble superior del compacto mide lo mismo que el base.');
  if (out.plantilla !== 'cocina' || !a.cuerpos.length) rechazar('Primero activa los muebles aéreos.');
  if (a.lados.izq && a.lados.der) rechazar('Con los aéreos en U el principal va de muro a muro: cambia el ancho del mueble.');
  const max = maximoTramo(out, 'aereos');
  const pedido = Math.round(largo);
  const minSinCampanas = Math.max(LIMITES_AEREOS.ancho[0], minimoSinCampanas(out, 'aereos'));
  const elegido = largoAereoSinCortarCampanas(out, 'aereos', pedido, [minSinCampanas, max]);
  soltarCampanas(out, 'aereos', elegido.fuera);
  const min = Math.max(LIMITES_AEREOS.ancho[0], sumar(limitesDe(out, 'aereos', a.cuerpos).map((l) => l.min)));
  const objetivo = Math.max(min, Math.min(max, elegido.largo));
  if (objetivo !== pedido) {
    const porCampana = objetivo === elegido.largo && elegido.largo !== Math.max(minSinCampanas, Math.min(max, pedido));
    ctx.avisos.push(
      `Los aéreos quedaron de ${cm(objetivo)}: ${porCampana ? `con ${cm(pedido)} la campana quedaría a medias sobre la encimera` : objetivo < pedido ? (hayMuros(out) ? 'no pueden pasar los muros' : 'es su largo máximo') : 'es lo mínimo para sus módulos'}.`,
    );
  }
  const [x0, x1] = extremosPrincipal(out);
  if (objetivo !== Math.round(x1 - x0)) a.cuadrado = false;
  ajustarTramo(out, 'aereos', objetivo);
}

// ---------- Cocina y terminaciones ----------

function opFijarCocina(out: Diseno, cambios: Partial<EquipamientoCocina>) {
  const k = out.cocina;
  if (cambios.grifo) k.grifo = cambios.grifo === 'cromado' ? 'cromado' : 'negro';
  if (cambios.copete != null) k.copete = !!cambios.copete;
  if (cambios.espesorCubierta != null) k.espesorCubierta = limitar(Math.round(cambios.espesorCubierta), [10, 60]);
  if (cambios.vueloCubierta != null) k.vueloCubierta = limitar(Math.round(cambios.vueloCubierta), [0, 60]);
}

export interface CambiosAcabados {
  tirador?: TipoTirador;
  zocalo?: number;
  luzFrentes?: number;
  espesor?: 15 | 18;
  estructura?: Diseno['estructura'];
  materiales?: Partial<Materiales>;
  cierreSuave?: boolean;
}

function opFijarAcabados(out: Diseno, c: CambiosAcabados) {
  if (c.tirador) out.tirador = c.tirador === 'unero' ? 'sin' : c.tirador;
  if (typeof c.cierreSuave === 'boolean') out.cierreSuave = c.cierreSuave;
  if (c.zocalo != null) out.zocalo = limitar(Math.round(c.zocalo), [0, 200]);
  if (c.luzFrentes != null) out.luzFrentes = limitar(Math.round(c.luzFrentes), [1, 10]);
  if (c.espesor != null) out.espesor = c.espesor === 18 ? 18 : 15;
  if (c.estructura) out.estructura = c.estructura === 'unica' ? 'unica' : 'modular';
  if (c.materiales) Object.assign(out.materiales, c.materiales);
}

// ---------- Operaciones (API para la interfaz y el asistente) ----------

/** Operación serializable: lo que la interfaz o el asistente de IA piden hacer sobre el diseño. */
export type Operacion =
  | { op: 'fijarAncho'; ancho: number }
  | { op: 'fijarAlto'; alto: number }
  | { op: 'fijarProfundidad'; profundidad: number }
  | { op: 'fijarSeparacion'; separacion: number }
  | { op: 'fijarForma'; forma: Forma }
  | ({ op: 'fijarLado'; lado: LadoId } & CambiosLado)
  | { op: 'agregarModulo'; tramo: Tramo; preset: string; posicion?: number; ajustarLargo?: boolean }
  | { op: 'agregarCuerpo'; tramo: Tramo; tipo: Cuerpo['tipo']; posicion?: number; ancho?: number; cambios?: Partial<Cuerpo>; ajustarLargo?: boolean }
  | { op: 'quitarModulo'; tramo: Tramo; modulo: RefModulo; ajustarLargo?: boolean }
  | { op: 'moverModulo'; tramo: Tramo; modulo: RefModulo; delta: -1 | 1 }
  | { op: 'actualizarModulo'; tramo: Tramo; modulo: RefModulo; cambios: Partial<Cuerpo> }
  | { op: 'fijarAnchoModulo'; tramo: Tramo; modulo: RefModulo; ancho: number }
  | ({ op: 'agregarEquipo'; equipo: TipoEquipoOp } & OpcionesEquipo)
  | { op: 'quitarEquipo'; id: string }
  | { op: 'moverEquipo'; id: string; tramo: Tramo; modulo: RefModulo }
  | { op: 'configurarEquipo'; id: string; cambios: CambiosEquipo }
  | { op: 'activarAereos'; activo: boolean }
  | ({ op: 'fijarAereos' } & CambiosAereos)
  | { op: 'fijarFormaAereos'; forma: Forma }
  | ({ op: 'fijarLadoAereo'; lado: LadoId } & CambiosLado)
  | { op: 'fijarLargoAereos'; largo: number }
  | { op: 'fijarAereosCuadrados'; cuadrado: boolean }
  | { op: 'fijarCocina'; cambios: Partial<EquipamientoCocina> }
  | ({ op: 'fijarAcabados' } & CambiosAcabados);

/**
 * Aplica una operación y devuelve el diseño resultante (siempre válido) con el motivo si
 * se rechazó y los avisos de lo que se ajustó solo. Un rechazo devuelve el mismo objeto.
 */
export function ejecutar(d: Diseno, op: Operacion): Resultado {
  // Lo que llega serializado (del asistente de IA o de un enlace) se revisa antes de tocar el diseño.
  const malFormada = revisarOperacion(op);
  if (malFormada) return { ok: false, diseno: d, motivo: malFormada, avisos: [] };
  return aplicar(d, op);
}

function aplicar(d: Diseno, op: Operacion): Resultado {
  return intentar(d, (out, ctx) => {
    switch (op.op) {
      case 'fijarAncho':
        return opFijarAncho(out, ctx, op.ancho);
      case 'fijarAlto':
        return opFijarAlto(out, op.alto);
      case 'fijarProfundidad':
        return opFijarProfundidad(out, ctx, op.profundidad);
      case 'fijarSeparacion':
        return opFijarSeparacion(out, ctx, op.separacion);
      case 'fijarForma':
        return opFijarForma(out, ctx, op.forma);
      case 'fijarLado':
        return opFijarLado(out, ctx, op.lado, op);
      case 'agregarModulo': {
        const t = tramoO(out, op.tramo);
        const preset = presetsModulo(out.plantilla, t).find((p) => p.id === op.preset);
        if (!preset) rechazar(`«${op.preset}» no es un módulo que se pueda agregar en ${enTramo(out, t)}.`);
        return opAgregar(out, ctx, t, preset.tipo, op.posicion, { cambios: preset.cambios, anchoSugerido: preset.ancho, anchoMinimo: preset.anchoMinimo, ajustarLargo: op.ajustarLargo, texto: preset.texto });
      }
      case 'agregarCuerpo':
        return opAgregar(out, ctx, op.tramo, op.tipo, op.posicion, { cambios: op.cambios, ancho: op.ancho, ajustarLargo: op.ajustarLargo });
      case 'quitarModulo':
        return opQuitar(out, ctx, op.tramo, op.modulo, !!op.ajustarLargo);
      case 'moverModulo':
        return opMover(out, op.tramo, op.modulo, op.delta);
      case 'actualizarModulo':
        return opActualizar(out, ctx, op.tramo, op.modulo, op.cambios);
      case 'fijarAnchoModulo':
        return opAnchoModulo(out, ctx, op.tramo, op.modulo, op.ancho);
      case 'agregarEquipo': {
        const { op: _op, equipo, ...o } = op;
        return opAgregarEquipo(out, ctx, equipo, o);
      }
      case 'quitarEquipo':
        return opQuitarEquipo(out, ctx, op.id);
      case 'moverEquipo':
        return opMoverEquipo(out, ctx, op.id, op);
      case 'configurarEquipo':
        return opConfigurarEquipo(out, ctx, op.id, op.cambios);
      case 'activarAereos':
        return opActivarAereos(out, op.activo);
      case 'fijarAereos':
        return opFijarAereos(out, op);
      case 'fijarFormaAereos':
        return opFormaAereos(out, op.forma);
      case 'fijarLadoAereo':
        return opLadoAereo(out, ctx, op.lado, op);
      case 'fijarLargoAereos':
        return opLargoAereos(out, ctx, op.largo);
      case 'fijarAereosCuadrados':
        out.aereos.cuadrado = op.cuadrado && out.plantilla === 'cocina';
        return;
      case 'fijarCocina':
        return opFijarCocina(out, op.cambios);
      case 'fijarAcabados':
        return opFijarAcabados(out, op);
    }
  });
}

// Equivalentes directos (devuelven el diseño; si la operación se rechaza, el mismo objeto).

/** Cambia el ancho del mueble (tramo principal) repartiendo la diferencia entre sus módulos. */
export function fijarAncho(d: Diseno, ancho: number): Diseno {
  return ejecutar(d, { op: 'fijarAncho', ancho }).diseno;
}

export function fijarAlto(d: Diseno, alto: number): Diseno {
  return ejecutar(d, { op: 'fijarAlto', alto }).diseno;
}

export function fijarProfundidad(d: Diseno, profundidad: number): Diseno {
  return ejecutar(d, { op: 'fijarProfundidad', profundidad }).diseno;
}

/** Cambia la separación entre módulos; el ancho del mueble no cambia. */
export function fijarSeparacion(d: Diseno, separacion: number): Diseno {
  return ejecutar(d, { op: 'fijarSeparacion', separacion }).diseno;
}

/** Cambia el ancho de un módulo: la diferencia la dan o toman los módulos ajustables vecinos. */
export function fijarAnchoCuerpo(d: Diseno, modulo: RefModulo, ancho: number, tramo: Tramo = 'base'): Diseno {
  return ejecutar(d, { op: 'fijarAnchoModulo', tramo, modulo, ancho }).diseno;
}

export function actualizarCuerpo(d: Diseno, modulo: RefModulo, cambios: Partial<Cuerpo>, tramo: Tramo = 'base'): Diseno {
  return ejecutar(d, { op: 'actualizarModulo', tramo, modulo, cambios }).diseno;
}

/** Si el módulo puede pasar a ser horno empotrado (60 cm) sin cambiar el largo del tramo. */
export function cabeHorno(d: Diseno, modulo: RefModulo, tramo: Tramo = 'base'): boolean {
  return ejecutar(d, { op: 'actualizarModulo', tramo, modulo, cambios: { tipo: 'horno' } }).ok;
}

/**
 * Agrega un módulo en la posición indicada (por defecto al final). El largo del tramo no
 * cambia: el módulo nuevo y los ajustables se reparten parejo el espacio (con `ancho`, el
 * nuevo conserva ese ancho; con `ajustarLargo`, solo programático, el mueble crece).
 */
export function agregarCuerpo(
  d: Diseno,
  tipo: Cuerpo['tipo'] = 'frentes',
  posicion?: number,
  opciones: { cambios?: Partial<Cuerpo>; ancho?: number; anchoMinimo?: number; tramo?: Tramo; ajustarLargo?: boolean } = {},
): Diseno {
  return intentar(d, (out, ctx) => opAgregar(out, ctx, opciones.tramo ?? 'base', tipo, posicion, opciones)).diseno;
}

/** Agrega uno de los módulos de presetsModulo. */
export function agregarModulo(d: Diseno, preset: PresetModulo, posicion?: number, tramo: Tramo = 'base', ajustarLargo = false): Diseno {
  return intentar(d, (out, ctx) =>
    opAgregar(out, ctx, tramo, preset.tipo, posicion, { cambios: preset.cambios, anchoSugerido: preset.ancho, anchoMinimo: preset.anchoMinimo, ajustarLargo, texto: preset.texto }),
  ).diseno;
}

/** Quita un módulo; los ajustables que quedan se reparten parejo el largo (con `ajustarLargo`, solo programático, el mueble se achica). */
export function quitarCuerpo(d: Diseno, modulo: RefModulo, tramo: Tramo = 'base', ajustarLargo = false): Diseno {
  return ejecutar(d, { op: 'quitarModulo', tramo, modulo, ajustarLargo }).diseno;
}

export function moverCuerpo(d: Diseno, modulo: RefModulo, delta: -1 | 1, tramo: Tramo = 'base'): Diseno {
  return ejecutar(d, { op: 'moverModulo', tramo, modulo, delta }).diseno;
}

export function agregarEquipo(d: Diseno, equipo: TipoEquipoOp, opciones: OpcionesEquipo = {}): Diseno {
  return ejecutar(d, { op: 'agregarEquipo', equipo, ...opciones }).diseno;
}

export function quitarEquipo(d: Diseno, id: string): Diseno {
  return ejecutar(d, { op: 'quitarEquipo', id }).diseno;
}

export function moverEquipo(d: Diseno, id: string, tramo: Tramo, modulo: RefModulo): Diseno {
  return ejecutar(d, { op: 'moverEquipo', id, tramo, modulo }).diseno;
}

export function configurarEquipo(d: Diseno, id: string, cambios: CambiosEquipo): Diseno {
  return ejecutar(d, { op: 'configurarEquipo', id, cambios }).diseno;
}

/** Cambia la forma del mueble base: 'lineal', 'L-izq', 'L-der' o 'U' (acepta 'izq' / 'der' / null heredados). */
export function fijarForma(d: Diseno, forma: Forma | LadoId | null): Diseno {
  return ejecutar(d, { op: 'fijarForma', forma: formaPedida(forma) }).diseno;
}

/** Cambia el largo (desde el muro principal) o el fondo de un lado de la L/U. */
export function fijarLado(d: Diseno, lado: LadoId, cambios: CambiosLado): Diseno {
  return ejecutar(d, { op: 'fijarLado', lado, ...cambios }).diseno;
}

/** Nombre heredado: cambia el único lado de la L (en una U, el izquierdo). */
export function fijarRetorno(d: Diseno, cambios: CambiosLado): Diseno {
  const r = retornoDe(d);
  return r ? fijarLado(d, r.lado, cambios) : d;
}

export function activarAereos(d: Diseno, activo: boolean): Diseno {
  return ejecutar(d, { op: 'activarAereos', activo }).diseno;
}

export function fijarAereos(d: Diseno, cambios: CambiosAereos): Diseno {
  return ejecutar(d, { op: 'fijarAereos', ...cambios }).diseno;
}

export function fijarFormaAereos(d: Diseno, forma: Forma): Diseno {
  return ejecutar(d, { op: 'fijarFormaAereos', forma }).diseno;
}

export function fijarLadoAereo(d: Diseno, lado: LadoId, cambios: CambiosLado): Diseno {
  return ejecutar(d, { op: 'fijarLadoAereo', lado, ...cambios }).diseno;
}

/** Cambia el largo del aéreo principal repartiéndolo entre sus módulos. */
export function fijarAnchoAereos(d: Diseno, largo: number): Diseno {
  return ejecutar(d, { op: 'fijarLargoAereos', largo }).diseno;
}

/** Deja los aéreos cuadrados con el base (misma forma y largos) o libres para cambiarlos. */
export function fijarAereosCuadrados(d: Diseno, cuadrado: boolean): Diseno {
  return ejecutar(d, { op: 'fijarAereosCuadrados', cuadrado }).diseno;
}

export function fijarCocina(d: Diseno, cambios: Partial<EquipamientoCocina>): Diseno {
  return ejecutar(d, { op: 'fijarCocina', cambios }).diseno;
}

export function formaBase(d: Diseno): Forma {
  return formaDe(d.lados);
}

export function formaAereos(d: Diseno): Forma {
  return formaDe(d.aereos.lados);
}

// ---------- Compatibilidad con la interfaz de la versión 1 ----------

/**
 * Vista heredada del equipamiento del tramo principal (la primera encimera y el primer
 * lavaplatos, por índice de módulo). Solo para las pantallas que aún no usan `equipos`.
 */
export function equipoLegado(d: Diseno): {
  encimera: 'ninguna' | '2' | '3' | '4';
  encimeraCuerpo: number;
  lavaplatos: 'ninguno' | Lavaplatos['modelo'];
  lavaplatosCuerpo: number;
} {
  const equipos = d.equipos ?? [];
  const enc = equipos.find((e): e is Encimera => e.tipo === 'encimera' && e.tramo === 'base');
  const lav = equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos' && e.tramo === 'base');
  const indice = (id: string) => Math.max(0, d.cuerpos.findIndex((c) => c.id === id));
  return {
    encimera: enc ? enc.platos : 'ninguna',
    encimeraCuerpo: enc ? indice(enc.modulo) : 0,
    lavaplatos: lav ? lav.modelo : 'ninguno',
    lavaplatosCuerpo: lav ? indice(lav.modulo) : 0,
  };
}

/** Aplica cambios con los nombres heredados (encimera, encimeraCuerpo, lavaplatos, lavaplatosCuerpo, grifo…). */
export function fijarCocinaLegado(d: Diseno, cambios: Partial<EquipamientoCocina & ReturnType<typeof equipoLegado>>): Diseno {
  return intentar(d, (out, ctx) => {
    const { encimera, encimeraCuerpo, lavaplatos, lavaplatosCuerpo, ...cocina } = cambios;
    opFijarCocina(out, cocina);
    const primera = <T extends Equipo['tipo']>(tipo: T) => out.equipos.find((e) => e.tipo === tipo && e.tramo === 'base') as Extract<Equipo, { tipo: T }> | undefined;
    if (encimera !== undefined) {
      const e = primera('encimera');
      if (encimera === 'ninguna') {
        if (e) opQuitarEquipo(out, ctx, e.id);
      } else if (e) e.platos = encimera;
      else opAgregarEquipo(out, ctx, 'encimera', { tramo: 'base', platos: esAdulta(out.plantilla) && encimera === '2' ? '3' : encimera });
    }
    if (encimeraCuerpo !== undefined) {
      const e = primera('encimera');
      if (e) opMoverEquipo(out, ctx, e.id, { tramo: 'base', modulo: encimeraCuerpo });
    }
    if (lavaplatos !== undefined) {
      const l = primera('lavaplatos');
      if (lavaplatos === 'ninguno') {
        if (l) opQuitarEquipo(out, ctx, l.id);
      } else if (l) l.modelo = lavaplatos;
      else opAgregarEquipo(out, ctx, 'lavaplatos', { tramo: 'base', modelo: lavaplatos });
    }
    if (lavaplatosCuerpo !== undefined) {
      const l = primera('lavaplatos');
      if (l) opMoverEquipo(out, ctx, l.id, { tramo: 'base', modulo: lavaplatosCuerpo });
    }
  }).diseno;
}

// ---------- Diseños guardados ----------

const TIPOS: Cuerpo['tipo'][] = ['frentes', 'horno', 'hueco', 'escritorio', 'campana', 'nicho', 'especiero', 'espacio-campana', 'refrigerador'];

const numero = (v: unknown, defecto: number) => (typeof v === 'number' && Number.isFinite(v) ? v : defecto);

/**
 * Asegura que un diseño cargado (o recibido del servidor) sea consistente y lo lleva a la
 * versión actual: los diseños de la versión 1 (con `retorno` y la encimera y el lavaplatos
 * por índice) se migran sin perder lo que tenían. Es idempotente.
 */
export function normalizar(entrada: Diseno | DisenoGuardado): Diseno {
  const g = entrada as DisenoGuardado;
  const p: Plantilla = g.plantilla;
  const defecto = disenoLibre(p);
  const ctx: CtxOp = { avisos: [], cerca: new Map() };
  const ids = new Set<string>();
  const limpiar = (c: Partial<Cuerpo>): Cuerpo => {
    let id = typeof c.id === 'string' && c.id ? c.id : nuevoId();
    if (ids.has(id)) id = nuevoId();
    ids.add(id);
    const out: Cuerpo = {
      ...nuevoCuerpo({ ancho: numero(c.ancho, ANCHO_MIN_CUERPO) }),
      ...c,
      id,
      tipo: TIPOS.includes(c.tipo as Cuerpo['tipo']) ? (c.tipo as Cuerpo['tipo']) : 'frentes',
      ancho: Math.round(numero(c.ancho, ANCHO_MIN_CUERPO)),
    };
    if (out.abatible === undefined) delete out.abatible;
    if (out.cajonesArriba === undefined) delete out.cajonesArriba;
    return out;
  };
  const lado = (l: { largo?: number; profundidad?: number; cuerpos?: Partial<Cuerpo>[] } | null | undefined, fondo: number, largo: number): Lado | null =>
    l ? { largo: Math.round(numero(l.largo, largo)), profundidad: Math.round(numero(l.profundidad, fondo)), cuerpos: (l.cuerpos ?? []).map(limpiar) } : null;
  const profundidad = numero(g.profundidad, defecto.profundidad);
  const r = g.retorno ?? null;
  const lados = {
    izq: lado(g.lados?.izq ?? (r?.lado === 'izq' ? r : null), profundidad, 1200),
    der: lado(g.lados?.der ?? (r?.lado === 'der' ? r : null), profundidad, 1200),
  };
  const av = aereosVacios(p);
  const ga = g.aereos ?? {};
  const cuerposAereos = (ga.cuerpos ?? []).map(limpiar);
  const aereos: Aereos = {
    activo: typeof ga.activo === 'boolean' ? ga.activo : av.activo,
    montaje: ga.montaje === 'apoyado' ? 'apoyado' : ga.montaje === 'mural' ? 'mural' : av.montaje,
    alto: numero(ga.alto, av.alto),
    profundidad: numero(ga.profundidad, av.profundidad),
    elevacion: numero(ga.elevacion, av.elevacion),
    alineacion: ga.alineacion === 'izq' || ga.alineacion === 'der' || ga.alineacion === 'centro' ? ga.alineacion : av.alineacion,
    cuerpos: cuerposAereos,
    lados: { izq: lado(ga.lados?.izq, numero(ga.profundidad, av.profundidad), 1200), der: lado(ga.lados?.der, numero(ga.profundidad, av.profundidad), 1200) },
    cuadrado: false,
  };
  const k = g.cocina ?? {};
  const out: Diseno = {
    ...defecto,
    version: 2,
    plantilla: p,
    productoId: g.productoId ?? null,
    nombreModelo: g.nombreModelo ?? '',
    ancho: Math.round(numero(g.ancho, defecto.ancho)),
    alto: numero(g.alto, defecto.alto),
    profundidad,
    cuerpos: (g.cuerpos ?? []).map(limpiar),
    luzFrentes: numero(g.luzFrentes, defecto.luzFrentes),
    separacionCuerpos: Math.round(Math.max(0, Math.min(200, numero(g.separacionCuerpos, 0)))),
    zocalo: numero(g.zocalo, defecto.zocalo),
    espesor: g.espesor === 18 ? 18 : 15,
    estructura: g.estructura === 'unica' || g.estructura === 'modular' ? g.estructura : defecto.estructura,
    // El perfil uñero se unificó con el sistema sin manilla.
    tirador: g.tirador === 'unero' ? 'sin' : (g.tirador ?? defecto.tirador),
    cierreSuave: g.cierreSuave === true,
    materiales: { ...defecto.materiales, ...(g.materiales ?? {}) },
    cocina: {
      grifo: k.grifo === 'cromado' ? 'cromado' : k.grifo === 'negro' ? 'negro' : defecto.cocina.grifo,
      copete: typeof k.copete === 'boolean' ? k.copete : defecto.cocina.copete,
      espesorCubierta: numero(k.espesorCubierta, defecto.cocina.espesorCubierta),
      vueloCubierta: numero(k.vueloCubierta, defecto.cocina.vueloCubierta),
    },
    tocador: { ...defecto.tocador, ...(g.tocador ?? {}) },
    filaSuperior: numero(g.filaSuperior, 0),
    mudador: !!g.mudador,
    imagenFrontal: g.imagenFrontal ?? null,
    aereos,
    lados: p === 'cocina' ? lados : { izq: null, der: null },
    equipos: [],
  };
  // Equipamiento: la versión 1 lo guardaba por índice de módulo del tramo principal.
  if (Array.isArray(g.equipos)) out.equipos = g.equipos.map((e) => ({ ...e, soloCorte: e.soloCorte === true }));
  else if (llevaEquipamiento(p) && out.cuerpos.length) {
    const n = out.cuerpos.length;
    const desde = p === 'cocina-infantil' && n > 1 ? 1 : 0;
    const modulo = (v: number | undefined) => out.cuerpos[Math.max(desde, Math.min(n - 1, Math.round(numero(v, 0))))].id;
    if (k.encimera && k.encimera !== 'ninguna') out.equipos.push(nuevaEncimera(modulo(k.encimeraCuerpo), k.encimera));
    if (k.lavaplatos && k.lavaplatos !== 'ninguno') out.equipos.push(nuevoLavaplatos(modulo(k.lavaplatosCuerpo), k.lavaplatos === 'doble' || k.lavaplatos === 'rinonera' ? k.lavaplatos : 'simple'));
    // El módulo de campana de los aéreos activos pasa a ser la campana de la encimera.
    const enc = out.equipos.find((e): e is Encimera => e.tipo === 'encimera');
    const campanas = aereos.cuerpos.filter((c) => c.tipo === 'campana');
    if (p === 'cocina' && aereos.activo && enc && campanas.length) {
      const x = posicionesModulos(out, 'base').find((m) => m.id === enc.modulo)!;
      const xEnc = -out.ancho / 2 + (x.s0 + x.s1) / 2;
      let cursor = inicioAereoPrincipal(out);
      const centros = new Map<Cuerpo, number>();
      for (const c of aereos.cuerpos) {
        centros.set(c, cursor + c.ancho / 2);
        cursor += c.ancho;
      }
      const cercana = campanas.reduce((a, b) => (Math.abs(centros.get(b)! - xEnc) < Math.abs(centros.get(a)! - xEnc) ? b : a));
      enc.campana = true;
      cercana.campanaDe = enc.id;
    }
  }
  // Aéreos cuadrados: los de la versión 1 lo son si cubren justo el tramo principal lineal.
  if (typeof ga.cuadrado === 'boolean') aereos.cuadrado = ga.cuadrado && p === 'cocina';
  else if (p === 'cocina') {
    const largo = sumar(aereos.cuerpos.map((c) => c.ancho));
    aereos.cuadrado = !lados.izq && !lados.der && (!aereos.cuerpos.length || Math.abs(largo - out.ancho) <= 1);
  }
  // Límites generales.
  const lim = LIMITES[p];
  out.alto = limitar(out.alto, lim.alto);
  out.profundidad = limitar(out.profundidad, lim.profundidad);
  out.ancho = limitar(out.ancho, lim.ancho);
  out.luzFrentes = limitar(out.luzFrentes, [1, 10]);
  out.zocalo = limitar(out.zocalo, [0, 200]);
  for (const l of LADOS) {
    const x = out.lados[l];
    if (!x) continue;
    x.profundidad = limitar(x.profundidad, LIMITES_LADO.profundidad);
    x.largo = limitar(x.largo, LIMITES_LADO.largo);
  }
  // Tipos que el tramo no admite pasan a ser módulos de puertas.
  for (const t of [...TRAMOS_BASE, ...TRAMOS_AEREOS]) {
    const permitidos = tiposPermitidos(out, t);
    for (const c of cuerposDe(out, t)) {
      if (!resolverTramo(out, t)) continue;
      if (!permitidos.includes(c.tipo)) c.tipo = 'frentes';
      sanear(c, t);
    }
  }
  if (out.plantilla !== 'cocina') out.aereos.lados = { izq: null, der: null };
  if (out.plantilla === 'compacto') {
    out.aereos.activo = true;
    out.aereos.montaje = 'apoyado';
  }
  if (out.plantilla === 'compacto' || out.plantilla === 'cocina') opFijarAereos(out, {});
  finalizar(out, ctx, true);
  const aj = normalizarAjustes((g as { ajustesPrecio?: unknown }).ajustesPrecio);
  if (aj) out.ajustesPrecio = aj;
  else delete out.ajustesPrecio;
  const adicionales = normalizarAdicionales((g as { adicionales?: unknown }).adicionales);
  if (adicionales.length) out.adicionales = adicionales;
  else delete out.adicionales;
  return out;
}

/** Voladizo de la cubierta de una isla: de 0 a 150 cm por lado. */
function normalizarVoladizo(v: Partial<Voladizo>): Voladizo {
  const n = (x: unknown) => Math.round(Math.max(0, Math.min(1500, numero(x, 0))));
  return { frente: n(v.frente), trasero: n(v.trasero), izq: n(v.izq), der: n(v.der) };
}

/** Islas y muebles en línea guardados con el proyecto: cada uno es una cocina completa (sin adicionales propios). */
function normalizarAdicionales(x: unknown): MuebleAdicional[] {
  if (!Array.isArray(x)) return [];
  const ids = new Set<string>();
  const out: MuebleAdicional[] = [];
  for (const a of x as Partial<MuebleAdicional>[]) {
    if (!a || typeof a !== 'object' || !a.diseno || typeof a.diseno !== 'object') continue;
    let id = typeof a.id === 'string' && a.id ? a.id : nuevoId('m');
    if (ids.has(id)) id = nuevoId('m');
    ids.add(id);
    const tipo = a.tipo === 'isla' ? 'isla' : 'linea';
    const { adicionales: _sub, ...diseno } = a.diseno as Diseno;
    out.push({
      id,
      tipo,
      nombre: typeof a.nombre === 'string' && a.nombre.trim() ? a.nombre.trim().slice(0, 60) : tipo === 'isla' ? 'Isla' : 'Mueble en línea',
      x: Math.round(numero(a.x, 0)),
      z: Math.round(numero(a.z, 0)),
      giro: ((Math.round(numero(a.giro, 0)) % 360) + 360) % 360,
      diseno: normalizar({ ...diseno, plantilla: 'cocina' }),
      ...(tipo === 'linea' && a.pegado === true ? { pegado: true } : {}),
      ...(tipo === 'isla' && !a.cara && a.voladizo && typeof a.voladizo === 'object' ? { voladizo: normalizarVoladizo(a.voladizo) } : {}),
      ...(tipo === 'isla' && (a.cara === 'trasera' || a.cara === 'izq' || a.cara === 'der') && typeof a.isla === 'string' ? { cara: a.cara, isla: a.isla } : {}),
    });
  }
  // Una cara sin su isla (o repetida) no se puede ubicar: se descarta.
  const vistas = new Set<string>();
  return out.filter((a) => {
    if (!a.cara) return true;
    const clave = `${a.isla}:${a.cara}`;
    if (vistas.has(clave) || !out.some((x) => x.id === a.isla && !x.cara && x.tipo === 'isla')) return false;
    vistas.add(clave);
    return true;
  });
}

// ---------- Advertencias de fabricación ----------

export interface Advertencia {
  nivel: 'info' | 'aviso';
  texto: string;
}

/** Frentes de todos los tramos con el nombre de su módulo. */
function frentesConNombre(d: Diseno): { fr: Frente; nombre: string }[] {
  const out: { fr: Frente; nombre: string }[] = [];
  for (const fr of calcularLayout(d).frentes) out.push({ fr, nombre: fr.cuerpo >= 0 ? nombreModuloEn(d, 'base', fr.cuerpo) : 'fila superior' });
  for (const lado of LADOS) {
    const dl = disenoLado(d, lado);
    if (dl) for (const fr of calcularLayout(dl).frentes) out.push({ fr, nombre: nombreModuloEn(d, lado, fr.cuerpo) });
  }
  const la = calcularLayoutAereos(d);
  if (la) for (const fr of la.frentes) out.push({ fr, nombre: nombreModuloEn(d, 'aereos', fr.cuerpo) });
  for (const lado of LADOS) {
    const ll = calcularLayoutAereosLado(d, lado);
    if (ll) for (const fr of ll.frentes) out.push({ fr, nombre: nombreModuloEn(d, lado === 'izq' ? 'aereos-izq' : 'aereos-der', fr.cuerpo) });
  }
  return out;
}

export function advertencias(d: Diseno, unidad: Unidad = 'cm'): Advertencia[] {
  // Una misma advertencia (p. ej. las dos puertas de un módulo) se dice una sola vez.
  const vistas = new Set<string>();
  return advertenciasTodas(d, unidad).filter((a) => !vistas.has(a.texto) && !!vistas.add(a.texto));
}

function advertenciasTodas(d: Diseno, unidad: Unidad): Advertencia[] {
  const out: Advertencia[] = [];
  const f = (mm: number) => formatear(mm, unidad);
  if (d.plantilla === 'tocador') {
    const l = calcularLayoutTocador(d);
    if (l.frentes.some((c) => c.rect.y1 - c.rect.y0 < 90)) out.push({ nivel: 'aviso', texto: `Hay cajones de menos de ${f(90)} de alto: reduce la cantidad de cajones.` });
    return out;
  }
  for (const { fr, nombre } of frentesConNombre(d)) {
    const ancho = fr.rect.x1 - fr.rect.x0;
    const alto = fr.rect.y1 - fr.rect.y0;
    if (fr.tipo === 'puerta' && fr.bisagra === 'arriba') {
      if (ancho > 1000) out.push({ nivel: 'aviso', texto: `La puerta abatible del ${nombre} mide ${f(ancho)} de ancho; sobre ${f(1000)} conviene dividir el módulo.` });
      continue;
    }
    if (fr.tipo === 'puerta' && ancho > 620) out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} mide ${f(ancho)} de ancho; sobre ${f(600)} se recomienda dividirla en 2 puertas.` });
    if (fr.tipo === 'puerta' && ancho < 200) out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} muy angosta (${f(ancho)}).` });
    if (fr.tipo === 'cajon' && !fr.especiero && alto < 90) out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} con frente de ${f(alto)}: el mínimo fabricable es ${f(90)}.` });
    if (fr.tipo === 'cajon' && ancho > 1000) out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} de ${f(ancho)} de ancho: sobre ${f(1000)} conviene dividir en 2 columnas.` });
  }
  if (esCocina(d)) {
    const db = disenoBase(d);
    for (const t of TRAMOS_BASE) {
      cuerposDe(d, t).forEach((c, i) => {
        if (esCocinaAdulta(d) && esCajonera(c) && c.ancho > 900) out.push({ nivel: 'aviso', texto: `La cajonera del ${nombreModuloEn(d, t, i)} mide ${f(c.ancho)}: el máximo es ${f(900)}.` });
      });
    }
    for (const e of d.equipos ?? []) {
      const cs = cuerposDe(d, e.tramo);
      const i = cs.findIndex((c) => c.id === e.modulo);
      const c = cs[i];
      if (!c) continue;
      const nombre = nombreModuloEn(d, e.tramo, i);
      if (e.tipo === 'lavaplatos') {
        const necesita = MODULO_MIN_LAVAPLATOS[e.modelo];
        if (c.ancho < necesita) out.push({ nivel: 'aviso', texto: `El lavaplatos ${NOMBRE_LAVAPLATOS[e.modelo]} necesita un módulo de al menos ${f(necesita)} (el ${nombre} mide ${f(c.ancho)}).` });
        else if (e.posicion !== 'centro' && c.ancho < anchoTotalEquipo(d, e) + e.margen + 15) {
          out.push({ nivel: 'aviso', texto: `El lavaplatos pegado al borde no cabe en el ${nombre} con ${f(e.margen)} de margen.` });
        }
        if (choqueEnModulo(d, e)) {
          out.push({ nivel: 'aviso', texto: `La encimera y el lavaplatos se topan en el mismo módulo (${nombre}): elige módulos distintos o pega el lavaplatos a un borde.` });
        }
      } else {
        const minimo = e.platos === '4' ? 580 : esCocinaAdulta(d) ? 400 : 250;
        if (!cabeEncimera(d, e.tramo, i, e.platos)) out.push({ nivel: 'aviso', texto: `La encimera del ${nombre} queda en la punta y se sale de la cubierta: muévela a un módulo más ancho o más adentro.` });
        else if (c.ancho < minimo) out.push({ nivel: 'info', texto: `La encimera sobresale del ${nombre}; la cubierta igual la soporta.` });
      }
    }
    const la = calcularLayoutAereos(d);
    if (la && la.montaje === 'mural') {
      const libre = la.y0 - d.alto;
      if (libre < 450) out.push({ nivel: 'aviso', texto: `Entre la cubierta y los aéreos quedan ${f(libre)}: se recomiendan al menos ${f(550)}.` });
      const [x0, x1] = extremosPrincipal(d);
      if (hayMuros(d) && (la.x0 < x0 - 1 || la.x1 > x1 + 1)) out.push({ nivel: 'aviso', texto: `Los aéreos pasan del muro de la cocina (${f(x1 - x0)}): acorta sus módulos o cambia la alineación.` });
    }
    // La campana tiene que quedar sobre su encimera y, sin campana, sobre la encimera conviene dejar espacio.
    for (const e of (d.equipos ?? []).filter((x): x is Encimera => x.tipo === 'encimera')) {
      const sb = centroEncimera(db, e);
      if (sb == null) continue;
      const ta = tramoAereoDe(e.tramo);
      if (!aereoVisible(d, ta)) continue;
      const s = posEnTramo(d, ta, posEnMundo(db, e.tramo, sb));
      const pos = posicionesModulos(d, ta);
      const cs = cuerposDe(d, ta);
      const encima = cs.findIndex((_, k) => pos[k].s0 <= s && s <= pos[k].s1);
      const nombreEnc = nombreModuloEn(d, e.tramo, cuerposDe(d, e.tramo).findIndex((c) => c.id === e.modulo));
      if (e.campana) {
        const m = moduloCampana(d, e.id);
        const k = m ? m.indice : -1;
        if (k < 0 || !(pos[k].s0 - 1 <= s && s <= pos[k].s1 + 1)) out.push({ nivel: 'aviso', texto: `La campana de los aéreos no queda sobre la encimera (${nombreEnc}): mueve la encimera para volver a alinearla.` });
      } else if (d.plantilla === 'compacto' && la) {
        // El mueble superior del compacto cubre todo el ancho: sin campana no conviene cocinar a gas bajo él.
        out.push({ nivel: 'aviso', texto: `La encimera a gas queda ${f(la.y0 - la.yCubierta)} bajo el mueble superior y sin campana: no se recomienda cocinar a gas bajo un mueble cerrado.` });
      } else if (encima >= 0 && cs[encima].tipo !== 'hueco') {
        out.push({ nivel: 'info', texto: `Sobre la encimera (${nombreEnc}) conviene una campana o un espacio libre en los aéreos.` });
      }
    }
  }
  const tramosAereos: [TramoAereo, ReturnType<typeof calcularLayoutAereos>][] = [
    ['aereos', calcularLayoutAereos(d)],
    ['aereos-izq', calcularLayoutAereosLado(d, 'izq')],
    ['aereos-der', calcularLayoutAereosLado(d, 'der')],
  ];
  for (const [t, la] of tramosAereos) {
    if (!la) continue;
    // Un microondas chico mide unos 26 cm de alto.
    for (const lc of la.cuerpos) {
      if (lc.nicho && lc.nicho.y1 - lc.nicho.y0 < 260) {
        out.push({
          nivel: 'aviso',
          texto: `El nicho del ${nombreModuloEn(d, t, lc.indice)} queda de ${f(lc.nicho.y1 - lc.nicho.y0)} de alto: un microondas necesita unos ${f(260)}; sube el alto ${d.plantilla === 'compacto' ? 'del mueble superior' : 'de los aéreos'}.`,
        });
      }
    }
  }
  const la = calcularLayoutAereos(d);
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
  const frentes = frentesConNombre(d).map((x) => x.fr);
  return {
    puertas: frentes.filter((f) => f.tipo === 'puerta').length,
    cajones: frentes.filter((f) => f.tipo === 'cajon').length,
  };
}

// ---------- Precio ----------

function superficie(ancho: number, alto: number, prof: number): number {
  return ancho * alto + 2 * prof * alto + ancho * prof;
}

/** Superficie de melamina aproximada de todo el conjunto (tramo principal, lados y aéreos). */
function superficieTotal(d: Diseno): number {
  const alto = d.plantilla === 'compacto' ? d.aereos.elevacion : d.alto;
  let s = superficie(d.ancho, alto, d.profundidad);
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) s += superficie(r.largo, d.alto, r.profundidad);
  }
  const la = calcularLayoutAereos(d);
  if (la) s += superficie(la.x1 - la.x0, la.montaje === 'apoyado' ? la.y1 - la.yCubierta : la.y1 - la.y0, la.profundidad);
  for (const lado of LADOS) {
    const ra = ladoAereoActivo(d, lado);
    if (ra) s += superficie(ra.largo, d.aereos.alto, ra.profundidad);
  }
  return s;
}

/**
 * Precio del diseño. En la cocina (lineal, L o U) es el precio oficial de la tienda
 * (precioCocina). En el resto escala el precio del producto base según la superficie de
 * melamina y suma o resta frentes y equipamiento: es una guía, la cotización final la da la tienda.
 */
export function precioReferencial(d: Diseno, base: ProductoCatalogo | null, disenoBase: Diseno | null): number | null {
  if (d.plantilla === 'cocina') return precioCocina(d).total;
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
    const extra = (x: Diseno) => sumar((x.equipos ?? []).map((e) => (e.tipo !== 'encimera' ? 0 : e.platos === '4' ? 2 : e.platos === '3' ? 1 : 0.6)));
    precio += (extra(d) - extra(disenoBase)) * 45000;
    const lav = (x: Diseno) => sumar((x.equipos ?? []).map((e) => (e.tipo !== 'lavaplatos' ? 0 : e.modelo === 'doble' ? 1.6 : 1)));
    precio += (lav(d) - lav(disenoBase)) * 60000;
    if (d.plantilla === 'compacto') {
      const hornos = (x: Diseno) => x.cuerpos.filter((c) => c.tipo === 'horno').length;
      const campanas = (x: Diseno) => (x.equipos ?? []).filter((e) => e.tipo === 'encimera' && e.campana).length;
      // El compacto no traía horno ni campana: si se agregan, se suman a su valor de tarifa.
      precio += (hornos(d) - hornos(disenoBase)) * TARIFAS.horno + (campanas(d) - campanas(disenoBase)) * TARIFAS.campana;
    }
  }
  if (d.imagenFrontal) precio += 15000;
  precio = Math.max(precioBase * 0.4, precio);
  return Math.round(precio / 1000) * 1000 - 10;
}

const NOMBRE_MODELO_LAVAPLATOS: Record<string, string> = NOMBRE_LAVAPLATOS;

/**
 * Descuento al quitar un equipo de un mueble del catálogo (o pedirlo como solo corte): el mueble
 * conserva el precio de la tienda y se le resta el equipo que no lleva.
 */
export const DESCUENTO_EQUIPO = {
  encimera: { '3': 35000, '4': 55000 } as Record<'3' | '4', number>,
  // El doble no tiene descuento: la tienda no lo informa.
  // Los dobles (también el de pozo doble) no tienen descuento: la tienda no lo informa.
  lavaplatos: { simple: 19000, doble: 0, rinonera: 19000, pozo: 19000, 'pozo-doble': 0 } as Record<'simple' | 'doble' | 'rinonera' | 'pozo' | 'pozo-doble', number>,
  /** Por cada horno que traía el producto y se retira. */
  horno: 120000,
};

/**
 * Las medidas del mueble (ancho, alto, fondo, forma y lados) siguen iguales a las del producto. En la
 * cocina el aéreo no cuenta: se cobra aparte con su tarifa (precioAereo) sobre el precio de la tienda.
 * En los demás muebles (compacto) el mueble superior es parte del mueble y sí cuenta.
 */
export function mismasMedidas(d: Diseno, b: Diseno): boolean {
  const lado = (x: Diseno, l: 'izq' | 'der') => {
    const r = x.lados?.[l];
    return r ? `${r.largo}x${r.profundidad}` : '-';
  };
  const aereo = (x: Diseno) =>
    x.aereos.activo
      ? `${largoTramo(x, 'aereos')}x${x.aereos.alto}x${x.aereos.profundidad}x${x.aereos.elevacion}|${x.aereos.lados?.izq?.largo ?? '-'}|${x.aereos.lados?.der?.largo ?? '-'}`
      : '-';
  return (
    d.ancho === b.ancho &&
    d.alto === b.alto &&
    d.profundidad === b.profundidad &&
    lado(d, 'izq') === lado(b, 'izq') &&
    lado(d, 'der') === lado(b, 'der') &&
    (d.plantilla === 'cocina' || aereo(d) === aereo(b))
  );
}

/**
 * Mueble del catálogo (cualquier plantilla) con sus medidas de la tienda: vale el precio de la tienda menos las
 * encimeras y lavaplatos que se quitaron o que van como solo corte (y más los que se agregaron,
 * a tarifa). Cambiar módulos, colores o tiradores no cambia el precio. null si cambiaron las
 * medidas: entonces rige el precio por metro lineal (cocina) o el referencial (el resto).
 */
function precioTiendaConDescuentos(d: Diseno, base: ProductoCatalogo | null, disenoBase: Diseno | null): { total: number; metodo: 'oficial'; lineas: LineaPrecio[] } | null {
  if (!base || !disenoBase || disenoBase.plantilla !== d.plantilla) return null;
  const precioBase = base.precio_oferta ?? base.precio;
  if (!precioBase || !mismasMedidas(d, disenoBase)) return null;
  // En las cocinas, pasar una encimera de 3 a 4 hornillas (o agregar una de 4) vuelve el mueble
  // especial: se calcula por metro con el fondo de 60 cm. Cambiar el modelo de lavaplatos no.
  const de4 = (x: Diseno) => (x.equipos ?? []).filter((e) => e.tipo === 'encimera' && (e as Encimera).platos === '4').length;
  if (d.plantilla === 'cocina' && de4(d) > de4(disenoBase)) return null;
  const linea = (concepto: string, cantidad: number, unitario: number, detalle: string): LineaPrecio => ({ concepto, detalle, cantidad, unidad: 'unidad', unitario, valor: cantidad * unitario });
  const lineas: LineaPrecio[] = [linea('Precio de la tienda', 1, precioBase, base.nombre)];
  let total = precioBase;
  // Cambiar un equipo por otro modelo (lavaplatos simple por riñonera, encimera de 3 por 4 platos)
  // no cambia el precio: solo se descuenta el equipo que se saca o queda como solo corte, y se
  // suma a tarifa el que se agrega de más.
  type Clase = { nombre: (e: Equipo) => string; f: (e: Equipo) => boolean; descuento: (e: Equipo) => number; tarifa: (e: Equipo) => number; agregado: string };
  const clases: Clase[] = [
    {
      f: (e) => e.tipo === 'encimera',
      nombre: (e) => `encimera ${(e as Encimera).platos === '4' ? 4 : 3} platos`,
      descuento: (e) => DESCUENTO_EQUIPO.encimera[(e as Encimera).platos === '4' ? '4' : '3'],
      tarifa: (e) => TARIFAS.encimera[(e as Encimera).platos === '4' ? '4' : '3'],
      agregado: 'agregada',
    },
    {
      f: (e) => e.tipo === 'lavaplatos',
      nombre: (e) => `lavaplatos ${NOMBRE_MODELO_LAVAPLATOS[(e as Lavaplatos).modelo] ?? (e as Lavaplatos).modelo}`,
      descuento: (e) => DESCUENTO_EQUIPO.lavaplatos[(e as Lavaplatos).modelo as keyof typeof DESCUENTO_EQUIPO.lavaplatos] ?? DESCUENTO_EQUIPO.lavaplatos.simple,
      tarifa: (e) => TARIFAS.lavaplatos[(e as Lavaplatos).modelo as keyof typeof TARIFAS.lavaplatos] ?? TARIFAS.lavaplatos.simple,
      agregado: 'agregado',
    },
  ];
  const activos = (x: Diseno, c: Clase) => (x.equipos ?? []).filter((e) => !(e as { soloCorte?: boolean }).soloCorte && c.f(e));
  for (const c of clases) {
    const antes = activos(disenoBase, c);
    const ahora = activos(d, c);
    // Se descuentan los del producto que ya no están (por su modelo original).
    for (const e of antes.slice(ahora.length)) {
      const v = c.descuento(e);
      lineas.push(linea(`Sin ${c.nombre(e)}`, 1, -v, `−${formatoPrecio(v)}`));
      total -= v;
    }
    for (const e of ahora.slice(antes.length)) {
      const v = c.tarifa(e);
      const nombre = c.nombre(e);
      lineas.push(linea(`${nombre[0].toUpperCase()}${nombre.slice(1)} ${c.agregado}`, 1, v, formatoPrecio(v)));
      total += v;
    }
  }
  // Campanas agregadas sobre las del producto, a tarifa; las que se quitan no se descuentan.
  const campanas = (x: Diseno) => (x.equipos ?? []).filter((e) => e.tipo === 'encimera' && e.campana).length;
  const extraCampanas = campanas(d) - campanas(disenoBase);
  for (let k = 0; k < extraCampanas; k++) {
    lineas.push(linea('Campana agregada', 1, TARIFAS.campana, formatoPrecio(TARIFAS.campana)));
    total += TARIFAS.campana;
  }
  // Hornos: los que se retiran descuentan DESCUENTO_EQUIPO.horno; los agregados se suman a tarifa.
  const hornos = contarModulos(d, 'horno') - contarModulos(disenoBase, 'horno');
  for (let k = 0; k < -hornos; k++) {
    lineas.push(linea('Sin horno eléctrico', 1, -DESCUENTO_EQUIPO.horno, `−${formatoPrecio(DESCUENTO_EQUIPO.horno)}`));
    total -= DESCUENTO_EQUIPO.horno;
  }
  for (let k = 0; k < hornos; k++) {
    lineas.push(linea(`${NOMBRE_HORNO} agregado`, 1, TARIFAS.horno, formatoPrecio(TARIFAS.horno)));
    total += TARIFAS.horno;
  }
  // Especieros agregados y opciones nuevas (cierre suave, sin manilla): se suman al precio de la tienda.
  for (const l of lineasOpciones(d, disenoBase)) {
    lineas.push(l);
    total += l.valor;
  }
  // Aéreo de la cocina: se cobra aparte con su tarifa. Si el producto ya lo traía, solo se suma la
  // diferencia cuando el nuevo vale más (no se descuenta el aéreo incluido salvo que se apague).
  if (d.plantilla === 'cocina') {
    const ahora = precioAereo(d);
    const antes = precioAereo(disenoBase);
    if (ahora && !antes) {
      lineas.push(...ahora.lineas);
      total += ahora.valor;
    } else if (ahora && antes && ahora.valor > antes.valor) {
      const v = ahora.valor - antes.valor;
      lineas.push(linea('Aéreo: diferencia sobre el incluido', 1, v, `${ahora.lineas.map((l) => l.detalle).join('; ')} (${formatoPrecio(ahora.valor)} − ${formatoPrecio(antes.valor)} incluido)`));
      total += v;
    } else if (!ahora && antes) {
      lineas.push(linea('Sin mueble aéreo', 1, -antes.valor, `−${formatoPrecio(antes.valor)}`));
      total -= antes.valor;
    }
  }
  return { total: Math.max(0, total), metodo: 'oficial', lineas };
}

/** Precio con su método y, en la cocina, el desglose oficial para mostrar al vendedor. */
export function precioDiseno(
  d: Diseno,
  base: ProductoCatalogo | null,
  disenoBase: Diseno | null,
): { total: number; metodo: 'oficial' | 'referencial'; lineas: LineaPrecio[] } | null {
  const tienda = precioTiendaConDescuentos(d, base, disenoBase);
  if (tienda) return tienda;
  if (d.plantilla === 'cocina') {
    const p = precioCocina(d);
    return { total: p.total, metodo: 'oficial', lineas: p.lineas };
  }
  const total = precioReferencial(d, base, disenoBase);
  return total == null ? null : { total, metodo: 'referencial', lineas: [] };
}

/** Clave estable de cada línea del desglose (concepto + detalle; las repetidas llevan #n). */
export function clavesLineas(lineas: LineaPrecio[]): string[] {
  const vistos = new Map<string, number>();
  return lineas.map((l) => {
    const base = `${l.concepto}|${l.detalle}`;
    const n = vistos.get(base) ?? 0;
    vistos.set(base, n + 1);
    return n ? `${base}#${n + 1}` : base;
  });
}

export interface LineaAjustada extends LineaPrecio {
  clave: string;
  calculado: number;
  editado: boolean;
}

export interface PrecioAjustado {
  total: number;
  /** Total sin las correcciones del vendedor. */
  totalCalculado: number;
  metodo: 'oficial' | 'referencial';
  lineas: LineaAjustada[];
  extras: AjustesPrecio['extras'];
  ajustado: boolean;
}

/**
 * Aplica al precio calculado las correcciones del vendedor: valores editados por línea
 * (las claves que ya no existen se ignoran) y ajustes libres. El total es la suma de las
 * líneas (o el total calculado si no hay desglose) más los ajustes, nunca negativo.
 */
export function aplicarAjustes(
  precio: { total: number; metodo: 'oficial' | 'referencial'; lineas: LineaPrecio[] } | null,
  ajustes: AjustesPrecio | undefined,
): PrecioAjustado | null {
  if (!precio) return null;
  const claves = clavesLineas(precio.lineas);
  const valores = ajustes?.valores ?? {};
  const lineas: LineaAjustada[] = precio.lineas.map((l, i) => {
    const v = valores[claves[i]];
    const editado = typeof v === 'number' && Number.isFinite(v) && v !== l.valor;
    return { ...l, clave: claves[i], calculado: l.valor, valor: editado ? v : l.valor, editado };
  });
  const extras = ajustes?.extras ?? [];
  const delta = sumar(lineas.map((l) => l.valor - l.calculado)) + sumar(extras.map((e) => e.valor));
  const total = Math.max(0, Math.round(precio.total + delta));
  return { total, totalCalculado: precio.total, metodo: precio.metodo, lineas, extras, ajustado: lineas.some((l) => l.editado) || extras.length > 0 };
}

/** Quita las correcciones de líneas que ya no están en el desglose; null si no queda nada. */
export function limpiarAjustes(ajustes: AjustesPrecio | undefined, lineas: LineaPrecio[]): AjustesPrecio | undefined {
  if (!ajustes) return undefined;
  const claves = new Set(clavesLineas(lineas));
  const valores = Object.fromEntries(Object.entries(ajustes.valores).filter(([k]) => claves.has(k)));
  if (!Object.keys(valores).length && !ajustes.extras.length) return undefined;
  return { valores, extras: ajustes.extras };
}

/** Acepta ajustes guardados (o ausentes) y descarta lo que no sea válido. */
export function normalizarAjustes(x: unknown): AjustesPrecio | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as { valores?: unknown; extras?: unknown };
  const valores: Record<string, number> = {};
  if (o.valores && typeof o.valores === 'object')
    for (const [k, v] of Object.entries(o.valores as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) valores[k] = Math.round(v);
  const extras = Array.isArray(o.extras)
    ? o.extras
        .filter((e): e is { id?: unknown; concepto?: unknown; valor: number } => !!e && typeof e === 'object' && typeof (e as { valor?: unknown }).valor === 'number' && Number.isFinite((e as { valor: number }).valor))
        .map((e) => ({ id: typeof e.id === 'string' && e.id ? e.id : nuevoId(), concepto: typeof e.concepto === 'string' ? e.concepto : 'Ajuste', valor: Math.round(e.valor) }))
    : [];
  if (!Object.keys(valores).length && !extras.length) return undefined;
  return { valores, extras };
}

export function formatoPrecio(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? '\u2212$' : '$') + Math.abs(r).toLocaleString('es-CL');
}
