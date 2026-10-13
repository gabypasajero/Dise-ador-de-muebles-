// Motor de distribución: a partir del diseño calcula la posición y medida de
// cada cuerpo, puerta y cajón. Lo usan el visor 3D y los paneles de medidas.
// Ejes (mm): x de izquierda a derecha centrado en 0, y desde el piso hacia
// arriba, z desde el muro (0) hacia el frente.
import type { Bisagra, Cuerpo, Diseno } from './tipos';

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
  bisagra: Bisagra;
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
  return d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil';
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

export function calcularLayout(d: Diseno): Layout {
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

    const ladoIzq = modular || i === 0 || c.tipo === 'escritorio' || d.cuerpos[i - 1]?.tipo === 'hueco';
    const ladoDer = modular || i === n - 1 || c.tipo === 'escritorio' || d.cuerpos[i + 1]?.tipo === 'hueco';
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
          let bisagra: Bisagra;
          if (c.puertas === 1) bisagra = c.bisagra;
          else if (c.puertas % 2 === 0) bisagra = k < c.puertas / 2 ? 'izq' : 'der';
          else bisagra = k === 0 ? 'izq' : k % 2 === 1 ? 'izq' : 'der';
          frentes.push({ tipo: 'puerta', cuerpo: i, indice: k, bisagra, rect: { x0: a, x1: b, y0: py0, y1: fy1 } });
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
