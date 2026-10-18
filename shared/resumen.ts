// Detalle de la cotización en forma de lista y su versión en texto (para copiar o
// enviar al cliente por WhatsApp), desglose del precio y ficha de fabricación para
// el maestro.
import { listarEquipamiento, nombreModuloEn, nombreTramo } from './equipos';
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
  largoUtilLadoAereo,
  ubicarEquipos,
  type Frente,
  type LayoutAereos,
} from './layout';
import { advertencias, formatear, formatoPrecio } from './reglas';
import { precioCocina } from './tarifas';
import { cuerposDe } from './tramos';
import type { CatalogoMateriales, Cotizacion, Cuerpo, Diseno, Encimera, LineaDetalle, ProductoCatalogo, TramoId, Unidad } from './tipos';

function nombreMaterial(lista: { id: string; nombre: string }[] | undefined, id: string) {
  return lista?.find((m) => m.id === id)?.nombre ?? id;
}

const TIRADOR: Record<Diseno['tirador'], string> = {
  barra: 'barra',
  boton: 'botón',
  unero: 'perfil uñero',
  sin: 'sin tirador (apertura por presión)',
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

/** Equipamiento sobre un módulo, en palabras ("encimera 4 platos con campana"). */
function equiposDelModulo(d: Diseno, t: TramoId, c: Cuerpo): string[] {
  const out: string[] = [];
  for (const e of d.equipos ?? []) {
    if (e.tramo !== t || e.modulo !== c.id) continue;
    if (e.tipo === 'encimera') out.push(`encimera ${e.platos} platos${e.campana ? ' con campana' : ''}`);
    else {
      const pos = e.posicion === 'centro' ? 'centrado' : `pegado a la ${e.posicion === 'izq' ? 'izquierda' : 'derecha'} a ${formatear(e.margen, 'cm')} del borde`;
      out.push(`lavaplatos ${e.modelo} ${pos}${e.llave ? ', con llave' : ', sin llave'}`);
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
      eq.push(`encimera ${e.platos} platos (${donde(it.tramo, it.indice)})${e.campana ? ' con campana' : ''}`);
    } else if (it.tipo === 'horno') eq.push(`horno eléctrico 58 L (${donde(it.tramo, it.indice)})`);
    else if (it.tipo === 'lavaplatos') {
      const l = d.equipos.find((x) => x.id === it.id)!;
      if (l.tipo !== 'lavaplatos') continue;
      const pos = l.posicion === 'centro' ? '' : `, pegado a la ${l.posicion === 'izq' ? 'izquierda' : 'derecha'} a ${formatear(l.margen, 'cm')}`;
      const llave = l.llave ? `, llave ${d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada'}` : d.plantilla === 'cocina-infantil' ? `, grifería ${d.cocina.grifo === 'negro' ? 'negro mate' : 'cromada'}` : ', sin llave';
      eq.push(`lavaplatos ${l.modelo === 'doble' ? '2 cubetas' : '1 cubeta'} (${donde(it.tramo, it.indice)}${pos})${llave}`);
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
  lineas.push({
    etiqueta: 'Medidas',
    valor: `${formatear(d.ancho, unidad, false)} × ${formatear(d.alto, unidad, false)} × ${formatear(d.profundidad, unidad)} (ancho × alto × profundidad)`,
  });
  const forma = textoForma(d, unidad);
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

export interface SeccionFicha {
  titulo: string;
  lineas: LineaDetalle[];
}

/** Hoja para el maestro: todo lo necesario para fabricar e instalar el mueble. */
export interface FichaFabricacion {
  titulo: string;
  subtitulo: string;
  secciones: SeccionFicha[];
}

function detalleModulo(d: Diseno, t: TramoId, i: number, frentes: Frente[], unidad: Unidad, s0: number): LineaDetalle {
  const c = cuerposDe(d, t)[i];
  const f = (mm: number, conU = true) => formatear(mm, unidad, conU);
  const etiqueta = `${prefijoModulo(d, t)} ${i + 1} · ${f(c.ancho)}`;
  const sub: string[] = [`desde ${f(s0)} hasta ${f(s0 + c.ancho)} del comienzo del tramo`];
  let valor: string;
  const propios = frentes.filter((fr) => fr.cuerpo === i);
  const puertas = propios.filter((fr) => fr.tipo === 'puerta');
  const cajones = propios.filter((fr) => fr.tipo === 'cajon');
  switch (c.tipo) {
    case 'horno':
      valor = d.plantilla === 'cocina-infantil' ? 'Horno de juguete' : 'Horno eléctrico 58 L empotrado (hueco de 59,5 cm de alto, faja de melamina arriba)';
      break;
    case 'hueco':
      valor = 'Espacio libre (sin casco; la cubierta pasa por encima)';
      break;
    case 'escritorio':
      valor = `Escritorio de ${f(c.alto || 750)} de alto`;
      break;
    case 'especiero':
      valor = `Especiero: cajón extraíble de alto completo con ${c.pisos ?? 2} pisos interiores`;
      if (cajones[0]) sub.push(`frente de ${f(cajones[0].rect.x1 - cajones[0].rect.x0, false)} × ${f(cajones[0].rect.y1 - cajones[0].rect.y0)}`);
      break;
    case 'campana':
      valor = 'Mueble de campana (puertas arriba, campana abajo)';
      break;
    case 'nicho':
      valor = 'Nicho para microondas con repisa y puerta abatible arriba';
      break;
    default:
      valor = c.abatible ? 'Puerta abatible' : `${c.puertas} ${c.puertas === 1 ? 'puerta' : 'puertas'}${c.cajones ? ` y ${c.cajones} ${c.cajones === 1 ? 'cajón' : 'cajones'}${c.cajonesArriba ? ' arriba' : ' abajo'}` : ''}`;
      if (!c.puertas && !c.cajones && !c.abatible) valor = `Abierto con ${c.repisas} repisas`;
  }
  if (c.tipo !== 'especiero') {
    puertas.forEach((fr, k) => {
      if (fr.tipo !== 'puerta') return;
      const ap = fr.bisagra === 'arriba' ? 'abatible (bisagras arriba)' : `bisagras a la ${fr.bisagra === 'izq' ? 'izquierda' : 'derecha'}`;
      sub.push(`puerta ${k + 1}: ${f(fr.rect.x1 - fr.rect.x0, false)} × ${f(fr.rect.y1 - fr.rect.y0)}, ${ap}`);
    });
    if (cajones.length) {
      const altos = cajones.map((fr) => f(fr.rect.y1 - fr.rect.y0, false)).join(' / ');
      sub.push(`cajones (de arriba hacia abajo): ${altos} ${unidad} de alto, ${f(cajones[0].rect.x1 - cajones[0].rect.x0)} de ancho${c.columnasCajones === 2 && c.cajones > 1 ? ', en 2 columnas' : ''}`);
    }
    if ((c.tipo === 'frentes' || c.tipo === 'campana') && c.repisas > 0 && (puertas.length || !cajones.length)) sub.push(`${c.repisas} ${c.repisas === 1 ? 'repisa' : 'repisas'}`);
    if (c.colgador) sub.push('barra para colgar');
  }
  const equipo = equiposDelModulo(d, t, c);
  if (equipo.length) sub.push(`lleva ${equipo.join(' y ')}`);
  return { etiqueta, valor, sub };
}

function seccionTramo(d: Diseno, t: TramoId, unidad: Unidad): SeccionFicha | null {
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
    lineas.push({ etiqueta: 'Medidas', valor: `largo desde el muro ${f(r.largo)} (con la esquina), módulos ${f(largoUtilLado(d, t))}, fondo ${f(r.profundidad)}` });
    lineas.push({ etiqueta: 'Orden', valor: t === 'izq' ? 'el módulo 1 queda en la punta abierta y el último junto a la esquina' : 'el módulo 1 queda junto a la esquina' });
  } else if (t === 'aereos-izq' || t === 'aereos-der') {
    const lado = t === 'aereos-izq' ? 'izq' : 'der';
    const r = d.aereos.lados[lado]!;
    lineas.push({ etiqueta: 'Medidas', valor: `largo desde el muro ${f(r.largo)} (con la esquina), módulos ${f(largoUtilLadoAereo(d, lado))}, fondo ${f(r.profundidad)}` });
  } else {
    const la = calcularLayoutAereos(d);
    if (la) lineas.push({ etiqueta: 'Medidas', valor: `largo ${f(la.x1 - la.x0)}, alto ${f(d.aereos.alto)}, fondo ${f(d.aereos.profundidad)}` });
  }
  const frentes = frentesTramo(d, t);
  let cursor = 0;
  const sep = t === 'base' ? d.separacionCuerpos : 0;
  cs.forEach((c, i) => {
    lineas.push(detalleModulo(d, t, i, frentes, unidad, cursor));
    cursor += c.ancho + sep;
  });
  return { titulo: nombreTramo(d, t), lineas };
}

/**
 * Ficha de fabricación completa para el maestro: medidas generales, cada lado con sus
 * módulos en orden, puertas con su apertura, cajones con sus altos, especiero,
 * equipamiento con su módulo y posición, materiales, cubierta, aéreos, campana y notas.
 */
export function fichaFabricacion(
  d: Diseno,
  producto: ProductoCatalogo | null,
  unidad: Unidad,
  materiales: CatalogoMateriales | null,
  opciones: { numero?: string; cliente?: string } = {},
): FichaFabricacion {
  const f = (mm: number) => formatear(mm, unidad);
  const m = d.materiales;
  const cocina = esCocinaD(d);
  const secciones: SeccionFicha[] = [];
  const [x0, x1] = extremosPrincipal(d);
  const forma = textoForma(d, unidad);
  const generales: LineaDetalle[] = [
    { etiqueta: 'Mueble', valor: producto ? `${producto.nombre} (código ${producto.id})` : d.nombreModelo || 'Diseño a medida' },
    { etiqueta: 'Forma', valor: forma ?? 'lineal' },
    { etiqueta: 'Medidas generales', valor: `${f(x1 - x0)} de largo × ${f(d.alto)} de alto × ${f(d.profundidad)} de fondo` },
    { etiqueta: 'Zócalo', valor: f(d.zocalo) },
    { etiqueta: 'Espesores', valor: `melamina ${d.espesor} mm${cocina && d.plantilla !== 'cocina-infantil' ? `, cubierta ${d.cocina.espesorCubierta} mm` : ''}` },
    { etiqueta: 'Luz entre frentes', valor: `${d.luzFrentes} mm` },
    { etiqueta: 'Estructura', valor: d.estructura === 'modular' ? 'modular: cada módulo con sus costados' : 'casco único con divisiones' },
    { etiqueta: 'Separación entre módulos', valor: f(d.separacionCuerpos) },
  ];
  if (d.plantilla === 'compacto') generales.push({ etiqueta: 'Mueble base', valor: `${f(d.aereos.elevacion)} de alto hasta la cubierta` });
  secciones.push({ titulo: 'Datos generales', lineas: generales });
  if (d.plantilla === 'tocador') {
    secciones.push({ titulo: 'Tocador', lineas: describirCuerpos(d, unidad).map((x) => ({ etiqueta: x.split(':')[0], valor: x.split(':').slice(1).join(':').trim() || x })) });
  } else {
    for (const t of ['izq', 'base', 'der'] as TramoId[]) {
      const sec = seccionTramo(d, t, unidad);
      if (sec) secciones.push(sec);
    }
  }
  if (cocina && d.plantilla !== 'cocina-infantil') {
    const k = d.cocina;
    const cortes = ubicarEquipos(d)
      .filter((u) => u.tipo === 'encimera' || u.tipo === 'lavaplatos')
      .map((u) => `${u.tipo === 'encimera' ? 'encimera' : 'lavaplatos'} de ${f(u.ancho)}: centro a ${f(u.s)} del comienzo del ${nombreTramo(d, u.tramo).toLowerCase()}`);
    secciones.push({
      titulo: 'Cubierta',
      lineas: [
        { etiqueta: 'Material', valor: `postformada ${nombreMaterial(materiales?.cubiertas, m.cubierta)}` },
        { etiqueta: 'Espesor y vuelo', valor: `${k.espesorCubierta} mm, vuelo frontal ${k.vueloCubierta} mm` },
        { etiqueta: 'Copete', valor: k.copete ? 'sí, en todo el borde contra los muros' : 'no' },
        ...(forma ? [{ etiqueta: 'Esquinas', valor: 'la cubierta del tramo principal cubre las esquinas; los lados parten del borde de esa cubierta' }] : []),
        ...(cortes.length ? [{ etiqueta: 'Cortes', valor: `${cortes.length} ${cortes.length === 1 ? 'corte' : 'cortes'}`, sub: cortes }] : []),
      ],
    });
  }
  if (cocina) {
    const items = listarEquipamiento(d);
    const ubic = ubicarEquipos(d);
    if (items.length) {
      secciones.push({
        titulo: 'Equipamiento',
        lineas: items.map((it) => {
          const u = ubic.find((x) => x.id === it.id);
          const pos = u ? `; centro a ${f(u.s)} del comienzo del tramo` : '';
          return { etiqueta: it.nombre, valor: `${it.donde} (${nombreTramo(d, it.tramo).toLowerCase()}): ${it.detalle}${pos}` };
        }),
      });
    }
  }
  const la = calcularLayoutAereos(d);
  if (la) {
    const a = d.aereos;
    const formaA = formaDe({ izq: ladoAereoActivo(d, 'izq'), der: ladoAereoActivo(d, 'der') });
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
      ],
    });
    for (const t of ['aereos-izq', 'aereos', 'aereos-der'] as TramoId[]) {
      if (t !== 'aereos' && !ladoAereoActivo(d, t === 'aereos-izq' ? 'izq' : 'der')) continue;
      const sec = seccionTramo(d, t, unidad);
      if (sec) secciones.push({ ...sec, titulo: t === 'aereos' ? (d.plantilla === 'compacto' ? 'Mueble superior · módulos' : 'Aéreo principal') : sec.titulo });
    }
    const campanas = ubicarEquipos(d).filter((u) => u.tipo === 'campana');
    if (campanas.length) {
      secciones.push({
        titulo: 'Campana',
        lineas: campanas.map((u) => ({
          etiqueta: 'Campana',
          valor: u.montaje === 'aereo' ? `en el ${nombreModuloEn(d, u.tramo, u.indice)}, centrada sobre la encimera (a ${f(u.s)} del comienzo del tramo)` : 'mural, sobre la encimera',
        })),
      });
    }
  } else if (cocina) {
    const campanas = ubicarEquipos(d).filter((u) => u.tipo === 'campana');
    if (campanas.length) secciones.push({ titulo: 'Campana', lineas: campanas.map(() => ({ etiqueta: 'Campana', valor: 'mural, sobre la encimera' })) });
  }
  secciones.push({
    titulo: 'Materiales',
    lineas: [
      { etiqueta: 'Melamina frentes', valor: nombreMaterial(materiales?.melaminas, m.frente) },
      { etiqueta: 'Melamina cuerpo', valor: nombreMaterial(materiales?.melaminas, m.casco) },
      ...(cocina ? [{ etiqueta: 'Cubierta', valor: nombreMaterial(materiales?.cubiertas, m.cubierta) }] : []),
      { etiqueta: 'Tiradores', valor: d.tirador === 'sin' ? TIRADOR.sin : `${TIRADOR[d.tirador]} ${nombreMaterial(materiales?.tiradores, m.tirador).toLowerCase()}` },
      ...(d.imagenFrontal ? [{ etiqueta: 'Imagen', valor: 'imagen personalizada impresa en los frentes' }] : []),
    ],
  });
  const notas: string[] = [
    `Medidas en ${unidad === 'cm' ? 'centímetros' : 'milímetros'}. Los módulos van numerados de izquierda a derecha mirando de frente cada tramo.`,
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

/** La ficha en texto plano (para imprimir o enviar). */
export function textoFicha(ficha: FichaFabricacion): string {
  const lineas: string[] = [ficha.titulo, ficha.subtitulo, ''];
  for (const s of ficha.secciones) {
    lineas.push(s.titulo.toUpperCase());
    for (const l of s.lineas) {
      lineas.push(`• ${l.etiqueta}: ${l.valor}`);
      for (const x of l.sub ?? []) lineas.push(`   - ${x}`);
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
