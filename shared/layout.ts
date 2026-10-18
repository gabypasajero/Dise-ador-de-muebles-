// Motor de distribución: a partir del diseño calcula la posición y medida de
// cada cuerpo, puerta y cajón. Lo usan el visor 3D y los paneles de medidas.
// Ejes (mm): x de izquierda a derecha centrado en 0, y desde el piso hacia
// arriba, z desde el muro (0) hacia el frente.
import type { Bisagra, Cuerpo, Diseno, Retorno } from './tipos';

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

/** Largo útil (mm) de los módulos del tramo en L: lo que sobresale del tramo principal. */
export function largoUtilRetorno(d: Diseno, r: Retorno | null = d.retorno): number {
  return r ? Math.max(0, r.largo - d.profundidad) : 0;
}

/** Diseño del tramo en L para calcular su distribución con el mismo motor. */
export function disenoRetorno(d: Diseno): Diseno | null {
  const r = d.retorno;
  if (!r || d.plantilla !== 'cocina') return null;
  return {
    ...d,
    ancho: largoUtilRetorno(d),
    profundidad: r.profundidad,
    cuerpos: r.cuerpos,
    separacionCuerpos: 0,
    retorno: null,
    aereos: { ...d.aereos, activo: false, cuerpos: [] },
    cocina: { ...d.cocina, encimera: 'ninguna', lavaplatos: 'ninguno' },
  };
}

/** Ubicación del tramo en L: su eje x local corre desde la esquina, y su fondo queda contra el muro lateral. */
export function transformRetorno(d: Diseno): { x: number; z: number; rotY: number } | null {
  const r = d.retorno;
  if (!r) return null;
  const z = d.profundidad + largoUtilRetorno(d) / 2;
  return r.lado === 'der'
    ? { x: d.ancho / 2 + r.profundidad, z, rotY: -Math.PI / 2 }
    : { x: -d.ancho / 2 - r.profundidad, z, rotY: Math.PI / 2 };
}

/** Lleva un punto del tramo en L (coordenadas locales) al espacio del mueble. */
export function aMundoRetorno(d: Diseno, x: number, z: number): [number, number] {
  const tr = transformRetorno(d)!;
  return d.retorno!.lado === 'der' ? [tr.x - z, tr.z + x] : [tr.x + z, tr.z - x];
}

/** Extremos en x del tramo principal incluyendo la esquina de la L. */
export function extremosPrincipal(d: Diseno): [number, number] {
  const r = d.retorno;
  return [-d.ancho / 2 - (r?.lado === 'izq' ? r.profundidad : 0), d.ancho / 2 + (r?.lado === 'der' ? r.profundidad : 0)];
}

/** Caja que ocupa todo el conjunto (para encuadrar la cámara y la escena). */
export function dimensionesTotales(d: Diseno): { x0: number; x1: number; alto: number; fondo: number } {
  let [x0, x1] = extremosPrincipal(d);
  let alto = d.alto;
  let fondo = d.profundidad;
  if (d.retorno) fondo = Math.max(fondo, d.retorno.largo);
  if (d.aereos.activo && d.aereos.cuerpos.length) {
    const la = calcularLayoutAereos(d);
    if (la) {
      x0 = Math.min(x0, la.x0);
      x1 = Math.max(x1, la.x1);
      alto = Math.max(alto, la.y1);
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
    };
    cuerpos.push(lc);

    if (c.tipo === 'hueco' || c.tipo === 'escritorio') return;

    // Zona frontal disponible para este cuerpo.
    const fx0 = x0 + luz / 2;
    const fx1 = x1 - luz / 2;
    const fy0 = d.zocalo + (d.zocalo > 0 ? luz / 2 : 2);
    let fy1 = tope - luz / 2;
    if (!cocina) fy1 = tope - luz / 2; // bajo el techo

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

/** Bisagra de la puerta k de un cuerpo: una puerta usa la elegida; con varias se abren desde los extremos. */
export function bisagraDe(c: Cuerpo, k: number): Bisagra | 'arriba' {
  if (c.abatible) return 'arriba';
  if (c.puertas === 1) return c.bisagra;
  if (c.puertas % 2 === 0) return k < c.puertas / 2 ? 'izq' : 'der';
  return k === 0 ? 'izq' : k % 2 === 1 ? 'izq' : 'der';
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

export function calcularLayoutAereos(d: Diseno): LayoutAereos | null {
  const a = d.aereos;
  if (!a.activo || !a.cuerpos.length) return null;
  const t = d.espesor;
  const luz = d.luzFrentes;
  const largo = a.cuerpos.reduce((s, c) => s + c.ancho, 0);
  const [sx0, sx1] = extremosPrincipal(d);
  const x0 = a.alineacion === 'izq' ? sx0 : a.alineacion === 'der' ? sx1 - largo : (sx0 + sx1) / 2 - largo / 2;
  const apoyado = a.montaje === 'apoyado';
  const y1 = apoyado ? d.alto : a.elevacion + a.alto;
  const y0 = y1 - a.alto;
  const zFrente = a.profundidad - t;
  const cuerpos: LayoutAereoCuerpo[] = [];
  const frentes: FrentePuerta[] = [];
  let cursor = x0;
  a.cuerpos.forEach((c, i) => {
    const cx0 = cursor;
    const cx1 = cursor + c.ancho;
    cursor = cx1;
    const lc: LayoutAereoCuerpo = { indice: i, cuerpo: c, x0: cx0, x1: cx1, y0, y1, nicho: null };
    cuerpos.push(lc);
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
    profundidad: a.profundidad,
    zFrente,
    espesor: t,
    cuerpos,
    frentes,
  };
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
