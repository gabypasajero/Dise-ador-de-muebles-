// Tarifas oficiales de la tienda para la cocina (plantilla 'cocina', lineal, L y U).
// Para cambiar un precio basta con editar TARIFAS: el resto se calcula solo.
import { LADOS, extremosPrincipal, ladoAereoActivo } from './layout';
import type { Diseno } from './tipos';

export const TARIFAS = {
  /** Valor por metro lineal del mueble base según su fondo (se redondea siempre al tramo mayor). */
  metroLineal: {
    tramos: [
      { hastaCm: 40, valor: 135000 },
      { hastaCm: 50, valor: 140000 },
      { hastaCm: 55, valor: 150000 },
      { hastaCm: 60, valor: 160000 },
      { hastaCm: 70, valor: 170000 },
    ],
    /** Sobre el último tramo, cada `cadaCm` (o fracción) suma `valor`. */
    sobreUltimo: { cadaCm: 5, valor: 10000 },
  },
  /** Encimera a gas. Los diseños antiguos de 2 platos se cobran como 3. */
  encimera: { '3': 60000, '4': 85000 } as Record<'3' | '4', number>,
  /** Horno eléctrico 58 L Sindelen, por cada uno. */
  horno: 170000,
  /** Lavaplatos según modelo (simple con secador, doble, riñonera). */
  lavaplatos: { simple: 40000, doble: 70000, rinonera: 40000 } as Record<'simple' | 'doble' | 'rinonera', number>,
  /** Llave monomando, una por lavaplatos que la lleve. */
  llave: 16000,
  /** Especiero extraíble, por cada uno. */
  especiero: 20000,
  /**
   * Cierre suave en bisagras y correderas, una vez por mueble, según el largo del mueble base
   * (ancho más sus lados): de 40.000 a 80.000. Los cortes por largo están por confirmar con la tienda.
   */
  cierreSuave: [
    { hastaCm: 200, valor: 40000 },
    { hastaCm: 300, valor: 60000 },
    { hastaCm: Infinity, valor: 80000 },
  ],
  /** Sistema sin manilla (sin tiradores, apertura por perfil o push): una vez por mueble completo. */
  sinManilla: 20000,
  /** Solo corte: hueco en la cubierta para una encimera o un lavaplatos que trae el cliente (por cada corte). */
  corte: 0,
  /** Campana, por cada una. */
  campana: 70000,
  /** Isla: valor por metro lineal (más sus equipos y opciones). */
  isla: 170000,
  /** Mueble aéreo: valor por metro lineal (lineal, L o U; cada lado a su largo completo) más los recargos de alto y fondo. */
  aereo: {
    /** Valor por metro lineal del aéreo estándar (alto y fondo base incluidos). */
    base: 130000,
    altoBaseCm: 60,
    fondoBaseCm: 30,
    /** El exceso de alto o de fondo se redondea hacia arriba a múltiplos de `pasoCm`. */
    pasoCm: 5,
    /** Por cada 10 cm completos de exceso. */
    cada10Cm: 15000,
    /** Si quedan 5 cm sueltos. */
    resto5Cm: 10000,
  },
};

export interface LineaPrecio {
  /** Qué se cobra (ej. "Mueble base · tramo principal", "Encimera 4 platos"). */
  concepto: string;
  /** Medida o explicación (ej. "1,5 m × fondo 60 cm"). */
  detalle: string;
  /** Cantidad: metros lineales, unidades o centímetros de recargo. */
  cantidad: number;
  unidad: 'm' | 'unidad' | 'cm';
  /** Valor unitario (por metro, por unidad o del recargo completo). */
  unitario: number;
  valor: number;
}

export interface PrecioCocina {
  total: number;
  lineas: LineaPrecio[];
}

const cm = (mm: number) => mm / 10;
const fmtCm = (mm: number) => `${cm(mm).toLocaleString('es-CL', { maximumFractionDigits: 1 })} cm`;
const fmtM = (mm: number) => `${(mm / 1000).toLocaleString('es-CL', { maximumFractionDigits: 3 })} m`;
const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

/** Valor por metro lineal del mueble base para un fondo dado (mm). */
export function valorMetro(fondoMm: number): number {
  const t = TARIFAS.metroLineal;
  for (const tramo of t.tramos) if (fondoMm <= tramo.hastaCm * 10) return tramo.valor;
  const ultimo = t.tramos[t.tramos.length - 1];
  const pasos = Math.ceil((fondoMm - ultimo.hastaCm * 10) / (t.sobreUltimo.cadaCm * 10));
  return ultimo.valor + pasos * t.sobreUltimo.valor;
}

/** Exceso (mm) redondeado hacia arriba a 5 cm sobre una medida base (0 si no la pasa). */
export function excesoAereo(medidaMm: number, baseCm: number): number {
  const paso = TARIFAS.aereo.pasoCm * 10;
  const exceso = medidaMm - baseCm * 10;
  return exceso <= 0 ? 0 : Math.ceil(exceso / paso) * paso;
}

/** Recargo del aéreo por un exceso (mm, múltiplo de 5 cm): $15.000 cada 10 cm y $10.000 si quedan 5. */
export function recargoAereo(excesoMm: number): number {
  const a = TARIFAS.aereo;
  const diez = Math.floor(excesoMm / 100);
  const resto = excesoMm - diez * 100;
  return diez * a.cada10Cm + (resto >= a.pasoCm * 10 ? a.resto5Cm : 0);
}

/** Largo total (mm) del aéreo para el precio: el principal más cada lado de la L/U a su largo completo. */
export function largoAereo(d: Diseno): number {
  const a = d.aereos;
  return a.cuerpos.reduce((s, c) => s + c.ancho, 0) + LADOS.reduce((s, l) => s + (ladoAereoActivo(d, l)?.largo ?? 0), 0);
}

/** Precio oficial del aéreo (metros lineales × valor por metro + recargos por alto y por el mayor fondo de sus lados). null si no lleva. */
export function precioAereo(d: Diseno): { valor: number; lineas: LineaPrecio[] } | null {
  const a = d.aereos;
  if (d.plantilla !== 'cocina' || !a.activo || !a.cuerpos.length) return null;
  const t = TARIFAS.aereo;
  const fondos = [a.profundidad, ...LADOS.map((l) => ladoAereoActivo(d, l)?.profundidad ?? 0)];
  const fondo = Math.max(...fondos);
  const lados = LADOS.filter((l) => ladoAereoActivo(d, l)).length;
  const forma = lados === 2 ? 'en U' : lados === 1 ? 'en L' : 'lineal';
  const largo = largoAereo(d);
  const lineas: LineaPrecio[] = [
    {
      concepto: 'Mueble aéreo',
      detalle: `${forma}, ${fmtM(largo)}${lados ? ' (cada lado a su largo completo)' : ''} × ${fmtPesos(t.base)} por metro (alto ${t.altoBaseCm} cm y fondo ${t.fondoBaseCm} cm incluidos)`,
      cantidad: largo / 1000,
      unidad: 'm',
      unitario: t.base,
      valor: Math.round((largo * t.base) / 1000),
    },
  ];
  const extraAlto = excesoAereo(a.alto, t.altoBaseCm);
  if (extraAlto > 0) {
    const v = recargoAereo(extraAlto);
    lineas.push({ concepto: 'Aéreo: alto adicional', detalle: `alto ${fmtCm(a.alto)}: ${fmtCm(extraAlto)} sobre ${t.altoBaseCm} cm`, cantidad: cm(extraAlto), unidad: 'cm', unitario: v, valor: v });
  }
  const extraFondo = excesoAereo(fondo, t.fondoBaseCm);
  if (extraFondo > 0) {
    const v = recargoAereo(extraFondo);
    lineas.push({
      concepto: 'Aéreo: fondo adicional',
      detalle: `fondo ${fmtCm(fondo)}${lados ? ' (el mayor de sus lados)' : ''}: ${fmtCm(extraFondo)} sobre ${t.fondoBaseCm} cm`,
      cantidad: cm(extraFondo),
      unidad: 'cm',
      unitario: v,
      valor: v,
    });
  }
  return { valor: lineas.reduce((s, l) => s + l.valor, 0), lineas };
}

/** Con una encimera de 4 hornillas la cocina se cobra al menos con el fondo de 60 cm (la dueña lo pidió así). */
export const FONDO_MINIMO_ENCIMERA_4 = 600;

function lineaLado(concepto: string, largoMm: number, fondoMm: number, esquina: boolean, fondoMinimo = 0): LineaPrecio {
  const fondoCobro = Math.max(fondoMm, fondoMinimo);
  const v = valorMetro(fondoCobro);
  const nota = fondoCobro > fondoMm ? `, se cobra como fondo ${fmtCm(fondoCobro)} por la encimera de 4 hornillas` : '';
  return {
    concepto,
    detalle: `${fmtM(largoMm)}${esquina ? ' (medido completo, con la esquina)' : ''} × fondo ${fmtCm(fondoMm)}${nota} (${fmtPesos(v)} por metro)`,
    cantidad: largoMm / 1000,
    unidad: 'm',
    unitario: v,
    valor: Math.round((largoMm * v) / 1000),
  };
}

export const NOMBRE_HORNO = 'Horno eléctrico 58 L Sindelen';

/** Cantidad de módulos de un tipo en todos los tramos (base, lados y aéreos). */
export function contarModulos(d: Diseno, tipo: Diseno['cuerpos'][number]['tipo']): number {
  const a = d.aereos;
  return [d.cuerpos, d.lados?.izq?.cuerpos ?? [], d.lados?.der?.cuerpos ?? [], a?.cuerpos ?? [], a?.lados?.izq?.cuerpos ?? [], a?.lados?.der?.cuerpos ?? []]
    .flat()
    .filter((c) => c.tipo === tipo).length;
}

/**
 * Especieros y opciones del mueble completo. Con `base` (mueble del catálogo con sus medidas)
 * solo se cobra lo que se agregó sobre el producto: especieros de más y las opciones que no traía.
 */
export function lineasOpciones(d: Diseno, base?: Diseno): LineaPrecio[] {
  const lineas: LineaPrecio[] = [];
  const especieros = contarModulos(d, 'especiero') - (base ? contarModulos(base, 'especiero') : 0);
  if (especieros > 0) lineas.push(lineaUnidades(base ? 'Especiero agregado' : 'Especiero', especieros, TARIFAS.especiero));
  if (d.cierreSuave && !base?.cierreSuave) {
    const largo = largoCierreSuave(d);
    const valor = TARIFAS.cierreSuave.find((t) => largo <= t.hastaCm * 10)!.valor;
    lineas.push(lineaUnidades('Cierre suave en puertas y cajones', 1, valor, `una vez por mueble · largo ${Math.round(largo / 10)} cm`));
  }
  if (d.tirador === 'sin' && base?.tirador !== 'sin') lineas.push(lineaUnidades('Sistema sin manilla', 1, TARIFAS.sinManilla, 'sin tiradores, apertura por perfil o push; una vez por mueble'));
  return lineas;
}

/** Largo del mueble base para el cierre suave: el ancho más los lados de la L o la U. */
export function largoCierreSuave(d: Diseno): number {
  return d.ancho + (d.lados?.izq?.largo ?? 0) + (d.lados?.der?.largo ?? 0);
}

function lineaUnidades(concepto: string, cantidad: number, unitario: number, detalle = ''): LineaPrecio {
  return { concepto, detalle: detalle || `${cantidad} × ${fmtPesos(unitario)}`, cantidad, unidad: 'unidad', unitario, valor: cantidad * unitario };
}

/**
 * Precio oficial de la cocina: cada lado del mueble base (largo completo en metros ×
 * valor por metro de su fondo) + equipamiento + especieros + opciones (cierre suave, sin manilla) + aéreo.
 * Solo aplica a la plantilla 'cocina' (incluidas la L y la U).
 */
export function precioCocina(d: Diseno): PrecioCocina {
  const lineas: LineaPrecio[] = [];
  const conLados = !!(d.lados?.izq || d.lados?.der);
  const [x0, x1] = extremosPrincipal(d);
  const minimo = (d.equipos ?? []).some((e) => e.tipo === 'encimera' && e.platos === '4') ? FONDO_MINIMO_ENCIMERA_4 : 0;
  lineas.push(lineaLado(conLados ? 'Mueble base · tramo principal' : 'Mueble base', Math.round(x1 - x0), d.profundidad, conLados, minimo));
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) lineas.push(lineaLado(`Mueble base · lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`, r.largo, r.profundidad, true, minimo));
  }
  const equipos = d.equipos ?? [];
  const encimeras = equipos.filter((e) => e.tipo === 'encimera');
  for (const platos of ['3', '4'] as const) {
    const n = encimeras.filter((e) => !e.soloCorte && (e.platos === '4' ? '4' : '3') === platos).length;
    if (n) lineas.push(lineaUnidades(`Encimera ${platos} platos`, n, TARIFAS.encimera[platos]));
  }
  const hornos = [d.cuerpos, d.lados?.izq?.cuerpos ?? [], d.lados?.der?.cuerpos ?? []].flat().filter((c) => c.tipo === 'horno').length;
  if (hornos) lineas.push(lineaUnidades(NOMBRE_HORNO, hornos, TARIFAS.horno));
  const lavaplatos = equipos.filter((e) => e.tipo === 'lavaplatos');
  for (const modelo of ['simple', 'doble', 'rinonera'] as const) {
    const n = lavaplatos.filter((e) => !e.soloCorte && e.modelo === modelo).length;
    if (n) lineas.push(lineaUnidades(`Lavaplatos ${modelo === 'rinonera' ? 'riñonera' : modelo}`, n, TARIFAS.lavaplatos[modelo]));
  }
  // Solo corte: el cliente trae el equipo; se cobra solo el hueco en la cubierta (TARIFAS.corte).
  const cortesEncimera = encimeras.filter((e) => e.soloCorte).length;
  if (cortesEncimera) lineas.push(lineaUnidades('Corte para encimera (sin equipo)', cortesEncimera, TARIFAS.corte));
  const cortesLavaplatos = lavaplatos.filter((e) => e.soloCorte).length;
  if (cortesLavaplatos) lineas.push(lineaUnidades('Corte para lavaplatos (sin equipo)', cortesLavaplatos, TARIFAS.corte));
  const llaves = lavaplatos.filter((e) => e.llave && !e.soloCorte).length;
  if (llaves) lineas.push(lineaUnidades('Llave monomando', llaves, TARIFAS.llave));
  const campanas = encimeras.filter((e) => e.campana).length;
  if (campanas) lineas.push(lineaUnidades('Campana', campanas, TARIFAS.campana));
  lineas.push(...lineasOpciones(d));
  const aereo = precioAereo(d);
  if (aereo) lineas.push(...aereo.lineas);
  return { total: lineas.reduce((s, l) => s + l.valor, 0), lineas };
}

/**
 * Precio de una isla: su largo en metros × la tarifa de isla (en vez del metro lineal por fondo del
 * mueble base), más sus equipos, especieros y opciones como cualquier cocina.
 */
export function precioIsla(d: Diseno): PrecioCocina {
  const p = precioCocina(d);
  const resto = p.lineas.filter((l) => !l.concepto.startsWith('Mueble base'));
  const isla: LineaPrecio = {
    concepto: 'Isla',
    detalle: `${fmtM(d.ancho)} × ${fmtPesos(TARIFAS.isla)} por metro`,
    cantidad: d.ancho / 1000,
    unidad: 'm',
    unitario: TARIFAS.isla,
    valor: Math.round((d.ancho * TARIFAS.isla) / 1000),
  };
  const lineas = [isla, ...resto];
  return { total: lineas.reduce((s, l) => s + l.valor, 0), lineas };
}
