// Equipamiento de cocina: dónde puede ir cada equipo, cómo se reubica cuando su
// módulo cambia o desaparece, el listado para la interfaz y la alineación
// central de las campanas sobre sus encimeras.
import { cuerpo as nuevoCuerpo } from './catalogo';
import {
  centroEncimera,
  centroLavaplatos,
  disenoBase,
  esTramoAereo,
  extremosPrincipal,
  inicioAereoPrincipal,
  ladoAereoActivo,
  largoEje,
  ladoDeTramo,
  MARGEN_MIN_LAVAPLATOS,
  MEDIDAS_EQUIPO,
  MODULO_MIN_LAVAPLATOS,
  posEnMundo,
  posEnTramo,
  posicionesModulos,
  tramoAereoDe,
} from './layout';
import { repartirConLimites, type Limite } from './reparto';
import { ANCHO_CAMPANA, ANCHO_MIN_CUERPO, ANCHO_MIN_HUECO, cuerposDe, esCajonera, ladoDe, LIMITES_AEREOS, limitesModulo, resolverTramo, TRAMOS_AEREOS, TRAMOS_BASE } from './tramos';
import type { Cuerpo, Diseno, Encimera, Equipo, Lavaplatos, Plantilla, TramoAereo, TramoBase, TramoId } from './tipos';

/** Mensajes informativos que juntan las operaciones (se devuelven en Resultado.avisos). */
export interface Ctx {
  avisos: string[];
}

export type TipoEquipo = 'encimera' | 'lavaplatos';

/** Muebles que llevan equipamiento de cocina. */
export function llevaEquipamiento(p: Plantilla): boolean {
  return p === 'cocina' || p === 'compacto' || p === 'cocina-infantil';
}

/** Cocina de adulto: encimera de 3 o 4 platos, lavaplatos simple o doble, campana y horno de 60 cm. */
export function esAdulta(p: Plantilla): boolean {
  return p === 'cocina' || p === 'compacto';
}

/** Opciones de equipamiento que ofrece cada mueble. */
export function opcionesEquipo(p: Plantilla): {
  platos: Encimera['platos'][];
  lavaplatos: Lavaplatos['modelo'][];
  campana: boolean;
  horno: boolean;
  llave: boolean;
} {
  if (p === 'cocina-infantil') return { platos: ['2', '3', '4'], lavaplatos: ['simple'], campana: false, horno: false, llave: false };
  if (esAdulta(p)) return { platos: ['3', '4'], lavaplatos: ['simple', 'doble'], campana: true, horno: true, llave: true };
  return { platos: [], lavaplatos: [], campana: false, horno: false, llave: false };
}

const NOMBRE_TRAMO: Record<TramoId, string> = {
  base: 'tramo principal',
  izq: 'lado izquierdo',
  der: 'lado derecho',
  aereos: 'aéreos',
  'aereos-izq': 'aéreo del lado izquierdo',
  'aereos-der': 'aéreo del lado derecho',
};

/** Nombre de un tramo para mostrar ("Tramo principal", "Lado izquierdo", "Mueble superior"…). */
export function nombreTramo(d: Diseno, t: TramoId): string {
  if (t === 'base') return d.plantilla === 'compacto' ? 'Mueble base' : 'Tramo principal';
  if (t === 'aereos') return d.plantilla === 'compacto' ? 'Mueble superior' : 'Aéreos';
  const n = NOMBRE_TRAMO[t];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Cómo se nombra un módulo en avisos y fichas: «módulo 2», «módulo 1 del lado derecho», «aéreo 3», «mueble superior 2». */
export function nombreModuloEn(d: Diseno, t: TramoId, i: number): string {
  const n = i + 1;
  if (t === 'base') return `módulo ${n}`;
  if (t === 'izq' || t === 'der') return `módulo ${n} del ${NOMBRE_TRAMO[t]}`;
  if (t === 'aereos') return d.plantilla === 'compacto' ? `mueble superior ${n}` : `aéreo ${n}`;
  return `aéreo ${n} del ${t === 'aereos-izq' ? 'lado izquierdo' : 'lado derecho'}`;
}

/** Si un módulo puede llevar ese equipo (encimera sobre frentes u horno; lavaplatos sobre frentes). */
export function puedeLlevar(d: Diseno, tipo: TipoEquipo, t: TramoBase, c: Cuerpo, i: number): boolean {
  if (!llevaEquipamiento(d.plantilla)) return false;
  // En la cocina infantil la despensa alta no lleva cubierta.
  if (d.plantilla === 'cocina-infantil' && t === 'base' && i === 0) return false;
  return tipo === 'encimera' ? c.tipo === 'frentes' || c.tipo === 'horno' : c.tipo === 'frentes';
}

/**
 * Si la encimera de una cocina adulta cabe sobre el módulo sin salirse de la cubierta: su
 * centro va sobre el módulo y a no menos de 30 cm de cada punta (lo que pide la campana).
 * Un módulo muy angosto en la punta del tramo no la puede llevar.
 */
export function cabeEncimera(d: Diseno, t: TramoBase, i: number): boolean {
  if (!esAdulta(d.plantilla)) return true;
  const db = disenoBase(d);
  const pos = posicionesModulos(db, t)[i];
  if (!pos) return false;
  const L = largoEje(db, t);
  const media = Math.max(MEDIDAS_EQUIPO.encimera['4'].ancho, MEDIDAS_EQUIPO.campana.ancho) / 2;
  return Math.max(pos.s0, media) <= Math.min(pos.s1, L - media) + 0.5;
}

/** Equipo del mismo tipo que ya ocupa ese módulo (sin contar `excepto`). */
function ocupado(d: Diseno, tipo: TipoEquipo, t: TramoBase, modulo: string, excepto?: string): boolean {
  return (d.equipos ?? []).some((e) => e.tipo === tipo && e.tramo === t && e.modulo === modulo && e.id !== excepto);
}

/** Motivo por el que un equipo no puede ir en un módulo (null si puede). */
export function motivoNoPuedeIr(d: Diseno, tipo: TipoEquipo, t: TramoBase, i: number, excepto?: string): string | null {
  const c = cuerposDe(d, t)[i];
  if (!c) return 'Ese módulo no existe.';
  const nombre = nombreModuloEn(d, t, i);
  if (d.plantilla === 'cocina-infantil' && t === 'base' && i === 0) return 'La despensa alta no lleva cubierta.';
  if (tipo === 'encimera' && (c.tipo === 'frentes' || c.tipo === 'horno') && !cabeEncimera(d, t, i)) {
    return `La encimera no cabe en el ${nombre} (${Math.round(c.ancho / 10)} cm): está en la punta y se saldría de la cubierta, que necesita 30 cm desde el borde. Elige un módulo más ancho o más adentro.`;
  }
  if (!puedeLlevar(d, tipo, t, c, i)) {
    const que = tipo === 'encimera' ? 'La encimera' : 'El lavaplatos';
    const donde = tipo === 'encimera' ? 'un módulo de puertas, cajones u horno' : 'un módulo de puertas o cajones';
    return `${que} va sobre ${donde}: el ${nombre} es ${c.tipo === 'hueco' ? 'un espacio libre' : c.tipo === 'especiero' ? 'el especiero' : c.tipo === 'horno' ? 'el horno' : 'otro tipo de módulo'}.`;
  }
  if (ocupado(d, tipo, t, c.id, excepto)) return `El ${nombre} ya tiene ${tipo === 'encimera' ? 'una encimera' : 'un lavaplatos'}.`;
  return null;
}

/**
 * Mejor módulo para un equipo: el más cercano a `cerca` (si se da) en los tramos
 * indicados; la encimera prefiere un horno y ambos evitan el módulo del otro equipo.
 * Sin `cerca` se elige el más ancho (el lavaplatos, lejos de la encimera).
 */
export function elegirAnfitrion(
  d: Diseno,
  tipo: TipoEquipo,
  tramos: TramoBase[],
  cerca: { tramo: TramoBase; indice: number } | null,
  excepto?: string,
  modelo: Lavaplatos['modelo'] = 'simple',
): { tramo: TramoBase; modulo: string; indice: number } | null {
  let mejor: { tramo: TramoBase; modulo: string; indice: number; puntaje: number } | null = null;
  const otro: TipoEquipo = tipo === 'encimera' ? 'lavaplatos' : 'encimera';
  const adulta = esAdulta(d.plantilla);
  tramos.forEach((t, orden) => {
    if (!resolverTramo(d, t)) return;
    const cs = cuerposDe(d, t);
    cs.forEach((c, i) => {
      if (!puedeLlevar(d, tipo, t, c, i) || ocupado(d, tipo, t, c.id, excepto)) return;
      let puntaje = orden * 1000;
      if (cerca) puntaje += cerca.tramo === t ? Math.abs(i - cerca.indice) : 500;
      else puntaje -= c.ancho / 100;
      if (tipo === 'encimera' && c.tipo !== 'horno') puntaje += 100;
      // Se prefieren módulos donde el equipo cabe: el lavaplatos sobre puertas (no sobre
      // cajones) y con el ancho que pide su cubeta; la encimera sobre un módulo de su ancho.
      if (adulta && tipo === 'lavaplatos' && c.ancho < MODULO_MIN_LAVAPLATOS[modelo]) puntaje += 200;
      if (tipo === 'lavaplatos' && esCajonera(c)) puntaje += 40;
      if (adulta && tipo === 'encimera' && c.tipo !== 'horno' && c.ancho < MEDIDAS_EQUIPO.encimera['4'].ancho) puntaje += 60;
      if (tipo === 'encimera' && !cabeEncimera(d, t, i)) puntaje += 400;
      if (ocupado(d, otro, t, c.id)) puntaje += 300;
      if (!cerca && tipo === 'lavaplatos') {
        // Sin preferencia: lejos de la encimera del mismo tramo.
        const enc = (d.equipos ?? []).find((e) => e.tipo === 'encimera' && e.tramo === t);
        const ie = enc ? cs.findIndex((x) => x.id === enc.modulo) : -1;
        if (ie >= 0) puntaje -= Math.abs(i - ie) * 2;
      }
      if (!mejor || puntaje < mejor.puntaje) mejor = { tramo: t, modulo: c.id, indice: i, puntaje };
    });
  });
  if (!mejor) return null;
  const { tramo, modulo, indice } = mejor;
  return { tramo, modulo, indice };
}

/** Margen máximo (mm) del lavaplatos pegado a un borde dentro de su módulo. */
export function margenMaximo(c: Cuerpo, l: Lavaplatos): number {
  return Math.max(MARGEN_MIN_LAVAPLATOS, c.ancho - MEDIDAS_EQUIPO.lavaplatos[l.modelo].ancho - 15);
}

/**
 * Si un equipo choca con el otro equipo de su mismo módulo (encimera y lavaplatos juntos en
 * un módulo que no da para los dos), el motivo; null si caben o está solo.
 */
export function choqueEnModulo(d: Diseno, e: Equipo): string | null {
  const otro = (d.equipos ?? []).find((x) => x.id !== e.id && x.tipo !== e.tipo && x.tramo === e.tramo && x.modulo === e.modulo);
  if (!otro) return null;
  const db = disenoBase(d);
  const tramo = (x: Equipo) => {
    const s = x.tipo === 'encimera' ? centroEncimera(db, x) : centroLavaplatos(db, x);
    const w = x.tipo === 'encimera' ? MEDIDAS_EQUIPO.encimera[x.platos].ancho : MEDIDAS_EQUIPO.lavaplatos[x.modelo].ancho;
    return s == null ? null : [s - w / 2, s + w / 2];
  };
  const a = tramo(e);
  const b = tramo(otro);
  if (!a || !b || a[1] <= b[0] || b[1] <= a[0]) return null;
  const cs = cuerposDe(d, e.tramo);
  const i = cs.findIndex((c) => c.id === e.modulo);
  return `La encimera y el lavaplatos no caben juntos en el ${nombreModuloEn(d, e.tramo, i)} (${Math.round(cs[i].ancho / 10)} cm): se toparían. Elige otro módulo o pega el lavaplatos a un borde de un módulo más ancho.`;
}

function nombreEquipo(e: Equipo): string {
  return e.tipo === 'encimera' ? `La encimera de ${e.platos} platos` : `El lavaplatos ${e.modelo}`;
}

/**
 * Deja cada equipo sobre un módulo válido de un tramo que existe: si su módulo ya no
 * sirve (se quitó, cambió de tipo, se quitó el lado) pasa al más cercano que sirva; si
 * no hay ninguno se quita y se avisa. También limpia sus opciones.
 */
export function repararEquipos(d: Diseno, ctx: Ctx, cerca: Map<string, { tramo: TramoBase; indice: number }> = new Map()) {
  if (!llevaEquipamiento(d.plantilla)) {
    d.equipos = [];
    return;
  }
  const adulta = esAdulta(d.plantilla);
  const quedan: Equipo[] = [];
  const original = d.equipos ?? [];
  d.equipos = quedan;
  for (const e0 of original) {
    const e = { ...e0 } as Equipo;
    if (e.tipo === 'encimera') {
      if (adulta && e.platos === '2') e.platos = '3';
      if (!['2', '3', '4'].includes(e.platos)) e.platos = adulta ? '4' : '2';
      e.campana = adulta && e.campana === true;
    } else {
      if (!adulta) e.modelo = 'simple';
      if (e.modelo !== 'doble') e.modelo = 'simple';
      // La llave es de la cocina adulta (la grifería de la infantil es de juguete y no se cobra).
      e.llave = adulta && e.llave !== false;
      if (e.posicion !== 'izq' && e.posicion !== 'der') e.posicion = 'centro';
      e.margen = Math.max(MARGEN_MIN_LAVAPLATOS, Math.round(Number.isFinite(e.margen) ? e.margen : MARGEN_MIN_LAVAPLATOS));
    }
    const t = (TRAMOS_BASE as string[]).includes(e.tramo) && resolverTramo(d, e.tramo) ? e.tramo : null;
    const cs = t ? cuerposDe(d, t) : [];
    const i = cs.findIndex((c) => c.id === e.modulo);
    const valido = t && i >= 0 && puedeLlevar(d, e.tipo, t, cs[i], i) && !ocupado(d, e.tipo, t, e.modulo);
    if (!valido) {
      const ref = cerca.get(e.id) ?? (t && i >= 0 ? { tramo: t, indice: i } : { tramo: t ?? 'base', indice: 0 });
      const tramos: TramoBase[] = [ref.tramo, ...TRAMOS_BASE.filter((x) => x !== ref.tramo)];
      const nuevo = elegirAnfitrion(d, e.tipo, tramos, ref, e.id, e.tipo === 'lavaplatos' ? e.modelo : 'simple');
      if (!nuevo) {
        ctx.avisos.push(`${nombreEquipo(e)} se quitó: no queda un módulo donde ponerlo.`);
        continue;
      }
      e.tramo = nuevo.tramo;
      e.modulo = nuevo.modulo;
      if (original.some((x) => x.id === e.id && x.modulo !== nuevo.modulo)) {
        ctx.avisos.push(`${nombreEquipo(e)} pasó al ${nombreModuloEn(d, nuevo.tramo, nuevo.indice)}.`);
      }
    }
    if (e.tipo === 'lavaplatos') {
      const c = cuerposDe(d, e.tramo).find((x) => x.id === e.modulo)!;
      e.margen = Math.min(e.margen, margenMaximo(c, e));
    }
    quedan.push(e);
  }
}

// ---------- Listado para la interfaz y el asistente ----------

export interface ItemEquipo {
  /** Id para quitar, mover o configurar: el equipo, el módulo del horno, `<encimera>:campana` o `<lavaplatos>:llave`. */
  id: string;
  tipo: 'encimera' | 'lavaplatos' | 'llave' | 'campana' | 'horno';
  nombre: string;
  tramo: TramoId;
  indice: number;
  modulo: string;
  /** Dónde está, en palabras: «módulo 1 del lado derecho». */
  donde: string;
  detalle: string;
  /** La llave pertenece a un lavaplatos y la campana a una encimera. */
  de?: string;
}

/** Todo el equipamiento del diseño con su ubicación (en el orden de los tramos). */
export function listarEquipamiento(d: Diseno): ItemEquipo[] {
  const out: ItemEquipo[] = [];
  if (!llevaEquipamiento(d.plantilla)) return out;
  for (const t of TRAMOS_BASE) {
    if (!resolverTramo(d, t)) continue;
    cuerposDe(d, t).forEach((c, i) => {
      if (c.tipo !== 'horno' || !esAdulta(d.plantilla)) return;
      out.push({ id: c.id, tipo: 'horno', nombre: 'Horno eléctrico 58 L', tramo: t, indice: i, modulo: c.id, donde: nombreModuloEn(d, t, i), detalle: 'empotrado en un módulo de 60 cm' });
    });
  }
  for (const e of d.equipos ?? []) {
    const i = cuerposDe(d, e.tramo).findIndex((c) => c.id === e.modulo);
    if (i < 0) continue;
    const donde = nombreModuloEn(d, e.tramo, i);
    if (e.tipo === 'encimera') {
      out.push({ id: e.id, tipo: 'encimera', nombre: `Encimera ${e.platos} platos`, tramo: e.tramo, indice: i, modulo: e.modulo, donde, detalle: 'centrada en su módulo' });
      if (e.campana) {
        const ta = tramoAereoDe(e.tramo);
        const ia = cuerposDe(d, ta).findIndex((c) => c.tipo === 'campana' && c.campanaDe === e.id);
        const enAereo = ia >= 0 && d.aereos.activo && (ta === 'aereos' || !!ladoAereoActivo(d, ladoDeTramo(ta)!));
        out.push({
          id: `${e.id}:campana`,
          tipo: 'campana',
          nombre: 'Campana',
          tramo: enAereo ? ta : e.tramo,
          indice: enAereo ? ia : i,
          modulo: enAereo ? cuerposDe(d, ta)[ia].id : e.modulo,
          donde: enAereo ? nombreModuloEn(d, ta, ia) : donde,
          detalle: enAereo ? `sobre la encimera del ${donde}` : `mural, sobre la encimera del ${donde}`,
          de: e.id,
        });
      }
    } else {
      const pos = e.posicion === 'centro' ? 'centrado en su módulo' : `pegado al borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} a ${e.margen / 10} cm`;
      out.push({ id: e.id, tipo: 'lavaplatos', nombre: `Lavaplatos ${e.modelo}`, tramo: e.tramo, indice: i, modulo: e.modulo, donde, detalle: pos });
      if (e.llave) out.push({ id: `${e.id}:llave`, tipo: 'llave', nombre: 'Llave', tramo: e.tramo, indice: i, modulo: e.modulo, donde, detalle: 'con el lavaplatos', de: e.id });
    }
  }
  return out;
}

// ---------- Campanas ----------

function moduloPuertas(c: Cuerpo) {
  c.tipo = 'frentes';
  c.puertas = c.ancho >= 600 ? 2 : 1;
  c.abatible = false;
  c.repisas = Math.max(1, c.repisas);
  delete c.campanaDe;
}

function relleno(ancho: number): Cuerpo {
  return nuevoCuerpo({ ancho, puertas: ancho >= 600 ? 2 : 1, bisagra: 'der', repisas: 1 });
}

/** Si el tramo aéreo existe y se dibuja. */
export function aereoVisible(d: Diseno, t: TramoAereo): boolean {
  if (!d.aereos.activo || !cuerposDe(d, t).length) return false;
  return t === 'aereos' || !!ladoAereoActivo(d, ladoDeTramo(t)!);
}

/**
 * Coloca los módulos "pin" (campanas) centrados en su objetivo y llena los huecos
 * de antes, entre y después con los demás módulos, sin cambiar el largo total L.
 */
function acomodarConPines(d: Diseno, t: TramoAereo, cs: Cuerpo[], L: number, objetivos: Map<string, number>, ctx: Ctx, conflictos: Set<string>): Cuerpo[] {
  const lim = (c: Cuerpo): Limite => limitesModulo(d, t, c);
  const centro = new Map<string, number>();
  let cursor = 0;
  for (const c of cs) {
    centro.set(c.id, cursor + c.ancho / 2);
    cursor += c.ancho;
  }
  let pines = cs
    .filter((c) => objetivos.has(c.id))
    // El ancho base del módulo de campana es siempre el de la campana: así su posición depende solo
    // de la encimera y el resultado no cambia al volver a alinear.
    .map((c) => ({ c, t: objetivos.get(c.id)!, w: Math.min(L, ANCHO_CAMPANA), x0: 0 }))
    .sort((a, b) => a.t - b.t);
  // Si las campanas no caben todas, las que sobran se informan como conflicto.
  while (pines.reduce((s, p) => s + p.w, 0) > L && pines.length) conflictos.add(pines.pop()!.c.id);
  for (const p of pines) p.x0 = Math.round(Math.max(0, Math.min(L - p.w, p.t - p.w / 2)));
  const ideal = new Map(pines.map((p) => [p, p.x0]));
  for (let j = 1; j < pines.length; j++) pines[j].x0 = Math.max(pines[j].x0, pines[j - 1].x0 + pines[j - 1].w);
  for (let j = pines.length - 1; j >= 0; j--) {
    const tope = j === pines.length - 1 ? L : pines[j + 1].x0;
    if (pines[j].x0 + pines[j].w > tope) pines[j].x0 = tope - pines[j].w;
  }
  // Dos campanas que se topan no pueden quedar las dos centradas sobre su encimera: si una
  // tuvo que correrse por la otra, hay conflicto.
  for (const p of pines) if (Math.abs(p.x0 - ideal.get(p)!) > 0.5) conflictos.add(p.c.id);
  const libres = cs.filter((c) => !pines.some((p) => p.c === c));
  const huecos = () => {
    const out: { a: number; b: number }[] = [];
    let prev = 0;
    for (const p of pines) {
      out.push({ a: prev, b: p.x0 });
      prev = p.x0 + p.w;
    }
    out.push({ a: prev, b: L });
    return out;
  };
  const grupos: Cuerpo[][] = huecos().map(() => []);
  for (const c of libres) {
    const k = pines.filter((p) => p.x0 + p.w / 2 < centro.get(c.id)!).length;
    grupos[k].push(c);
  }
  const minimo = (g: Cuerpo[]) => g.reduce((s, c) => s + lim(c).min, 0);
  // Un hueco que no alcanza para sus módulos los pasa al vecino con más espacio.
  for (let vuelta = 0; vuelta < cs.length * 4 + 4; vuelta++) {
    const hs = huecos();
    const k = grupos.findIndex((g, j) => minimo(g) > hs[j].b - hs[j].a);
    if (k < 0) break;
    const libreEn = (j: number) => (j < 0 || j >= grupos.length ? -Infinity : hs[j].b - hs[j].a - minimo(grupos[j]));
    const g = grupos[k];
    // Holgura que le queda al vecino después de recibir el módulo de esa punta.
    const izq = libreEn(k - 1) - lim(g[0]).min;
    const der = libreEn(k + 1) - lim(g[g.length - 1]).min;
    if (izq < 0 && der < 0) {
      // Sin vecino: se quita el módulo más chico del hueco.
      const menor = g.reduce((a, b) => (lim(b).min < lim(a).min ? b : a));
      g.splice(g.indexOf(menor), 1);
      ctx.avisos.push('Se quitó un aéreo para dejar la campana sobre la encimera.');
    } else if (der >= izq) grupos[k + 1].unshift(g.pop()!);
    else grupos[k - 1].push(g.shift()!);
  }
  // Huecos vacíos: se rellenan con un módulo de puertas o, si son muy chicos, los cierra el módulo
  // de campana vecino (queda más ancho y la campana sigue centrada sobre la encimera).
  for (let k = 0; k < grupos.length; k++) {
    const hs = huecos();
    const largo = hs[k].b - hs[k].a;
    if (grupos[k].length || largo <= 0) continue;
    if (largo >= ANCHO_MIN_CUERPO) {
      grupos[k].push(relleno(largo));
      continue;
    }
    if (k === 0) {
      pines[0].w += pines[0].x0;
      pines[0].x0 = 0;
    } else pines[k - 1].w += largo;
  }
  const hs = huecos();
  const out: Cuerpo[] = [];
  grupos.forEach((g, k) => {
    const largo = hs[k].b - hs[k].a;
    if (g.length) {
      const actual = g.reduce((s, c) => s + c.ancho, 0);
      if (actual !== largo) {
        const anchos = repartirConLimites(
          g.map((c) => c.ancho),
          largo,
          g.map((c) => ({ min: c.tipo === 'hueco' ? ANCHO_MIN_HUECO : lim(c).min, max: Infinity })),
        );
        if (anchos) g.forEach((c, j) => (c.ancho = anchos[j]));
      }
      out.push(...g);
    } else if (largo > 0 && k < pines.length) pines[k].w += largo;
    else if (largo > 0 && k > 0) pines[k - 1].w += largo;
    if (k < pines.length) {
      pines[k].c.ancho = pines[k].w;
      out.push(pines[k].c);
    }
  });
  return out;
}

/** Centro (s, a lo largo del tramo aéreo `ta`) que le corresponde a la campana de una encimera. */
export function centroCampanaEn(d: Diseno, ta: TramoAereo, e: Encimera): number | null {
  const db = disenoBase(d);
  const sb = centroEncimera(db, e);
  return sb == null ? null : posEnTramo(d, ta, posEnMundo(db, e.tramo, sb));
}

/**
 * Cómo queda la campana respecto del aéreo de su lado: dentro (va alojada en un módulo de
 * campana), fuera (mural, sin tocar el aéreo) o parcial (el aéreo termina justo sobre ella).
 */
export function coberturaCampana(d: Diseno, ta: TramoAereo, e: Encimera): { s: number; L: number; estado: 'dentro' | 'fuera' | 'parcial' } | null {
  if (!aereoVisible(d, ta)) return null;
  const s = centroCampanaEn(d, ta, e);
  if (s == null) return null;
  const L = cuerposDe(d, ta).reduce((x, c) => x + c.ancho, 0);
  const h = ANCHO_CAMPANA / 2;
  if (s + h <= TOL_CAMPANA || s - h >= L - TOL_CAMPANA) return { s, L, estado: 'fuera' };
  if (s - h >= -TOL_CAMPANA && s + h <= L + TOL_CAMPANA) return { s, L, estado: 'dentro' };
  return { s, L, estado: 'parcial' };
}

/** Holgura (mm) con que se compara la campana con los bordes del aéreo. */
const TOL_CAMPANA = 1;

/**
 * Si un aéreo hecho a medida (no cuadrado) termina justo sobre una campana, se alarga hasta
 * cubrirla entera: así la campana queda alojada y centrada sobre su encimera en vez de
 * desplazada o chocando con el último módulo.
 */
function alargarSobreCampanas(d: Diseno, ta: TramoAereo, encimeras: Encimera[], ctx: Ctx) {
  // Los aéreos cuadrados siguen al base (y la encimera nunca se sale de la cubierta): no hace falta.
  if (d.plantilla !== 'cocina' || d.aereos.cuadrado) return;
  const h = ANCHO_CAMPANA / 2;
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    let cambio = false;
    for (const e of encimeras) {
      if (!e.campana || tramoAereoDe(e.tramo) !== ta) continue;
      const cob = coberturaCampana(d, ta, e);
      if (!cob || cob.estado !== 'parcial') continue;
      const cs = cuerposDe(d, ta);
      const { s, L } = cob;
      let extra = 0;
      let alPrincipio = false;
      if (ta === 'aereos') {
        // El aéreo principal crece hacia el lado de la campana según su alineación.
        const [sx0, sx1] = extremosPrincipal(d);
        const x0 = inicioAereoPrincipal(d);
        const xa = x0 + s - h;
        const xb = x0 + s + h;
        const a = d.aereos;
        const alineacion = a.lados?.izq ? 'izq' : a.lados?.der ? 'der' : a.alineacion;
        const muros = !!(d.lados?.izq || d.lados?.der || a.lados?.izq || a.lados?.der);
        const maximo = muros ? Math.round(sx1 - sx0) : LIMITES_AEREOS.ancho[1];
        let nuevo = L;
        if (alineacion === 'izq') nuevo = xb - x0;
        else if (alineacion === 'der') nuevo = x0 + L - xa;
        else {
          const c = (sx0 + sx1) / 2;
          nuevo = Math.max(2 * (xb - c), 2 * (c - xa));
        }
        extra = Math.min(maximo, Math.ceil(nuevo)) - L;
        alPrincipio = alineacion === 'der' || (alineacion === 'centro' && s - h < 0);
      } else {
        // Un lado del aéreo crece hacia su punta abierta (s = 0 en el izquierdo, s = L en el derecho).
        const r = ladoDe(d, ta)!;
        const izq = ta === 'aereos-izq';
        extra = Math.min(LIMITES_AEREOS.ladoLargo[1] - r.largo, Math.ceil(izq ? h - s : s + h - L));
        if (extra > 0) r.largo += extra;
        alPrincipio = izq;
      }
      if (extra <= 0) continue;
      cs[alPrincipio ? 0 : cs.length - 1].ancho += extra;
      cambio = true;
      ctx.avisos.push(`${ta === 'aereos' ? 'El aéreo' : `El aéreo del ${NOMBRE_TRAMO[tramoBaseDeAereo(ta)]}`} se alargó ${Math.round(extra / 10)} cm para que la campana quede entera y centrada sobre la encimera.`);
    }
    if (!cambio) break;
  }
}

/**
 * Largo más cercano al pedido con el que ninguna campana del tramo aéreo queda a medias:
 * o el aéreo la cubre entera (va alojada) o termina antes (queda mural). En los lados es el
 * largo exterior (desde el muro principal); en el principal, la suma de sus módulos. Devuelve
 * también las encimeras cuya campana queda fuera del aéreo con ese largo.
 */
export function largoAereoSinCortarCampanas(d: Diseno, ta: TramoAereo, pedido: number, [min, max]: [number, number]): { largo: number; fuera: string[] } {
  const db = disenoBase(d);
  const h = ANCHO_CAMPANA / 2;
  const prohibidos: { id: string; hasta: number; desde: number }[] = [];
  for (const e of d.equipos ?? []) {
    if (e.tipo !== 'encimera' || !e.campana || tramoAereoDe(e.tramo) !== ta) continue;
    const sb = centroEncimera(db, e);
    if (sb == null) continue;
    const p = posEnMundo(db, e.tramo, sb);
    if (ta !== 'aereos') {
      prohibidos.push({ id: e.id, hasta: p.z - h, desde: p.z + h });
      continue;
    }
    const [sx0, sx1] = extremosPrincipal(d);
    const a = d.aereos;
    const alineacion = a.lados?.izq ? 'izq' : a.lados?.der ? 'der' : a.alineacion;
    if (alineacion === 'izq') prohibidos.push({ id: e.id, hasta: p.x - h - sx0, desde: p.x + h - sx0 });
    else if (alineacion === 'der') prohibidos.push({ id: e.id, hasta: sx1 - p.x - h, desde: sx1 - p.x + h });
    else {
      const dist = Math.abs(p.x - (sx0 + sx1) / 2);
      prohibidos.push({ id: e.id, hasta: 2 * (dist - h), desde: 2 * (dist + h) });
    }
  }
  let largo = Math.max(min, Math.min(max, Math.round(pedido)));
  for (let vuelta = 0; vuelta <= prohibidos.length; vuelta++) {
    const p = prohibidos.find((x) => largo > x.hasta + TOL_CAMPANA && largo < x.desde - TOL_CAMPANA);
    if (!p) break;
    const opciones = [Math.floor(p.hasta), Math.ceil(p.desde)].filter((x) => x >= min && x <= max);
    if (!opciones.length) break;
    largo = opciones.reduce((m, x) => (Math.abs(x - pedido) < Math.abs(m - pedido) ? x : m));
  }
  return { largo, fuera: prohibidos.filter((x) => largo <= x.hasta + TOL_CAMPANA).map((x) => x.id) };
}

/** Los módulos de campana de esas encimeras en el tramo pasan a ser de puertas (la campana queda mural). */
export function soltarCampanas(d: Diseno, ta: TramoAereo, encimeras: string[]) {
  for (const c of cuerposDe(d, ta)) if (c.tipo === 'campana' && c.campanaDe && encimeras.includes(c.campanaDe)) moduloPuertas(c);
}

function tramoBaseDeAereo(t: TramoAereo): TramoBase {
  return t === 'aereos' ? 'base' : t === 'aereos-izq' ? 'izq' : 'der';
}

/**
 * Función central de la campana: deja cada campana sobre su encimera en el tramo aéreo
 * de su mismo lado (crea, mueve o convierte módulos de campana) y llena el resto del
 * aéreo sin cambiar su largo. Se aplica al final de todas las operaciones. Devuelve las
 * encimeras cuya campana no pudo quedar sobre ellas (dos campanas que se topan).
 */
export function alinearCampanas(d: Diseno, ctx: Ctx): string[] {
  const conflictos = new Set<string>();
  const encimeras = (d.equipos ?? []).filter((e): e is Encimera => e.tipo === 'encimera');
  if (!esAdulta(d.plantilla)) encimeras.forEach((e) => (e.campana = false));
  for (const ta of TRAMOS_AEREOS) {
    if (!aereoVisible(d, ta)) continue;
    alargarSobreCampanas(d, ta, encimeras, ctx);
    const lado = ladoDeTramo(ta);
    const cs = ta === 'aereos' ? d.aereos.cuerpos : ladoDe(d, ta)!.cuerpos;
    const L = cs.reduce((s, c) => s + c.ancho, 0);
    // Encimeras con campana que quedan bajo este tramo aéreo y dónde cae su centro.
    const objetivoEnc = new Map<string, number>();
    for (const e of encimeras) {
      if (!e.campana || tramoAereoDe(e.tramo) !== ta) continue;
      // Fuera del aéreo es mural; dentro (o, si no se pudo alargar, en parte) va alojada.
      const cob = coberturaCampana(d, ta, e);
      if (cob && cob.estado !== 'fuera') objetivoEnc.set(e.id, cob.s);
    }
    // Módulos de campana: cada encimera conserva el suyo; los demás se vinculan o pasan a ser de puertas.
    const vinculado = new Map<string, Cuerpo>();
    const sueltos: Cuerpo[] = [];
    for (const c of cs) {
      if (c.tipo !== 'campana') continue;
      if (c.campanaDe && objetivoEnc.has(c.campanaDe) && !vinculado.has(c.campanaDe)) vinculado.set(c.campanaDe, c);
      else sueltos.push(c);
    }
    let cursor = 0;
    const centros = new Map<Cuerpo, number>();
    for (const c of cs) {
      centros.set(c, cursor + c.ancho / 2);
      cursor += c.ancho;
    }
    for (const [id, s] of objetivoEnc) {
      if (vinculado.has(id) || !sueltos.length) continue;
      const cercano = sueltos.reduce((a, b) => (Math.abs(centros.get(b)! - s) < Math.abs(centros.get(a)! - s) ? b : a));
      sueltos.splice(sueltos.indexOf(cercano), 1);
      cercano.campanaDe = id;
      vinculado.set(id, cercano);
    }
    for (const c of sueltos) {
      moduloPuertas(c);
      ctx.avisos.push(`El módulo de campana del ${lado ? `aéreo del lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}` : 'aéreo'} pasó a ser de puertas: no tiene una encimera con campana debajo.`);
    }
    // Encimeras con campana sin módulo: se crea uno de 60 cm donde cae la encimera.
    for (const [id, s] of objetivoEnc) {
      if (vinculado.has(id)) continue;
      const nuevo = nuevoCuerpo({ tipo: 'campana', ancho: Math.min(ANCHO_CAMPANA, L), puertas: 2, repisas: 0, campanaDe: id });
      let k = 0;
      let acum = 0;
      while (k < cs.length && acum + cs[k].ancho / 2 < s) acum += cs[k++].ancho;
      cs.splice(k, 0, nuevo);
      vinculado.set(id, nuevo);
      ctx.avisos.push(`Se agregó el módulo de campana en ${ta === 'aereos' ? (d.plantilla === 'compacto' ? 'el mueble superior' : 'los aéreos') : `el aéreo del lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`}, sobre la encimera.`);
    }
    if (!vinculado.size && L === cs.reduce((s, c) => s + c.ancho, 0)) continue;
    const objetivos = new Map<string, number>();
    for (const [id, c] of vinculado) objetivos.set(c.id, objetivoEnc.get(id)!);
    const pinesEnConflicto = new Set<string>();
    const nuevos = acomodarConPines(d, ta, cs, L, objetivos, ctx, pinesEnConflicto);
    cs.splice(0, cs.length, ...nuevos);
    for (const [id, c] of vinculado) if (pinesEnConflicto.has(c.id)) conflictos.add(id);
  }
  // Campanas murales (sin aéreo encima) del mismo tramo: también necesitan 60 cm cada una.
  const db = disenoBase(d);
  for (const t of TRAMOS_BASE) {
    const murales = encimeras
      .filter((e) => e.campana && e.tramo === t && !moduloCampana(d, e.id))
      .map((e) => ({ id: e.id, s: centroEncimera(db, e) }))
      .filter((x): x is { id: string; s: number } => x.s != null)
      .sort((a, b) => a.s - b.s);
    for (let k = 1; k < murales.length; k++) if (murales[k].s - murales[k - 1].s < ANCHO_CAMPANA - TOL_CAMPANA) conflictos.add(murales[k].id);
  }
  return [...conflictos];
}

/** Módulo aéreo que aloja la campana de una encimera (o null si es mural o no tiene). */
export function moduloCampana(d: Diseno, encimeraId: string): { tramo: TramoAereo; indice: number } | null {
  for (const t of TRAMOS_AEREOS) {
    if (!aereoVisible(d, t)) continue;
    const i = cuerposDe(d, t).findIndex((c) => c.tipo === 'campana' && c.campanaDe === encimeraId);
    if (i >= 0) return { tramo: t, indice: i };
  }
  return null;
}

export { esTramoAereo };
