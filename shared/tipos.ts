// Tipos compartidos entre el servidor y el cliente.
// Todas las medidas internas del diseño se guardan en milímetros.

export type Unidad = 'cm' | 'mm';

export type Plantilla = 'cocina' | 'closet' | 'comoda' | 'tocador' | 'escritorio' | 'cocina-infantil';

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
 * Un cuerpo es una "cabina" o columna del mueble. El ancho total del mueble
 * es la suma de los cuerpos más la separación entre ellos.
 */
export interface Cuerpo {
  id: string;
  /**
   * frentes: puertas y/o cajones.
   * horno: módulo para horno empotrado (cocina).
   * hueco: espacio libre sin estructura (lavadora, refrigerador…), la cubierta pasa por encima.
   * escritorio: superficie de trabajo con pata lateral (clóset escritorio).
   */
  tipo: 'frentes' | 'horno' | 'hueco' | 'escritorio';
  ancho: number;
  puertas: number;
  bisagra: Bisagra;
  cajones: number;
  columnasCajones: 1 | 2;
  /** Alto de cada frente de cajón en mm. 0 = automático. */
  altoCajon: number;
  repisas: number;
  colgador: boolean;
  /** Para cuerpos más bajos que el mueble (p. ej. escritorio). 0 = alto completo. */
  alto: number;
}

export interface Materiales {
  frente: string;
  casco: string;
  cubierta: string;
  tirador: string;
}

export interface EquipamientoCocina {
  encimera: 'ninguna' | '2' | '3' | '4';
  encimeraCuerpo: number;
  lavaplatos: 'ninguno' | 'simple' | 'doble';
  lavaplatosCuerpo: number;
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
  version: 1;
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
  materiales: Materiales;
  cocina: EquipamientoCocina;
  tocador: OpcionesTocador;
  /** Cajones pequeños en una fila superior a todo el ancho (cómodas). */
  filaSuperior: number;
  mudador: boolean;
  /** Imagen impresa en los frentes (data URL), para muebles personalizables. */
  imagenFrontal: string | null;
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
  /** "catalogo-dto" si el color aparece en la tienda, "generico" si es de muestra. */
  origen: 'catalogo-dto' | 'generico';
}

export interface CatalogoMateriales {
  nota: string;
  melaminas: Material[];
  cubiertas: Material[];
  tiradores: Material[];
}

/** Vendedor con cuenta en la herramienta. */
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
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
  vendedor: { id: number; nombre: string; telefono: string | null };
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
