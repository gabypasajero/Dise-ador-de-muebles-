// Catálogo y revisión de las operaciones serializables que reciben ejecutar() y el
// asistente de IA. Todas las medidas van en milímetros. Este archivo no depende del
// resto del motor (solo de sus tipos), para que reglas.ts lo use sin ciclos.
import type { Operacion } from './reglas';

type TipoCampo = 'mm' | 'entero' | 'booleano' | 'texto' | 'tramo' | 'modulo' | 'opcion' | 'objeto';

export interface CampoOperacion {
  tipo: TipoCampo;
  /** Valores admitidos (tipo 'opcion'). */
  valores?: readonly (string | number)[];
  opcional?: boolean;
  descripcion: string;
  /** Campos de un objeto anidado (tipo 'objeto'). */
  campos?: Record<string, CampoOperacion>;
  /** Se acepta pero no se ofrece (no se lista en describirOperaciones). */
  oculto?: boolean;
}

export interface DescripcionOperacion {
  op: Operacion['op'];
  descripcion: string;
  campos: Record<string, CampoOperacion>;
  ejemplo: Operacion;
}

export const TRAMOS_OPERACION = ['base', 'izq', 'der', 'aereos', 'aereos-izq', 'aereos-der', 'retorno'] as const;
export const FORMAS = ['lineal', 'L-izq', 'L-der', 'U'] as const;
const LADOS = ['izq', 'der'] as const;
const TIPOS_MODULO = ['frentes', 'horno', 'hueco', 'escritorio', 'campana', 'nicho', 'especiero', 'espacio-campana', 'refrigerador'] as const;

const mm = (descripcion: string, opcional = false): CampoOperacion => ({ tipo: 'mm', descripcion, opcional });
const tramo = (opcional = false): CampoOperacion => ({
  tipo: 'tramo',
  opcional,
  descripcion: "'base' (tramo principal), 'izq' / 'der' (lados de la L o U), 'aereos', 'aereos-izq', 'aereos-der'",
});
const modulo: CampoOperacion = { tipo: 'modulo', descripcion: 'índice del módulo en su tramo (0 = el primero) o su id' };
// Solo para uso programático: el asistente no lo ve (y aplicarPlan lo descarta). Al agregar o quitar,
// el mueble conserva su medida y los módulos ajustables se reparten parejo.
const ajustarLargo: CampoOperacion = { tipo: 'booleano', opcional: true, oculto: true, descripcion: 'true: agranda o achica el mueble en vez de repartir el espacio dentro del largo actual' };

const CAMBIOS_MODULO: Record<string, CampoOperacion> = {
  id: { tipo: 'texto', opcional: true, oculto: true, descripcion: 'se ignora: el id de un módulo no cambia' },
  campanaDe: { tipo: 'texto', opcional: true, oculto: true, descripcion: 'se ignora: la campana la ubica el motor' },
  tipo: { tipo: 'opcion', valores: TIPOS_MODULO, opcional: true, descripcion: 'tipo de módulo' },
  ancho: mm('ancho del módulo', true),
  puertas: { tipo: 'entero', opcional: true, descripcion: '0 a 4 puertas' },
  bisagra: { tipo: 'opcion', valores: LADOS, opcional: true, descripcion: 'apertura de la puerta única o de la puerta 1 de un módulo de 3' },
  cajones: { tipo: 'entero', opcional: true, descripcion: '0 a 12 cajones' },
  columnasCajones: { tipo: 'entero', opcional: true, descripcion: 'cajones en 1 o 2 columnas' },
  altoCajon: mm('alto de cada frente de cajón (0 = automático)', true),
  repisas: { tipo: 'entero', opcional: true, descripcion: 'repisas interiores' },
  colgador: { tipo: 'booleano', opcional: true, descripcion: 'barra para colgar (clóset)' },
  alto: mm('alto propio del módulo (0 = alto completo)', true),
  abatible: { tipo: 'booleano', opcional: true, descripcion: 'puerta que se abre hacia arriba (aéreos)' },
  cajonesArriba: { tipo: 'booleano', opcional: true, descripcion: 'cajones arriba y puertas abajo' },
  pisos: { tipo: 'entero', opcional: true, descripcion: 'pisos interiores del especiero: 2 o 3' },
};

const CAMBIOS_EQUIPO: Record<string, CampoOperacion> = {
  platos: { tipo: 'opcion', valores: ['2', '3', '4'], opcional: true, descripcion: "encimera: '3' o '4' (la infantil también '2')" },
  campana: { tipo: 'booleano', opcional: true, descripcion: 'encimera: con o sin campana encima' },
  modelo: { tipo: 'opcion', valores: ['simple', 'doble', 'rinonera', 'pozo', 'pozo-doble'], opcional: true, descripcion: "lavaplatos: 'simple' (1 cubeta con secador, 80 cm), 'doble' (2 cubetas, 77 cm), 'rinonera' (riñonera: 1 cubeta redondeada sin secador, 61 cm), 'pozo' (1 cubeta de 43,7 × 33,7 cm de acero oscuro, 49 × 39 cm) o 'pozo-doble' (cubetas de 37 × 38 y 33 × 33 cm de acero oscuro, 78 × 43 cm)" },
  llave: { tipo: 'booleano', opcional: true, descripcion: 'lavaplatos: con o sin llave' },
  posicion: { tipo: 'opcion', valores: ['centro', 'izq', 'der'], opcional: true, descripcion: 'lavaplatos centrado o pegado a un borde de su módulo' },
  margen: mm('lavaplatos pegado a un borde: distancia del borde del módulo al borde del lavaplatos completo (mínimo 50)', true),
  soloCorte: { tipo: 'booleano', opcional: true, descripcion: 'encimera o lavaplatos: solo el corte en la cubierta, el cliente trae su equipo (no se cobra; el lavaplatos queda sin llave)' },
};

/** Todas las operaciones con sus campos, para la interfaz, el asistente y la revisión. */
export const OPERACIONES: DescripcionOperacion[] = [
  { op: 'fijarAncho', descripcion: 'Cambia el ancho del tramo principal (sin las esquinas de la L/U); se reparte entre sus módulos.', campos: { ancho: mm('ancho nuevo') }, ejemplo: { op: 'fijarAncho', ancho: 2400 } },
  { op: 'fijarAlto', descripcion: 'Cambia el alto del mueble.', campos: { alto: mm('alto nuevo') }, ejemplo: { op: 'fijarAlto', alto: 900 } },
  { op: 'fijarProfundidad', descripcion: 'Cambia el fondo del tramo principal (los lados conservan su largo exterior).', campos: { profundidad: mm('fondo nuevo') }, ejemplo: { op: 'fijarProfundidad', profundidad: 600 } },
  { op: 'fijarSeparacion', descripcion: 'Separación entre módulos del tramo principal (el ancho no cambia).', campos: { separacion: mm('separación') }, ejemplo: { op: 'fijarSeparacion', separacion: 0 } },
  { op: 'fijarForma', descripcion: 'Forma del mueble base: lineal, L a la izquierda, L a la derecha o U.', campos: { forma: { tipo: 'opcion', valores: FORMAS, descripcion: 'forma' } }, ejemplo: { op: 'fijarForma', forma: 'U' } },
  {
    op: 'fijarLado',
    descripcion: 'Largo exterior (desde el muro principal, con la esquina) o fondo de un lado de la L/U.',
    campos: { lado: { tipo: 'opcion', valores: LADOS, descripcion: 'lado' }, largo: mm('largo exterior', true), profundidad: mm('fondo', true) },
    ejemplo: { op: 'fijarLado', lado: 'der', largo: 1200 },
  },
  {
    op: 'agregarModulo',
    descripcion: 'Agrega un módulo de la lista presetsModulo(plantilla, tramo) sin cambiar el largo: el nuevo y los módulos ajustables del tramo se reparten parejo el espacio (horno, especiero y módulos con encimera, lavaplatos o campana conservan su ancho).',
    campos: { tramo: tramo(), preset: { tipo: 'texto', descripcion: "id del preset: 'puerta', 'dos-puertas', 'cajonera', 'cajon-puerta', 'especiero', 'horno', 'hueco', 'aereo-puerta', 'aereo-dos', 'abatible', 'nicho', 'sobre-refrigerador' (aéreos de cocina: cajón o abatible arriba del refrigerador, que queda abajo hasta el piso), 'espacio-campana' (aéreos de cocina: hueco abierto de 60 cm sin puertas para la campana; si la encimera de abajo lleva campana, la aloja y se centra sobre ella)" }, posicion: { tipo: 'entero', opcional: true, descripcion: 'dónde se inserta (0 = al comienzo; sin dar = al final)' }, ajustarLargo },
    ejemplo: { op: 'agregarModulo', tramo: 'base', preset: 'especiero', posicion: 1 },
  },
  {
    op: 'agregarCuerpo',
    descripcion: 'Agrega un módulo de un tipo con contenido a medida sin cambiar el largo (se reparte parejo con los ajustables; con ancho, el nuevo conserva ese ancho).',
    campos: { tramo: tramo(), tipo: { tipo: 'opcion', valores: TIPOS_MODULO, descripcion: 'tipo de módulo' }, posicion: { tipo: 'entero', opcional: true, descripcion: 'dónde se inserta' }, ancho: mm('ancho deseado', true), cambios: { tipo: 'objeto', opcional: true, campos: CAMBIOS_MODULO, descripcion: 'contenido del módulo' }, ajustarLargo },
    ejemplo: { op: 'agregarCuerpo', tramo: 'izq', tipo: 'frentes', cambios: { puertas: 2 } },
  },
  { op: 'quitarModulo', descripcion: 'Quita un módulo sin cambiar el largo: los módulos ajustables que quedan se reparten parejo su espacio.', campos: { tramo: tramo(), modulo, ajustarLargo }, ejemplo: { op: 'quitarModulo', tramo: 'base', modulo: 2 } },
  { op: 'moverModulo', descripcion: 'Mueve un módulo un lugar a la izquierda (-1) o a la derecha (1).', campos: { tramo: tramo(), modulo, delta: { tipo: 'opcion', valores: [-1, 1], descripcion: '-1 o 1' } }, ejemplo: { op: 'moverModulo', tramo: 'base', modulo: 1, delta: 1 } },
  {
    op: 'actualizarModulo',
    descripcion: 'Cambia el contenido de un módulo (puertas, cajones, apertura, tipo, pisos del especiero…).',
    campos: { tramo: tramo(), modulo, cambios: { tipo: 'objeto', campos: CAMBIOS_MODULO, descripcion: 'campos a cambiar' } },
    ejemplo: { op: 'actualizarModulo', tramo: 'der', modulo: 0, cambios: { puertas: 1, bisagra: 'izq' } },
  },
  { op: 'fijarAnchoModulo', descripcion: 'Cambia el ancho de un módulo; la diferencia la dan o toman los vecinos ajustables.', campos: { tramo: tramo(), modulo, ancho: mm('ancho nuevo') }, ejemplo: { op: 'fijarAnchoModulo', tramo: 'base', modulo: 1, ancho: 600 } },
  {
    op: 'agregarEquipo',
    descripcion: 'Agrega encimera, lavaplatos, campana (va sola sobre la encimera), horno o llave (a un lavaplatos).',
    campos: {
      equipo: { tipo: 'opcion', valores: ['encimera', 'lavaplatos', 'campana', 'horno', 'llave'], descripcion: 'qué se agrega' },
      tramo: tramo(true),
      modulo: { ...modulo, opcional: true, descripcion: 'módulo que lo lleva (sin dar se elige el mejor); horno: módulo que pasa a ser horno' },
      posicion: { tipo: 'entero', opcional: true, descripcion: 'horno sin módulo: dónde se inserta su módulo de 60 cm' },
      platos: CAMBIOS_EQUIPO.platos,
      modelo: CAMBIOS_EQUIPO.modelo,
      llave: CAMBIOS_EQUIPO.llave,
      ubicacion: { ...CAMBIOS_EQUIPO.posicion, descripcion: 'lavaplatos: centrado o pegado a un borde' },
      margen: CAMBIOS_EQUIPO.margen,
      soloCorte: CAMBIOS_EQUIPO.soloCorte,
      para: { tipo: 'texto', opcional: true, descripcion: 'campana o llave: id de la encimera o del lavaplatos' },
    },
    ejemplo: { op: 'agregarEquipo', equipo: 'lavaplatos', tramo: 'izq', modelo: 'doble', ubicacion: 'der', margen: 80 },
  },
  { op: 'quitarEquipo', descripcion: 'Quita un equipo: su id, el id del módulo del horno, `<encimera>:campana` o `<lavaplatos>:llave`.', campos: { id: { tipo: 'texto', descripcion: 'id de listarEquipamiento()' } }, ejemplo: { op: 'quitarEquipo', id: 'e123:campana' } },
  { op: 'moverEquipo', descripcion: 'Mueve encimera, lavaplatos u horno a otro módulo de cualquier tramo del base (la campana sigue a la encimera).', campos: { id: { tipo: 'texto', descripcion: 'id de listarEquipamiento()' }, tramo: tramo(), modulo }, ejemplo: { op: 'moverEquipo', id: 'e123', tramo: 'der', modulo: 0 } },
  { op: 'configurarEquipo', descripcion: 'Cambia platos, campana y solo corte de una encimera, o modelo, llave, posición y solo corte de un lavaplatos.', campos: { id: { tipo: 'texto', descripcion: 'id del equipo' }, cambios: { tipo: 'objeto', campos: CAMBIOS_EQUIPO, descripcion: 'campos a cambiar' } }, ejemplo: { op: 'configurarEquipo', id: 'e124', cambios: { posicion: 'izq', margen: 100 } } },
  { op: 'activarAereos', descripcion: 'Agrega (cuadrados con el base) o quita los muebles aéreos.', campos: { activo: { tipo: 'booleano', descripcion: 'con o sin aéreos' } }, ejemplo: { op: 'activarAereos', activo: true } },
  {
    op: 'fijarAereos',
    descripcion: 'Alto, fondo, altura desde el piso y alineación de los aéreos.',
    campos: { alto: mm('alto', true), profundidad: mm('fondo (también el de sus lados)', true), elevacion: mm('borde inferior desde el piso', true), alineacion: { tipo: 'opcion', valores: ['izq', 'centro', 'der'], opcional: true, descripcion: 'alineación del aéreo principal más corto que el base' } },
    ejemplo: { op: 'fijarAereos', alto: 700 },
  },
  { op: 'fijarFormaAereos', descripcion: 'Forma de los aéreos (deja de seguir al base).', campos: { forma: { tipo: 'opcion', valores: FORMAS, descripcion: 'forma' } }, ejemplo: { op: 'fijarFormaAereos', forma: 'L-izq' } },
  {
    op: 'fijarLadoAereo',
    descripcion: 'Largo exterior o fondo de un lado de los aéreos (deja de ser cuadrado si cambia el largo).',
    campos: { lado: { tipo: 'opcion', valores: LADOS, descripcion: 'lado' }, largo: mm('largo exterior', true), profundidad: mm('fondo', true) },
    ejemplo: { op: 'fijarLadoAereo', lado: 'izq', largo: 1500 },
  },
  { op: 'fijarLargoAereos', descripcion: 'Largo del aéreo principal (no en U ni en el compacto).', campos: { largo: mm('largo') }, ejemplo: { op: 'fijarLargoAereos', largo: 1800 } },
  { op: 'fijarAereosCuadrados', descripcion: 'Vuelve a cuadrar los aéreos con el base (misma forma y largos) o los deja libres.', campos: { cuadrado: { tipo: 'booleano', descripcion: 'cuadrados o libres' } }, ejemplo: { op: 'fijarAereosCuadrados', cuadrado: true } },
  { op: 'fijarAereoPrincipal', descripcion: 'Con (true) o sin (false) aéreo en el tramo principal: sin él, el aéreo va solo en los lados de la L o la U (cada lado llega hasta el muro principal).', campos: { activo: { tipo: 'booleano', descripcion: 'con o sin aéreo principal' } }, ejemplo: { op: 'fijarAereoPrincipal', activo: false } },
  {
    op: 'fijarCocina',
    descripcion: 'Terminaciones de la cubierta: color de la grifería, copete, espesor y vuelo.',
    campos: {
      cambios: {
        tipo: 'objeto',
        descripcion: 'campos a cambiar',
        campos: {
          grifo: { tipo: 'opcion', valores: ['negro', 'cromado'], opcional: true, descripcion: 'color de la llave' },
          copete: { tipo: 'booleano', opcional: true, descripcion: 'copete contra el muro' },
          espesorCubierta: mm('espesor de la cubierta', true),
          vueloCubierta: mm('vuelo frontal de la cubierta', true),
        },
      },
    },
    ejemplo: { op: 'fijarCocina', cambios: { grifo: 'cromado' } },
  },
  {
    op: 'fijarAcabados',
    descripcion: 'Tiradores (o sin manilla), cierre suave, zócalo, luz entre frentes, espesor de melamina, estructura y colores (ids de materiales.json).',
    campos: {
      tirador: { tipo: 'opcion', valores: ['barra', 'boton', 'sin'], opcional: true, descripcion: "tipo de tirador ('sin' = sistema sin manilla, se cobra aparte)" },
      cierreSuave: { tipo: 'booleano', opcional: true, descripcion: 'bisagras y correderas de cierre suave (se cobra una vez por mueble)' },
      zocalo: mm('alto del zócalo', true),
      luzFrentes: mm('holgura entre frentes', true),
      espesor: { tipo: 'opcion', valores: [15, 18], opcional: true, descripcion: 'melamina de 15 o 18 mm' },
      estructura: { tipo: 'opcion', valores: ['modular', 'unica'], opcional: true, descripcion: 'cada módulo con sus costados o casco único' },
      materiales: {
        tipo: 'objeto',
        opcional: true,
        descripcion: 'ids de material',
        campos: {
          frente: { tipo: 'texto', opcional: true, descripcion: 'melamina de los frentes' },
          casco: { tipo: 'texto', opcional: true, descripcion: 'melamina del cuerpo' },
          cubierta: { tipo: 'texto', opcional: true, descripcion: 'cubierta' },
          tirador: { tipo: 'texto', opcional: true, descripcion: 'color del tirador' },
        },
      },
    },
    ejemplo: { op: 'fijarAcabados', tirador: 'sin' },
  },
];

const POR_OP = new Map(OPERACIONES.map((o) => [o.op, o]));

function revisarCampo(nombre: string, v: unknown, c: CampoOperacion): string | null {
  switch (c.tipo) {
    // Solo se revisa el tipo: los valores fuera de rango los limita el motor y lo avisa.
    case 'mm':
      return typeof v === 'number' && Number.isFinite(v) ? null : `«${nombre}» debe ser un número en milímetros.`;
    case 'entero':
      return typeof v === 'number' && Number.isFinite(v) ? null : `«${nombre}» debe ser un número entero.`;
    case 'booleano':
      return typeof v === 'boolean' ? null : `«${nombre}» debe ser true o false.`;
    case 'texto':
      return typeof v === 'string' && v.length > 0 ? null : `«${nombre}» debe ser un texto.`;
    case 'tramo':
      return (TRAMOS_OPERACION as readonly unknown[]).includes(v) ? null : `«${nombre}» debe ser uno de: ${TRAMOS_OPERACION.join(', ')}.`;
    case 'modulo':
      return (typeof v === 'number' && Number.isInteger(v) && v >= 0) || (typeof v === 'string' && v.length > 0) ? null : `«${nombre}» debe ser el índice del módulo (0, 1, 2…) o su id.`;
    case 'opcion':
      return c.valores!.includes(v as string | number) ? null : `«${nombre}» debe ser uno de: ${c.valores!.join(', ')}.`;
    case 'objeto':
      if (!v || typeof v !== 'object' || Array.isArray(v)) return `«${nombre}» debe ser un objeto.`;
      return revisarCampos(v as Record<string, unknown>, c.campos!, `${nombre}.`);
  }
}

function revisarCampos(x: Record<string, unknown>, campos: Record<string, CampoOperacion>, prefijo = ''): string | null {
  for (const k of Object.keys(x)) {
    if (k === 'op' && !prefijo) continue;
    // Para campos opcionales, undefined equivale a no darlo (así lo deja JSON.stringify).
    if (!(k in campos)) return `«${prefijo}${k}» no es un campo de esta operación.`;
  }
  for (const [k, c] of Object.entries(campos)) {
    const v = x[k];
    if (v === undefined) {
      if (!c.opcional) return `Falta «${prefijo}${k}» (${c.descripcion}).`;
      continue;
    }
    const error = revisarCampo(prefijo + k, v, c);
    if (error) return error;
  }
  return null;
}

/**
 * Revisa que un objeto (por ejemplo el JSON que arma el asistente de IA) sea una operación
 * bien formada. Devuelve el motivo en español si no lo es, o null si se puede ejecutar.
 */
export function revisarOperacion(x: unknown): string | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return 'La operación debe ser un objeto con el campo «op».';
  const op = (x as { op?: unknown }).op;
  const desc = typeof op === 'string' ? POR_OP.get(op as Operacion['op']) : undefined;
  if (!desc) return `«${String(op)}» no es una operación conocida. Las operaciones son: ${OPERACIONES.map((o) => o.op).join(', ')}.`;
  return revisarCampos(x as Record<string, unknown>, desc.campos);
}

/** Lista de operaciones en texto, para las instrucciones del asistente de IA. */
export function describirOperaciones(): string {
  const campo = (k: string, c: CampoOperacion): string => {
    const tipo =
      c.tipo === 'opcion'
        ? c.valores!.map((v) => JSON.stringify(v)).join(' | ')
        : c.tipo === 'objeto'
          ? `{ ${Object.entries(c.campos!)
              .filter(([, b]) => !b.oculto)
              .map(([a, b]) => campo(a, b))
              .join(', ')} }`
          : c.tipo;
    return `${k}${c.opcional ? '?' : ''}: ${tipo}`;
  };
  return OPERACIONES.map((o) => `- ${o.op} { ${Object.entries(o.campos).filter(([, c]) => !c.oculto).map(([k, c]) => campo(k, c)).join(', ')} }: ${o.descripcion} Ejemplo: ${JSON.stringify(o.ejemplo)}`).join('\n');
}
