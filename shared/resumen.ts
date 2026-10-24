// Detalle de la cotización en forma de lista y su versión en texto (para copiar o
// enviar al cliente por WhatsApp), desglose del precio y ficha de fabricación para
// el maestro.
import { distanciasEquipos, listarEquipamiento, nombreModuloEn, nombreTramo, textoDistancia } from './equipos';
import {
  aperturaAjustable,
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  disenoBase,
  disenoLado,
  extremosPrincipal,
  formaDe,
  LADOS,
  ladoAereoActivo,
  largoUtilLado,
  MEDIDAS_EQUIPO,
  largoUtilLadoAereo,
  posEnMundo,
  ubicarEquipos,
  type EquipoUbicado,
  type Frente,
  type FrentePuerta,
  type LayoutAereos,
} from './layout';
import { advertencias, formatear, formatoPrecio } from './reglas';
import { precioCocina } from './tarifas';
import { cuerposDe, tramosDe } from './tramos';
import type { CatalogoMateriales, Cotizacion, Cuerpo, Diseno, Encimera, Equipo, Lavaplatos, LineaDetalle, ProductoCatalogo, TramoId, Unidad } from './tipos';

function nombreMaterial(lista: { id: string; nombre: string }[] | undefined, id: string) {
  return lista?.find((m) => m.id === id)?.nombre ?? id;
}

const TIRADOR: Record<Diseno['tirador'], string> = {
  barra: 'barra',
  boton: 'botón',
  unero: 'perfil uñero',
  sin: 'Sin manillas (apertura por perfil o push)',
};

const FORMA: Record<ReturnType<typeof formaDe>, string> = {
  lineal: 'lineal',
  'L-izq': 'en L a la izquierda',
  'L-der': 'en L a la derecha',
  U: 'en U',
};

const esCocinaD = (d: Diseno) => d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil' || d.plantilla === 'compacto';

/** Frentes del layout de un tramo. */
function frentesTramo(d: Diseno, t: TramoId): Frente[] {
  if (t === 'base') return calcularLayout(d).frentes;
  if (t === 'izq' || t === 'der') {
    const dl = disenoLado(d, t);
    return dl ? calcularLayout(dl).frentes : [];
  }
  return layoutAereo(d, t)?.frentes ?? [];
}

function layoutAereo(d: Diseno, t: TramoId): LayoutAereos | null {
  if (t === 'aereos') return calcularLayoutAereos(d);
  if (t === 'aereos-izq') return calcularLayoutAereosLado(d, 'izq');
  if (t === 'aereos-der') return calcularLayoutAereosLado(d, 'der');
  return null;
}

/** «Lavaplatos simple (1 cubeta con secador, 80 cm)», «Lavaplatos doble (2 cubetas)», «Lavaplatos riñonera (1 cubeta, 61 cm)». */
export function textoModeloLavaplatos(m: Lavaplatos['modelo']): string {
  if (m === 'doble') return 'Lavaplatos doble (2 cubetas)';
  const w = MEDIDAS_EQUIPO.lavaplatos[m].anchoTotal / 10;
  return m === 'rinonera' ? `Lavaplatos riñonera (1 cubeta, ${w} cm)` : `Lavaplatos simple (1 cubeta con secador, ${w} cm)`;
}

/** Corte en la cubierta de un equipo que trae el cliente: «solo corte de 58 × 51 cm (el cliente aporta el equipo)». */
export function textoSoloCorte(e: Equipo, unidad: Unidad | ((mm: number, conU?: boolean) => string) = 'cm'): string {
  const m = e.tipo === 'encimera' ? MEDIDAS_EQUIPO.encimera[e.platos] : MEDIDAS_EQUIPO.lavaplatos[e.modelo];
  const f = typeof unidad === 'function' ? unidad : (mm: number, conU = true) => formatear(mm, unidad, conU);
  return `solo corte de ${f(m.ancho, false)} × ${f(m.fondo)} (el cliente aporta el equipo)`;
}

/** Equipamiento sobre un módulo, en palabras ("encimera 4 platos con campana"). */
function equiposDelModulo(d: Diseno, t: TramoId, c: Cuerpo): string[] {
  const out: string[] = [];
  for (const e of d.equipos ?? []) {
    if (e.tramo !== t || e.modulo !== c.id) continue;
    if (e.soloCorte) out.push(`${e.tipo}: ${textoSoloCorte(e)}${e.tipo === 'encimera' && e.campana ? ', con campana' : ''}`);
    else if (e.tipo === 'encimera') out.push(`encimera ${e.platos} platos${e.campana ? ' con campana' : ''}`);
    else {
      const pos = e.posicion === 'centro' ? 'centrado' : `pegado a la ${e.posicion === 'izq' ? 'izquierda' : 'derecha'} a ${formatear(e.margen, 'cm')} del borde`;
      out.push(`lavaplatos ${e.modelo === 'rinonera' ? 'riñonera' : e.modelo} ${pos}${e.llave ? ', con llave' : ', sin llave'}`);
    }
  }
  return out;
}

function prefijoModulo(d: Diseno, t: TramoId): string {
  if (t === 'aereos' || t === 'aereos-izq' || t === 'aereos-der') return d.plantilla === 'compacto' ? 'Superior' : 'Aéreo';
  return 'Módulo';
}

/** Una línea por módulo de un tramo, con sus puertas, cajones y equipamiento. */
export function describirTramo(d: Diseno, t: TramoId, unidad: Unidad): string[] {
  const cuerpos = cuerposDe(d, t);
  const frentes = frentesTramo(d, t);
  const prefijo = prefijoModulo(d, t);
  return cuerpos.map((c, i) => {
    const nombre = `${prefijo} ${i + 1} (${formatear(c.ancho, unidad)})`;
    const equipo = equiposDelModulo(d, t, c);
    const con = equipo.length ? `; con ${equipo.join(' y ')}` : '';
    if (c.tipo === 'horno') return `${nombre}: ${d.plantilla === 'cocina-infantil' ? 'horno de juguete' : 'horno empotrado'}${con}`;
    if (c.tipo === 'hueco') return `${nombre}: espacio libre`;
    if (c.tipo === 'espacio-campana') return `${nombre}: espacio para campana ${formatear(c.ancho, unidad)} (sin puertas)${con}`;
    if (c.tipo === 'escritorio') return `${nombre}: escritorio de ${formatear(c.alto || 750, unidad)} de alto`;
    if (c.tipo === 'especiero') return `${nombre}: especiero extraíble de alto completo con ${c.pisos ?? 2} pisos${con}`;
    const partes: string[] = [];
    const puertas = frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === i);
    const cajones = frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === i);
    const abatibles = puertas.filter((f) => f.tipo === 'puerta' && f.bisagra === 'arriba');
    const normales = puertas.filter((f) => !(f.tipo === 'puerta' && f.bisagra === 'arriba'));
    if (c.tipo === 'campana') partes.push('mueble de campana');
    if (c.tipo === 'nicho') partes.push('nicho para microondas con repisa');
    if (normales.length) {
      const p = normales[0].rect;
      const apertura = aperturaAjustable(c) ? ` (${normales.length === 1 ? 'bisagras' : 'puerta 1 con bisagras'} a la ${c.bisagra === 'izq' ? 'izquierda' : 'derecha'})` : '';
      partes.push(`${normales.length} ${normales.length === 1 ? 'puerta' : 'puertas'} de ${formatear(p.x1 - p.x0, unidad, false)} × ${formatear(p.y1 - p.y0, unidad)}${apertura}`);
    }
    if (abatibles.length) {
      const p = abatibles[0].rect;
      partes.push(`puerta abatible de ${formatear(p.x1 - p.x0, unidad, false)} × ${formatear(p.y1 - p.y0, unidad)}`);
    }
    if (cajones.length) partes.push(`${cajones.length} ${cajones.length === 1 ? 'cajón' : 'cajones'}${c.cajonesArriba && normales.length ? ' arriba' : ''}`);
    if (c.colgador) partes.push('barra para colgar');
    if (!puertas.length && !cajones.length) partes.push(`abierto con ${c.repisas} repisas`);
    return `${nombre}: ${partes.join(', ')}${con}`;
  });
}

export function describirCuerpos(d: Diseno, unidad: Unidad): string[] {
  if (d.plantilla === 'tocador') {
    const t = d.tocador;
    return [
      `Cajonera izquierda: ${t.cajonesIzq} cajones`,
      `Centro: ${t.cajonesCentro} cajones`,
      `Cajonera derecha: ${t.cajonesDer} cajones`,
      `Espejo ${t.espejo === 'ovalado' ? 'ovalado LED' : t.espejo === 'hollywood' ? 'Hollywood' : 'rectangular LED'}, luz ${t.luz}`,
    ];
  }
  return describirTramo(d, 'base', unidad);
}

const modulos = (n: number) => `${n} ${n === 1 ? 'módulo' : 'módulos'}`;

/** La forma de la L/U con sus medidas, como se mide en la tienda (cada lado completo, con la esquina). */
function textoForma(d: Diseno, unidad: Unidad): string | null {
  const forma = formaDe(d.lados);
  if (forma === 'lineal') return null;
  const [x0, x1] = extremosPrincipal(d);
  const principal = formatear(x1 - x0, unidad, false);
  if (forma === 'U') {
    return `${FORMA.U}: lado izquierdo ${formatear(d.lados.izq!.largo, unidad, false)} + tramo principal ${principal} + lado derecho ${formatear(d.lados.der!.largo, unidad)} (cada lado medido completo, con la esquina)`;
  }
  const lado = d.lados.izq ?? d.lados.der!;
  return `${FORMA[forma]}: ${principal} × ${formatear(lado.largo, unidad)} (tramo principal con la esquina × largo del lado)`;
}

/** Equipamiento en una línea: cada equipo con su módulo y tramo. */
function textoEquipamiento(d: Diseno): string[] {
  const conLados = !!(d.lados?.izq || d.lados?.der);
  const donde = (t: TramoId, i: number) => (conLados || t !== 'base' ? nombreModuloEn(d, t, i) : `módulo ${i + 1}`);
  const eq: string[] = [];
  for (const it of listarEquipamiento(d)) {
    if (it.tipo === 'llave') continue;
    if (it.tipo === 'encimera') {
      const e = d.equipos.find((x) => x.id === it.id) as Encimera;
      if (e.soloCorte) eq.push(`encimera: ${textoSoloCorte(e)} (${donde(it.tramo, it.indice)})${e.campana ? ' con campana' : ''}`);
      else eq.push(`encimera ${e.platos} platos (${donde(it.tramo, it.indice)})${e.campana ? ' con campana' : ''}`);
    } else if (it.tipo === 'horno') eq.push(`horno eléctrico 58 L (${donde(it.tramo, it.indice)})`);
    else if (it.tipo === 'lavaplatos') {
      const l = d.equipos.find((x) => x.id === it.id)!;
      if (l.tipo !== 'lavaplatos') continue;
      const pos = l.posicion === 'centro' ? '' : `, pegado a la ${l.posicion === 'izq' ? 'izquierda' : 'derecha'} a ${formatear(l.margen, 'cm')}`;
      if (l.soloCorte) {
        eq.push(`lavaplatos: ${textoSoloCorte(l)} (${donde(it.tramo, it.indice)}${pos})`);
        continue;
      }
      const llave = l.llave ? `, llave ${d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada'}` : d.plantilla === 'cocina-infantil' ? `, grifería ${d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada'}` : ', sin llave';
      eq.push(`lavaplatos ${l.modelo === 'doble' ? '2 cubetas' : l.modelo === 'rinonera' ? 'riñonera (1 cubeta)' : '1 cubeta con secador'} (${donde(it.tramo, it.indice)}${pos})${llave}`);
    }
  }
  return eq;
}

/** Datos técnicos del mueble diseñado, en el orden en que se muestran en la cotización. */
export function detalleCotizacion(
  d: Diseno,
  producto: ProductoCatalogo | null,
  unidad: Unidad,
  materiales: CatalogoMateriales | null,
): LineaDetalle[] {
  const lineas: LineaDetalle[] = [];
  const m = d.materiales;
  const cocina = esCocinaD(d);
  lineas.push({
    etiqueta: 'Modelo base',
    valor: producto ? `${producto.nombre} (código ${producto.id})` : d.nombreModelo || 'Diseño a medida',
  });
  const forma = textoForma(d, unidad);
  const [mx0, mx1] = extremosPrincipal(d);
  lineas.push({
    etiqueta: 'Medidas',
    valor: forma
      ? `${formatear(mx1 - mx0, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (tramo principal con ${d.lados.izq && d.lados.der ? 'las esquinas' : 'la esquina'} × alto × profundidad)`
      : `${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)`,
  });
  if (forma) lineas.push({ etiqueta: 'Forma', valor: forma });
  const conLados = !!forma;
  lineas.push({
    etiqueta: d.plantilla === 'compacto' ? 'Mueble base' : conLados ? 'Tramo principal' : 'Distribución',
    valor: d.plantilla === 'tocador' ? 'Tocador' : modulos(d.cuerpos.length),
    sub: describirCuerpos(d, unidad),
  });
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (!r) continue;
    lineas.push({
      etiqueta: lado === 'izq' ? 'Lado izquierdo' : 'Lado derecho',
      valor: `${modulos(r.cuerpos.length)}, largo ${formatear(r.largo, unidad)} desde el muro, fondo ${formatear(r.profundidad, unidad)}`,
      sub: describirTramo(d, lado, unidad),
    });
  }
  const la = calcularLayoutAereos(d);
  if (la) {
    const a = d.aereos;
    const compacto = d.plantilla === 'compacto';
    const formaA = formaDe({ izq: ladoAereoActivo(d, 'izq'), der: ladoAereoActivo(d, 'der') });
    lineas.push({
      etiqueta: compacto ? 'Mueble superior' : 'Muebles aéreos',
      valor: compacto
        ? `${formatear(la.x1 - la.x0, unidad, false)} × ${formatear(a.alto, unidad, false)} × ${formatear(a.profundidad, unidad)} sobre la cubierta, mueble base de ${formatear(a.elevacion, unidad)} de alto`
        : `${formaA === 'lineal' ? '' : `${FORMA[formaA]}, `}${formatear(la.x1 - la.x0, unidad, false)} × ${formatear(a.alto, unidad, false)} × ${formatear(a.profundidad, unidad)}, a ${formatear(a.elevacion, unidad)} del piso`,
      sub: describirTramo(d, 'aereos', unidad),
    });
    for (const lado of LADOS) {
      const r = ladoAereoActivo(d, lado);
      if (!r) continue;
      lineas.push({
        etiqueta: `Aéreo lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`,
        valor: `${modulos(r.cuerpos.length)}, largo ${formatear(r.largo, unidad)} desde el muro, fondo ${formatear(r.profundidad, unidad)}`,
        sub: describirTramo(d, lado === 'izq' ? 'aereos-izq' : 'aereos-der', unidad),
      });
    }
  }
  lineas.push({ etiqueta: 'Melamina frentes', valor: nombreMaterial(materiales?.melaminas, m.frente) });
  lineas.push({ etiqueta: 'Melamina cuerpo', valor: nombreMaterial(materiales?.melaminas, m.casco) });
  if (cocina) lineas.push({ etiqueta: 'Cubierta postformada', valor: nombreMaterial(materiales?.cubiertas, m.cubierta) });
  lineas.push({
    etiqueta: 'Tiradores',
    valor: d.tirador === 'sin' ? TIRADOR.sin : `${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}`,
  });
  if (d.cierreSuave) lineas.push({ etiqueta: 'Herrajes', valor: 'Cierre suave en puertas y cajones' });
  if (cocina) {
    const k = d.cocina;
    const eq = textoEquipamiento(d);
    if (d.plantilla === 'cocina' || d.plantilla === 'compacto') eq.push(`cubierta ${k.espesorCubierta} mm${k.copete ? ' con copete' : ''}`);
    if (eq.length) lineas.push({ etiqueta: 'Equipamiento', valor: eq.join('; ') });
  }
  lineas.push({
    etiqueta: 'Espacios',
    valor: `separación entre módulos ${formatear(d.separacionCuerpos, unidad)}, zócalo ${formatear(d.zocalo, unidad)}, luz entre frentes ${d.luzFrentes} mm, melamina ${d.espesor} mm`,
  });
  const extras: string[] = [];
  if (d.plantilla === 'comoda' && d.mudador) extras.push('mudador');
  if (d.imagenFrontal) extras.push('imagen personalizada impresa en los frentes');
  if (extras.length) lineas.push({ etiqueta: 'Extras', valor: extras.join(', ') });
  return lineas;
}

/** Desglose del precio oficial de la cocina como líneas de detalle (vacío en los demás muebles). */
export function detallePrecio(d: Diseno): LineaDetalle[] {
  if (d.plantilla !== 'cocina') return [];
  const p = precioCocina(d);
  return [
    ...p.lineas.map((l) => ({ etiqueta: l.concepto, valor: formatoPrecio(l.valor), sub: [l.detalle] })),
    { etiqueta: 'Total', valor: formatoPrecio(p.total) },
  ];
}

// ---------- Ficha de fabricación ----------

/** Tabla ordenada de la ficha (módulos de un tramo, equipamiento, frentes para cortar). */
export interface TablaFicha {
  columnas: string[];
  /** Ancho relativo de cada columna. */
  anchos: number[];
  filas: FilaFicha[];
  /** Columnas en negrita y columnas cuyo primer renglón va en negrita (el resto, en gris). */
  negrita?: number[];
  destacar?: number[];
}

export interface FilaFicha {
  /** Texto de cada columna; '\n' separa renglones. */
  celdas: string[];
  /** La misma fila como línea de texto (textoFicha). */
  texto?: LineaDetalle;
}

export interface SeccionFicha {
  titulo: string;
  lineas: LineaDetalle[];
  tabla?: TablaFicha;
}

/** Hoja para el maestro: todo lo necesario para fabricar e instalar el mueble. */
export interface FichaFabricacion {
  titulo: string;
  subtitulo: string;
  secciones: SeccionFicha[];
}

const cuantos = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;

/** Qué es un módulo, en una frase para el maestro ("Cajonera de 3 cajones", "2 puertas y 1 cajón arriba"…). */
function queEsModulo(d: Diseno, c: Cuerpo, f: (mm: number) => string): string {
  const n = cuantos;
  switch (c.tipo) {
    case 'horno':
      return d.plantilla === 'cocina-infantil' ? 'Horno de juguete' : 'Horno eléctrico 58 L Sindelen empotrado (hueco de 59,5 cm de alto, faja de melamina arriba)';
    case 'hueco':
      return 'Espacio libre (sin casco; la cubierta pasa por encima)';
    case 'escritorio':
      return `Escritorio de ${f(c.alto || 750)} de alto`;
    case 'especiero':
      return `Especiero: cajón extraíble de ${f(c.ancho)} y alto completo, con ${c.pisos ?? 2} pisos interiores`;
    case 'campana':
      return 'Mueble de campana (puertas arriba, campana abajo)';
    case 'nicho':
      return 'Nicho para microondas con repisa y puerta abatible arriba';
    case 'espacio-campana':
      return `Espacio para campana ${f(c.ancho)} (sin puertas)`;
  }
  if (c.abatible) return 'Puerta abatible';
  if (c.puertas && c.cajones) return `${n(c.puertas, 'puerta', 'puertas')} y ${n(c.cajones, 'cajón', 'cajones')} ${c.cajonesArriba ? 'arriba' : 'abajo'}`;
  if (c.cajones) return `Cajonera de ${n(c.cajones, 'cajón', 'cajones')}`;
  if (c.puertas) return n(c.puertas, 'puerta', 'puertas');
  return `Abierto con ${n(c.repisas, 'repisa', 'repisas')}`;
}

/** Desde dónde se miden las cotas de un tramo en la ficha. */
function referenciaTramo(d: Diseno, t: TramoId): string {
  if (t === 'base' || t === 'aereos') return d.lados?.izq ? 'del muro izquierdo' : 'del extremo izquierdo del mueble';
  return 'del muro principal';
}

/** Cota (mm) de la posición s de un tramo: desde el extremo izquierdo (principal) o desde el muro principal (lados). */
function cota(d: Diseno, t: TramoId, s: number): number {
  const db = t === 'base' || t === 'izq' || t === 'der' ? disenoBase(d) : d;
  const p = posEnMundo(db, t, s);
  return t === 'base' || t === 'aereos' ? p.x - extremosPrincipal(d)[0] : p.z;
}

/** «de 60 a 120 cm del muro izquierdo» */
function entreCotas(d: Diseno, t: TramoId, s0: number, s1: number, f: (mm: number, conU?: boolean) => string): string {
  const a = cota(d, t, s0);
  const b = cota(d, t, s1);
  return `de ${f(Math.min(a, b), false)} a ${f(Math.max(a, b))} ${referenciaTramo(d, t)}`;
}

/** Sentido de apertura de una puerta, como lo lee el maestro (mirando el mueble de frente). */
export function textoApertura(b: FrentePuerta['bisagra']): string {
  if (b === 'arriba') return 'abre hacia arriba (bisagras arriba)';
  return b === 'izq' ? 'abre a la izquierda (bisagras izq.)' : 'abre a la derecha (bisagras der.)';
}

/** Frentes y huecos de horno de un tramo. */
function layoutTramo(d: Diseno, t: TramoId): { frentes: Frente[]; hornos: (Frente['rect'] | null)[] } {
  if (t === 'base' || t === 'izq' || t === 'der') {
    const dl = t === 'base' ? d : disenoLado(d, t);
    if (!dl) return { frentes: [], hornos: [] };
    const l = calcularLayout(dl);
    return { frentes: l.frentes, hornos: l.cuerpos.map((c) => c.horno) };
  }
  return { frentes: layoutAereo(d, t)?.frentes ?? [], hornos: [] };
}

/** De arriba hacia abajo y de izquierda a derecha. */
function ordenados<T extends Frente>(fs: T[]): T[] {
  return [...fs].sort((a, b) => b.rect.y1 - a.rect.y1 || a.rect.x0 - b.rect.x0);
}

/** Cada frente de un módulo con su medida terminada (ancho × alto) y, las puertas, su apertura. */
function frentesDelModulo(propios: Frente[], f: (mm: number, conU?: boolean) => string): string[] {
  const medida = (fr: Frente) => `${f(fr.rect.x1 - fr.rect.x0, false)} × ${f(fr.rect.y1 - fr.rect.y0)}`;
  const out: string[] = [];
  const puertas = ordenados(propios.filter((fr): fr is FrentePuerta => fr.tipo === 'puerta'));
  puertas.forEach((p, k) => {
    const nombre = p.bisagra === 'arriba' ? `Puerta abatible${puertas.length > 1 ? ` ${k + 1}` : ''}` : `Puerta ${k + 1}`;
    out.push(`${nombre}: ${medida(p)} · ${textoApertura(p.bisagra)}`);
  });
  const cajones = ordenados(propios.filter((fr) => fr.tipo === 'cajon'));
  for (const c of cajones) if (c.tipo === 'cajon' && c.especiero) out.push(`Frente del especiero (extraíble): ${medida(c)}`);
  const normales = cajones.filter((c) => !(c.tipo === 'cajon' && c.especiero));
  normales.forEach((c, k) => out.push(`Cajón ${k + 1}${k === 0 && normales.length > 1 ? ' (arriba)' : ''}: ${medida(c)}`));
  for (const fr of propios) if (fr.tipo === 'faja') out.push(`Faja fija: ${medida(fr)}`);
  return out;
}

/** Interior del módulo y el equipamiento que lleva (encimera, lavaplatos, campana, horno). */
function interiorModulo(
  d: Diseno,
  t: TramoId,
  c: Cuerpo,
  horno: Frente['rect'] | null,
  propios: Frente[],
  ubic: EquipoUbicado[],
  f: (mm: number, conU?: boolean) => string,
): string[] {
  const out: string[] = [];
  const adulta = d.plantilla !== 'cocina-infantil';
  const puertas = propios.filter((fr) => fr.tipo === 'puerta').length;
  const cajones = propios.filter((fr) => fr.tipo === 'cajon').length;
  if (c.tipo === 'horno') out.push(adulta ? `Horno eléctrico 58 L Sindelen (60 cm)${horno ? `; hueco ${f(horno.x1 - horno.x0, false)} × ${f(horno.y1 - horno.y0)}` : ''}` : 'Horno de juguete');
  if (c.tipo === 'especiero') out.push(`${cuantos(c.pisos ?? 2, 'piso', 'pisos')} interiores`);
  if (c.tipo === 'nicho') out.push('Nicho para microondas con repisa');
  if (c.tipo === 'escritorio') out.push(`Cubierta de escritorio a ${f(c.alto || 750)}`);
  if (c.tipo === 'hueco') out.push('Sin casco ni frentes');
  if (c.tipo === 'espacio-campana') out.push(`Espacio para campana ${f(c.ancho)} (sin puertas): costados, techo y fondo, sin base ni repisas`);
  if ((c.tipo === 'frentes' || c.tipo === 'campana') && c.repisas > 0 && (puertas || !cajones)) out.push(cuantos(c.repisas, 'repisa', 'repisas'));
  if (c.colgador) out.push('Barra para colgar');
  for (const e of d.equipos ?? []) {
    if (e.tramo !== t || e.modulo !== c.id) continue;
    const u = ubic.find((x) => x.id === e.id);
    const corte = u ? `; corte ${f(u.ancho, false)} × ${f(u.fondo)}` : '';
    if (e.soloCorte) {
      const nombre = e.tipo === 'encimera' ? 'Encimera' : 'Lavaplatos';
      const pos = e.tipo === 'lavaplatos' && e.posicion !== 'centro' ? `, pegado al borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} a ${f(e.margen)}` : '';
      out.push(`${nombre}: ${textoSoloCorte(e, f)}${pos}${e.tipo === 'encimera' && e.campana ? ', con campana' : ''}`);
    } else if (e.tipo === 'encimera') {
      out.push(`${adulta ? `Encimera a gas ${e.platos} platos (quemadores)` : `Encimera de juguete ${e.platos} platos`}${e.campana ? ', con campana' : ''}${corte}`);
    } else {
      const pos = e.posicion === 'centro' ? 'centrado' : `pegado al borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} a ${f(e.margen)}`;
      const llave = e.llave ? `con llave ${d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada'}` : 'sin llave';
      out.push(`${textoModeloLavaplatos(e.modelo)}, ${pos}, ${llave}${corte}`);
    }
  }
  for (const u of ubic) {
    if (u.tipo !== 'campana' || u.tramo !== t || u.modulo !== c.id) continue;
    out.push(u.montaje === 'aereo' ? `Aloja la campana de ${f(u.ancho)} (abajo)` : `Campana mural de ${f(u.ancho)} sobre la encimera`);
  }
  return out;
}

/** Fila de la tabla de un tramo: número, qué es y dónde va, ancho, frentes con medida y apertura, interior y equipo. */
function filaModulo(d: Diseno, t: TramoId, i: number, lt: ReturnType<typeof layoutTramo>, unidad: Unidad, s0: number, ubic: EquipoUbicado[]): FilaFicha {
  const c = cuerposDe(d, t)[i];
  const f = (mm: number, conU = true) => formatear(mm, unidad, conU);
  const propios = lt.frentes.filter((fr) => fr.cuerpo === i);
  const ubicacion = entreCotas(d, t, s0, s0 + c.ancho, f);
  const que = queEsModulo(d, c, f);
  const frentes = frentesDelModulo(propios, f);
  const interior = interiorModulo(d, t, c, lt.hornos[i] ?? null, propios, ubic, f);
  // En la tabla, el horno y el especiero con un nombre corto: su detalle va en las otras columnas.
  const corto = c.tipo === 'horno' ? (d.plantilla === 'cocina-infantil' ? 'Horno de juguete' : 'Módulo de horno empotrado') : c.tipo === 'especiero' ? 'Especiero extraíble de alto completo' : que;
  return {
    celdas: [String(i + 1), `${corto}\n${ubicacion}`, f(c.ancho), frentes.join('\n') || 'Sin frentes', interior.join('\n') || '—'],
    texto: { etiqueta: `${prefijoModulo(d, t)} ${i + 1} · ${f(c.ancho)}`, valor: que, sub: [ubicacion, ...frentes, ...interior] },
  };
}

const COLUMNAS_TRAMO = {
  columnas: ['N°', 'Módulo y ubicación', 'Ancho', 'Frentes: ancho × alto y apertura', 'Interior y equipamiento'],
  anchos: [0.05, 0.245, 0.1, 0.345, 0.26],
  negrita: [0, 2],
  destacar: [1],
};

function seccionTramo(d: Diseno, t: TramoId, unidad: Unidad, ubic: EquipoUbicado[]): SeccionFicha | null {
  const cs = cuerposDe(d, t);
  if (!cs.length) return null;
  const f = (mm: number) => formatear(mm, unidad);
  const lineas: LineaDetalle[] = [];
  const db = disenoBase(d);
  if (t === 'base') {
    const [x0, x1] = extremosPrincipal(d);
    const conLados = !!(d.lados.izq || d.lados.der);
    lineas.push({
      etiqueta: 'Medidas',
      valor: `${conLados ? `largo con esquinas ${f(x1 - x0)}, módulos ${f(d.ancho)}` : `largo ${f(d.ancho)}`}, alto ${f(db.alto)}, fondo ${f(d.profundidad)}`,
    });
  } else if (t === 'izq' || t === 'der') {
    const r = d.lados[t]!;
    lineas.push({ etiqueta: 'Medidas', valor: `largo desde el muro ${f(r.largo)} (con la esquina), módulos ${f(largoUtilLado(d, t))}, alto ${f(db.alto)}, fondo ${f(r.profundidad)}` });
    lineas.push({ etiqueta: 'Orden', valor: t === 'izq' ? 'el módulo 1 queda en la punta abierta y el último junto a la esquina' : 'el módulo 1 queda junto a la esquina' });
  } else if (t === 'aereos-izq' || t === 'aereos-der') {
    const lado = t === 'aereos-izq' ? 'izq' : 'der';
    const r = d.aereos.lados[lado]!;
    lineas.push({ etiqueta: 'Medidas', valor: `largo desde el muro ${f(r.largo)} (con la esquina del aéreo principal), módulos ${f(largoUtilLadoAereo(d, lado))}, alto ${f(d.aereos.alto)}, fondo ${f(r.profundidad)}` });
    lineas.push({ etiqueta: 'Orden', valor: lado === 'izq' ? 'cuelga del muro izquierdo; el aéreo 1 queda en la punta abierta y el último junto a la esquina' : 'cuelga del muro derecho; el aéreo 1 queda junto a la esquina' });
  } else {
    const la = calcularLayoutAereos(d);
    if (la) lineas.push({ etiqueta: 'Medidas', valor: `largo ${f(la.x1 - la.x0)}, alto ${f(d.aereos.alto)}, fondo ${f(d.aereos.profundidad)}` });
  }
  const lt = layoutTramo(d, t);
  let cursor = 0;
  const sep = t === 'base' ? d.separacionCuerpos : 0;
  const filas = cs.map((c, i) => {
    const fila = filaModulo(d, t, i, lt, unidad, cursor, ubic);
    cursor += c.ancho + sep;
    return fila;
  });
  return { titulo: nombreTramo(d, t), lineas, tabla: { ...COLUMNAS_TRAMO, filas } };
}

/** Conteo de frentes de todo el conjunto (para el maestro). */
function resumenFrentes(d: Diseno): string {
  let puertas = 0;
  let abatibles = 0;
  let cajones = 0;
  let especieros = 0;
  for (const t of tramosDe(d)) {
    for (const fr of frentesTramo(d, t)) {
      if (fr.tipo === 'puerta') fr.bisagra === 'arriba' ? abatibles++ : puertas++;
      else if (fr.tipo === 'cajon') fr.especiero ? especieros++ : cajones++;
    }
  }
  const n = cuantos;
  const partes = [n(puertas, 'puerta', 'puertas')];
  if (abatibles) partes.push(n(abatibles, 'puerta abatible', 'puertas abatibles'));
  partes.push(n(cajones, 'cajón', 'cajones'));
  if (especieros) partes.push(n(especieros, 'especiero', 'especieros'));
  return partes.join(', ');
}

/** Todos los frentes del conjunto agrupados por pieza y medida: la lista para cortar. */
function seccionFrentesParaCortar(d: Diseno, unidad: Unidad): SeccionFicha | null {
  if (d.plantilla === 'tocador') return null;
  const f = (mm: number, conU = true) => formatear(mm, unidad, conU);
  const PIEZAS = ['Puerta', 'Puerta abatible', 'Frente de cajón', 'Frente del especiero', 'Faja fija'];
  const grupos = new Map<string, { pieza: string; ancho: number; alto: number; medida: string; cantidad: number; izq: number; der: number; donde: string[] }>();
  for (const t of tramosDe(d)) {
    if (!cuerposDe(d, t).length) continue;
    for (const fr of layoutTramo(d, t).frentes) {
      const pieza = fr.tipo === 'puerta' ? (fr.bisagra === 'arriba' ? PIEZAS[1] : PIEZAS[0]) : fr.tipo === 'cajon' ? (fr.especiero ? PIEZAS[3] : PIEZAS[2]) : PIEZAS[4];
      const ancho = fr.rect.x1 - fr.rect.x0;
      const alto = fr.rect.y1 - fr.rect.y0;
      const medida = `${f(ancho, false)} × ${f(alto)}`;
      const clave = `${pieza}|${medida}`;
      const g = grupos.get(clave) ?? { pieza, ancho, alto, medida, cantidad: 0, izq: 0, der: 0, donde: [] };
      g.cantidad++;
      if (fr.tipo === 'puerta' && fr.bisagra !== 'arriba') g[fr.bisagra]++;
      const lugar = nombreModuloEn(d, t, fr.cuerpo);
      if (!g.donde.includes(lugar)) g.donde.push(lugar);
      grupos.set(clave, g);
    }
  }
  if (!grupos.size) return null;
  const filas = [...grupos.values()]
    .sort((a, b) => PIEZAS.indexOf(a.pieza) - PIEZAS.indexOf(b.pieza) || b.alto - a.alto || b.ancho - a.ancho)
    .map((g): FilaFicha => {
      const apertura =
        g.pieza === 'Puerta'
          ? [g.izq ? `${g.izq} a la izquierda` : '', g.der ? `${g.der} a la derecha` : ''].filter(Boolean).join(', ')
          : g.pieza === 'Puerta abatible'
            ? 'hacia arriba'
            : '—';
      const donde = g.donde.join(', ');
      return {
        celdas: [g.pieza, g.medida, String(g.cantidad), apertura, donde],
        texto: { etiqueta: `${g.pieza} ${g.medida}`, valor: `${cuantos(g.cantidad, 'unidad', 'unidades')}${apertura !== '—' ? ` (abren ${apertura})` : ''} · ${donde}` },
      };
    });
  return {
    titulo: 'Frentes para cortar',
    lineas: [
      { etiqueta: 'Total', valor: resumenFrentes(d) },
      { etiqueta: 'Medidas', valor: `de cada frente terminado (ancho × alto), con la luz de ${d.luzFrentes} mm ya descontada; melamina ${d.espesor} mm` },
    ],
    tabla: { columnas: ['Pieza', 'Ancho × alto', 'Cant.', 'Apertura', 'Dónde va'], anchos: [0.18, 0.17, 0.07, 0.2, 0.38], filas, negrita: [0, 1, 2] },
  };
}

/** Equipamiento en tabla: qué es (tipo y modelo), dónde va y su posición acotada con el corte de la cubierta. */
function seccionEquipamiento(d: Diseno, unidad: Unidad, ubic: EquipoUbicado[]): SeccionFicha | null {
  const items = listarEquipamiento(d);
  if (!items.length) return null;
  const f = (mm: number, conU = true) => formatear(mm, unidad, conU);
  const adulta = d.plantilla !== 'cocina-infantil';
  const grifo = d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada';
  const donde = (u: { tramo: TramoId; s: number }) => `centro a ${f(cota(d, u.tramo, u.s))} ${referenciaTramo(d, u.tramo)}`;
  const filas = items.map((it): FilaFicha => {
    const u = ubic.find((x) => x.id === it.id);
    const lugar = `${it.donde.charAt(0).toUpperCase()}${it.donde.slice(1)}\n${nombreTramo(d, it.tramo).toLowerCase()}`;
    const pos = u ? donde(u) : '';
    const corte = u ? `corte en la cubierta ${f(u.ancho, false)} × ${f(u.fondo)}` : '';
    const texto: LineaDetalle = { etiqueta: it.tipo === 'llave' ? `Llave monomando ${grifo}` : it.nombre, valor: `${it.donde} (${nombreTramo(d, it.tramo).toLowerCase()}): ${it.detalle}${pos ? `; ${pos}` : ''}` };
    if (it.tipo === 'horno') return { celdas: ['Horno', 'Eléctrico 58 L Sindelen, empotrado en módulo de 60 cm', lugar, pos], texto };
    if (it.tipo === 'llave') return { celdas: ['Llave monomando', `Grifería ${grifo}`, lugar, 'Junto al lavaplatos'], texto };
    if ((it.tipo === 'encimera' || it.tipo === 'lavaplatos') && d.equipos.find((x) => x.id === it.id)?.soloCorte) {
      const e = d.equipos.find((x) => x.id === it.id)!;
      const nombre = e.tipo === 'encimera' ? 'Encimera' : 'Lavaplatos';
      const solo = textoSoloCorte(e, f);
      const enModulo = e.tipo === 'encimera' ? 'Centrada en su módulo' : e.posicion === 'centro' ? 'Centrado en su módulo' : `Pegado al borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} del módulo, a ${f(e.margen)}`;
      const extra = e.tipo === 'encimera' && e.campana ? ', con campana' : '';
      return {
        celdas: [nombre, `${solo.charAt(0).toUpperCase()}${solo.slice(1)}${extra}`, lugar, [enModulo, pos].filter(Boolean).join('\n')],
        texto: { etiqueta: nombre, valor: `${solo}${extra}; ${it.donde} (${nombreTramo(d, it.tramo).toLowerCase()})${pos ? `; ${pos}` : ''}` },
      };
    }
    if (it.tipo === 'encimera') {
      const e = d.equipos.find((x) => x.id === it.id) as Encimera;
      const tipo = `${adulta ? `A gas, ${e.platos} platos (quemadores)` : `De juguete, ${e.platos} platos`}${e.campana ? ', con campana' : ', sin campana'}`;
      return { celdas: ['Encimera', tipo, lugar, ['Centrada en su módulo', pos, corte].filter(Boolean).join('\n')], texto };
    }
    if (it.tipo === 'lavaplatos') {
      const e = d.equipos.find((x) => x.id === it.id);
      if (!e || e.tipo !== 'lavaplatos') return { celdas: ['Lavaplatos', it.nombre, lugar, pos], texto };
      const tipo = `${textoModeloLavaplatos(e.modelo).replace(/^Lavaplatos /, '').replace(/^./, (c) => c.toUpperCase())}, ${e.llave ? `con llave ${grifo}` : 'sin llave'}`;
      const enModulo = e.posicion === 'centro' ? 'Centrado en su módulo' : `Pegado al borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} del módulo, a ${f(e.margen)}`;
      return { celdas: ['Lavaplatos', tipo, lugar, [enModulo, pos, corte].filter(Boolean).join('\n')], texto };
    }
    // Campana: alojada en un módulo aéreo o mural, centrada sobre su encimera.
    const uc = ubic.find((x) => x.tipo === 'campana' && (x.id === it.id || x.encimera === it.de));
    if (!uc) return { celdas: ['Campana', it.detalle, lugar, ''], texto };
    const e = ubic.find((x) => x.id === uc.encimera);
    const sobre = e ? `sobre la encimera del ${nombreModuloEn(d, e.tramo, e.indice)}` : 'sobre la encimera';
    return {
      celdas: [
        'Campana',
        uc.montaje === 'aereo' ? `De ${f(uc.ancho)}, alojada en el mueble aéreo (bajo sus puertas)` : `Mural de ${f(uc.ancho)}, sin mueble encima`,
        lugar,
        `Centrada ${sobre}\n${donde(uc)}`,
      ],
      texto: {
        etiqueta: `Campana ${f(uc.ancho)}`,
        valor: uc.montaje === 'aereo' ? `alojada en el ${nombreModuloEn(d, uc.tramo, uc.indice)}, centrada ${sobre}; ${donde(uc)}` : `mural, ${sobre}; ${donde(uc)}`,
      },
    };
  });
  // Espacios libres de la cubierta entre los cortes y hasta sus extremos, por tramo.
  const distancias = distanciasEquipos(d);
  const lineas: LineaDetalle[] = [];
  for (const t of ['izq', 'base', 'der'] as const) {
    const ds = distancias.filter((x) => x.tramo === t);
    if (ds.length) lineas.push({ etiqueta: `Distancias · ${nombreTramo(d, t).toLowerCase()}`, valor: 'espacio libre de cubierta entre los equipos (ancho total) y hasta sus extremos', sub: ds.map((x) => textoDistancia(x, unidad)) });
  }
  return {
    titulo: 'Equipamiento',
    lineas,
    tabla: { columnas: ['Equipo', 'Tipo', 'Dónde va', 'Posición y corte'], anchos: [0.13, 0.3, 0.22, 0.35], filas, negrita: [0], destacar: [2, 3] },
  };
}

/**
 * Ficha de fabricación completa para el maestro: forma y medidas generales; cada tramo
 * (lados, principal y aéreos) con sus módulos en orden en una tabla: qué es y dónde va
 * (cotas), ancho, cada frente con su medida terminada y la apertura de cada puerta,
 * interior y equipamiento; equipamiento (encimera a gas y sus platos, lavaplatos simple o
 * doble con o sin llave y su posición, horno, campana alojada o mural), cubierta con sus
 * piezas y cortes, materiales, frentes para cortar agrupados por medida y notas.
 */
export function fichaFabricacion(
  d: Diseno,
  producto: ProductoCatalogo | null,
  unidad: Unidad,
  materiales: CatalogoMateriales | null,
  opciones: { numero?: string; cliente?: string } = {},
): FichaFabricacion {
  const f = (mm: number, conU = true) => formatear(mm, unidad, conU);
  const m = d.materiales;
  const cocina = esCocinaD(d);
  const adulta = cocina && d.plantilla !== 'cocina-infantil';
  const secciones: SeccionFicha[] = [];
  const [x0, x1] = extremosPrincipal(d);
  const forma = textoForma(d, unidad);
  const ubic = ubicarEquipos(d);
  const generales: LineaDetalle[] = [
    { etiqueta: 'Mueble', valor: producto ? `${producto.nombre} (código ${producto.id})` : d.nombreModelo || 'Diseño a medida' },
    { etiqueta: 'Forma', valor: forma ?? 'lineal' },
    { etiqueta: 'Medidas generales', valor: `${f(x1 - x0)} de largo${forma ? ' (tramo principal con las esquinas)' : ''} × ${f(d.alto)} de alto × ${f(d.profundidad)} de fondo` },
  ];
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) generales.push({ etiqueta: `Lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`, valor: `${f(r.largo)} desde el muro principal (con la esquina) × ${f(r.profundidad)} de fondo` });
  }
  if (d.plantilla !== 'tocador' && d.aereos.activo && calcularLayoutAereos(d)) {
    generales.push({ etiqueta: d.plantilla === 'compacto' ? 'Mueble superior' : 'Muebles aéreos', valor: `sí: ${f(d.aereos.alto)} de alto × ${f(d.aereos.profundidad)} de fondo (detalle más abajo)` });
  }
  generales.push(
    { etiqueta: 'Zócalo', valor: f(d.zocalo) },
    { etiqueta: 'Espesores', valor: `melamina ${d.espesor} mm${adulta ? `, cubierta ${d.cocina.espesorCubierta} mm` : ''}` },
    { etiqueta: 'Luz entre frentes', valor: `${d.luzFrentes} mm` },
    { etiqueta: 'Estructura', valor: d.estructura === 'modular' ? 'modular: cada módulo con sus costados' : 'casco único con divisiones' },
    { etiqueta: 'Separación entre módulos', valor: f(d.separacionCuerpos) },
    { etiqueta: 'Tiradores', valor: d.tirador === 'sin' ? TIRADOR.sin : `${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}` },
    { etiqueta: 'Herrajes', valor: d.cierreSuave ? 'Cierre suave en puertas y cajones' : 'bisagras y correderas estándar' },
  );
  if (d.plantilla !== 'tocador') {
    const tramos = tramosDe(d).filter((t) => cuerposDe(d, t).length);
    const modulos = tramos.reduce((x, t) => x + cuerposDe(d, t).length, 0);
    generales.push({ etiqueta: 'Frentes', valor: `${modulos} ${modulos === 1 ? 'módulo' : 'módulos'}: ${resumenFrentes(d)}` });
  }
  if (d.plantilla === 'compacto') generales.push({ etiqueta: 'Mueble base', valor: `${f(d.aereos.elevacion)} de alto hasta la cubierta` });
  secciones.push({ titulo: 'Forma y medidas generales', lineas: generales });
  if (d.plantilla === 'tocador') {
    secciones.push({ titulo: 'Tocador', lineas: describirCuerpos(d, unidad).map((x) => ({ etiqueta: x.split(':')[0], valor: x.split(':').slice(1).join(':').trim() || x })) });
  } else {
    for (const t of ['izq', 'base', 'der'] as TramoId[]) {
      const sec = seccionTramo(d, t, unidad, ubic);
      if (sec) secciones.push(sec);
    }
  }
  const la = calcularLayoutAereos(d);
  if (la) {
    const a = d.aereos;
    const formaA = formaDe({ izq: ladoAereoActivo(d, 'izq'), der: ladoAereoActivo(d, 'der') });
    const desde = la.x0 - x0;
    const lb = calcularLayout(disenoBase(d));
    const sobreCubierta = la.y0 - (lb.yTope + lb.espesorCubierta);
    secciones.push({
      titulo: d.plantilla === 'compacto' ? 'Mueble superior' : 'Muebles aéreos',
      lineas: [
        {
          etiqueta: 'Forma y medidas',
          valor:
            d.plantilla === 'compacto'
              ? `apoyado sobre la cubierta con costados y respaldo, alto ${f(a.alto)}, fondo ${f(a.profundidad)}`
              : `${FORMA[formaA]}, alto ${f(a.alto)}, fondo ${f(a.profundidad)}, borde inferior a ${f(a.elevacion)} del piso${a.cuadrado ? ', cuadrados con el mueble base' : ''}`,
        },
        {
          etiqueta: 'Montaje',
          valor:
            la.montaje === 'apoyado'
              ? `apoyado sobre la cubierta del mueble base (a ${f(la.y0)} del piso), con costados y respaldo`
              : `colgados del muro, de ${f(la.y0)} a ${f(la.y1)} del piso${sobreCubierta > 0 && lb.espesorCubierta > 0 ? `; quedan ${f(sobreCubierta)} libres sobre la cubierta` : ''}`,
        },
        ...(Math.abs(desde) > 0.5 ? [{ etiqueta: 'Ubicación', valor: `el aéreo principal comienza a ${f(desde)} ${referenciaTramo(d, 'aereos')}` }] : []),
      ],
    });
    for (const t of ['aereos-izq', 'aereos', 'aereos-der'] as TramoId[]) {
      if (t !== 'aereos' && !ladoAereoActivo(d, t === 'aereos-izq' ? 'izq' : 'der')) continue;
      const sec = seccionTramo(d, t, unidad, ubic);
      if (sec) secciones.push({ ...sec, titulo: t === 'aereos' ? (d.plantilla === 'compacto' ? 'Mueble superior · módulos' : 'Aéreo principal') : sec.titulo });
    }
  }
  if (cocina) {
    const eq = seccionEquipamiento(d, unidad, ubic);
    if (eq) secciones.push(eq);
  }
  if (adulta) {
    const k = d.cocina;
    const piezas: string[] = [`tramo principal: ${f(x1 - x0, false)} × ${f(d.profundidad)}${forma ? ' (cubre las esquinas)' : ''}`];
    for (const lado of LADOS) {
      const r = d.lados?.[lado];
      if (r) piezas.push(`lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}: ${f(largoUtilLado(d, lado), false)} × ${f(r.profundidad)} (desde el borde de la cubierta principal hasta la punta)`);
    }
    const donde = (u: { tramo: TramoId; s: number }) => `centro a ${f(cota(d, u.tramo, u.s))} ${referenciaTramo(d, u.tramo)}`;
    const cortes = ubic
      .filter((u) => u.tipo === 'encimera' || u.tipo === 'lavaplatos')
      .map((u) => {
        const e = d.equipos.find((x) => x.id === u.id)!;
        const que = `${e.tipo === 'encimera' ? `encimera ${e.platos} platos` : `lavaplatos ${e.modelo === 'rinonera' ? 'riñonera' : e.modelo}`}${e.soloCorte ? ' (solo corte: el cliente aporta el equipo)' : ''}`;
        const borde = e.tipo === 'lavaplatos' && e.posicion !== 'centro' ? `, a ${f(e.margen)} del borde ${e.posicion === 'izq' ? 'izquierdo' : 'derecho'} de su módulo` : '';
        return `${que}: ${f(u.ancho, false)} × ${f(u.fondo)} (${nombreModuloEn(d, u.tramo, u.indice)}), ${donde(u)}${borde}`;
      });
    secciones.push({
      titulo: 'Cubierta',
      lineas: [
        { etiqueta: 'Material', valor: `postformada ${nombreMaterial(materiales?.cubiertas, m.cubierta)}` },
        { etiqueta: 'Espesor y vuelo', valor: `${k.espesorCubierta} mm, vuelo frontal ${k.vueloCubierta} mm` },
        { etiqueta: 'Copete', valor: k.copete ? 'sí, en todo el borde contra los muros' : 'no' },
        { etiqueta: 'Piezas', valor: `${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'} (largo × fondo)`, sub: piezas },
        ...(forma ? [{ etiqueta: 'Esquinas', valor: 'la cubierta del tramo principal cubre las esquinas; los lados parten del borde de esa cubierta' }] : []),
        ...(cortes.length ? [{ etiqueta: 'Cortes', valor: `${cortes.length} ${cortes.length === 1 ? 'corte' : 'cortes'} (ancho × fondo nominal; confirmar con el equipo)`, sub: cortes }] : []),
      ],
    });
  }
  secciones.push({
    titulo: 'Materiales',
    lineas: [
      { etiqueta: 'Melamina frentes', valor: nombreMaterial(materiales?.melaminas, m.frente) },
      { etiqueta: 'Melamina cuerpo', valor: nombreMaterial(materiales?.melaminas, m.casco) },
      ...(cocina ? [{ etiqueta: 'Cubierta', valor: nombreMaterial(materiales?.cubiertas, m.cubierta) }] : []),
      { etiqueta: 'Tiradores', valor: d.tirador === 'sin' ? TIRADOR.sin : `${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}` },
      ...(d.cierreSuave ? [{ etiqueta: 'Herrajes', valor: 'Cierre suave en puertas y cajones' }] : []),
      ...(d.imagenFrontal ? [{ etiqueta: 'Imagen', valor: 'imagen personalizada impresa en los frentes' }] : []),
    ],
  });
  const frentes = seccionFrentesParaCortar(d, unidad);
  if (frentes) secciones.push(frentes);
  const notas: string[] = [
    `Medidas en ${unidad === 'cm' ? 'centímetros' : 'milímetros'}. Los módulos van numerados de izquierda a derecha mirando de frente cada tramo; la apertura de cada puerta también se indica mirándola de frente.`,
    `Cotas: el tramo principal y los aéreos se miden desde el ${referenciaTramo(d, 'base').replace(/^del /, '')}; los lados, desde el muro principal.`,
  ];
  if (forma) notas.push('En la L y la U cada lado se mide completo desde el muro principal, con la esquina.');
  for (const a of advertencias(d, unidad)) notas.push(a.texto);
  secciones.push({ titulo: 'Notas', lineas: notas.map((n, i) => ({ etiqueta: `${i + 1}`, valor: n })) });
  return {
    titulo: `Ficha de fabricación${opciones.numero ? ` · ${opciones.numero}` : ''}`,
    subtitulo: [opciones.cliente, producto?.modelo ?? (d.nombreModelo || 'Diseño a medida')].filter(Boolean).join(' · '),
    secciones,
  };
}

/** La ficha en texto plano (para imprimir o enviar): las tablas, una línea por fila. */
export function textoFicha(ficha: FichaFabricacion): string {
  const lineas: string[] = [ficha.titulo, ficha.subtitulo, ''];
  const linea = (l: LineaDetalle) => {
    lineas.push(`• ${l.etiqueta}: ${l.valor}`);
    for (const x of l.sub ?? []) lineas.push(`   - ${x}`);
  };
  for (const s of ficha.secciones) {
    lineas.push(s.titulo.toUpperCase());
    s.lineas.forEach(linea);
    for (const fila of s.tabla?.filas ?? []) {
      if (fila.texto) linea(fila.texto);
      else lineas.push(`• ${fila.celdas.map((c) => c.replace(/\n/g, ', ')).filter(Boolean).join(' · ')}`);
    }
    lineas.push('');
  }
  return lineas.join('\n').trimEnd();
}

export function numeroCotizacion(id: number): string {
  return `COT-${String(id).padStart(4, '0')}`;
}

/** AAAA-MM-DD → DD-MM-AAAA */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

/** Fecha local de hoy en formato AAAA-MM-DD. */
export function hoy(): string {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

/** Texto plano de la cotización: título, datos en lista y cierre con vendedor, fecha y valor. */
export function textoCotizacion(c: Pick<Cotizacion, 'numero' | 'cliente' | 'detalle' | 'observaciones' | 'vendedor' | 'fecha' | 'valor'>): string {
  const lineas: string[] = [];
  lineas.push(`Cotización ${c.cliente.nombre} · N° ${c.numero}`);
  lineas.push('De Todito Outlet · Muebles a medida');
  lineas.push('');
  lineas.push(`• Cliente: ${c.cliente.nombre}`);
  if (c.cliente.telefono) lineas.push(`• Teléfono: ${c.cliente.telefono}`);
  if (c.cliente.email) lineas.push(`• Correo: ${c.cliente.email}`);
  if (c.cliente.direccion) lineas.push(`• Dirección / comuna: ${c.cliente.direccion}`);
  for (const l of c.detalle) {
    lineas.push(`• ${l.etiqueta}: ${l.valor}`);
    for (const s of l.sub ?? []) lineas.push(`   - ${s}`);
  }
  if (c.observaciones) lineas.push(`• Observaciones: ${c.observaciones}`);
  lineas.push('');
  lineas.push(`Vendedor: ${c.vendedor.nombre}`);
  lineas.push(`Fecha cotización: ${formatoFecha(c.fecha)}`);
  lineas.push(`Valor mueble: ${formatoPrecio(c.valor)}`);
  return lineas.join('\n');
}

/** Normaliza un teléfono chileno para wa.me (solo dígitos, con código 56). */
export function telefonoWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9 && n.startsWith('9')) n = `56${n}`;
  if (n.length === 8) n = `569${n}`;
  return n.length >= 10 ? n : null;
}
