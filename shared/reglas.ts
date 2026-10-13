// Reglas de negocio: límites de medidas, unidades, operaciones sobre el diseño,
// advertencias de fabricación y precio referencial.
import { cuerpo as nuevoCuerpo, repartir } from './catalogo';
import { calcularLayout, calcularLayoutTocador, esCocina } from './layout';
import type { Cuerpo, Diseno, Plantilla, ProductoCatalogo, Unidad } from './tipos';

export interface Limites {
  ancho: [number, number];
  alto: [number, number];
  profundidad: [number, number];
}

export const LIMITES: Record<Plantilla, Limites> = {
  cocina: { ancho: [400, 3600], alto: [700, 1000], profundidad: [450, 700] },
  'cocina-infantil': { ancho: [500, 1500], alto: [800, 1300], profundidad: [250, 450] },
  closet: { ancho: [400, 3000], alto: [1200, 2600], profundidad: [300, 650] },
  comoda: { ancho: [400, 2000], alto: [500, 1400], profundidad: [300, 600] },
  tocador: { ancho: [600, 1800], alto: [1000, 2000], profundidad: [300, 600] },
  escritorio: { ancho: [700, 2600], alto: [500, 2400], profundidad: [350, 700] },
};

export const ANCHO_MIN_CUERPO = 150;
export const ANCHO_MIN_HUECO = 100;

// ---------- Unidades ----------

export function aUnidad(mm: number, unidad: Unidad): number {
  return unidad === 'cm' ? Math.round(mm) / 10 : Math.round(mm);
}

export function deUnidad(valor: number, unidad: Unidad): number {
  return Math.round(unidad === 'cm' ? valor * 10 : valor);
}

export function formatear(mm: number, unidad: Unidad, conUnidad = true): string {
  const v = aUnidad(mm, unidad);
  const texto = unidad === 'cm' ? v.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : String(v);
  return conUnidad ? `${texto} ${unidad}` : texto;
}

export function limitar(v: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, v));
}

// ---------- Operaciones ----------

function clonar(d: Diseno): Diseno {
  return { ...d, cuerpos: d.cuerpos.map((c) => ({ ...c })), materiales: { ...d.materiales }, cocina: { ...d.cocina }, tocador: { ...d.tocador } };
}

function minCuerpo(c: Cuerpo): number {
  return c.tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
}

/** Cambia el ancho total y reparte la diferencia entre los cuerpos proporcionalmente. */
export function fijarAncho(d: Diseno, ancho: number): Diseno {
  const out = clonar(d);
  const n = out.cuerpos.length;
  const minimo = out.cuerpos.reduce((s, c) => s + minCuerpo(c), 0) + out.separacionCuerpos * Math.max(0, n - 1);
  const objetivo = Math.max(limitar(Math.round(ancho), LIMITES[d.plantilla].ancho), minimo);
  out.ancho = objetivo;
  if (n === 0) return out;
  const util = objetivo - out.separacionCuerpos * (n - 1);
  const partes = repartir(util, out.cuerpos.map((c) => c.ancho));
  out.cuerpos.forEach((c, i) => (c.ancho = partes[i]));
  // Corrige cuerpos que quedaron bajo el mínimo tomando ancho del más grande.
  for (const c of out.cuerpos) {
    const falta = minCuerpo(c) - c.ancho;
    if (falta > 0) {
      const mayor = out.cuerpos.reduce((a, b) => (b.ancho > a.ancho ? b : a));
      mayor.ancho -= falta;
      c.ancho += falta;
    }
  }
  return out;
}

export function fijarAlto(d: Diseno, alto: number): Diseno {
  const out = clonar(d);
  out.alto = limitar(Math.round(alto), LIMITES[d.plantilla].alto);
  if (out.plantilla === 'tocador') out.tocador.altoCubierta = Math.min(out.tocador.altoCubierta, out.alto - 400);
  out.cuerpos.forEach((c) => {
    if (c.alto > out.alto) c.alto = out.alto;
  });
  return out;
}

export function fijarProfundidad(d: Diseno, profundidad: number): Diseno {
  const out = clonar(d);
  out.profundidad = limitar(Math.round(profundidad), LIMITES[d.plantilla].profundidad);
  return out;
}

/** Cambia el ancho de un cuerpo; el ancho total del mueble pasa a ser la suma. */
export function fijarAnchoCuerpo(d: Diseno, indice: number, ancho: number): Diseno {
  const out = clonar(d);
  const c = out.cuerpos[indice];
  if (!c) return out;
  const resto = out.ancho - c.ancho;
  const maxTotal = LIMITES[d.plantilla].ancho[1];
  c.ancho = Math.max(minCuerpo(c), Math.min(Math.round(ancho), maxTotal - resto));
  out.ancho = resto + c.ancho;
  return out;
}

export function fijarSeparacion(d: Diseno, separacion: number): Diseno {
  const out = clonar(d);
  const sep = Math.max(0, Math.min(200, Math.round(separacion)));
  const n = out.cuerpos.length;
  out.separacionCuerpos = sep;
  out.ancho = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + sep * Math.max(0, n - 1);
  if (out.ancho > LIMITES[d.plantilla].ancho[1]) return fijarAncho(out, LIMITES[d.plantilla].ancho[1]);
  return out;
}

export function actualizarCuerpo(d: Diseno, indice: number, cambios: Partial<Cuerpo>): Diseno {
  const out = clonar(d);
  const c = out.cuerpos[indice];
  if (!c) return out;
  Object.assign(c, cambios);
  c.puertas = Math.max(0, Math.min(4, Math.round(c.puertas)));
  c.cajones = Math.max(0, Math.min(12, Math.round(c.cajones)));
  c.repisas = Math.max(0, Math.min(8, Math.round(c.repisas)));
  if (c.tipo !== 'frentes') {
    c.puertas = 0;
    c.cajones = 0;
  }
  if ('ancho' in cambios && typeof cambios.ancho === 'number') return fijarAnchoCuerpo(out, indice, cambios.ancho);
  return out;
}

/** Nombre corto de un módulo según lo que tiene (para la tira y el visor). */
export function nombreModulo(c: Cuerpo): string {
  if (c.tipo !== 'frentes') return NOMBRE_CORTO[c.tipo];
  const puertas = c.puertas > 0 ? `${c.puertas} ${c.puertas === 1 ? 'puerta' : 'puertas'}` : '';
  const cajones = c.cajones > 0 ? `${c.cajones} ${c.cajones === 1 ? 'cajón' : 'cajones'}` : '';
  if (puertas && cajones) return `${puertas} + ${cajones}`;
  return puertas || cajones || 'Abierto';
}

const NOMBRE_CORTO: Record<Exclude<Cuerpo['tipo'], 'frentes'>, string> = {
  horno: 'Horno',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
};

/** Módulo listo para agregar desde el panel «Módulos y espacios». */
export interface PresetModulo {
  id: string;
  texto: string;
  ayuda: string;
  tipo: Cuerpo['tipo'];
  ancho: number;
  cambios: Partial<Cuerpo>;
}

/** Módulos y espacios que se pueden agregar según el tipo de mueble. */
export function presetsModulo(p: Plantilla): PresetModulo[] {
  switch (p) {
    case 'cocina':
      return [
        { id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
        { id: 'cajonera', texto: 'Cajonera', ayuda: '3 cajones', tipo: 'frentes', ancho: 450, cambios: { cajones: 3 } },
        { id: 'horno', texto: 'Horno empotrado', ayuda: 'Módulo de 60 cm para horno', tipo: 'horno', ancho: 600, cambios: {} },
        { id: 'hueco', texto: 'Espacio libre', ayuda: 'Para refrigerador, lavadora u otro equipo', tipo: 'hueco', ancho: 600, cambios: {} },
      ];
    case 'cocina-infantil':
      return [
        { id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho: 300, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
        { id: 'horno', texto: 'Horno de juguete', ayuda: 'Puerta con ventana', tipo: 'horno', ancho: 300, cambios: {} },
      ];
    case 'closet':
      return [
        { id: 'colgar', texto: 'Módulo para colgar', ayuda: 'Puerta y barra para colgar', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', colgador: true, repisas: 1 } },
        { id: 'repisas', texto: 'Módulo con repisas', ayuda: 'Puerta y 4 repisas', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', repisas: 4 } },
        { id: 'cajones', texto: 'Módulo con cajones', ayuda: 'Puerta arriba y 3 cajones abajo', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', cajones: 3, repisas: 1 } },
        { id: 'abierto', texto: 'Módulo abierto', ayuda: 'Repisas a la vista, sin puerta', tipo: 'frentes', ancho: 400, cambios: { repisas: 4 } },
      ];
    case 'escritorio':
      return [
        { id: 'colgar', texto: 'Módulo para colgar', ayuda: 'Puerta y barra para colgar', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', colgador: true, repisas: 2 } },
        { id: 'cajones', texto: 'Módulo con cajones', ayuda: '3 cajones', tipo: 'frentes', ancho: 450, cambios: { cajones: 3, repisas: 2 } },
        { id: 'abierto', texto: 'Módulo abierto', ayuda: 'Repisas a la vista, sin puerta', tipo: 'frentes', ancho: 400, cambios: { repisas: 4 } },
        { id: 'escritorio', texto: 'Escritorio', ayuda: 'Cubierta de trabajo de 75 cm de alto', tipo: 'escritorio', ancho: 800, cambios: { alto: 750 } },
      ];
    case 'comoda':
      return [
        { id: 'cajones', texto: 'Módulo de cajones', ayuda: '4 cajones', tipo: 'frentes', ancho: 450, cambios: { cajones: 4 } },
        { id: 'puerta', texto: 'Módulo con puerta', ayuda: 'Puerta con repisa interior', tipo: 'frentes', ancho: 450, cambios: { puertas: 1, bisagra: 'der', repisas: 1 } },
        { id: 'abierto', texto: 'Módulo abierto', ayuda: 'Repisas a la vista, sin puerta', tipo: 'frentes', ancho: 400, cambios: { repisas: 2 } },
      ];
    case 'tocador':
      return [];
  }
}

/** Ancho que puede tener un módulo nuevo sin pasar el ancho máximo del mueble (null si no cabe). */
export function anchoDisponible(d: Diseno, tipo: Cuerpo['tipo'], deseado: number): number | null {
  const libre = LIMITES[d.plantilla].ancho[1] - d.ancho - (d.cuerpos.length > 0 ? d.separacionCuerpos : 0);
  const minimo = tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO;
  if (libre < minimo) return null;
  return Math.min(deseado, libre);
}

/**
 * Agrega un módulo en la posición indicada (por defecto al final). El ancho
 * total crece con el módulo; si no cabe completo se agrega con el ancho que
 * queda y si no queda espacio el diseño no cambia.
 */
export function agregarCuerpo(
  d: Diseno,
  tipo: Cuerpo['tipo'] = 'frentes',
  posicion: number = d.cuerpos.length,
  cambios?: Partial<Cuerpo>,
  anchoDeseado?: number,
): Diseno {
  const base =
    cambios ??
    {
      puertas: tipo === 'frentes' ? (d.plantilla === 'comoda' ? 0 : 1) : 0,
      cajones: tipo === 'frentes' && d.plantilla === 'comoda' ? 4 : 0,
      bisagra: 'der' as const,
      colgador: d.plantilla === 'closet' && tipo === 'frentes',
    };
  const ancho = anchoDisponible(d, tipo, anchoDeseado ?? (tipo === 'horno' || tipo === 'hueco' ? 600 : 450));
  if (ancho == null) return d;
  const out = clonar(d);
  const nuevo = nuevoCuerpo({ ...base, tipo, ancho, ...(tipo === 'frentes' ? {} : { puertas: 0, cajones: 0 }) });
  const i = Math.max(0, Math.min(out.cuerpos.length, Math.round(posicion)));
  out.cuerpos.splice(i, 0, nuevo);
  const n = out.cuerpos.length;
  out.ancho = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + out.separacionCuerpos * (n - 1);
  // La encimera y el lavaplatos siguen en el mismo módulo.
  const correr = (v: number) => (v >= i ? v + 1 : v);
  if (n > 1) {
    out.cocina.encimeraCuerpo = correr(out.cocina.encimeraCuerpo);
    out.cocina.lavaplatosCuerpo = correr(out.cocina.lavaplatosCuerpo);
  }
  return out;
}

/** Agrega uno de los módulos de presetsModulo. */
export function agregarModulo(d: Diseno, preset: PresetModulo, posicion: number = d.cuerpos.length): Diseno {
  return agregarCuerpo(d, preset.tipo, posicion, preset.cambios, preset.ancho);
}

/** Módulo más cercano a `cerca` que no sea `evitar`, prefiriendo el tipo indicado y evitando espacios libres. */
function moduloCercano(cuerpos: Cuerpo[], cerca: number, evitar: number, preferir: Cuerpo['tipo']): number {
  let mejor = -1;
  let puntaje = Infinity;
  cuerpos.forEach((c, i) => {
    if (i === evitar) return;
    const p = Math.abs(i - cerca) + (c.tipo === preferir ? 0 : c.tipo === 'hueco' ? 200 : 100);
    if (p < puntaje) {
      puntaje = p;
      mejor = i;
    }
  });
  return mejor >= 0 ? mejor : Math.max(0, Math.min(cuerpos.length - 1, cerca));
}

export function quitarCuerpo(d: Diseno, indice: number): Diseno {
  if (d.cuerpos.length <= 1 || indice < 0 || indice >= d.cuerpos.length) return d;
  const out = clonar(d);
  out.cuerpos.splice(indice, 1);
  const n = out.cuerpos.length;
  // La encimera y el lavaplatos del módulo quitado pasan al módulo más adecuado y cercano.
  const { encimeraCuerpo: enc, lavaplatosCuerpo: lav } = d.cocina;
  const correr = (v: number) => Math.min(n - 1, v > indice ? v - 1 : v);
  let e = correr(enc);
  let w = correr(lav);
  if (enc === indice) e = moduloCercano(out.cuerpos, indice, lav === indice ? -1 : w, 'horno');
  if (lav === indice) w = moduloCercano(out.cuerpos, indice, e, 'frentes');
  out.cocina.encimeraCuerpo = e;
  out.cocina.lavaplatosCuerpo = w;
  out.ancho = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + out.separacionCuerpos * (n - 1);
  if (out.ancho < LIMITES[d.plantilla].ancho[0]) return fijarAncho(out, LIMITES[d.plantilla].ancho[0]);
  return out;
}

export function moverCuerpo(d: Diseno, indice: number, delta: -1 | 1): Diseno {
  const destino = indice + delta;
  if (destino < 0 || destino >= d.cuerpos.length) return d;
  const out = clonar(d);
  const [c] = out.cuerpos.splice(indice, 1);
  out.cuerpos.splice(destino, 0, c);
  const remapear = (v: number) => (v === indice ? destino : v === destino ? indice : v);
  out.cocina.encimeraCuerpo = remapear(out.cocina.encimeraCuerpo);
  out.cocina.lavaplatosCuerpo = remapear(out.cocina.lavaplatosCuerpo);
  return out;
}

/** Asegura que un diseño cargado (o recibido del servidor) sea consistente. */
export function normalizar(d: Diseno): Diseno {
  let out = clonar(d);
  const lim = LIMITES[out.plantilla];
  out.alto = limitar(out.alto, lim.alto);
  out.profundidad = limitar(out.profundidad, lim.profundidad);
  out.luzFrentes = limitar(out.luzFrentes, [1, 10]);
  out.zocalo = limitar(out.zocalo, [0, 200]);
  out.espesor = out.espesor === 18 ? 18 : 15;
  const n = out.cuerpos.length;
  const suma = out.cuerpos.reduce((s, c) => s + c.ancho, 0) + out.separacionCuerpos * Math.max(0, n - 1);
  if (suma !== out.ancho) out = fijarAncho(out, out.ancho);
  out.cocina.encimeraCuerpo = limitar(out.cocina.encimeraCuerpo, [0, Math.max(0, n - 1)]);
  out.cocina.lavaplatosCuerpo = limitar(out.cocina.lavaplatosCuerpo, [0, Math.max(0, n - 1)]);
  return out;
}

// ---------- Advertencias de fabricación ----------

export interface Advertencia {
  nivel: 'info' | 'aviso';
  texto: string;
}

export function advertencias(d: Diseno, unidad: Unidad = 'cm'): Advertencia[] {
  const out: Advertencia[] = [];
  const f = (mm: number) => formatear(mm, unidad);
  if (d.plantilla === 'tocador') {
    const l = calcularLayoutTocador(d);
    if (l.frentes.some((c) => c.rect.y1 - c.rect.y0 < 90)) out.push({ nivel: 'aviso', texto: `Hay cajones de menos de ${f(90)} de alto: reduce la cantidad de cajones.` });
    return out;
  }
  const l = calcularLayout(d);
  for (const fr of l.frentes) {
    const ancho = fr.rect.x1 - fr.rect.x0;
    const alto = fr.rect.y1 - fr.rect.y0;
    const nombre = fr.cuerpo >= 0 ? `módulo ${fr.cuerpo + 1}` : 'fila superior';
    if (fr.tipo === 'puerta' && ancho > 620) {
      out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} mide ${f(ancho)} de ancho; sobre ${f(600)} se recomienda dividirla en 2 puertas.` });
    }
    if (fr.tipo === 'puerta' && ancho < 200) {
      out.push({ nivel: 'aviso', texto: `Puerta del ${nombre} muy angosta (${f(ancho)}).` });
    }
    if (fr.tipo === 'cajon' && alto < 90) {
      out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} con frente de ${f(alto)}: el mínimo fabricable es ${f(90)}.` });
    }
    if (fr.tipo === 'cajon' && ancho > 1000) {
      out.push({ nivel: 'aviso', texto: `Cajón del ${nombre} de ${f(ancho)} de ancho: sobre ${f(1000)} conviene dividir en 2 columnas.` });
    }
  }
  if (esCocina(d)) {
    d.cuerpos.forEach((c, i) => {
      if (c.tipo === 'horno' && d.plantilla === 'cocina' && c.ancho < 600) {
        out.push({ nivel: 'aviso', texto: `El horno empotrado estándar necesita un módulo de ${f(600)} (módulo ${i + 1} mide ${f(c.ancho)}).` });
      }
    });
    const lav = d.cuerpos[d.cocina.lavaplatosCuerpo];
    if (d.cocina.lavaplatos !== 'ninguno' && lav) {
      const necesita = d.cocina.lavaplatos === 'doble' ? 800 : 450;
      if (lav.ancho < necesita) out.push({ nivel: 'aviso', texto: `El lavaplatos ${d.cocina.lavaplatos} necesita un módulo de al menos ${f(necesita)}.` });
    }
    const enc = d.cuerpos[d.cocina.encimeraCuerpo];
    if (d.cocina.encimera !== 'ninguna' && enc && enc.ancho < (d.cocina.encimera === '4' ? 580 : d.plantilla === 'cocina' ? 400 : 250)) {
      out.push({ nivel: 'info', texto: `La encimera sobresale del módulo ${d.cocina.encimeraCuerpo + 1}; la cubierta igual la soporta.` });
    }
    if (
      d.cocina.encimera !== 'ninguna' &&
      d.cocina.lavaplatos !== 'ninguno' &&
      d.cocina.encimeraCuerpo === d.cocina.lavaplatosCuerpo
    ) {
      out.push({ nivel: 'aviso', texto: 'La encimera y el lavaplatos están sobre el mismo módulo: elige módulos distintos.' });
    }
  }
  if (d.plantilla === 'closet' && d.profundidad < 500 && d.cuerpos.some((c) => c.colgador)) {
    out.push({ nivel: 'info', texto: `Con ${f(d.profundidad)} de fondo los ganchos quedan algo justos (ideal ${f(550)}).` });
  }
  return out;
}

// ---------- Resumen de piezas ----------

export function contarFrentes(d: Diseno): { puertas: number; cajones: number } {
  if (d.plantilla === 'tocador') {
    return { puertas: 0, cajones: d.tocador.cajonesIzq + d.tocador.cajonesDer + d.tocador.cajonesCentro };
  }
  const l = calcularLayout(d);
  return {
    puertas: l.frentes.filter((f) => f.tipo === 'puerta').length,
    cajones: l.frentes.filter((f) => f.tipo === 'cajon').length,
  };
}

// ---------- Precio referencial ----------

function superficie(ancho: number, alto: number, prof: number): number {
  return ancho * alto + 2 * prof * alto + ancho * prof;
}

/**
 * Precio referencial: escala el precio del producto base según la superficie de
 * melamina y suma o resta frentes. Es solo una guía; la cotización final la da la tienda.
 */
export function precioReferencial(d: Diseno, base: ProductoCatalogo | null, disenoBase: Diseno | null): number | null {
  if (!base || !disenoBase) return null;
  const precioBase = base.precio_oferta ?? base.precio;
  if (!precioBase) return null;
  const s0 = superficie(disenoBase.ancho, disenoBase.alto, disenoBase.profundidad);
  const s1 = superficie(d.ancho, d.alto, d.profundidad);
  let precio = precioBase * (0.45 + 0.55 * (s1 / s0));
  const f0 = contarFrentes(disenoBase);
  const f1 = contarFrentes(d);
  precio += (f1.cajones - f0.cajones) * 14000 + (f1.puertas - f0.puertas) * 9000;
  if (esCocina(d)) {
    const extra = (x: string) => (x === '4' ? 2 : x === '3' ? 1 : x === '2' ? 0.6 : 0);
    precio += (extra(d.cocina.encimera) - extra(disenoBase.cocina.encimera)) * 45000;
    const lav = (x: string) => (x === 'doble' ? 1.6 : x === 'simple' ? 1 : 0);
    precio += (lav(d.cocina.lavaplatos) - lav(disenoBase.cocina.lavaplatos)) * 60000;
    const hornos = (x: Diseno) => x.cuerpos.filter((c) => c.tipo === 'horno').length;
    if (d.plantilla === 'cocina') precio += (hornos(d) - hornos(disenoBase)) * 150000;
  }
  if (d.imagenFrontal) precio += 15000;
  precio = Math.max(precioBase * 0.4, precio);
  return Math.round(precio / 1000) * 1000 - 10;
}

export function formatoPrecio(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
