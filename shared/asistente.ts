// Apoyo para el asistente de IA: una foto compacta del diseño (para que el modelo sepa
// qué módulos, lados y equipos existen y cómo nombrarlos) y la ejecución de varias
// operaciones como un solo paso (todo o nada).
import { listarEquipamiento, nombreModuloEn, nombreTramo, opcionesEquipo, type ItemEquipo } from './equipos';
import { aperturaAjustable, extremosPrincipal, formaDe, ladoAereoActivo } from './layout';
import {
  advertencias,
  cuerposDe,
  ejecutar,
  largoTramo,
  limitesModulo,
  nombreModulo,
  precioDiseno,
  presetsModulo,
  rolModulo,
  tiposPermitidos,
  tramosDe,
  type Operacion,
  type Resultado,
  type Rol,
} from './reglas';
import type { Bisagra, Cuerpo, Diseno, Forma, ProductoCatalogo, TramoId } from './tipos';

export interface ModuloContexto {
  /** Índice en su tramo (0 = el primero de la izquierda mirando ese tramo de frente). */
  indice: number;
  id: string;
  /** «módulo 2 del lado derecho», «aéreo 1». */
  nombre: string;
  /** «2 puertas», «Cajonera»… (nombreModulo). */
  contenido: string;
  tipo: Cuerpo['tipo'];
  ancho: number;
  /** fijo (horno, especiero), equipado (con encimera, lavaplatos o campana) o ajustable. */
  rol: Rol;
  min: number;
  /** null = sin máximo. */
  max: number | null;
  puertas: number;
  cajones: number;
  /** Solo si la apertura se puede elegir (puerta única o impar). */
  bisagra?: Bisagra;
  pisos?: number;
  /** Ids de los equipos sobre este módulo (o de la campana que aloja). */
  equipos: string[];
}

export interface TramoContexto {
  tramo: TramoId;
  nombre: string;
  /** Lo que suman sus módulos (con la separación en el principal). */
  largo: number;
  /** Lados: largo exterior desde el muro principal (con la esquina), como se mide en la tienda. */
  largoExterior?: number;
  profundidad: number;
  modulos: ModuloContexto[];
  /** Ids de presetsModulo que se pueden agregar en este tramo. */
  presets: string[];
  tipos: Cuerpo['tipo'][];
}

export interface ContextoAsistente {
  plantilla: Diseno['plantilla'];
  forma: Forma;
  /** null si no hay aéreos. */
  formaAereos: Forma | null;
  medidas: { ancho: number; alto: number; profundidad: number; largoConEsquinas: number };
  tramos: TramoContexto[];
  equipamiento: ItemEquipo[];
  opcionesEquipo: ReturnType<typeof opcionesEquipo>;
  aereos: { activo: boolean; cuadrado: boolean; alto: number; profundidad: number; elevacion: number; alineacion: Diseno['aereos']['alineacion'] } | null;
  precio: { total: number; metodo: 'oficial' | 'referencial' } | null;
  advertencias: string[];
}

/**
 * Foto del diseño para el asistente: tramos con sus módulos (índice, id, nombre, ancho,
 * rol, límites), equipamiento con sus ids, opciones y precio. Es JSON puro: se puede
 * poner tal cual en el mensaje al modelo.
 */
export function contextoAsistente(d: Diseno, producto: ProductoCatalogo | null = null, disenoProducto: Diseno | null = null): ContextoAsistente {
  const items = listarEquipamiento(d);
  const tramos: TramoContexto[] = tramosDe(d).map((t) => {
    const lado = t === 'izq' || t === 'der' ? d.lados[t] : t === 'aereos-izq' ? d.aereos.lados.izq : t === 'aereos-der' ? d.aereos.lados.der : null;
    const profundidad = lado ? lado.profundidad : t === 'aereos' ? d.aereos.profundidad : d.profundidad;
    return {
      tramo: t,
      nombre: nombreTramo(d, t),
      largo: largoTramo(d, t),
      ...(lado ? { largoExterior: lado.largo } : {}),
      profundidad,
      modulos: cuerposDe(d, t).map((c, i) => {
        const l = limitesModulo(d, t, c);
        return {
          indice: i,
          id: c.id,
          nombre: nombreModuloEn(d, t, i),
          contenido: nombreModulo(c),
          tipo: c.tipo,
          ancho: c.ancho,
          rol: rolModulo(d, t, c),
          min: l.min,
          max: Number.isFinite(l.max) ? l.max : null,
          puertas: c.puertas,
          cajones: c.cajones,
          ...(aperturaAjustable(c) ? { bisagra: c.bisagra } : {}),
          ...(c.tipo === 'especiero' ? { pisos: c.pisos ?? 2 } : {}),
          equipos: items.filter((x) => x.tramo === t && x.modulo === c.id && x.tipo !== 'llave').map((x) => x.id),
        };
      }),
      presets: presetsModulo(d.plantilla, t).map((p) => p.id),
      tipos: tiposPermitidos(d, t),
    };
  });
  const [x0, x1] = extremosPrincipal(d);
  const a = d.aereos;
  const conAereos = a.activo && a.cuerpos.length > 0;
  const precio = precioDiseno(d, producto, disenoProducto);
  return {
    plantilla: d.plantilla,
    forma: formaDe(d.lados),
    formaAereos: conAereos ? formaDe({ izq: ladoAereoActivo(d, 'izq'), der: ladoAereoActivo(d, 'der') }) : null,
    medidas: { ancho: d.ancho, alto: d.alto, profundidad: d.profundidad, largoConEsquinas: Math.round(x1 - x0) },
    tramos,
    equipamiento: items,
    opcionesEquipo: opcionesEquipo(d.plantilla),
    aereos: conAereos ? { activo: a.activo, cuadrado: a.cuadrado, alto: a.alto, profundidad: a.profundidad, elevacion: a.elevacion, alineacion: a.alineacion } : null,
    precio: precio ? { total: precio.total, metodo: precio.metodo } : null,
    advertencias: advertencias(d).map((x) => x.texto),
  };
}

export interface ResultadoVarias {
  /** true si se hicieron todas. */
  ok: boolean;
  /** Con `todoONada` (por defecto), el diseño original si alguna se rechazó. */
  diseno: Diseno;
  /** Un resultado por operación intentada (se detiene en la primera rechazada). */
  resultados: Resultado[];
  /** Índice de la operación rechazada, si hubo una. */
  fallo: number | null;
  /** Motivo del rechazo (el de la operación `fallo`). */
  motivo: string | null;
  /** Todos los avisos juntos, en orden. */
  avisos: string[];
}

/**
 * Ejecuta varias operaciones en orden (lo que pide una sola instrucción del vendedor, por
 * ejemplo «pásala a U y pon el lavaplatos en el lado derecho»). Por defecto es todo o nada:
 * si una se rechaza, el diseño queda como estaba y se explica cuál y por qué.
 */
export function ejecutarVarias(d: Diseno, ops: Operacion[], opciones: { todoONada?: boolean } = {}): ResultadoVarias {
  const todoONada = opciones.todoONada ?? true;
  let actual = d;
  const resultados: Resultado[] = [];
  for (let i = 0; i < ops.length; i++) {
    const r = ejecutar(actual, ops[i]);
    resultados.push(r);
    if (!r.ok) {
      return { ok: false, diseno: todoONada ? d : actual, resultados, fallo: i, motivo: r.motivo, avisos: resultados.flatMap((x) => x.avisos) };
    }
    actual = r.diseno;
  }
  return { ok: true, diseno: actual, resultados, fallo: null, motivo: null, avisos: resultados.flatMap((x) => x.avisos) };
}

export interface DestinoEquipo {
  tramo: TramoId;
  indice: number;
  modulo: string;
  /** «módulo 2 del lado derecho» */
  nombre: string;
  /** Si el equipo se puede mover ahí (o ya está ahí). */
  ok: boolean;
  /** Por qué no (null si se puede). */
  motivo: string | null;
  actual: boolean;
}

/**
 * Módulos del mueble base a los que se puede mover un equipo (encimera, lavaplatos u horno),
 * con el motivo de los que no sirven: para marcar destinos en la interfaz o en el 3D.
 */
export function destinosEquipo(d: Diseno, id: string): DestinoEquipo[] {
  const item = listarEquipamiento(d).find((x) => x.id === id);
  if (!item || (item.tipo !== 'encimera' && item.tipo !== 'lavaplatos' && item.tipo !== 'horno')) return [];
  const out: DestinoEquipo[] = [];
  for (const t of tramosDe(d)) {
    if (t !== 'base' && t !== 'izq' && t !== 'der') continue;
    cuerposDe(d, t).forEach((c, i) => {
      const actual = item.tramo === t && item.modulo === c.id;
      const r = actual ? null : ejecutar(d, { op: 'moverEquipo', id, tramo: t, modulo: i });
      out.push({ tramo: t, indice: i, modulo: c.id, nombre: nombreModuloEn(d, t, i), ok: actual || !!r?.ok, motivo: r && !r.ok ? r.motivo : null, actual });
    });
  }
  return out;
}
