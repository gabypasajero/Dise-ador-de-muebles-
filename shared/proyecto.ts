// Proyecto con varios muebles: el mueble principal (el de siempre) más islas y muebles en línea.
// Cada mueble adicional es una cocina completa con su posición en la planta; el precio del
// proyecto es la suma de todos y cada uno guarda sus propias correcciones del desglose.
import { nuevoId } from './catalogo';
import { disenoLibre } from './catalogo';
import { dimensionesTotales, extremosPrincipal } from './layout';
import { aplicarAjustes, ejecutar, formatear, precioDiseno, type Operacion, type PrecioAjustado } from './reglas';
import { detalleCotizacion } from './resumen';
import { precioCocina, precioIsla } from './tarifas';
import type { CaraIsla, CatalogoMateriales, Diseno, LineaDetalle, MuebleAdicional, ProductoCatalogo, Unidad } from './tipos';

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
    const islas = otros.filter((a) => a.tipo === 'isla' && !a.cara).length;
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

// ---------- Caras de la isla (lado trasero y costados con puertas y cajones) ----------

export const NOMBRE_CARA: Record<CaraIsla, string> = { trasera: 'lado trasero', izq: 'costado izquierdo', der: 'costado derecho' };
/** Fondo de un costado al agregarlo (el mínimo de un mueble de cocina). */
export const FONDO_COSTADO = 450;

/** Las caras que tiene una isla. */
export function carasDe(p: Diseno, islaId: string): Partial<Record<CaraIsla, MuebleAdicional>> {
  const out: Partial<Record<CaraIsla, MuebleAdicional>> = {};
  for (const a of p.adicionales ?? []) if (a.isla === islaId && a.cara) out[a.cara] = a;
  return out;
}

/** La isla de un mueble del proyecto: ella misma o la isla de la que es cara. */
export function islaDe(p: Diseno, id: string): MuebleAdicional | null {
  const a = p.adicionales?.find((x) => x.id === id);
  if (!a) return null;
  if (a.isla) return p.adicionales?.find((x) => x.id === a.isla) ?? null;
  return a.tipo === 'isla' ? a : null;
}

/** Diseño de una cara nueva: el lado trasero mide lo mismo que la isla; un costado, lo que mide su fondo total. */
function disenoCara(principal: Diseno, isla: Diseno, ancho: number, fondo: number): Diseno {
  const d = aplicar(cocinaVacia(principal), [
    { op: 'fijarAncho', ancho },
    { op: 'fijarProfundidad', profundidad: fondo },
    { op: 'fijarAlto', alto: isla.alto },
  ]);
  return { ...d, nombreModelo: 'Isla', productoId: null, materiales: { ...isla.materiales }, tirador: isla.tirador, cierreSuave: isla.cierreSuave, cocina: { ...d.cocina, copete: false } };
}

/**
 * Agrega a la isla su lado trasero o un costado, con puertas y cajones propios. El lado trasero
 * parte la isla en dos (cada lado con la mitad del fondo); un costado se pega a la punta.
 */
export function agregarCara(p: Diseno, islaId: string, cara: CaraIsla): Diseno {
  const isla = p.adicionales?.find((a) => a.id === islaId && !a.isla);
  if (!isla || carasDe(p, islaId)[cara]) return p;
  let frente = isla.diseno;
  let diseno: Diseno;
  if (cara === 'trasera') {
    const mitad = Math.max(450, Math.round(frente.profundidad / 2));
    frente = aplicar(frente, [{ op: 'fijarProfundidad', profundidad: mitad }]);
    diseno = disenoCara(p, frente, frente.ancho, mitad);
  } else {
    const fondoTotal = frente.profundidad + (carasDe(p, islaId).trasera?.diseno.profundidad ?? 0);
    diseno = disenoCara(p, frente, fondoTotal, FONDO_COSTADO);
  }
  const nueva: MuebleAdicional = { id: nuevoId('m'), tipo: 'isla', nombre: `${isla.nombre} · ${NOMBRE_CARA[cara]}`, x: isla.x, z: isla.z, giro: isla.giro, diseno, cara, isla: islaId };
  return acomodarCaras({ ...p, adicionales: [...(p.adicionales ?? []).map((a) => (a.id === islaId ? { ...a, diseno: frente } : a)), nueva] });
}

/** Quita una cara; sin el lado trasero, el frente vuelve a tener todo el fondo de la isla. */
export function quitarCara(p: Diseno, caraId: string): Diseno {
  const c = p.adicionales?.find((a) => a.id === caraId && a.cara);
  if (!c) return p;
  const resto = (p.adicionales ?? []).filter((a) => a.id !== caraId).map((a) =>
    c.cara === 'trasera' && a.id === c.isla ? { ...a, diseno: aplicar(a.diseno, [{ op: 'fijarProfundidad', profundidad: a.diseno.profundidad + c.diseno.profundidad }]) } : a,
  );
  return acomodarCaras({ ...p, adicionales: resto });
}

/**
 * Las caras siguen a su isla: el lado trasero tiene su largo y su alto; cada costado, el alto y el
 * fondo total (frente más lado trasero). Las caras de una isla que ya no está se quitan. Devuelve
 * el mismo proyecto si no hay nada que corregir.
 */
export function acomodarCaras(p: Diseno): Diseno {
  const lista = p.adicionales ?? [];
  if (!lista.some((a) => a.cara)) return p;
  let cambio = false;
  const nueva = lista.flatMap((a) => {
    if (!a.cara) return [a];
    const isla = lista.find((x) => x.id === a.isla && !x.isla);
    if (!isla) {
      cambio = true;
      return [];
    }
    const trasera = lista.find((x) => x.isla === isla.id && x.cara === 'trasera');
    const ancho = a.cara === 'trasera' ? isla.diseno.ancho : isla.diseno.profundidad + (trasera?.diseno.profundidad ?? 0);
    const ops: Operacion[] = [];
    if (a.diseno.ancho !== ancho) ops.push({ op: 'fijarAncho', ancho });
    if (a.diseno.alto !== isla.diseno.alto) ops.push({ op: 'fijarAlto', alto: isla.diseno.alto });
    if (!ops.length) return [a];
    cambio = true;
    return [{ ...a, diseno: aplicar(a.diseno, ops) }];
  });
  return cambio ? { ...p, adicionales: nueva } : p;
}

/** Gira (x, z) en la planta como el grupo del visor (rotation.y en grados). */
function girarPlanta(x: number, z: number, grados: number): [number, number] {
  const g = (grados * Math.PI) / 180;
  return [x * Math.cos(g) + z * Math.sin(g), -x * Math.sin(g) + z * Math.cos(g)];
}

/** Un mueble del proyecto, con su ubicación (el principal está en el origen). */
export interface MuebleProyecto {
  /** null: el mueble principal. */
  id: string | null;
  tipo: 'principal' | MuebleAdicional['tipo'];
  nombre: string;
  diseno: Diseno;
  /** Centro del mueble en la planta (mm) y su giro, tal como se dibuja. */
  x: number;
  z: number;
  giro: number;
  /** Isla sin lado trasero: su respaldo queda a la vista, terminado. */
  respaldo: boolean;
  cara?: CaraIsla;
}

/**
 * Todos los muebles del proyecto, el principal primero, cada uno donde se dibuja. En una isla (x, z)
 * es el centro de toda la isla: con lado trasero, el frente y la trasera quedan espalda con espalda,
 * y los costados en las puntas.
 */
export function mueblesProyecto(p: Diseno, nombrePrincipal = 'Mueble principal'): MuebleProyecto[] {
  const { adicionales, ...principal } = p;
  const lista = adicionales ?? [];
  const out: MuebleProyecto[] = [{ id: null, tipo: 'principal', nombre: nombrePrincipal, diseno: principal, x: 0, z: 0, giro: 0, respaldo: false }];
  for (const a of lista) {
    const base = { id: a.id, tipo: a.tipo, nombre: a.nombre, diseno: a.diseno };
    if (a.tipo !== 'isla' || (!a.cara && !lista.some((x) => x.isla === a.id))) {
      out.push({ ...base, x: a.x, z: a.z, giro: a.giro, respaldo: a.tipo === 'isla' });
      continue;
    }
    const isla = a.cara ? lista.find((x) => x.id === a.isla && !x.isla) : a;
    if (!isla) continue;
    const trasera = lista.find((x) => x.isla === isla.id && x.cara === 'trasera');
    const fF = isla.diseno.profundidad;
    const fT = trasera?.diseno.profundidad ?? 0;
    const F = fF + fT;
    const L = isla.diseno.ancho;
    // Centro de la pieza dentro de la isla (sin girar) y su giro propio.
    let local: [number, number];
    let giro: number;
    if (!a.cara) [local, giro] = [[0, F / 2 - fF / 2], 0];
    else if (a.cara === 'trasera') [local, giro] = [[0, -F / 2 + fT / 2], 180];
    else if (a.cara === 'der') [local, giro] = [[L / 2 + a.diseno.profundidad / 2, 0], 90];
    else [local, giro] = [[-L / 2 - a.diseno.profundidad / 2, 0], 270];
    const [dx, dz] = girarPlanta(local[0], local[1], isla.giro);
    out.push({ ...base, x: Math.round(isla.x + dx), z: Math.round(isla.z + dz), giro: (isla.giro + giro) % 360, respaldo: !a.cara && !trasera, cara: a.cara });
  }
  return out;
}

/**
 * Precio de un mueble adicional con sus correcciones: la isla por metro de isla (su largo con los
 * costados), el mueble en línea como una cocina. Una cara de la isla ya va en el metro de la isla:
 * suma solo sus equipos y especieros (las opciones del mueble se cobran una vez, en la isla).
 */
export function precioAdicional(a: Pick<MuebleAdicional, 'tipo' | 'diseno' | 'cara'>, largoIsla?: number): PrecioAjustado | null {
  const p = precioBaseAdicional(a, largoIsla);
  return aplicarAjustes({ total: p.total, metodo: 'oficial', lineas: p.lineas }, a.diseno.ajustesPrecio);
}

/** El precio calculado (sin las correcciones del vendedor) de un mueble adicional. */
export function precioBaseAdicional(a: Pick<MuebleAdicional, 'tipo' | 'diseno' | 'cara'>, largoIsla?: number): { total: number; lineas: ReturnType<typeof precioCocina>['lineas'] } {
  if (a.cara) {
    const lineas = precioCocina(a.diseno).lineas.filter((l) => !l.concepto.startsWith('Mueble base') && l.concepto !== 'Cierre suave en puertas y cajones' && l.concepto !== 'Sistema sin manilla');
    return { total: lineas.reduce((s, l) => s + l.valor, 0), lineas };
  }
  return a.tipo === 'isla' ? precioIsla(a.diseno, largoIsla) : precioCocina(a.diseno);
}

/** Largo de la isla para el cobro: el frente más el fondo de sus costados. */
export function largoIsla(p: Diseno, isla: MuebleAdicional): number {
  const caras = carasDe(p, isla.id);
  return isla.diseno.ancho + (caras.izq?.diseno.profundidad ?? 0) + (caras.der?.diseno.profundidad ?? 0);
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
    ...(adicionales ?? []).map((a) => ({ id: a.id, nombre: a.nombre, precio: precioAdicional(a, a.tipo === 'isla' && !a.cara ? largoIsla(p, a) : undefined) })),
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
      valor: a.cara
        ? `${a.cara === 'trasera' ? 'Lado trasero' : NOMBRE_CARA[a.cara].charAt(0).toUpperCase() + NOMBRE_CARA[a.cara].slice(1)} de la isla, con sus puertas y cajones: ${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)}`
        : `${NOMBRE_TIPO_ADICIONAL[a.tipo]} de ${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)${a.tipo === 'isla' && !(adicionales ?? []).some((x) => x.isla === a.id && x.cara === 'trasera') ? ', con respaldo terminado' : ''}`,
    });
    for (const l of detalleCotizacion(d, null, unidad, materiales)) {
      if (l.etiqueta === 'Modelo base' || l.etiqueta === 'Medidas') continue;
      lineas.push({ ...l, etiqueta: `${a.nombre} · ${l.etiqueta}` });
    }
  }
  return lineas;
}
