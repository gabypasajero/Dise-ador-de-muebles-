// Recomendaciones de puertas, cajones y módulos para el mueble que se edita: lo que cabe
// idealmente en cada tramo según sus medidas, las de los equipos y los mínimos y máximos de
// fabricación. Son sugerencias: el vendedor decide (todas las medidas se pueden editar).
import { nombreModuloEn, nombreTramo } from './equipos';
import { anchoTotalEquipo, esCocinaAdulta, esTramoAereo, MODULO_MIN_LAVAPLATOS } from './layout';
import { advertencias, formatear, type Operacion } from './reglas';
import { ANCHO_POR_PUERTA, ANCHO_MAX_CAJONERA, cuerposDe, esCajonera, tramosDe } from './tramos';
import type { Diseno, TramoId, Unidad } from './tipos';

/** Puertas estándar de 35 cm, con 10 cm de margen hacia cada lado (la dueña lo pidió así). */
export const PUERTA = { ideal: ANCHO_POR_PUERTA, min: ANCHO_POR_PUERTA - 100, max: ANCHO_POR_PUERTA + 100 };
/** Cajonera estándar de 40 cm: desde 30 cm y hasta 90 cm de ancho. */
export const CAJONERA = { ideal: 400, min: 300, max: ANCHO_MAX_CAJONERA };
/** Alto de frente de cajón cómodo (mm): alrededor de 24 cm (3 cajones en un mueble de 90), nunca menos de 9 cm. */
export const CAJON = { ideal: 240, min: 90 };

export interface Recomendacion {
  nivel: 'ok' | 'info' | 'aviso';
  texto: string;
  /** Cambio sugerido que se puede aplicar con un toque. */
  accion?: { texto: string; op: Operacion };
}

export interface GrupoRecomendaciones {
  titulo: string;
  items: Recomendacion[];
}

/**
 * Puertas ideales para un módulo de ese ancho: la menor cantidad con la que cada puerta queda entre
 * 25 y 45 cm (estándar 35); si ninguna cantidad cabe en ese rango, la que más se acerca a 35 cm.
 */
export function puertasIdeales(ancho: number): number {
  for (let n = 1; n <= 4; n++) {
    const cada = ancho / n;
    if (cada >= PUERTA.min && cada <= PUERTA.max) return n;
  }
  let mejor = 1;
  for (let n = 2; n <= 4; n++) if (Math.abs(ancho / n - PUERTA.ideal) < Math.abs(ancho / mejor - PUERTA.ideal)) mejor = n;
  return mejor;
}

/** Cajones ideales para un alto de frentes dado (frentes de unos 18 cm, entre 2 y 5). */
export function cajonesIdeales(altoFrentes: number): number {
  return Math.max(2, Math.min(5, Math.round(altoFrentes / CAJON.ideal)));
}

/** Alto disponible para los frentes del mueble base (sin zócalo ni cubierta). */
function altoFrentes(d: Diseno): number {
  return d.alto - d.zocalo - (esCocinaAdulta(d) ? d.cocina.espesorCubierta : 0);
}

/** Un grupo de módulos iguales de la distribución ideal. */
export interface ModuloIdeal {
  cantidad: number;
  tipo: 'puertas' | 'cajonera';
  puertas: number;
  ancho: number;
}

/**
 * Distribución ideal del largo libre de un tramo (lo que no ocupan hornos, especieros y módulos de
 * equipos), según los estándares de la tienda: una cajonera de 40 cm (en el mueble base de la
 * cocina) y el resto en módulos de 2 puertas de 35 cm (70 cm); si sobra, un módulo de 1 puerta
 * (25 a 45 cm) y lo que todavía quede agranda la cajonera (hasta 90 cm) o las puertas (hasta 45 cm).
 */
export function distribucionIdeal(libre: number, conCajonera: boolean): ModuloIdeal[] {
  const par = 2 * PUERTA.ideal;
  let cajonera = conCajonera && libre >= CAJONERA.min ? Math.min(CAJONERA.ideal, libre) : 0;
  const resto = libre - cajonera;
  let pares = Math.floor(resto / par);
  let sobra = resto - pares * par;
  let una = 0;
  if (sobra >= PUERTA.min) {
    una = Math.min(PUERTA.max, sobra);
    sobra -= una;
  }
  // Lo que sobra: primero la cajonera (hasta 90 cm), luego la puerta suelta y los módulos de 2 puertas (hasta 45 cm cada puerta).
  if (sobra > 0 && cajonera) {
    const extra = Math.min(sobra, CAJONERA.max - cajonera);
    cajonera += extra;
    sobra -= extra;
  }
  if (sobra > 0 && una) {
    const extra = Math.min(sobra, PUERTA.max - una);
    una += extra;
    sobra -= extra;
  }
  let anchoPar = par;
  if (sobra > 0 && pares > 0) {
    anchoPar = par + sobra / pares;
    // Si las puertas quedarían de más de 45 cm, se agrega un módulo más de 2 puertas.
    while (anchoPar > 2 * PUERTA.max) {
      pares++;
      anchoPar = (resto - una) / pares;
    }
    sobra = 0;
  }
  if (sobra > 0 && !pares && !una && !cajonera) una = sobra;
  else if (sobra > 0 && cajonera) cajonera += sobra;
  const out: ModuloIdeal[] = [];
  if (cajonera) out.push({ cantidad: 1, tipo: 'cajonera', puertas: 0, ancho: Math.round(cajonera) });
  if (pares) out.push({ cantidad: pares, tipo: 'puertas', puertas: 2, ancho: Math.round(anchoPar) });
  if (una) out.push({ cantidad: 1, tipo: 'puertas', puertas: 1, ancho: Math.round(una) });
  return out;
}

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function recomendacionesTramo(d: Diseno, t: TramoId, unidad: Unidad): Recomendacion[] {
  const f = (mm: number) => formatear(mm, unidad);
  const cs = cuerposDe(d, t);
  const aereo = esTramoAereo(t);
  const items: Recomendacion[] = [];
  const equipos = aereo ? [] : (d.equipos ?? []).filter((e) => e.tramo === t);
  // Lo que piden los equipos.
  for (const e of equipos) {
    const i = cs.findIndex((c) => c.id === e.modulo);
    if (i < 0) continue;
    const c = cs[i];
    const nombre = nombreModuloEn(d, t, i);
    const necesita = e.tipo === 'lavaplatos' ? MODULO_MIN_LAVAPLATOS[e.modelo] : anchoTotalEquipo(d, e);
    const que = e.tipo === 'lavaplatos' ? 'El lavaplatos' : `La encimera de ${e.platos} platos`;
    if (c.ancho < necesita)
      items.push({
        nivel: 'aviso',
        texto: `${que} pide un módulo de ${f(necesita)} o más; el ${nombre} mide ${f(c.ancho)}.`,
        accion: { texto: `Dejar el ${nombre} en ${f(necesita)}`, op: { op: 'fijarAnchoModulo', tramo: t, modulo: c.id, ancho: necesita } },
      });
    else items.push({ nivel: 'ok', texto: `${que} cabe en el ${nombre} (${f(c.ancho)}; necesita ${f(necesita)}).` });
  }
  // Puertas y cajones de cada módulo.
  cs.forEach((c, i) => {
    if (c.tipo !== 'frentes' || c.abatible) return;
    const nombre = nombreModuloEn(d, t, i);
    if (c.puertas > 0) {
      const ideal = puertasIdeales(c.ancho);
      const cada = c.ancho / c.puertas;
      if (ideal !== c.puertas && (cada > PUERTA.max || cada < PUERTA.min))
        items.push({
          nivel: cada > PUERTA.max || cada < PUERTA.min ? 'aviso' : 'info',
          texto: `${mayus(nombre)} (${f(c.ancho)}): con ${c.puertas} ${c.puertas === 1 ? 'puerta' : 'puertas'} quedan de ${f(Math.round(cada))}; lo ideal son ${ideal} de ${f(Math.round(c.ancho / ideal))} (puertas de ${f(PUERTA.ideal)}, entre ${f(PUERTA.min)} y ${f(PUERTA.max)}).`,
          accion: { texto: `Poner ${ideal} ${ideal === 1 ? 'puerta' : 'puertas'}`, op: { op: 'actualizarModulo', tramo: t, modulo: c.id, cambios: { puertas: ideal } } },
        });
    }
    if (!aereo && c.cajones > 0) {
      const alto = c.puertas > 0 ? altoFrentes(d) * 0.4 : altoFrentes(d);
      const ideal = c.puertas > 0 ? Math.max(1, Math.round(alto / CAJON.ideal)) : cajonesIdeales(alto);
      const frente = alto / c.cajones;
      if (frente < CAJON.min || (ideal !== c.cajones && Math.abs(frente - CAJON.ideal) > 70))
        items.push({
          nivel: frente < CAJON.min ? 'aviso' : 'info',
          texto: `${mayus(nombre)}: ${c.cajones} cajones de unos ${f(Math.round(frente))} de frente; lo ideal son ${ideal} de unos ${f(Math.round(alto / ideal))}.`,
          accion: { texto: `Poner ${ideal} cajones`, op: { op: 'actualizarModulo', tramo: t, modulo: c.id, cambios: { cajones: ideal } } },
        });
      if (esCocinaAdulta(d) && esCajonera(c) && (c.ancho < CAJONERA.min || c.ancho > CAJONERA.max))
        items.push({ nivel: c.ancho > CAJONERA.max ? 'aviso' : 'info', texto: `La cajonera del ${nombre} mide ${f(c.ancho)}: el estándar es ${f(CAJONERA.ideal)}, entre ${f(CAJONERA.min)} y ${f(CAJONERA.max)}.` });
    }
  });
  // Distribución ideal del largo que queda libre.
  const fijos = cs.filter((c) => c.tipo !== 'frentes' || equipos.some((e) => e.modulo === c.id)).reduce((s, c) => s + c.ancho, 0);
  const libre = cs.reduce((s, c) => s + c.ancho, 0) - fijos;
  if (libre >= PUERTA.min) {
    const partes = distribucionIdeal(libre, !aereo && esCocinaAdulta(d)).map((m) =>
      m.tipo === 'cajonera'
        ? `${m.cantidad} cajonera de ${f(m.ancho)}`
        : `${m.cantidad} ${m.cantidad === 1 ? 'módulo' : 'módulos'} de ${m.puertas} ${m.puertas === 1 ? 'puerta' : 'puertas'} de ${f(m.ancho)}`,
    );
    items.push({ nivel: 'info', texto: `Distribución ideal de los ${f(libre)} sin equipos ni módulos fijos: ${partes.join(' + ')}.` });
  }
  return items;
}

/** Recomendaciones del mueble: avisos de fabricación y, por tramo, equipos, puertas, cajones y distribución. */
export function recomendaciones(d: Diseno, unidad: Unidad): GrupoRecomendaciones[] {
  const grupos: GrupoRecomendaciones[] = [];
  const avisos = advertencias(d, unidad);
  if (avisos.length) grupos.push({ titulo: 'Fabricación', items: avisos.map((a) => ({ nivel: a.nivel, texto: a.texto })) });
  if (d.plantilla === 'tocador') return grupos;
  for (const t of tramosDe(d)) {
    const items = recomendacionesTramo(d, t, unidad);
    if (items.length) grupos.push({ titulo: nombreTramo(d, t), items });
  }
  return grupos;
}
