// Hoja para el maestro: documento interno, SIN precios, con la imagen referencial, la
// marca, el N° de cotización, el cliente y la fecha; un esquema frontal acotado de cada
// muro (módulos con su ancho, puertas con su apertura, cajones, horno, aéreos) y la ficha
// de fabricación completa del motor (fichaFabricacion de shared/resumen.ts).
import { jsPDF } from 'jspdf';
import {
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  disenoBase,
  disenoLado,
  extremosPrincipal,
  ladoAereoActivo,
  largoUtilLado,
  largoUtilLadoAereo,
  ubicarEquipos,
  type Frente,
  type Layout,
  type LayoutAereos,
} from '../../shared/layout';
import { formatear, normalizar } from '../../shared/reglas';
import { fichaFabricacion, formatoFecha, type FichaFabricacion } from '../../shared/resumen';
import type { CatalogoMateriales, Cliente, Diseno, LadoId, LineaDetalle, ProductoCatalogo, TramoId, Unidad } from '../../shared/tipos';
import { A4, COLORES_MARCA, colorTexto, dibujarCabecera, dibujarImagen, dibujarLogo, fuente, GRIS, latin1, LINEA, MARGEN, nombreArchivo, TEXTO, type Rgb } from './pdf';
import { MARCAS, type Marca } from './marcas';

export interface DatosHojaMaestro {
  marca: Marca;
  numero: string | null;
  cliente: Cliente;
  fecha: string;
  vendedor: string;
  vendedorTelefono?: string | null;
  modelo: string;
  imagen: string | null;
  diseno: Diseno;
  producto: ProductoCatalogo | null;
  materiales: CatalogoMateriales | null;
  unidad: Unidad;
  observaciones: string | null;
}

// ---------- Esquema frontal de cada muro ----------

interface Caja {
  h0: number;
  h1: number;
  y0: number;
  y1: number;
}

/** Lo que se dibuja de un muro, en mm: h a lo largo del muro (izquierda → derecha mirándolo), y desde el piso. */
export interface Muro {
  titulo: string;
  base: { layout: Layout; h: (x: number) => number; cubierta: Caja | null; zocalo: Caja | null; modulos: { numero: number; caja: Caja; ancho: number }[] } | null;
  aereo: { layout: LayoutAereos; h: (x: number) => number; modulos: { numero: number; caja: Caja; ancho: number }[] } | null;
  /** Esquinas que ocupa el tramo principal (en los lados) o los lados (en el principal). */
  esquinas: Caja[];
  equipos: { h: number; ancho: number; texto: string; campanaMural: boolean }[];
  h0: number;
  h1: number;
  alto: number;
}

const NOMBRE_EQUIPO: Record<string, (d: Diseno, id: string) => string> = {
  encimera: (d, id) => {
    const e = d.equipos.find((x) => x.id === id);
    return e && e.tipo === 'encimera' ? `Encimera ${e.platos} platos` : 'Encimera';
  },
  lavaplatos: (d, id) => {
    const e = d.equipos.find((x) => x.id === id);
    return e && e.tipo === 'lavaplatos' ? `Lavaplatos ${e.modelo}` : 'Lavaplatos';
  },
};

function tramosDelMuro(muro: 'principal' | LadoId): { base: TramoId; aereo: TramoId } {
  if (muro === 'principal') return { base: 'base', aereo: 'aereos' };
  return muro === 'izq' ? { base: 'izq', aereo: 'aereos-izq' } : { base: 'der', aereo: 'aereos-der' };
}

/** Calcula los muros con módulos (izquierdo, principal, derecho) para dibujar su esquema. */
export function murosDe(d: Diseno): Muro[] {
  if (d.plantilla === 'tocador') return [];
  const out: Muro[] = [];
  const [e0, e1] = extremosPrincipal(d);
  const P = d.profundidad;
  const Pa = d.aereos.profundidad;
  const ubic = (() => {
    try {
      return ubicarEquipos(d);
    } catch {
      return [];
    }
  })();
  for (const muro of ['izq', 'principal', 'der'] as const) {
    let layout: Layout | null = null;
    let hB: (x: number) => number = (x) => x;
    let la: LayoutAereos | null = null;
    let hA: (x: number) => number = (x) => x;
    const esquinas: Caja[] = [];
    if (muro === 'principal') {
      layout = d.cuerpos.length ? calcularLayout(disenoBase(d)) : null;
      la = calcularLayoutAereos(d);
      if (layout) {
        const tope = layout.yTope + layout.espesorCubierta;
        if (d.lados?.izq) esquinas.push({ h0: e0, h1: -d.ancho / 2, y0: 0, y1: tope });
        if (d.lados?.der) esquinas.push({ h0: d.ancho / 2, h1: e1, y0: 0, y1: tope });
      }
    } else {
      const dl = disenoLado(d, muro);
      if (!dl || !dl.cuerpos.length) continue;
      layout = calcularLayout(dl);
      const L = largoUtilLado(d, muro);
      // Mirando el muro izquierdo, la esquina queda a la derecha; mirando el derecho, a la izquierda.
      hB = muro === 'izq' ? (x) => x - P - L / 2 : (x) => x + P + L / 2;
      const tope = layout.yTope + layout.espesorCubierta;
      esquinas.push(muro === 'izq' ? { h0: -P, h1: 0, y0: 0, y1: tope } : { h0: 0, h1: P, y0: 0, y1: tope });
      if (ladoAereoActivo(d, muro)) {
        la = calcularLayoutAereosLado(d, muro);
        const La = largoUtilLadoAereo(d, muro);
        hA = muro === 'izq' ? (x) => x - Pa - La / 2 : (x) => x + Pa + La / 2;
        if (la) esquinas.push(muro === 'izq' ? { h0: -Pa, h1: 0, y0: la.y0, y1: la.y1 } : { h0: 0, h1: Pa, y0: la.y0, y1: la.y1 });
      }
    }
    if (!layout && !la) continue;
    const { base: tb, aereo: ta } = tramosDelMuro(muro);
    const base = layout
      ? (() => {
          const l = layout;
          const ancho = l.cuerpos.length ? [hB(l.cuerpos[0].x0), hB(l.cuerpos[l.cuerpos.length - 1].x1)] : [0, 0];
          const cocina = l.espesorCubierta > 0;
          return {
            layout: l,
            h: hB,
            cubierta: cocina ? { h0: Math.min(ancho[0], ...esquinas.filter((e) => e.y0 === 0).map((e) => e.h0)), h1: Math.max(ancho[1], ...esquinas.filter((e) => e.y0 === 0).map((e) => e.h1)), y0: l.yTope, y1: l.yTope + l.espesorCubierta } : null,
            zocalo: d.zocalo > 0 ? { h0: ancho[0], h1: ancho[1], y0: 0, y1: d.zocalo } : null,
            modulos: l.cuerpos.map((c, i) => ({ numero: i + 1, ancho: c.cuerpo.ancho, caja: { h0: hB(c.x0), h1: hB(c.x1), y0: 0, y1: c.yTope } })),
          };
        })()
      : null;
    const aereo = la
      ? { layout: la, h: hA, modulos: la.cuerpos.map((c, i) => ({ numero: i + 1, ancho: c.cuerpo.ancho, caja: { h0: hA(c.x0), h1: hA(c.x1), y0: la!.y0, y1: la!.y1 } })) }
      : null;
    const equipos: Muro['equipos'] = [];
    for (const u of ubic) {
      if (u.tipo === 'horno') continue;
      if (u.tipo === 'campana') {
        // Alojada en un módulo aéreo: ese módulo ya la muestra. Mural: se dibuja sobre la encimera.
        if (u.montaje === 'mural' && u.tramo === tb) equipos.push({ h: hB(u.x), ancho: u.ancho, texto: 'Campana', campanaMural: true });
        continue;
      }
      if (u.tramo !== tb) continue;
      equipos.push({ h: hB(u.x), ancho: u.ancho, texto: (NOMBRE_EQUIPO[u.tipo]?.(d, u.id) ?? u.tipo).replace(' platos', ' pl.'), campanaMural: false });
    }
    void ta;
    const hs = [
      ...(base ? base.modulos.flatMap((m) => [m.caja.h0, m.caja.h1]) : []),
      ...(aereo ? aereo.modulos.flatMap((m) => [m.caja.h0, m.caja.h1]) : []),
      ...esquinas.flatMap((e) => [e.h0, e.h1]),
    ];
    const alto = Math.max(base ? base.layout.yTope + base.layout.espesorCubierta : 0, la ? la.y1 : 0, equipos.some((e) => e.campanaMural) ? (base?.layout.yTope ?? 0) + 1000 : 0);
    out.push({
      titulo: muro === 'principal' ? 'Muro principal' : muro === 'izq' ? 'Lado izquierdo (mirando el muro izquierdo)' : 'Lado derecho (mirando el muro derecho)',
      base,
      aereo,
      esquinas,
      equipos,
      h0: Math.min(...hs),
      h1: Math.max(...hs),
      alto,
    });
  }
  return out;
}

/** Dibuja el esquema de un muro en (x, y) con la escala dada (mm de papel por mm reales). Devuelve el alto usado. */
function dibujarMuro(doc: jsPDF, m: Muro, x: number, y: number, escala: number, unidad: Unidad, acento: Rgb): number {
  const cota = (mm: number) => formatear(mm, unidad, false);
  const margenSup = 9;
  const yPiso = y + margenSup + m.alto * escala;
  const X = (h: number) => x + (h - m.h0) * escala;
  const Y = (yy: number) => yPiso - yy * escala;
  const rect = (c: Caja, estilo: 'S' | 'F' | 'FD') => doc.rect(X(c.h0), Y(c.y1), (c.h1 - c.h0) * escala, (c.y1 - c.y0) * escala, estilo);
  const fino = () => doc.setLineWidth(0.18);

  // Esquinas: la ocupa otro tramo (rayado suave).
  for (const e of m.esquinas) {
    doc.setFillColor(236, 233, 229);
    doc.setDrawColor(...LINEA);
    fino();
    rect(e, 'FD');
    fuente(doc, 'normal', 6);
    colorTexto(doc, GRIS);
    const ancho = (e.h1 - e.h0) * escala;
    if (ancho > 7) doc.text('esquina', X((e.h0 + e.h1) / 2), Y((e.y0 + e.y1) / 2) + 1, { align: 'center' });
  }

  const dibujarFrentes = (frentes: Frente[], h: (x: number) => number) => {
    for (const f of frentes) {
      const c: Caja = { h0: h(f.rect.x0), h1: h(f.rect.x1), y0: f.rect.y0, y1: f.rect.y1 };
      const x0 = X(Math.min(c.h0, c.h1));
      const x1 = X(Math.max(c.h0, c.h1));
      const y0 = Y(c.y1);
      const y1 = Y(c.y0);
      doc.setDrawColor(70, 66, 74);
      doc.setLineWidth(0.22);
      if (f.tipo === 'faja') {
        doc.setFillColor(226, 222, 217);
        doc.rect(x0, y0, x1 - x0, y1 - y0, 'FD');
        continue;
      }
      doc.setFillColor(255, 255, 255);
      doc.rect(x0, y0, x1 - x0, y1 - y0, 'FD');
      if (f.tipo === 'puerta') {
        // Las líneas de apertura se juntan en el lado de las bisagras.
        doc.setDrawColor(...acento);
        doc.setLineWidth(0.15);
        doc.setLineDashPattern([0.8, 0.6], 0);
        const ym = (y0 + y1) / 2;
        const xm = (x0 + x1) / 2;
        if (f.bisagra === 'arriba') {
          doc.line(x0, y1, xm, y0);
          doc.line(x1, y1, xm, y0);
        } else if (f.bisagra === 'izq') {
          doc.line(x1, y0, x0, ym);
          doc.line(x1, y1, x0, ym);
        } else {
          doc.line(x0, y0, x1, ym);
          doc.line(x0, y1, x1, ym);
        }
        doc.setLineDashPattern([], 0);
      } else if (f.tipo === 'cajon') {
        doc.setDrawColor(90, 86, 94);
        doc.setLineWidth(0.3);
        const xm = (x0 + x1) / 2;
        const largo = Math.min(6, (x1 - x0) * 0.4);
        const yt = y0 + Math.min(2.2, (y1 - y0) * 0.3);
        doc.line(xm - largo / 2, yt, xm + largo / 2, yt);
        if (f.especiero && x1 - x0 > 3) {
          fuente(doc, 'bold', 5.5);
          colorTexto(doc, GRIS);
          doc.text('ESPECIERO', xm + 0.8, (y0 + y1) / 2, { angle: 90, align: 'center' });
        }
      }
    }
  };

  const numero = (n: number, cx: number, cy: number) => {
    doc.setFillColor(...acento);
    doc.circle(cx, cy, 1.9, 'F');
    fuente(doc, 'bold', 6.5);
    colorTexto(doc, [255, 255, 255]);
    doc.text(String(n), cx, cy + 0.8, { align: 'center' });
  };

  // Mueble base
  if (m.base) {
    const b = m.base;
    if (b.zocalo) {
      doc.setFillColor(214, 209, 203);
      doc.setDrawColor(...LINEA);
      fino();
      rect({ ...b.zocalo, h0: b.zocalo.h0 + 15, h1: b.zocalo.h1 - 15 }, 'F');
    }
    for (const [i, mod] of b.modulos.entries()) {
      const lc = b.layout.cuerpos[i];
      const hueco = lc.cuerpo.tipo === 'hueco';
      doc.setDrawColor(60, 56, 64);
      doc.setLineWidth(0.3);
      const caja = { h0: Math.min(mod.caja.h0, mod.caja.h1), h1: Math.max(mod.caja.h0, mod.caja.h1), y0: hueco ? 0 : d0(b.zocalo), y1: mod.caja.y1 };
      if (hueco) {
        doc.setLineDashPattern([1.2, 0.8], 0);
        rect(caja, 'S');
        doc.setLineDashPattern([], 0);
        fuente(doc, 'normal', 6.5);
        colorTexto(doc, GRIS);
        doc.text('libre', X((caja.h0 + caja.h1) / 2), Y((caja.y0 + caja.y1) / 2) + 1, { align: 'center' });
      } else {
        doc.setFillColor(250, 248, 246);
        rect(caja, 'FD');
      }
      if (lc.horno) {
        const hc: Caja = { h0: b.h(lc.horno.x0), h1: b.h(lc.horno.x1), y0: lc.horno.y0, y1: lc.horno.y1 };
        const hx0 = X(Math.min(hc.h0, hc.h1));
        const hx1 = X(Math.max(hc.h0, hc.h1));
        doc.setFillColor(58, 56, 60);
        doc.setDrawColor(40, 38, 42);
        doc.roundedRect(hx0 + 0.4, Y(hc.y1) + 0.4, hx1 - hx0 - 0.8, (hc.y1 - hc.y0) * escala - 0.8, 0.8, 0.8, 'FD');
        fuente(doc, 'bold', 6.5);
        colorTexto(doc, [255, 255, 255]);
        doc.text('HORNO', (hx0 + hx1) / 2, Y((hc.y0 + hc.y1) / 2) + 1, { align: 'center' });
      }
    }
    dibujarFrentes(b.layout.frentes, b.h);
    if (b.cubierta) {
      doc.setFillColor(150, 144, 138);
      doc.setDrawColor(120, 114, 108);
      fino();
      rect(b.cubierta, 'FD');
    }
    for (const mod of b.modulos) {
      const h0 = Math.min(mod.caja.h0, mod.caja.h1);
      numero(mod.numero, X(h0) + 2.6, Y(mod.caja.y1) + 2.6);
    }
  }

  // Equipamiento sobre la cubierta (etiqueta y marca de posición)
  if (m.base) {
    const tope = m.base.layout.yTope + m.base.layout.espesorCubierta;
    for (const e of m.equipos) {
      const cx = X(e.h);
      if (e.campanaMural) {
        const yb = Y(tope + 650);
        const w = e.ancho * escala;
        doc.setFillColor(205, 208, 212);
        doc.setDrawColor(120, 124, 130);
        fino();
        doc.lines(
          [
            [w, 0],
            [-w * 0.3, -5],
            [-w * 0.4, 0],
          ],
          cx - w / 2,
          yb,
          [1, 1],
          'FD',
          true,
        );
        doc.rect(cx - w * 0.08, yb - 5 - Math.max(0, yb - 5 - (y + margenSup)), w * 0.16, Math.max(0, yb - 5 - (y + margenSup)), 'FD');
        fuente(doc, 'normal', 6);
        colorTexto(doc, GRIS);
        doc.text('campana mural', cx, yb + 3, { align: 'center' });
        continue;
      }
      const yt = Y(tope);
      doc.setDrawColor(...acento);
      doc.setLineWidth(0.6);
      doc.line(cx - (e.ancho * escala) / 2, yt - 0.4, cx + (e.ancho * escala) / 2, yt - 0.4);
      fuente(doc, 'bold', 6);
      colorTexto(doc, acento);
      doc.text(e.texto, cx, yt - 1.6, { align: 'center' });
    }
  }

  // Aéreos
  if (m.aereo) {
    const a = m.aereo;
    for (const [i, mod] of a.modulos.entries()) {
      const lc = a.layout.cuerpos[i];
      const h0 = Math.min(mod.caja.h0, mod.caja.h1);
      const h1 = Math.max(mod.caja.h0, mod.caja.h1);
      doc.setDrawColor(60, 56, 64);
      doc.setLineWidth(0.3);
      doc.setFillColor(250, 248, 246);
      rect({ h0, h1, y0: mod.caja.y0, y1: mod.caja.y1 }, lc.cuerpo.tipo === 'hueco' ? 'S' : 'FD');
      if (lc.cuerpo.tipo === 'campana') {
        // Parte baja abierta: la campana.
        doc.setFillColor(205, 208, 212);
        rect({ h0, h1, y0: mod.caja.y0, y1: lc.y0 }, 'FD');
        fuente(doc, 'bold', 6);
        colorTexto(doc, [70, 74, 80]);
        doc.text('CAMPANA', X((h0 + h1) / 2), Y((mod.caja.y0 + lc.y0) / 2) + 1, { align: 'center' });
      }
      if (lc.nicho) {
        fuente(doc, 'normal', 6);
        colorTexto(doc, GRIS);
        doc.text('nicho', X((h0 + h1) / 2), Y((lc.nicho.y0 + lc.nicho.y1) / 2) + 1, { align: 'center' });
      }
    }
    dibujarFrentes(a.layout.frentes, a.h);
    for (const mod of a.modulos) numero(mod.numero, X(Math.min(mod.caja.h0, mod.caja.h1)) + 2.6, Y(mod.caja.y1) + 2.6);
  }

  // Piso
  doc.setDrawColor(120, 114, 108);
  doc.setLineWidth(0.4);
  doc.line(X(m.h0) - 2, yPiso, X(m.h1) + 2, yPiso);

  // Cotas: ancho de cada módulo bajo el base (y sobre el aéreo) y el largo total.
  const cotaHorizontal = (h0: number, h1: number, yy: number, texto: string, arriba = false, negrita = false) => {
    const a = X(Math.min(h0, h1));
    const b = X(Math.max(h0, h1));
    doc.setDrawColor(110, 104, 114);
    doc.setLineWidth(0.15);
    doc.line(a, yy, b, yy);
    doc.line(a, yy - 1.1, a, yy + 1.1);
    doc.line(b, yy - 1.1, b, yy + 1.1);
    fuente(doc, negrita ? 'bold' : 'normal', negrita ? 7.5 : 7);
    colorTexto(doc, negrita ? TEXTO : [70, 66, 74]);
    const w = doc.getTextWidth(texto);
    const ty = arriba ? yy - 1 : yy + 3;
    if (w < b - a - 0.6 || negrita) doc.text(texto, (a + b) / 2, ty, { align: 'center' });
    else {
      fuente(doc, 'normal', 5.5);
      doc.text(texto, (a + b) / 2, ty, { align: 'center' });
    }
  };
  let yCota = yPiso + 3.5;
  if (m.base) {
    for (const mod of m.base.modulos) cotaHorizontal(mod.caja.h0, mod.caja.h1, yCota, cota(mod.ancho));
    yCota += 6;
    const hs = m.base.modulos.flatMap((x) => [x.caja.h0, x.caja.h1]);
    const conEsquinas = m.base.cubierta ? [m.base.cubierta.h0, m.base.cubierta.h1] : hs;
    const largo = Math.max(...conEsquinas) - Math.min(...conEsquinas);
    cotaHorizontal(Math.min(...conEsquinas), Math.max(...conEsquinas), yCota, `${cota(largo)} ${unidad}${m.esquinas.length ? ' con la esquina' : ''}`, false, true);
    yCota += 3;
  }
  if (m.aereo && m.aereo.modulos.length) {
    const yA = Y(m.aereo.layout.y1) - 2;
    for (const mod of m.aereo.modulos) cotaHorizontal(mod.caja.h0, mod.caja.h1, yA, cota(mod.ancho), true);
  }

  // Cotas verticales a la derecha: alto del base, elevación y alto del aéreo.
  const xv = X(m.h1) + 4;
  const cotaVertical = (y0: number, y1: number, texto: string, dx = 0) => {
    const a = Y(y1);
    const b = Y(y0);
    doc.setDrawColor(110, 104, 114);
    doc.setLineWidth(0.15);
    doc.line(xv + dx, a, xv + dx, b);
    doc.line(xv + dx - 1, a, xv + dx + 1, a);
    doc.line(xv + dx - 1, b, xv + dx + 1, b);
    fuente(doc, 'normal', 6.5);
    colorTexto(doc, [70, 66, 74]);
    doc.text(texto, xv + dx + 1.6, (a + b) / 2 + 1);
  };
  if (m.base) cotaVertical(0, m.base.layout.yTope + m.base.layout.espesorCubierta, cota(m.base.layout.yTope + m.base.layout.espesorCubierta));
  if (m.aereo) {
    const la = m.aereo.layout;
    if (la.montaje === 'mural') cotaVertical(m.base ? m.base.layout.yTope + m.base.layout.espesorCubierta : 0, la.y0, cota(la.y0 - (m.base ? m.base.layout.yTope + m.base.layout.espesorCubierta : 0)));
    cotaVertical(la.y0, la.y1, cota(la.y1 - la.y0));
    if (la.montaje === 'mural') cotaVertical(0, la.y0, `${cota(la.y0)} del piso`, 10);
  }
  return yCota - y + 2;
}

function d0(z: Caja | null): number {
  return z ? z.y1 : 0;
}

// ---------- Documento ----------

export function crearHojaMaestro(datos: DatosHojaMaestro): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const d = normalizar(datos.diseno);
  const marca = datos.marca;
  const { acento, suave } = COLORES_MARCA[marca];
  const ancho = A4.ancho - MARGEN * 2;
  const borde = A4.ancho - MARGEN;
  const limite = A4.alto - MARGEN - 10;
  const numero = datos.numero ? `N° ${datos.numero}` : 'Borrador';
  let y = MARGEN - 2;

  const nuevaPagina = () => {
    doc.addPage();
    // Encabezado corto en las páginas siguientes.
    dibujarLogo(doc, marca, MARGEN, MARGEN - 4, 8);
    fuente(doc, 'bold', 9.5);
    colorTexto(doc, TEXTO);
    doc.text(MARCAS[marca].nombre, MARGEN + 10.5, MARGEN + 1.3);
    fuente(doc, 'bold', 9);
    colorTexto(doc, acento);
    doc.text(`Hoja para el maestro · ${numero}`, borde, MARGEN - 0.3, { align: 'right' });
    fuente(doc, 'normal', 8);
    colorTexto(doc, GRIS);
    doc.text(`${datos.cliente.nombre} · ${formatoFecha(datos.fecha)}`, borde, MARGEN + 3.4, { align: 'right' });
    doc.setDrawColor(...acento);
    doc.setLineWidth(0.4);
    doc.line(MARGEN, MARGEN + 6, borde, MARGEN + 6);
    y = MARGEN + 12;
  };
  const asegurar = (alto: number) => {
    if (y + alto > limite) nuevaPagina();
  };

  // Cabecera
  y = dibujarCabecera(doc, marca, y, [
    { texto: 'HOJA PARA EL MAESTRO', color: acento, tam: 11 },
    { texto: `${numero} · ${formatoFecha(datos.fecha)}`, color: TEXTO, tam: 9.5 },
  ]);
  y += 5;

  // Datos de la orden
  const celdas: [string, string][] = [
    ['Cliente', datos.cliente.nombre],
    ['Cotización', numero],
    ['Fecha', formatoFecha(datos.fecha)],
    ['Vendedor', datos.vendedorTelefono ? `${datos.vendedor} · ${datos.vendedorTelefono}` : datos.vendedor],
  ];
  const anchos = [0.34, 0.18, 0.16, 0.32].map((f) => f * ancho);
  const altoCaja = datos.cliente.direccion ? 21 : 14.5;
  doc.setFillColor(...suave);
  doc.roundedRect(MARGEN, y, ancho, altoCaja, 2, 2, 'F');
  let xc = MARGEN + 4;
  celdas.forEach(([k, v], i) => {
    fuente(doc, 'bold', 7);
    colorTexto(doc, GRIS);
    doc.text(k.toUpperCase(), xc, y + 5);
    fuente(doc, 'bold', 9.5);
    colorTexto(doc, TEXTO);
    doc.text((doc.splitTextToSize(latin1(v), anchos[i] - 5) as string[])[0], xc, y + 10.2);
    xc += anchos[i];
  });
  if (datos.cliente.direccion) {
    fuente(doc, 'bold', 7);
    colorTexto(doc, GRIS);
    doc.text('DESPACHO / INSTALACIÓN', MARGEN + 4, y + 16.4);
    fuente(doc, 'normal', 9);
    colorTexto(doc, TEXTO);
    doc.text((doc.splitTextToSize(latin1(datos.cliente.direccion), ancho - 50) as string[])[0], MARGEN + 42, y + 16.4);
  }
  y += altoCaja + 4;

  // Mueble
  fuente(doc, 'bold', 13);
  colorTexto(doc, TEXTO);
  for (const l of doc.splitTextToSize(latin1(datos.modelo), ancho) as string[]) {
    doc.text(l, MARGEN, y + 3);
    y += 5.6;
  }
  fuente(doc, 'normal', 8.5);
  colorTexto(doc, GRIS);
  doc.text(`Documento interno para fabricar e instalar · sin precios · medidas en ${datos.unidad === 'cm' ? 'centímetros' : 'milímetros'}`, MARGEN, y + 2.2);
  y += 5.5;

  // Imagen referencial
  if (datos.imagen) {
    const alto = dibujarImagen(doc, datos.imagen, MARGEN, y, ancho, 80);
    if (alto) {
      fuente(doc, 'normal', 7);
      colorTexto(doc, GRIS);
      doc.text('Imagen referencial: las medidas y la distribución que valen son las de esta hoja.', MARGEN, y + alto + 3.6);
      y += alto + 8;
    }
  }

  // Ficha de fabricación del motor
  let ficha: FichaFabricacion;
  try {
    ficha = fichaFabricacion(d, datos.producto, datos.unidad, datos.materiales, { numero: datos.numero ?? undefined, cliente: datos.cliente.nombre });
  } catch (e) {
    ficha = { titulo: 'Ficha de fabricación', subtitulo: '', secciones: [{ titulo: 'Datos generales', lineas: [{ etiqueta: 'Aviso', valor: `No se pudo armar la ficha: ${(e as Error).message}` }] }] };
  }

  const titulo = (t: string) => {
    asegurar(16);
    y += 2;
    fuente(doc, 'bold', 10.5);
    colorTexto(doc, acento);
    doc.text(latin1(t.toUpperCase()), MARGEN, y);
    y += 1.8;
    doc.setDrawColor(...acento);
    doc.setLineWidth(0.35);
    doc.line(MARGEN, y, borde, y);
    y += 4.6;
  };

  const lineas = (ls: LineaDetalle[]) => {
    for (const l of ls) {
      fuente(doc, 'bold', 9.3);
      const etiqueta = `${latin1(l.etiqueta)}: `;
      const anchoEtiqueta = doc.getTextWidth(etiqueta);
      fuente(doc, 'normal', 9.3);
      const palabras = latin1(l.valor).split(/\s+/).filter(Boolean);
      let primera = '';
      let i = 0;
      while (i < palabras.length) {
        const prueba = primera ? `${primera} ${palabras[i]}` : palabras[i];
        if (doc.getTextWidth(prueba) > ancho - 4 - anchoEtiqueta) break;
        primera = prueba;
        i++;
      }
      const resto = palabras.slice(i).join(' ');
      const siguientes = resto ? (doc.splitTextToSize(resto, ancho - 4) as string[]) : [];
      fuente(doc, 'normal', 8.6);
      const subs = (l.sub ?? []).flatMap((s) => doc.splitTextToSize(`– ${latin1(s)}`, ancho - 10) as string[]);
      asegurar(4.6 * (1 + siguientes.length) + subs.length * 4.1 + 1.4);
      fuente(doc, 'bold', 9.3);
      colorTexto(doc, acento);
      doc.text('•', MARGEN + 0.6, y);
      colorTexto(doc, TEXTO);
      doc.text(etiqueta, MARGEN + 4, y);
      fuente(doc, 'normal', 9.3);
      if (primera) doc.text(primera, MARGEN + 4 + anchoEtiqueta, y);
      for (const s of siguientes) {
        y += 4.6;
        doc.text(s, MARGEN + 4, y);
      }
      fuente(doc, 'normal', 8.6);
      colorTexto(doc, [80, 76, 86]);
      for (const s of subs) {
        y += 4.1;
        doc.text(s, MARGEN + 9, y);
      }
      y += 4.6 + 1.2;
    }
  };

  const [generales, ...resto] = ficha.secciones;
  if (generales) {
    titulo(generales.titulo);
    lineas(generales.lineas);
  }

  // Esquema frontal acotado de cada muro (misma escala para todos)
  const muros = murosDe(d);
  if (muros.length) {
    const anchoDibujo = ancho - 24;
    const altoMax = 62;
    const escala = Math.min(...muros.map((m) => Math.min(anchoDibujo / Math.max(1, m.h1 - m.h0), altoMax / Math.max(1, m.alto))));
    const altoMuro = (m: Muro) => 9 + m.alto * escala + (m.base ? 15 : 4);
    asegurar(16 + 8 + altoMuro(muros[0]));
    titulo('Esquema frontal');
    fuente(doc, 'normal', 7.8);
    colorTexto(doc, GRIS);
    const leyenda = doc.splitTextToSize(
      `Cada muro visto de frente, con sus módulos numerados de izquierda a derecha y su ancho en ${datos.unidad}. En cada puerta, las líneas punteadas se juntan en el lado de las bisagras. Dibujo a escala aproximada: valen las cotas.`,
      ancho,
    ) as string[];
    doc.text(leyenda, MARGEN, y);
    y += leyenda.length * 3.4 + 2;
    for (const m of muros) {
      const alto = altoMuro(m);
      asegurar(alto + 7);
      fuente(doc, 'bold', 9);
      colorTexto(doc, TEXTO);
      doc.text(m.titulo, MARGEN, y + 2);
      y += 3;
      const anchoReal = (m.h1 - m.h0) * escala;
      const usado = dibujarMuro(doc, m, MARGEN + Math.max(0, (anchoDibujo - anchoReal) / 2), y, escala, datos.unidad, acento);
      y += usado + 4;
    }
  }

  // Resto de la ficha: tramos con sus módulos, cubierta, equipamiento, aéreos, campana, materiales y notas.
  for (const s of resto) {
    titulo(s.titulo);
    lineas(s.lineas);
  }

  // Observaciones del vendedor
  if (datos.observaciones) {
    titulo('Observaciones de la cotización');
    fuente(doc, 'normal', 9.5);
    const ls = doc.splitTextToSize(latin1(datos.observaciones), ancho - 8) as string[];
    asegurar(ls.length * 4.6 + 6);
    doc.setFillColor(255, 248, 230);
    doc.roundedRect(MARGEN, y - 4, ancho, ls.length * 4.6 + 4.5, 1.5, 1.5, 'F');
    colorTexto(doc, TEXTO);
    doc.text(ls, MARGEN + 4, y + 0.6);
    y += ls.length * 4.6 + 3;
  }

  // Pie: documento interno y número de página
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, A4.alto - 12, borde, A4.alto - 12);
    fuente(doc, 'normal', 8);
    colorTexto(doc, GRIS);
    doc.text(latin1(`${MARCAS[marca].nombre} · Hoja para el maestro · ${numero} · ${datos.cliente.nombre} · Documento interno sin precios`), MARGEN, A4.alto - 7.5);
    doc.text(`Página ${p} de ${paginas}`, borde, A4.alto - 7.5, { align: 'right' });
  }
  return doc;
}

export function nombreArchivoMaestro(d: Pick<DatosHojaMaestro, 'numero' | 'cliente'>): string {
  return nombreArchivo(d, 'Hoja-maestro');
}

export function descargarHojaMaestro(d: DatosHojaMaestro) {
  crearHojaMaestro(d).save(nombreArchivoMaestro(d));
}
