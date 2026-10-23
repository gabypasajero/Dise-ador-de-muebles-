// Motor de distribución: a partir del diseño calcula la posición y medida de
// cada cuerpo, puerta y cajón. Lo usan el visor 3D y los paneles de medidas.
// Ejes (mm): x de izquierda a derecha centrado en 0, y desde el piso hacia
// arriba, z desde el muro (0) hacia el frente.
import type { Bisagra, Cuerpo, Diseno, Encimera, Equipo, Lado, LadoId, Lavaplatos, Retorno, TramoAereo, TramoBase, TramoId } from './tipos';

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface FrenteBase {
  cuerpo: number;
  indice: number;
  rect: Rect;
}

export interface FrentePuerta extends FrenteBase {
  tipo: 'puerta';
  /** 'arriba': puerta abatible que se abre hacia arriba. */
  bisagra: Bisagra | 'arriba';
}

export interface FrenteCajon extends FrenteBase {
  tipo: 'cajon';
  /** Frente del especiero: cajón extraíble de alto completo. */
  especiero?: boolean;
}

/** Franja de melamina fija (sobre el horno o tapa de cajonera). */
export interface FrenteFaja extends FrenteBase {
  tipo: 'faja';
}

export type Frente = FrentePuerta | FrenteCajon | FrenteFaja;

export interface LayoutCuerpo {
  indice: number;
  cuerpo: Cuerpo;
  x0: number;
  x1: number;
  /** Altura superior del casco de este cuerpo. */
  yTope: number;
  /** Panel izquierdo y derecho propios (false si comparte división). */
  ladoIzq: boolean;
  ladoDer: boolean;
  /** Espacio interior libre entre paneles. */
  interior: { x0: number; x1: number; y0: number; y1: number };
  /** Zona de puertas (si tiene) y de cajones (si tiene). */
  zonaPuertas: Rect | null;
  zonaCajones: Rect | null;
  horno: Rect | null;
  /** Especiero: altura (y) de cada piso interior del cajón extraíble. */
  especiero: { pisos: number[] } | null;
}

export interface Layout {
  ancho: number;
  alto: number;
  profundidad: number;
  espesor: number;
  espesorFrente: number;
  /** Plano frontal del casco: los frentes van de zFrente a zFrente + espesorFrente. */
  zFrente: number;
  profundidadCasco: number;
  /** Altura de la cara inferior de la cubierta (cocinas) o del techo (resto). */
  yTope: number;
  espesorCubierta: number;
  cuerpos: LayoutCuerpo[];
  frentes: Frente[];
  divisiones: { x: number; y0: number; y1: number }[];
  filaSuperior: Rect | null;
}

export const ALTO_HORNO = 595;

export function esCocina(d: Diseno): boolean {
  return d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil' || d.plantilla === 'compacto';
}

/** Cocina de adulto (con cubierta postformada y equipamiento real): cocina o compacto. */
export function esCocinaAdulta(d: Diseno): boolean {
  return d.plantilla === 'cocina' || d.plantilla === 'compacto';
}

/** Diseño del mueble base: en el compacto es la cocina bajo la cubierta (alto = elevación de los aéreos). */
export function disenoBase(d: Diseno): Diseno {
  if (d.plantilla !== 'compacto') return d;
  return { ...d, plantilla: 'cocina', alto: Math.min(d.alto, d.aereos.elevacion) };
}

export const LADOS: LadoId[] = ['izq', 'der'];

export function esTramoAereo(t: TramoId): t is TramoAereo {
  return t === 'aereos' || t === 'aereos-izq' || t === 'aereos-der';
}

/** Costado de un tramo lateral (null para los principales). */
export function ladoDeTramo(t: TramoId): LadoId | null {
  if (t === 'izq' || t === 'aereos-izq') return 'izq';
  if (t === 'der' || t === 'aereos-der') return 'der';
  return null;
}

/** Tramo aéreo que va sobre un tramo del base (y viceversa). */
export function tramoAereoDe(t: TramoBase): TramoAereo {
  return t === 'base' ? 'aereos' : t === 'izq' ? 'aereos-izq' : 'aereos-der';
}
export function tramoBaseDe(t: TramoAereo): TramoBase {
  return t === 'aereos' ? 'base' : t === 'aereos-izq' ? 'izq' : 'der';
}

/** Forma que dibujan unos lados: lineal, L a la izquierda, L a la derecha o U. */
export function formaDe(lados: { izq: unknown; der: unknown }): 'lineal' | 'L-izq' | 'L-der' | 'U' {
  if (lados.izq && lados.der) return 'U';
  if (lados.izq) return 'L-izq';
  if (lados.der) return 'L-der';
  return 'lineal';
}

/** Largo útil (mm) de los módulos de un lado del base: lo que sobresale del tramo principal. */
export function largoUtilLado(d: Diseno, lado: LadoId): number {
  const r = d.lados?.[lado];
  return r ? Math.max(0, r.largo - d.profundidad) : 0;
}

/** Vista heredada del tramo en L: el único lado de la L (en una U, el izquierdo). */
export function retornoDe(d: Diseno): Retorno | null {
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) return { ...r, lado };
  }
  return null;
}

/** Largo útil (mm) de los módulos del tramo en L (vista heredada, ver retornoDe). */
export function largoUtilRetorno(d: Diseno, r: Retorno | null = retornoDe(d)): number {
  return r ? largoUtilLado(d, r.lado) : 0;
}

/**
 * Diseño de un lado de la L/U para calcular su distribución con el mismo motor: sus
 * módulos pasan a ser el tramo principal y su equipamiento queda en el tramo 'base'.
 */
export function disenoLado(d: Diseno, lado: LadoId): Diseno | null {
  const r = d.lados?.[lado];
  if (!r || d.plantilla !== 'cocina') return null;
  return {
    ...d,
    ancho: largoUtilLado(d, lado),
    profundidad: r.profundidad,
    cuerpos: r.cuerpos,
    separacionCuerpos: 0,
    lados: { izq: null, der: null },
    aereos: { ...d.aereos, activo: false, cuerpos: [], lados: { izq: null, der: null } },
    equipos: (d.equipos ?? []).filter((e) => e.tramo === lado).map((e) => ({ ...e, tramo: 'base' as const })),
  };
}

/** Diseño del tramo en L (vista heredada, ver retornoDe). */
export function disenoRetorno(d: Diseno): Diseno | null {
  const r = retornoDe(d);
  return r ? disenoLado(d, r.lado) : null;
}

export interface Transformacion {
  /** Posición (mm) del centro del eje local y giro en y del tramo. */
  x: number;
  z: number;
  rotY: number;
}

/** Ubicación de un lado del base: su eje x local corre a lo largo del muro lateral y su fondo queda contra ese muro. */
export function transformLado(d: Diseno, lado: LadoId): Transformacion | null {
  const r = d.lados?.[lado];
  if (!r) return null;
  const z = d.profundidad + largoUtilLado(d, lado) / 2;
  return lado === 'der' ? { x: d.ancho / 2 + r.profundidad, z, rotY: -Math.PI / 2 } : { x: -d.ancho / 2 - r.profundidad, z, rotY: Math.PI / 2 };
}

/** Lleva un punto local (x a lo largo del lado, z desde el muro) de un lado al espacio del mueble: [x, z]. */
export function aMundoLado(d: Diseno, lado: LadoId, x: number, z: number): [number, number] {
  const tr = transformLado(d, lado)!;
  return girar(tr, lado, x, z);
}

function girar(tr: Transformacion, lado: LadoId, x: number, z: number): [number, number] {
  return lado === 'der' ? [tr.x - z, tr.z + x] : [tr.x + z, tr.z - x];
}

function desgirar(tr: Transformacion, lado: LadoId, wx: number, wz: number): [number, number] {
  return lado === 'der' ? [wz - tr.z, tr.x - wx] : [tr.z - wz, wx - tr.x];
}

/** Ubicación del tramo en L (vista heredada, ver retornoDe). */
export function transformRetorno(d: Diseno): Transformacion | null {
  const r = retornoDe(d);
  return r ? transformLado(d, r.lado) : null;
}

/** Lleva un punto del tramo en L (coordenadas locales) al espacio del mueble (vista heredada). */
export function aMundoRetorno(d: Diseno, x: number, z: number): [number, number] {
  return aMundoLado(d, retornoDe(d)!.lado, x, z);
}

/** Extremos en x del tramo principal incluyendo las esquinas de la L o la U (los muros laterales). */
export function extremosPrincipal(d: Diseno): [number, number] {
  return [-d.ancho / 2 - (d.lados?.izq?.profundidad ?? 0), d.ancho / 2 + (d.lados?.der?.profundidad ?? 0)];
}

/** Largo del tramo principal medido como en la tienda: de muro a muro, con las esquinas. */
export function largoPrincipalConEsquinas(d: Diseno): number {
  const [x0, x1] = extremosPrincipal(d);
  return Math.round(x1 - x0);
}

/** Caja que ocupa todo el conjunto (para encuadrar la cámara y la escena). */
export function dimensionesTotales(d: Diseno): { x0: number; x1: number; alto: number; fondo: number } {
  let [x0, x1] = extremosPrincipal(d);
  let alto = d.alto;
  let fondo = d.profundidad;
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) fondo = Math.max(fondo, r.largo);
  }
  if (d.aereos.activo && d.aereos.cuerpos.length) {
    const la = calcularLayoutAereos(d);
    if (la) {
      x0 = Math.min(x0, la.x0);
      x1 = Math.max(x1, la.x1);
      alto = Math.max(alto, la.y1);
    }
    for (const lado of LADOS) {
      const ra = ladoAereoActivo(d, lado);
      if (ra) fondo = Math.max(fondo, ra.largo);
    }
  }
  return { x0, x1, alto, fondo };
}

/** Reparte una longitud en k tramos con una holgura entre ellos. */
export function tramos(a: number, b: number, k: number, luz: number): [number, number][] {
  if (k <= 0) return [];
  const largo = (b - a - (k - 1) * luz) / k;
  return Array.from({ length: k }, (_, i) => {
    const ini = a + i * (largo + luz);
    return [ini, ini + largo];
  });
}

function altoCajonDefecto(d: Diseno): number {
  if (d.plantilla === 'cocina') return 160;
  if (d.plantilla === 'escritorio') return 220;
  return 180;
}

export function calcularLayout(d0: Diseno): Layout {
  // El compacto se distribuye como una cocina bajo la cubierta.
  const d = disenoBase(d0);
  const t = d.espesor;
  const tf = d.espesor;
  const luz = d.luzFrentes;
  const cocina = esCocina(d);
  const infantil = d.plantilla === 'cocina-infantil';
  const ct = cocina ? d.cocina.espesorCubierta : 0;
  const vuelo = cocina ? d.cocina.vueloCubierta : 0;
  const zFrente = d.profundidad - vuelo - tf;
  const profundidadCasco = zFrente;
  // Las cocinas apoyan la cubierta sobre el casco; el resto tiene techo propio.
  const yTope = d.alto - ct;
  const modular = d.estructura === 'modular' || d.separacionCuerpos > 0;

  const cuerpos: LayoutCuerpo[] = [];
  const frentes: Frente[] = [];
  const divisiones: Layout['divisiones'] = [];

  let cursor = -d.ancho / 2;
  const n = d.cuerpos.length;
  d.cuerpos.forEach((c, i) => {
    const x0 = cursor;
    const x1 = cursor + c.ancho;
    cursor = x1 + d.separacionCuerpos;

    let alturaCuerpo = c.alto > 0 ? Math.min(c.alto, d.alto) : d.alto;
    if (infantil && i > 0) alturaCuerpo = Math.min(alturaCuerpo, altoBaseInfantil(d));
    // En cocina el casco termina bajo la cubierta; en el resto bajo el techo.
    const despensa = infantil && i === 0;
    const tope = cocina && !despensa ? alturaCuerpo - ct : alturaCuerpo - t;

    const aislado = (v: Diseno['cuerpos'][number] | undefined) => v?.tipo === 'hueco' || v?.tipo === 'escritorio';
    const ladoIzq = modular || i === 0 || c.tipo === 'escritorio' || aislado(d.cuerpos[i - 1]);
    const ladoDer = modular || i === n - 1 || c.tipo === 'escritorio' || aislado(d.cuerpos[i + 1]);
    // Con estructura única dos cuerpos vecinos comparten una división centrada en el límite.
    const inIzq = ladoIzq ? x0 + t : x0 + t / 2;
    const inDer = ladoDer ? x1 - t : x1 - t / 2;
    if (!modular && i < n - 1 && c.tipo !== 'hueco' && d.cuerpos[i + 1].tipo !== 'hueco' && c.tipo !== 'escritorio' && d.cuerpos[i + 1].tipo !== 'escritorio') {
      const sig = d.cuerpos[i + 1];
      const topeSig = sig.alto > 0 ? Math.min(sig.alto, d.alto) : d.alto;
      divisiones.push({ x: x1, y0: d.zocalo, y1: Math.min(alturaCuerpo, topeSig) - (cocina ? ct : t) });
    }
    const yFondo = d.zocalo + t;
    const interior = { x0: inIzq, x1: inDer, y0: yFondo, y1: tope };

    const lc: LayoutCuerpo = {
      indice: i,
      cuerpo: c,
      x0,
      x1,
      yTope: tope,
      ladoIzq,
      ladoDer,
      interior,
      zonaPuertas: null,
      zonaCajones: null,
      horno: null,
      especiero: null,
    };
    cuerpos.push(lc);

    if (c.tipo === 'hueco' || c.tipo === 'escritorio') return;

    // Zona frontal disponible para este cuerpo.
    const fx0 = x0 + luz / 2;
    const fx1 = x1 - luz / 2;
    const fy0 = d.zocalo + (d.zocalo > 0 ? luz / 2 : 2);
    let fy1 = tope - luz / 2;
    if (!cocina) fy1 = tope - luz / 2; // bajo el techo

    if (c.tipo === 'especiero') {
      // Cajón extraíble de alto completo con sus pisos interiores repartidos en la altura.
      frentes.push({ tipo: 'cajon', cuerpo: i, indice: 0, especiero: true, rect: { x0: fx0, x1: fx1, y0: fy0, y1: fy1 } });
      lc.zonaCajones = { x0: fx0, x1: fx1, y0: fy0, y1: fy1 };
      const pisos = Math.max(1, c.pisos ?? 2);
      const alto = interior.y1 - interior.y0;
      lc.especiero = { pisos: Array.from({ length: pisos }, (_, k) => interior.y0 + (alto * k) / pisos) };
      return;
    }

    if (c.tipo === 'horno') {
      if (infantil) {
        // Horno de juguete: puerta abatible con ventana sobre una franja de perillas.
        const alto = Math.min(fy1 - fy0, Math.max(200, (fy1 - fy0) * 0.78));
        lc.horno = { x0: fx0, x1: fx1, y0: fy0, y1: fy0 + alto };
        frentes.push({ tipo: 'faja', cuerpo: i, indice: 0, rect: { x0: fx0, x1: fx1, y0: fy0 + alto + luz, y1: fy1 } });
        return;
      }
      const hx0 = inIzq;
      const hx1 = inDer;
      const hy0 = yFondo;
      const alto = Math.min(ALTO_HORNO, fy1 - hy0 - 60);
      lc.horno = { x0: hx0, x1: hx1, y0: hy0, y1: hy0 + alto };
      frentes.push({ tipo: 'faja', cuerpo: i, indice: 0, rect: { x0: fx0, x1: fx1, y0: hy0 + alto + luz, y1: fy1 } });
      return;
    }

    const cols = c.columnasCajones === 2 && c.cajones > 1 ? 2 : 1;
    const filas = Math.ceil(c.cajones / cols);
    let topeCajones = fy0;
    if (c.cajonesArriba && c.cajones > 0 && c.puertas > 0) {
      // Cajones arriba (numerados de arriba hacia abajo) y puertas abajo. El cajón se acota
      // para dejar al menos 20 cm de puerta (y nunca pasa del alto del módulo).
      const libre = fy1 - fy0;
      const fijo = Math.min(c.altoCajon > 0 ? c.altoCajon : altoCajonDefecto(d), Math.max(90, libre - luz - 200), libre);
      const maxFilas = Math.max(1, Math.floor((libre - 200 + luz) / (fijo + luz)));
      const k = Math.min(filas, maxFilas);
      const xs = tramos(fx0, fx1, cols, luz);
      let indice = 0;
      let piso = fy1;
      for (let r = 0; r < k; r++) {
        const y1 = fy1 - r * (fijo + luz);
        piso = y1 - fijo;
        for (let q = 0; q < cols && indice < c.cajones; q++) {
          frentes.push({ tipo: 'cajon', cuerpo: i, indice: indice++, rect: { x0: xs[q][0], x1: xs[q][1], y0: piso, y1 } });
        }
      }
      lc.zonaCajones = { x0: fx0, x1: fx1, y0: piso, y1: fy1 };
      const py1 = piso - luz;
      if (py1 - fy0 > 80) {
        lc.zonaPuertas = { x0: fx0, x1: fx1, y0: fy0, y1: py1 };
        tramos(fx0, fx1, c.puertas, luz).forEach(([a, b], q) => {
          frentes.push({ tipo: 'puerta', cuerpo: i, indice: q, bisagra: bisagraDe(c, q), rect: { x0: a, x1: b, y0: fy0, y1: py1 } });
        });
      }
      return;
    }
    if (c.cajones > 0) {
      const fijo = c.altoCajon > 0 ? c.altoCajon : c.puertas > 0 ? altoCajonDefecto(d) : 0;
      let filasY: [number, number][];
      if (fijo > 0) {
        const maxFilas = Math.max(1, Math.floor((fy1 - fy0 + luz) / (fijo + luz)));
        const k = Math.min(filas, maxFilas);
        filasY = Array.from({ length: k }, (_, r) => [fy0 + r * (fijo + luz), fy0 + r * (fijo + luz) + fijo]);
      } else {
        filasY = tramos(fy0, fy1, filas, luz);
      }
      // Las filas se numeran de arriba hacia abajo para el usuario.
      const xs = tramos(fx0, fx1, cols, luz);
      let indice = 0;
      for (let r = filasY.length - 1; r >= 0; r--) {
        for (let k = 0; k < cols; k++) {
          if (indice >= c.cajones) break;
          frentes.push({
            tipo: 'cajon',
            cuerpo: i,
            indice,
            rect: { x0: xs[k][0], x1: xs[k][1], y0: filasY[r][0], y1: filasY[r][1] },
          });
          indice++;
        }
      }
      topeCajones = filasY.length ? filasY[filasY.length - 1][1] : fy0;
      lc.zonaCajones = { x0: fx0, x1: fx1, y0: fy0, y1: topeCajones };
    }

    if (c.puertas > 0) {
      const py0 = c.cajones > 0 ? topeCajones + luz : fy0;
      if (fy1 - py0 > 80) {
        lc.zonaPuertas = { x0: fx0, x1: fx1, y0: py0, y1: fy1 };
        const xs = tramos(fx0, fx1, c.puertas, luz);
        xs.forEach(([a, b], k) => {
          frentes.push({ tipo: 'puerta', cuerpo: i, indice: k, bisagra: bisagraDe(c, k), rect: { x0: a, x1: b, y0: py0, y1: fy1 } });
        });
      }
    }
  });

  // Fila superior de cajones pequeños a todo el ancho (cómodas tipo 13 cajones).
  let filaSuperior: Rect | null = null;
  if (d.filaSuperior > 0 && d.plantilla === 'comoda') {
    const alto = 130;
    const y1 = d.alto - t - luz / 2;
    filaSuperior = { x0: -d.ancho / 2 + luz / 2, x1: d.ancho / 2 - luz / 2, y0: y1 - alto, y1 };
    const xs = tramos(filaSuperior.x0, filaSuperior.x1, d.filaSuperior, luz);
    xs.forEach(([a, b], k) => frentes.push({ tipo: 'cajon', cuerpo: -1, indice: k, rect: { x0: a, x1: b, y0: y1 - alto, y1 } }));
    // Los cuerpos inferiores pierden la altura de la fila superior.
    const limite = y1 - alto - luz;
    for (const f of frentes) {
      if (f.cuerpo >= 0 && f.rect.y1 > limite) {
        // Reescala verticalmente los frentes de los cuerpos para dejar espacio.
        const c = cuerpos[f.cuerpo];
        const y0 = d.zocalo + (d.zocalo > 0 ? luz / 2 : 2);
        const yMax = c.yTope - luz / 2;
        const esc = (limite - y0) / (yMax - y0);
        f.rect = { ...f.rect, y0: y0 + (f.rect.y0 - y0) * esc, y1: y0 + (f.rect.y1 - y0) * esc };
      }
    }
    for (const c of cuerpos) {
      c.interior.y1 = Math.min(c.interior.y1, limite - t);
    }
    divisiones.forEach((dv) => (dv.y1 = Math.min(dv.y1, limite - luz)));
  }

  return {
    ancho: d.ancho,
    alto: d.alto,
    profundidad: d.profundidad,
    espesor: t,
    espesorFrente: tf,
    zFrente,
    profundidadCasco,
    yTope,
    espesorCubierta: ct,
    cuerpos,
    frentes,
    divisiones,
    filaSuperior,
  };
}

/**
 * Bisagra de la puerta k de un cuerpo: la puerta única (o la impar de un módulo de 3,
 * que es la primera de la izquierda) usa la apertura elegida; las demás van en pares
 * que se abren desde los extremos.
 */
export function bisagraDe(c: Cuerpo, k: number): Bisagra | 'arriba' {
  if (c.abatible) return 'arriba';
  const impar = c.puertas % 2 === 1;
  if (impar && k === 0) return c.bisagra;
  const j = impar ? k - 1 : k;
  const pares = impar ? c.puertas - 1 : c.puertas;
  return j < pares / 2 ? 'izq' : 'der';
}

/** Si el módulo tiene una puerta cuya apertura (izquierda o derecha) se elige: 1 puerta o la impar de 3. */
export function aperturaAjustable(c: Cuerpo): boolean {
  if (c.abatible || c.tipo === 'nicho') return false;
  if (c.tipo !== 'frentes' && c.tipo !== 'campana') return false;
  return c.puertas % 2 === 1;
}

// ---------- Aéreos ----------

export interface LayoutAereoCuerpo {
  indice: number;
  cuerpo: Cuerpo;
  x0: number;
  x1: number;
  /** Caja del mueble (y en coordenadas del piso). En la campana es solo la parte con puertas. */
  y0: number;
  y1: number;
  /** Nicho abierto bajo la puerta abatible (tipo nicho). */
  nicho: Rect | null;
}

export interface LayoutAereos {
  montaje: 'mural' | 'apoyado';
  x0: number;
  x1: number;
  /** Borde inferior y superior de los muebles superiores. */
  y0: number;
  y1: number;
  /** Apoyado: altura de la cubierta del mueble base, donde nacen los costados. */
  yCubierta: number;
  profundidad: number;
  zFrente: number;
  espesor: number;
  cuerpos: LayoutAereoCuerpo[];
  frentes: FrentePuerta[];
}

/** Alto de la parte con puertas de un módulo de campana o de la puerta abatible de un nicho. */
export function altoSuperior(tipo: 'campana' | 'nicho', alto: number): number {
  const proporcion = tipo === 'campana' ? 0.5 : 0.45;
  return Math.round(Math.max(200, Math.min(alto - 150, alto * proporcion)));
}

/** Largo útil (mm) de los módulos de un lado del aéreo: desde la esquina del aéreo principal. */
export function largoUtilLadoAereo(d: Diseno, lado: LadoId): number {
  const r = d.aereos.lados?.[lado];
  return r ? Math.max(0, r.largo - d.aereos.profundidad) : 0;
}

/** Lado del aéreo que existe y se dibuja (aéreos murales activos de cocina). */
export function ladoAereoActivo(d: Diseno, lado: LadoId): Lado | null {
  const a = d.aereos;
  if (!a.activo || a.montaje !== 'mural' || d.plantilla !== 'cocina') return null;
  const r = a.lados?.[lado];
  return r && r.cuerpos.length ? r : null;
}

/** Inicio en x del aéreo principal según su largo, su alineación y sus lados (que lo anclan a un muro). */
export function inicioAereoPrincipal(d: Diseno): number {
  const a = d.aereos;
  const largo = a.cuerpos.reduce((s, c) => s + c.ancho, 0);
  const [sx0, sx1] = extremosPrincipal(d);
  const alineacion = a.lados?.izq ? 'izq' : a.lados?.der ? 'der' : a.alineacion;
  return alineacion === 'izq' ? sx0 : alineacion === 'der' ? sx1 - largo : (sx0 + sx1) / 2 - largo / 2;
}

function layoutAereosTramo(d: Diseno, cuerpos: Cuerpo[], x0: number, profundidad: number): LayoutAereos {
  const a = d.aereos;
  const t = d.espesor;
  const luz = d.luzFrentes;
  const apoyado = a.montaje === 'apoyado';
  const y1 = apoyado ? d.alto : a.elevacion + a.alto;
  const y0 = y1 - a.alto;
  const zFrente = profundidad - t;
  const lcs: LayoutAereoCuerpo[] = [];
  const frentes: FrentePuerta[] = [];
  let cursor = x0;
  cuerpos.forEach((c, i) => {
    const cx0 = cursor;
    const cx1 = cursor + c.ancho;
    cursor = cx1;
    const lc: LayoutAereoCuerpo = { indice: i, cuerpo: c, x0: cx0, x1: cx1, y0, y1, nicho: null };
    lcs.push(lc);
    if (c.tipo === 'hueco') return;
    const fx0 = cx0 + luz / 2;
    const fx1 = cx1 - luz / 2;
    const puerta = (k: number, n: number, ry0: number, ry1: number, abatible: boolean) => {
      const xs = tramos(fx0, fx1, n, luz)[k];
      frentes.push({
        tipo: 'puerta',
        cuerpo: i,
        indice: k,
        bisagra: abatible ? 'arriba' : bisagraDe({ ...c, puertas: n }, k),
        rect: { x0: xs[0], x1: xs[1], y0: ry0, y1: ry1 },
      });
    };
    if (c.tipo === 'nicho') {
      const hA = altoSuperior('nicho', a.alto);
      puerta(0, 1, y1 - hA + luz / 2, y1 - luz / 2, true);
      lc.nicho = { x0: cx0 + t, x1: cx1 - t, y0: y0 + t, y1: y1 - hA - t };
      return;
    }
    if (c.tipo === 'campana') {
      const h = altoSuperior('campana', a.alto);
      lc.y0 = y1 - h;
      const n = Math.max(1, c.puertas);
      for (let k = 0; k < n; k++) puerta(k, n, lc.y0 + luz / 2, y1 - luz / 2, !!c.abatible);
      return;
    }
    // Módulo con puertas (las abatibles son una sola puerta a todo el ancho).
    const n = c.abatible ? 1 : Math.max(0, c.puertas);
    for (let k = 0; k < n; k++) puerta(k, n, y0 + luz / 2, y1 - luz / 2, !!c.abatible);
  });
  return {
    montaje: a.montaje,
    x0,
    x1: cursor,
    y0,
    y1,
    yCubierta: apoyado ? a.elevacion : y0,
    profundidad,
    zFrente,
    espesor: t,
    cuerpos: lcs,
    frentes,
  };
}

/** Aéreo principal (o mueble superior del compacto) en coordenadas del mueble. */
export function calcularLayoutAereos(d: Diseno): LayoutAereos | null {
  const a = d.aereos;
  if (!a.activo || !a.cuerpos.length) return null;
  return layoutAereosTramo(d, a.cuerpos, inicioAereoPrincipal(d), a.profundidad);
}

/** Lado del aéreo en coordenadas locales (como disenoLado: x a lo largo del muro lateral, centrado en 0). */
export function calcularLayoutAereosLado(d: Diseno, lado: LadoId): LayoutAereos | null {
  const r = ladoAereoActivo(d, lado);
  if (!r) return null;
  return layoutAereosTramo(d, r.cuerpos, -largoUtilLadoAereo(d, lado) / 2, r.profundidad);
}

/** Ubicación de un lado del aéreo: cuelga del muro lateral (en el extremo del base) desde la esquina del aéreo principal. */
export function transformAereoLado(d: Diseno, lado: LadoId): Transformacion | null {
  const r = d.aereos.lados?.[lado];
  if (!r) return null;
  const [x0, x1] = extremosPrincipal(d);
  const z = d.aereos.profundidad + largoUtilLadoAereo(d, lado) / 2;
  return lado === 'der' ? { x: x1, z, rotY: -Math.PI / 2 } : { x: x0, z, rotY: Math.PI / 2 };
}

/** Lleva un punto local de un lado del aéreo al espacio del mueble: [x, z]. */
export function aMundoAereoLado(d: Diseno, lado: LadoId, x: number, z: number): [number, number] {
  return girar(transformAereoLado(d, lado)!, lado, x, z);
}

// ---------- Eje de cada tramo ----------

/** Largo (mm) que llenan los módulos de un tramo según la geometría (no la suma de sus módulos). */
export function largoEje(d: Diseno, t: TramoId): number {
  switch (t) {
    case 'base':
      return d.ancho;
    case 'izq':
    case 'der':
      return largoUtilLado(d, t);
    case 'aereos':
      return d.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0);
    default:
      return largoUtilLadoAereo(d, ladoDeTramo(t)!);
  }
}

/**
 * Punto en planta (x, z del mueble, sobre el muro de ese tramo) que corresponde a la
 * posición s (mm desde el comienzo del primer módulo) a lo largo de un tramo.
 */
export function posEnMundo(d: Diseno, t: TramoId, s: number): { x: number; z: number } {
  const L = largoEje(d, t);
  if (t === 'base') return { x: -d.ancho / 2 + s, z: 0 };
  if (t === 'aereos') return { x: inicioAereoPrincipal(d) + s, z: 0 };
  const lado = ladoDeTramo(t)!;
  const tr = esTramoAereo(t) ? transformAereoLado(d, lado) : transformLado(d, lado);
  if (!tr) return { x: 0, z: 0 };
  const [x, z] = girar(tr, lado, s - L / 2, 0);
  return { x, z };
}

/** Posición s a lo largo de un tramo del punto en planta más cercano (inversa de posEnMundo). */
export function posEnTramo(d: Diseno, t: TramoId, p: { x: number; z: number }): number {
  const L = largoEje(d, t);
  if (t === 'base') return p.x + d.ancho / 2;
  if (t === 'aereos') return p.x - inicioAereoPrincipal(d);
  const lado = ladoDeTramo(t)!;
  const tr = esTramoAereo(t) ? transformAereoLado(d, lado) : transformLado(d, lado);
  if (!tr) return 0;
  return desgirar(tr, lado, p.x, p.z)[0] + L / 2;
}

/** Transformación de un tramo (null en los principales, que ya están en coordenadas del mueble). */
export function transformTramo(d: Diseno, t: TramoId): Transformacion | null {
  if (t === 'base' || t === 'aereos') return null;
  const lado = ladoDeTramo(t)!;
  return esTramoAereo(t) ? transformAereoLado(d, lado) : transformLado(d, lado);
}

// ---------- Equipamiento ----------

/**
 * Medidas nominales (mm) del equipamiento. `ancho` × `fondo` es el corte (orificio) en la
 * cubierta; `anchoTotal` es el ancho del equipo completo apoyado sobre la cubierta (la placa de la
 * encimera, el lavaplatos con su secador). El lavaplatos simple lleva la cubeta a la izquierda y el
 * secador estriado a la derecha (como el modelo de la tienda), así que su corte no va centrado:
 * `cubeta` es el ancho de la zona de la cubeta, con el corte al medio de ella.
 * Riñonera: una sola cubeta redondeada sin secador; corte de 55 × 40 cm en un equipo de 61 cm.
 */
export const MEDIDAS_EQUIPO = {
  encimera: {
    '2': { ancho: 300, fondo: 520, anchoTotal: 300 },
    '3': { ancho: 580, fondo: 500, anchoTotal: 730 },
    '4': { ancho: 580, fondo: 510, anchoTotal: 600 },
  },
  lavaplatos: {
    simple: { ancho: 400, fondo: 360, anchoTotal: 800, cubeta: 440 },
    doble: { ancho: 770, fondo: 380, anchoTotal: 770, cubeta: 770 },
    rinonera: { ancho: 550, fondo: 400, anchoTotal: 610, cubeta: 610 },
  },
  campana: { ancho: 600, fondo: 480 },
  horno: { ancho: 595, alto: ALTO_HORNO },
} as const;

/** Distancia mínima (mm) entre el lavaplatos y el borde al que va pegado. */
export const MARGEN_MIN_LAVAPLATOS = 50;
/** Ancho de módulo con el que el lavaplatos queda dentro de su mueble. */
export const MODULO_MIN_LAVAPLATOS = { simple: 450, doble: 800, rinonera: 600 } as const;

/**
 * Cuánto se extiende el equipo completo (mm) a la izquierda y a la derecha del centro de su
 * corte. La cocina infantil es de juguete: su equipo mide lo mismo que el corte. El lavaplatos
 * simple lleva el secador a la derecha (o a la izquierda si `secador` lo dice).
 */
export function extensionEquipo(d: Pick<Diseno, 'plantilla'>, e: Equipo, secador: 'izq' | 'der' = 'der'): [number, number] {
  if (e.tipo === 'encimera') {
    const m = MEDIDAS_EQUIPO.encimera[e.platos];
    const w = d.plantilla === 'cocina-infantil' ? m.ancho : m.anchoTotal;
    return [w / 2, w / 2];
  }
  const m = MEDIDAS_EQUIPO.lavaplatos[e.modelo];
  if (d.plantilla === 'cocina-infantil') return [m.ancho / 2, m.ancho / 2];
  const cubeta = m.cubeta / 2;
  const resto = m.anchoTotal - cubeta;
  return secador === 'der' ? [cubeta, resto] : [resto, cubeta];
}

/**
 * Dónde va el lavaplatos: centro del corte (s), su extensión a cada lado y el lado del secador.
 * El secador del simple va hacia adentro del módulo: a la derecha por defecto y pegado al borde
 * izquierdo; a la izquierda si va pegado al borde derecho, o si centrado a la derecha se saldría
 * de la cubierta.
 */
export function ubicacionLavaplatos(d: Diseno, l: Lavaplatos): { s: number; ext: [number, number]; secador: 'izq' | 'der' } | null {
  const pos = posicionesModulos(d, l.tramo);
  const m = pos.find((p) => p.id === l.modulo);
  if (!m) return null;
  const L = largoEje(d, l.tramo);
  const colocar = (secador: 'izq' | 'der') => {
    const ext = extensionEquipo(d, l, secador);
    const [ei, ed] = ext;
    let s: number;
    if (l.posicion === 'izq') s = dentro(m.s0 + l.margen + ei, m);
    else if (l.posicion === 'der') s = dentro(m.s1 - l.margen - ed, m);
    else {
      // Centrado: el equipo completo queda al medio del módulo, sin salirse de la cubierta.
      const c = (m.s0 + m.s1) / 2 - (ed - ei) / 2;
      const lo = ei + 45;
      const hi = L - ed - 45;
      s = dentro(lo <= hi ? Math.max(lo, Math.min(hi, c)) : L / 2, m);
    }
    return { s, ext, secador, sale: Math.max(0, -(s - ei)) + Math.max(0, s + ed - L) };
  };
  if (l.modelo !== 'simple' || d.plantilla === 'cocina-infantil') {
    const r = colocar('der');
    return { s: r.s, ext: r.ext, secador: r.secador };
  }
  if (l.posicion === 'der') {
    const r = colocar('izq');
    return { s: r.s, ext: r.ext, secador: r.secador };
  }
  const der = colocar('der');
  const izq = l.posicion === 'centro' && der.sale > 0.5 ? colocar('izq') : null;
  const r = izq && izq.sale < der.sale ? izq : der;
  return { s: r.s, ext: r.ext, secador: r.secador };
}

/** Ancho del equipo completo sobre la cubierta (mm). */
export function anchoTotalEquipo(d: Pick<Diseno, 'plantilla'>, e: Equipo): number {
  const [a, b] = extensionEquipo(d, e);
  return a + b;
}

export interface EquipoUbicado {
  /** Id del equipo; el horno usa el id de su módulo y la campana `<id encimera>:campana`. */
  id: string;
  tipo: 'encimera' | 'lavaplatos' | 'horno' | 'campana';
  tramo: TramoId;
  /** Índice y id del módulo que lo lleva (la campana mural: el módulo de su encimera). */
  indice: number;
  modulo: string;
  /** Centro a lo largo del tramo, en mm desde el comienzo de su primer módulo. */
  s: number;
  /** Centro en x local del layout de ese tramo (calcularLayout / calcularLayoutAereos*). */
  x: number;
  ancho: number;
  fondo: number;
  /** Encimera y lavaplatos: inicio y fin (s) del equipo completo sobre la cubierta. */
  total?: { s0: number; s1: number };
  /** Lavaplatos simple: lado del secador (respecto de s creciente). */
  secador?: 'izq' | 'der';
  /** Centro en planta, sobre el muro del tramo (coordenadas del mueble). */
  mundo: { x: number; z: number };
  /** Campana: alojada en un módulo de los aéreos o mural (sin aéreos encima). */
  montaje?: 'aereo' | 'mural';
  /** Campana: id de su encimera. */
  encimera?: string;
}

function cuerposTramo(d: Diseno, t: TramoId): Cuerpo[] {
  if (t === 'base') return d.cuerpos;
  if (t === 'izq' || t === 'der') return d.lados?.[t]?.cuerpos ?? [];
  if (t === 'aereos') return d.aereos.cuerpos;
  return d.aereos.lados?.[ladoDeTramo(t)!]?.cuerpos ?? [];
}

/** Inicio (s) y fin de cada módulo a lo largo de un tramo. */
export function posicionesModulos(d: Diseno, t: TramoId): { id: string; s0: number; s1: number }[] {
  const sep = t === 'base' ? d.separacionCuerpos : 0;
  let cursor = 0;
  return cuerposTramo(d, t).map((c) => {
    const s0 = cursor;
    cursor += c.ancho + sep;
    return { id: c.id, s0, s1: s0 + c.ancho };
  });
}

/** Centro (s, mm a lo largo de su tramo) de una encimera, como se dibuja (sin salirse de la cubierta). */
export function centroEncimera(d: Diseno, e: Encimera): number | null {
  const pos = posicionesModulos(d, e.tramo);
  const m = pos.find((p) => p.id === e.modulo);
  if (!m) return null;
  const L = largoEje(d, e.tramo);
  // Con campana se aleja de la punta lo que pide la campana (60 cm): así la campana queda
  // centrada sobre ella sin salirse del aéreo, que termina donde termina la cubierta.
  const media = Math.max(anchoTotalEquipo(d, e), e.campana ? MEDIDAS_EQUIPO.campana.ancho : 0) / 2;
  const c = (m.s0 + m.s1) / 2;
  // No se sale de la cubierta y su centro queda siempre sobre su módulo.
  return dentro(L > 2 * media ? Math.max(media, Math.min(L - media, c)) : L / 2, m);
}

function dentro(s: number, m: { s0: number; s1: number }): number {
  return Math.max(m.s0, Math.min(m.s1, s));
}

/** Centro (s) de un lavaplatos: centrado en su módulo o pegado a uno de sus bordes con su margen. */
export function centroLavaplatos(d: Diseno, l: Lavaplatos): number | null {
  return ubicacionLavaplatos(d, l)?.s ?? null;
}

/** x local del layout de un tramo a partir de s. */
function xLocal(d: Diseno, t: TramoId, s: number): number {
  if (t === 'base') return -d.ancho / 2 + s;
  if (t === 'aereos') return inicioAereoPrincipal(d) + s;
  return s - largoEje(d, t) / 2;
}

/**
 * Dónde va cada equipo (encimeras, lavaplatos, hornos y campanas) en todos los tramos,
 * con su posición a lo largo del tramo y en planta. Lo usa el 3D para dibujarlos y la
 * ficha de fabricación para acotarlos.
 */
export function ubicarEquipos(d: Diseno): EquipoUbicado[] {
  const out: EquipoUbicado[] = [];
  const tramosBase: TramoBase[] = ['base', 'izq', 'der'];
  const db = disenoBase(d);
  for (const t of tramosBase) {
    const cs = cuerposTramo(db, t);
    if (!cs.length) continue;
    const pos = posicionesModulos(db, t);
    cs.forEach((c, i) => {
      if (c.tipo !== 'horno' || d.plantilla === 'cocina-infantil') return;
      const s = (pos[i].s0 + pos[i].s1) / 2;
      out.push({ id: c.id, tipo: 'horno', tramo: t, indice: i, modulo: c.id, s, x: xLocal(db, t, s), ancho: c.ancho, fondo: db.profundidad, mundo: posEnMundo(db, t, s) });
    });
  }
  for (const e of d.equipos ?? []) {
    const i = cuerposTramo(db, e.tramo).findIndex((c) => c.id === e.modulo);
    if (i < 0) continue;
    const ul = e.tipo === 'lavaplatos' ? ubicacionLavaplatos(db, e) : null;
    const s = e.tipo === 'encimera' ? centroEncimera(db, e) : (ul?.s ?? null);
    if (s == null) continue;
    const med = e.tipo === 'encimera' ? MEDIDAS_EQUIPO.encimera[e.platos] : MEDIDAS_EQUIPO.lavaplatos[e.modelo];
    const [ei, ed] = ul ? ul.ext : extensionEquipo(db, e);
    out.push({ id: e.id, tipo: e.tipo, tramo: e.tramo, indice: i, modulo: e.modulo, s, x: xLocal(db, e.tramo, s), ancho: med.ancho, fondo: med.fondo, total: { s0: s - ei, s1: s + ed }, ...(ul && e.tipo === 'lavaplatos' && e.modelo === 'simple' && d.plantilla !== 'cocina-infantil' ? { secador: ul.secador } : {}), mundo: posEnMundo(db, e.tramo, s) });
    if (e.tipo !== 'encimera' || !e.campana) continue;
    const mundo = posEnMundo(db, e.tramo, s);
    const ta = tramoAereoDe(e.tramo);
    const ca = cuerposTramo(d, ta);
    const ia = ca.findIndex((c) => c.tipo === 'campana' && c.campanaDe === e.id);
    const aereoVisible = d.aereos.activo && (ta === 'aereos' || ladoAereoActivo(d, ladoDeTramo(ta)!));
    if (ia >= 0 && aereoVisible) {
      const pa = posicionesModulos(d, ta)[ia];
      const sa = Math.max(pa.s0, Math.min(pa.s1, posEnTramo(d, ta, mundo)));
      const w = Math.min(MEDIDAS_EQUIPO.campana.ancho, pa.s1 - pa.s0);
      const sc = Math.max(pa.s0 + w / 2, Math.min(pa.s1 - w / 2, sa));
      out.push({ id: `${e.id}:campana`, tipo: 'campana', tramo: ta, indice: ia, modulo: ca[ia].id, s: sc, x: xLocal(d, ta, sc), ancho: w, fondo: MEDIDAS_EQUIPO.campana.fondo, mundo: posEnMundo(d, ta, sc), montaje: 'aereo', encimera: e.id });
    } else {
      out.push({ id: `${e.id}:campana`, tipo: 'campana', tramo: e.tramo, indice: i, modulo: e.modulo, s, x: xLocal(db, e.tramo, s), ancho: MEDIDAS_EQUIPO.campana.ancho, fondo: MEDIDAS_EQUIPO.campana.fondo, mundo, montaje: 'mural', encimera: e.id });
    }
  }
  return out;
}

export function altoBaseInfantil(d: Diseno): number {
  return Math.round(Math.min(620, Math.max(420, d.alto * 0.56)));
}

/** Centro en x de un cuerpo (para ubicar encimera y lavaplatos). */
export function centroCuerpo(l: Layout, i: number): number {
  const c = l.cuerpos[Math.max(0, Math.min(l.cuerpos.length - 1, i))];
  return c ? (c.x0 + c.x1) / 2 : 0;
}

// ---------- Tocador ----------

export interface LayoutTocador {
  cubierta: { y: number; espesor: number; profundidad: number };
  pedestales: { lado: 'izq' | 'der'; x0: number; x1: number }[];
  frentes: FrenteCajon[];
  centro: Rect | null;
  espejo: { x0: number; x1: number; y0: number; y1: number };
  respaldo: { x0: number; x1: number; y0: number; y1: number };
}

export function calcularLayoutTocador(d: Diseno): LayoutTocador {
  const t = d.espesor;
  const luz = d.luzFrentes;
  const o = d.tocador;
  const yCub = Math.min(o.altoCubierta, d.alto - 300);
  const espCub = 25;
  const anchoPed = Math.min(420, Math.max(300, d.ancho * 0.3));
  const pedestales: LayoutTocador['pedestales'] = [];
  if (o.cajonesIzq > 0) pedestales.push({ lado: 'izq', x0: -d.ancho / 2, x1: -d.ancho / 2 + anchoPed });
  if (o.cajonesDer > 0) pedestales.push({ lado: 'der', x0: d.ancho / 2 - anchoPed, x1: d.ancho / 2 });
  const frentes: FrenteCajon[] = [];
  const yBase = d.zocalo + 20;
  const yTopeFrentes = yCub - espCub - luz / 2;
  let indice = 0;
  for (const p of pedestales) {
    const k = p.lado === 'izq' ? o.cajonesIzq : o.cajonesDer;
    const xs: [number, number] = [p.x0 + t + luz / 2, p.x1 - t - luz / 2];
    const filas = tramos(yBase, yTopeFrentes, k, luz);
    for (let r = filas.length - 1; r >= 0; r--) {
      frentes.push({ tipo: 'cajon', cuerpo: p.lado === 'izq' ? 0 : 2, indice: indice++, rect: { x0: xs[0], x1: xs[1], y0: filas[r][0], y1: filas[r][1] } });
    }
  }
  const izq = pedestales.find((p) => p.lado === 'izq');
  const der = pedestales.find((p) => p.lado === 'der');
  const cx0 = (izq ? izq.x1 : -d.ancho / 2 + t) + luz / 2;
  const cx1 = (der ? der.x0 : d.ancho / 2 - t) - luz / 2;
  let centro: Rect | null = null;
  if (o.cajonesCentro > 0 && cx1 - cx0 > 200) {
    const alto = 140;
    centro = { x0: cx0, x1: cx1, y0: yTopeFrentes - alto, y1: yTopeFrentes };
    tramos(cx0, cx1, o.cajonesCentro, luz).forEach(([a, b]) =>
      frentes.push({ tipo: 'cajon', cuerpo: 1, indice: indice++, rect: { x0: a, x1: b, y0: yTopeFrentes - alto, y1: yTopeFrentes } }),
    );
  }
  const anchoRepisas = o.repisasLaterales ? Math.min(220, d.ancho * 0.18) : 0;
  const respaldo = { x0: -d.ancho / 2 + 40, x1: d.ancho / 2 - 40 - anchoRepisas, y0: yCub, y1: d.alto };
  const margen = o.espejo === 'hollywood' ? 70 : 45;
  const espejo = { x0: respaldo.x0 + margen, x1: respaldo.x1 - margen, y0: yCub + 120, y1: d.alto - margen };
  return {
    cubierta: { y: yCub, espesor: espCub, profundidad: d.profundidad },
    pedestales,
    frentes,
    centro,
    espejo,
    respaldo,
  };
}
