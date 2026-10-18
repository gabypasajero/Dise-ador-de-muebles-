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
    ],
    /** Sobre el último tramo, cada `cadaCm` (o fracción) suma `valor`. */
    sobreUltimo: { cadaCm: 5, valor: 10000 },
  },
  /** Encimera a gas. Los diseños antiguos de 2 platos se cobran como 3. */
  encimera: { '3': 60000, '4': 85000 } as Record<'3' | '4', number>,
  /** Horno eléctrico de 58 L, por cada uno. */
  horno: 170000,
  lavaplatos: { simple: 40000, doble: 70000 } as Record<'simple' | 'doble', number>,
  /** Llave (grifería), una por lavaplatos que la lleve. */
  llave: 15000,
  /** Campana, por cada una. */
  campana: 70000,
  /** Mueble aéreo: precio fijo para cualquier largo y forma (lineal, L o U). */
  aereo: {
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

/** Precio oficial del aéreo (fijo + recargos por alto y por el mayor fondo de sus lados). null si no lleva. */
export function precioAereo(d: Diseno): { valor: number; lineas: LineaPrecio[] } | null {
  const a = d.aereos;
  if (d.plantilla !== 'cocina' || !a.activo || !a.cuerpos.length) return null;
  const t = TARIFAS.aereo;
  const fondos = [a.profundidad, ...LADOS.map((l) => ladoAereoActivo(d, l)?.profundidad ?? 0)];
  const fondo = Math.max(...fondos);
  const lados = LADOS.filter((l) => ladoAereoActivo(d, l)).length;
  const forma = lados === 2 ? 'en U' : lados === 1 ? 'en L' : 'lineal';
  const lineas: LineaPrecio[] = [
    {
      concepto: 'Mueble aéreo',
      detalle: `${forma}, precio fijo (alto ${t.altoBaseCm} cm y fondo ${t.fondoBaseCm} cm incluidos)`,
      cantidad: 1,
      unidad: 'unidad',
      unitario: t.base,
      valor: t.base,
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

function lineaLado(concepto: string, largoMm: number, fondoMm: number, esquina: boolean): LineaPrecio {
  const v = valorMetro(fondoMm);
  return {
    concepto,
    detalle: `${fmtM(largoMm)}${esquina ? ' (medido completo, con la esquina)' : ''} × fondo ${fmtCm(fondoMm)} (${fmtPesos(v)} por metro)`,
    cantidad: largoMm / 1000,
    unidad: 'm',
    unitario: v,
    valor: Math.round((largoMm * v) / 1000),
  };
}

function lineaUnidades(concepto: string, cantidad: number, unitario: number, detalle = ''): LineaPrecio {
  return { concepto, detalle: detalle || `${cantidad} × ${fmtPesos(unitario)}`, cantidad, unidad: 'unidad', unitario, valor: cantidad * unitario };
}

/**
 * Precio oficial de la cocina: cada lado del mueble base (largo completo en metros ×
 * valor por metro de su fondo) + equipamiento + aéreo. El especiero va incluido.
 * Solo aplica a la plantilla 'cocina' (incluidas la L y la U).
 */
export function precioCocina(d: Diseno): PrecioCocina {
  const lineas: LineaPrecio[] = [];
  const conLados = !!(d.lados?.izq || d.lados?.der);
  const [x0, x1] = extremosPrincipal(d);
  lineas.push(lineaLado(conLados ? 'Mueble base · tramo principal' : 'Mueble base', Math.round(x1 - x0), d.profundidad, conLados));
  for (const lado of LADOS) {
    const r = d.lados?.[lado];
    if (r) lineas.push(lineaLado(`Mueble base · lado ${lado === 'izq' ? 'izquierdo' : 'derecho'}`, r.largo, r.profundidad, true));
  }
  const equipos = d.equipos ?? [];
  const encimeras = equipos.filter((e) => e.tipo === 'encimera');
  for (const platos of ['3', '4'] as const) {
    const n = encimeras.filter((e) => (e.platos === '4' ? '4' : '3') === platos).length;
    if (n) lineas.push(lineaUnidades(`Encimera ${platos} platos`, n, TARIFAS.encimera[platos]));
  }
  const hornos = [d.cuerpos, d.lados?.izq?.cuerpos ?? [], d.lados?.der?.cuerpos ?? []].flat().filter((c) => c.tipo === 'horno').length;
  if (hornos) lineas.push(lineaUnidades('Horno eléctrico 58 L', hornos, TARIFAS.horno));
  const lavaplatos = equipos.filter((e) => e.tipo === 'lavaplatos');
  for (const modelo of ['simple', 'doble'] as const) {
    const n = lavaplatos.filter((e) => e.modelo === modelo).length;
    if (n) lineas.push(lineaUnidades(`Lavaplatos ${modelo}`, n, TARIFAS.lavaplatos[modelo]));
  }
  const llaves = lavaplatos.filter((e) => e.llave).length;
  if (llaves) lineas.push(lineaUnidades('Llave', llaves, TARIFAS.llave));
  const campanas = encimeras.filter((e) => e.campana).length;
  if (campanas) lineas.push(lineaUnidades('Campana', campanas, TARIFAS.campana));
  const aereo = precioAereo(d);
  if (aereo) lineas.push(...aereo.lineas);
  return { total: lineas.reduce((s, l) => s + l.valor, 0), lineas };
}
