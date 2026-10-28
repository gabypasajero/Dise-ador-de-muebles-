// Tipos compartidos entre el servidor y el cliente.
// Todas las medidas internas del diseño se guardan en milímetros.

export type Unidad = 'cm' | 'mm';

export type Plantilla = 'cocina' | 'compacto' | 'closet' | 'comoda' | 'tocador' | 'escritorio' | 'cocina-infantil';

export type Escenario = 'cocina' | 'dormitorio' | 'infantil' | 'estudio';

export type TipoTirador = 'barra' | 'boton' | 'unero' | 'sin';

export type Bisagra = 'izq' | 'der';

/** Producto tal como lo entrega la tienda De Todito Outlet. */
export interface ProductoTienda {
  id: number;
  nombre: string;
  categoria: string;
  descripcion: string | null;
  medidas: string | null;
  precio: number;
  precio_oferta: number | null;
  imagen_url: string | null;
  personalizable: boolean;
  destacado: boolean;
  orden: number | null;
}

/** Producto enriquecido con la plantilla 3D que lo representa. */
export interface ProductoCatalogo extends ProductoTienda {
  plantilla: Plantilla;
  escenario: Escenario;
  /** Nombre del modelo sin la variante de color o diseño. */
  modelo: string;
  /** Texto de la variante (ej. "Clasic Pino Casina" o "Diseño 03"). */
  variante: string | null;
  /** Medidas base en mm leídas de la ficha (o estimadas si la ficha no las trae). */
  medidasBase: { ancho: number; alto: number; profundidad: number; estimadas: boolean };
}

export interface CategoriaTienda {
  id: string;
  nombre: string;
}

/**
 * Un cuerpo es una "cabina" o columna del mueble (un módulo). El largo de cada
 * tramo es la suma de sus módulos (más la separación entre ellos en el principal).
 */
export interface Cuerpo {
  id: string;
  /**
   * frentes: puertas y/o cajones.
   * horno: módulo para horno empotrado (cocina y compacto: 60 cm fijos).
   * hueco: espacio libre sin estructura (lavadora, refrigerador…), la cubierta pasa por encima.
   * escritorio: superficie de trabajo con pata lateral (clóset escritorio).
   * campana (aéreos): mueble más bajo con puertas arriba que aloja la campana de una encimera.
   * nicho (aéreos): puerta abatible arriba y nicho abierto con repisa (microondas).
   * espacio-campana (aéreos de cocina): hueco abierto de 60 cm fijos, sin puertas ni repisas,
   *   para instalar la campana; si la encimera de abajo lleva campana, este espacio la aloja.
   * especiero: cajón extraíble de 20 cm fijos y alto completo, con 2 o 3 pisos interiores.
   * refrigerador (aéreos de cocina): mueble bajo arriba del refrigerador, con un cajón o una puerta
   *   abatible; abajo queda el espacio del refrigerador hasta el piso. `alto` es el del mueble (0 = automático).
   */
  tipo: 'frentes' | 'horno' | 'hueco' | 'escritorio' | 'campana' | 'nicho' | 'especiero' | 'espacio-campana' | 'refrigerador';
  ancho: number;
  puertas: number;
  /** Apertura de la puerta única (1 puerta) o de la puerta impar (la 1, a la izquierda) de un módulo de 3. */
  bisagra: Bisagra;
  cajones: number;
  columnasCajones: 1 | 2;
  /** Alto de cada frente de cajón en mm. 0 = automático. */
  altoCajon: number;
  repisas: number;
  colgador: boolean;
  /** Para cuerpos más bajos que el mueble (p. ej. escritorio). 0 = alto completo. */
  alto: number;
  /** Puertas que se abren hacia arriba (aéreos). */
  abatible?: boolean;
  /** Cajones arriba y puertas abajo (por defecto los cajones van abajo). */
  cajonesArriba?: boolean;
  /** Especiero: pisos interiores (2 por defecto, 3 si el cliente lo pide). */
  pisos?: number;
  /** Aéreos: id de la encimera cuya campana aloja este módulo de campana. */
  campanaDe?: string;
}

/** Costado de una L o de una U. */
export type LadoId = 'izq' | 'der';

/** Forma del mueble base o de los aéreos. */
export type Forma = 'lineal' | 'L-izq' | 'L-der' | 'U';

/** Tramos del mueble base: el principal y los lados de la L/U. */
export type TramoBase = 'base' | 'izq' | 'der';
/** Tramos de los aéreos (o del mueble superior del compacto). */
export type TramoAereo = 'aereos' | 'aereos-izq' | 'aereos-der';
export type TramoId = TramoBase | TramoAereo;
/**
 * Tramo que reciben las operaciones. 'retorno' es el nombre heredado del único
 * lado de una L (en una U se refiere al izquierdo); se recomienda usar 'izq' / 'der'.
 */
export type Tramo = TramoId | 'retorno';

/** Lado de una L o U (del mueble base o de los aéreos), contra un muro lateral. */
export interface Lado {
  /** Largo exterior medido desde el muro principal (mm): incluye la esquina. */
  largo: number;
  profundidad: number;
  cuerpos: Cuerpo[];
}

export interface Lados {
  izq: Lado | null;
  der: Lado | null;
}

/** Muebles aéreos (cocina) o mueble superior del compacto. */
export interface Aereos {
  activo: boolean;
  /** mural: colgados del muro; apoyado: sobre la cubierta con costados hasta arriba (compacto). */
  montaje: 'mural' | 'apoyado';
  /** Alto de los muebles superiores (mm), común a todos sus lados. */
  alto: number;
  /** Fondo del aéreo principal (mm). Cada lado tiene el suyo. */
  profundidad: number;
  /** Mural: altura del borde inferior desde el piso. Apoyado: alto del mueble base (hasta la cubierta). */
  elevacion: number;
  /** Alineación del aéreo principal cuando es más corto que el base (sin lados). */
  alineacion: 'izq' | 'centro' | 'der';
  /** Módulos del aéreo principal. */
  cuerpos: Cuerpo[];
  /** Lados del aéreo en L o U (solo cocina). */
  lados: Lados;
  /** "Cuadrado" con el base: sigue su forma y el largo de cada lado. Se apaga al cambiar el aéreo a mano. */
  cuadrado: boolean;
}

/** Segundo tramo de una cocina en L (vista heredada de la versión 1, ver retornoDe). */
export interface Retorno extends Lado {
  lado: LadoId;
}

export interface Materiales {
  frente: string;
  casco: string;
  cubierta: string;
  tirador: string;
}

/** Encimera a gas sobre un módulo. La campana va siempre sobre ella. */
export interface Encimera {
  id: string;
  tipo: 'encimera';
  tramo: TramoBase;
  /** Id del módulo que la lleva. */
  modulo: string;
  /** La cocina adulta ofrece 3 y 4 platos; la infantil también 2. */
  platos: '2' | '3' | '4';
  /** Campana sobre esta encimera (en el módulo de campana de los aéreos o mural). */
  campana: boolean;
  /** Solo corte: el cliente trae su encimera; la cubierta lleva solo el hueco (no se cobra el equipo). */
  soloCorte: boolean;
}

/** Lavaplatos empotrado en la cubierta sobre un módulo. */
export interface Lavaplatos {
  id: string;
  tipo: 'lavaplatos';
  tramo: TramoBase;
  modulo: string;
  /** Simple (cubeta + secador, 80 cm), doble (2 cubetas) o riñonera (1 cubeta redondeada, 61 cm). */
  modelo: 'simple' | 'doble' | 'rinonera';
  /** Llave (grifería) incluida. */
  llave: boolean;
  /** Centrado en su módulo o pegado a su borde izquierdo o derecho. */
  posicion: 'centro' | 'izq' | 'der';
  /** Distancia (mm) entre el borde elegido y la cubeta; mínimo 50. */
  margen: number;
  /** Solo corte: el cliente trae su lavaplatos; la cubierta lleva solo el hueco (sin cubeta ni llave). */
  soloCorte: boolean;
}

export type Equipo = Encimera | Lavaplatos;

/** Terminaciones de la cubierta de la cocina (el equipamiento va en Diseno.equipos). */
export interface EquipamientoCocina {
  grifo: 'negro' | 'cromado';
  copete: boolean;
  espesorCubierta: number;
  vueloCubierta: number;
}

export interface OpcionesTocador {
  espejo: 'ovalado' | 'hollywood' | 'rectangular';
  luz: 'calida' | 'neutra' | 'fria';
  altoCubierta: number;
  cajonesIzq: number;
  cajonesDer: number;
  cajonesCentro: number;
  repisasLaterales: boolean;
}

export interface Diseno {
  /** 2: lados por costado, equipamiento por módulo, especiero y aéreos en L/U. */
  version: 2;
  plantilla: Plantilla;
  productoId: number | null;
  nombreModelo: string;
  ancho: number;
  alto: number;
  profundidad: number;
  cuerpos: Cuerpo[];
  /** Luz (holgura) entre frentes de puertas y cajones, en mm. */
  luzFrentes: number;
  /** Separación entre cuerpos o cabinas, en mm. */
  separacionCuerpos: number;
  zocalo: number;
  espesor: number;
  /** modular: cada cuerpo es una cabina independiente (cocina). unica: un solo casco con divisiones. */
  estructura: 'modular' | 'unica';
  tirador: TipoTirador;
  /** Bisagras y correderas de cierre suave (se cobra una vez por mueble). */
  cierreSuave: boolean;
  materiales: Materiales;
  cocina: EquipamientoCocina;
  tocador: OpcionesTocador;
  /** Cajones pequeños en una fila superior a todo el ancho (cómodas). */
  filaSuperior: number;
  mudador: boolean;
  /** Imagen impresa en los frentes (data URL), para muebles personalizables. */
  imagenFrontal: string | null;
  /** Muebles aéreos (cocina) o mueble superior (compacto). */
  aereos: Aereos;
  /** Lados de la L o U del mueble base (solo cocina). */
  lados: Lados;
  /** Encimeras y lavaplatos, cada uno sobre un módulo (los hornos son módulos). */
  equipos: Equipo[];
  /** Correcciones del vendedor al desglose del precio (valores editados y ajustes libres). */
  ajustesPrecio?: AjustesPrecio;
  /**
   * Otros muebles del mismo proyecto (solo en el mueble principal): islas y muebles en línea.
   * Cada uno es un diseño completo con su posición en la planta.
   */
  adicionales?: MuebleAdicional[];
}

/** Mueble que se suma al proyecto: una isla o un mueble en línea (otro tramo, otro muro). */
export interface MuebleAdicional {
  id: string;
  /** isla: mueble suelto con respaldo terminado. linea: otro mueble contra un muro. */
  tipo: 'isla' | 'linea';
  nombre: string;
  /**
   * Posición en la planta (mm), en las coordenadas del mueble principal (x a lo largo de su muro,
   * z hacia la sala): el centro del mueble adicional visto desde arriba. Gira sobre ese centro.
   */
  x: number;
  z: number;
  /** Giro en grados, mirado desde arriba (0 = de frente, como el principal; 180 = mira al muro). */
  giro: number;
  diseno: Diseno;
}

export interface AjustePrecioExtra {
  id: string;
  concepto: string;
  valor: number;
}

export interface AjustesPrecio {
  /** Valor editado por clave de línea (ver claveLinea). */
  valores: Record<string, number>;
  extras: AjustePrecioExtra[];
}

/**
 * Diseño tal como pudo guardarse antes (versión 1): con `retorno` en vez de
 * `lados` y la encimera y el lavaplatos por índice de módulo. normalizar() lo
 * convierte a la versión actual.
 */
export interface DisenoGuardado extends Omit<Partial<Diseno>, 'version' | 'cocina' | 'aereos' | 'lados' | 'equipos'> {
  version?: number;
  plantilla: Plantilla;
  retorno?: (Omit<Lado, 'cuerpos'> & { lado: LadoId; cuerpos: Partial<Cuerpo>[] }) | null;
  lados?: Partial<Lados>;
  equipos?: Equipo[];
  aereos?: Partial<Omit<Aereos, 'lados'>> & { lados?: Partial<Lados> };
  cocina?: Partial<EquipamientoCocina> & {
    encimera?: 'ninguna' | '2' | '3' | '4';
    encimeraCuerpo?: number;
    lavaplatos?: 'ninguno' | 'simple' | 'doble' | 'rinonera';
    lavaplatosCuerpo?: number;
  };
}

export type TipoMaterial = 'liso' | 'madera' | 'marmol' | 'granito' | 'concreto' | 'imagen';

export interface Material {
  id: string;
  nombre: string;
  tipo: TipoMaterial;
  color: string;
  /** Color de veta (madera, mármol). */
  veta?: string;
  /** Colores de motas (granito). */
  motas?: string[];
  /** Rugosidad PBR 0..1. */
  rugosidad?: number;
  /** Para materiales metálicos (tiradores). */
  metal?: number;
  /** Ruta de una textura oficial (cuando esté disponible). */
  textura?: string;
  /** Tamaño real (mm) que cubre una repetición de la textura fotográfica. */
  tamanoMm?: number;
  /** Color exclusivo de los muebles de cocina (melaminas del catálogo de cocina). */
  cocina?: boolean;
  /** "catalogo-dto" si el color aparece en la tienda, "generico" si es de muestra. */
  origen: 'catalogo-dto' | 'generico';
}

export interface CatalogoMateriales {
  nota: string;
  melaminas: Material[];
  cubiertas: Material[];
  tiradores: Material[];
}

/** Persona con sesión: vendedor y/o administración de la tienda. */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  /** Puede registrar cotizaciones y ventas. */
  esVendedor: boolean;
  /** Administración de la tienda: ve las cotizaciones de todos los vendedores. */
  esAdmin: boolean;
}

/** Una línea del detalle de la cotización (con sublíneas opcionales). */
export interface LineaDetalle {
  etiqueta: string;
  valor: string;
  sub?: string[];
}

export type EstadoCotizacion = 'cotizada' | 'vendida' | 'anulada';

export interface Cliente {
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

export interface Venta {
  fecha: string;
  valor: number;
  medioPago: string | null;
  nota: string | null;
}

/** Cotización registrada por un vendedor. */
export interface Cotizacion {
  id: number;
  numero: string;
  vendedor: { id: string; nombre: string; telefono: string | null };
  cliente: Cliente;
  observaciones: string | null;
  productoId: number | null;
  modelo: string;
  detalle: LineaDetalle[];
  miniatura: string | null;
  /** Valor del mueble en pesos chilenos. */
  valor: number;
  /** Fecha de la cotización (AAAA-MM-DD). */
  fecha: string;
  estado: EstadoCotizacion;
  venta: Venta | null;
  creado: string;
  actualizado: string;
  /** Solo viene al pedir una cotización puntual. */
  config?: Diseno;
}

export interface TotalesCotizaciones {
  cotizaciones: number;
  montoCotizado: number;
  ventas: number;
  montoVendido: number;
}

/** Datos para registrar o actualizar una cotización. */
export interface DatosCotizacion {
  cliente: Cliente;
  observaciones: string | null;
  productoId: number | null;
  modelo: string;
  config: Diseno;
  detalle: LineaDetalle[];
  miniatura: string | null;
  valor: number;
  fecha: string;
}
