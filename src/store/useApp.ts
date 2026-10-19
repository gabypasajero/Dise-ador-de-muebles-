import { create } from 'zustand';
import { clasificarProducto, disenoInicial, disenoLibre } from '../../shared/catalogo';
import { cuerposDe, ejecutar, normalizar, tramosDe, type Operacion, type Resultado, type TramoId } from '../../shared/reglas';
import type { CatalogoMateriales, Cotizacion, Diseno, Escenario, Plantilla, ProductoCatalogo, Unidad, Usuario } from '../../shared/tipos';
import { obtenerCatalogo, obtenerMateriales, type RespuestaCatalogo } from '../datos/catalogo';
import { backend } from '../datos';

export type Pestana = 'puertas' | 'cajones' | 'modulos' | 'equipamiento';
export type Modal = null | 'catalogo' | 'registrarCotizacion' | 'cotizaciones' | 'documento' | 'venta';

/** Cotización a la que pertenece el diseño que se está editando. */
export type CotizacionEnEdicion = Omit<Cotizacion, 'config' | 'miniatura'>;
export type Vista = 'perspectiva' | 'frontal' | 'superior';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
}

/** Operación que el motor rechazó: el motivo se muestra tal cual y, si hay, la forma de hacerla igual. */
export interface Rechazo {
  id: number;
  motivo: string;
  /** La misma operación agrandando o achicando el mueble (que sí se puede). */
  alternativa?: Operacion;
}

interface Estado {
  catalogo: RespuestaCatalogo | null;
  materiales: CatalogoMateriales | null;
  errorCarga: string | null;

  producto: ProductoCatalogo | null;
  disenoBase: Diseno | null;
  diseno: Diseno;
  pasado: Diseno[];
  futuro: Diseno[];
  ultimoGrupo: { clave: string; t: number } | null;

  unidad: Unidad;
  escenario: Escenario | 'auto';
  abierto: boolean;
  cotas: boolean;
  fotoRef: boolean;
  pestana: Pestana | null;
  /** Módulo seleccionado en la pestaña «Módulos y espacios» (índice dentro del tramo activo). */
  moduloActivo: number;
  /** Tramo que se edita: principal, lados de la L/U, aéreos y sus lados. */
  tramoActivo: TramoId;
  /** Último rechazo del motor (se borra con el siguiente cambio válido o al cerrarlo). */
  rechazo: Rechazo | null;
  /** Panel de medidas plegado (más espacio para el 3D). */
  panelPlegado: boolean;
  /** Alto elegido para las pestañas del panel (px); null = automático. */
  altoPestanas: number | null;
  /** Panel de colores oculto. */
  coloresPlegados: boolean;
  /** Cambia y recuerda en este equipo cómo se reparte la pantalla. */
  fijarVista: (cambios: Partial<VistaGuardada>) => void;
  vista: Vista;
  encuadre: number;

  usuario: Usuario | null;
  sesion: 'verificando' | 'invitado' | 'activa';
  /** Motivo por el que no se pudo abrir la sesión (cuenta sin acceso, falta configurar Supabase…). */
  errorSesion: string | null;
  cotizacionActual: CotizacionEnEdicion | null;
  /** Cotización abierta en el documento o en el registro de venta. */
  cotizacionVista: Cotizacion | null;
  modal: Modal;
  avisos: Aviso[];
  capturar: (() => string | null) | null;

  cargarDatos: () => Promise<void>;
  elegirProducto: (p: ProductoCatalogo) => void;
  empezarLibre: (plantilla: Plantilla) => void;
  cambiar: (f: (d: Diseno) => Diseno, grupo?: string) => void;
  /**
   * Ejecuta una operación del motor: si se hace entra al historial (deshacer) y muestra sus
   * avisos; si se rechaza, guarda el motivo y la alternativa para mostrarlos sin tocar el diseño.
   */
  operar: (op: Operacion, grupo?: string) => Resultado;
  deshacer: () => void;
  rehacer: () => void;
  restablecer: () => void;
  cargarCotizacion: (c: Cotizacion) => void;
  verCotizacion: (c: Cotizacion) => void;
  set: (parcial: Partial<Estado>) => void;
  avisar: (texto: string, tipo?: Aviso['tipo']) => void;
  revisarSesion: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const CLAVE_BORRADOR = 'dto-borrador-v1';
const CLAVE_VISTA = 'dto-vista-v1';

interface VistaGuardada {
  panelPlegado: boolean;
  altoPestanas: number | null;
  coloresPlegados: boolean;
}

function leerVista(): VistaGuardada {
  const defecto: VistaGuardada = { panelPlegado: false, altoPestanas: null, coloresPlegados: false };
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? 'null') as Partial<VistaGuardada> | null;
    if (!v) return defecto;
    return {
      panelPlegado: v.panelPlegado === true,
      altoPestanas: typeof v.altoPestanas === 'number' && v.altoPestanas >= 100 && v.altoPestanas <= 900 ? v.altoPestanas : null,
      coloresPlegados: v.coloresPlegados === true,
    };
  } catch {
    return defecto;
  }
}

/** Al deshacer o rehacer, el tramo y el módulo elegidos deben existir en el diseño. */
function seleccionValida(d: Diseno, tramo: TramoId, modulo: number): { tramoActivo: TramoId; moduloActivo: number } {
  const t = tramosDe(d).includes(tramo) ? tramo : 'base';
  return { tramoActivo: t, moduloActivo: Math.max(0, Math.min(modulo, cuerposDe(d, t).length - 1)) };
}

interface Borrador {
  productoId: number | null;
  diseno: Diseno;
  unidad?: Unidad;
  cotizacion?: CotizacionEnEdicion | null;
}

function leerBorrador(): Borrador | null {
  try {
    const t = localStorage.getItem(CLAVE_BORRADOR);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

function escribirBorrador(productoId: number | null, diseno: Diseno, unidad: Unidad, cotizacion: CotizacionEnEdicion | null) {
  try {
    const b: Borrador = { productoId, diseno, unidad, cotizacion };
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    // sin almacenamiento local (o imagen muy grande): se omite el borrador
  }
}

/** Deshacer y rehacer también actualizan el borrador: al recargar vuelve el diseño que se ve. */
function guardarActual(s: { producto: ProductoCatalogo | null; diseno: Diseno; unidad: Unidad; cotizacionActual: CotizacionEnEdicion | null }) {
  escribirBorrador(s.producto?.id ?? null, s.diseno, s.unidad, s.cotizacionActual);
}

let idAviso = 0;
let idRechazo = 0;

export const useApp = create<Estado>((set, get) => ({
  catalogo: null,
  materiales: null,
  errorCarga: null,

  producto: null,
  disenoBase: null,
  diseno: disenoLibre('cocina'),
  pasado: [],
  futuro: [],
  ultimoGrupo: null,

  unidad: 'cm',
  escenario: 'auto',
  abierto: false,
  cotas: true,
  fotoRef: true,
  pestana: 'modulos',
  moduloActivo: 0,
  tramoActivo: 'base',
  rechazo: null,
  ...leerVista(),
  vista: 'perspectiva',
  encuadre: 0,

  usuario: null,
  sesion: 'verificando',
  errorSesion: null,
  cotizacionActual: null,
  cotizacionVista: null,
  modal: null,
  avisos: [],
  capturar: null,

  async cargarDatos() {
    get().revisarSesion();
    // Si la sesión se cierra o vence (en esta u otra pestaña) se vuelve al ingreso.
    backend.alCambiarSesion((haySesion) => {
      if (!haySesion && get().sesion === 'activa') set({ usuario: null, sesion: 'invitado', modal: null });
    });
    try {
      const [catalogo, materiales] = await Promise.all([obtenerCatalogo(), obtenerMateriales()]);
      set({ catalogo, materiales, errorCarga: null });
      const borrador = leerBorrador();
      const producto = borrador?.productoId != null ? catalogo.productos.find((p) => p.id === borrador.productoId) : null;
      if (borrador?.diseno) {
        set({
          producto: producto ?? null,
          disenoBase: producto ? disenoInicial(producto) : null,
          diseno: normalizar(borrador.diseno),
          unidad: borrador.unidad ?? 'cm',
          cotizacionActual: borrador.cotizacion ?? null,
          encuadre: get().encuadre + 1,
        });
      } else {
        // Primera visita: parte con el mueble de cocina más pedido.
        const inicial = catalogo.productos.find((p) => p.plantilla === 'cocina' && /full equipo/i.test(p.nombre)) ?? catalogo.productos[0];
        if (inicial) get().elegirProducto(inicial);
        set({ modal: 'catalogo' });
      }
    } catch (e) {
      set({ errorCarga: (e as Error).message });
    }
  },

  elegirProducto(p) {
    const producto = p.plantilla ? p : clasificarProducto(p);
    const d = disenoInicial(producto);
    set({
      producto,
      disenoBase: d,
      diseno: d,
      pasado: [],
      futuro: [],
      cotizacionActual: null,
      abierto: false,
      encuadre: get().encuadre + 1,
      vista: 'perspectiva',
      moduloActivo: 0,
      tramoActivo: 'base',
      rechazo: null,
      modal: null,
    });
    escribirBorrador(producto.id, d, get().unidad, null);
  },

  empezarLibre(plantilla) {
    const d = disenoLibre(plantilla);
    set({
      producto: null,
      disenoBase: null,
      diseno: d,
      pasado: [],
      futuro: [],
      cotizacionActual: null,
      abierto: false,
      encuadre: get().encuadre + 1,
      vista: 'perspectiva',
      moduloActivo: 0,
      tramoActivo: 'base',
      rechazo: null,
      modal: null,
    });
    escribirBorrador(null, d, get().unidad, null);
  },

  cambiar(f, grupo) {
    const { diseno, pasado, ultimoGrupo, producto, unidad, cotizacionActual } = get();
    const nuevo = f(diseno);
    if (nuevo === diseno) return;
    const ahora = Date.now();
    const mismoGrupo = grupo && ultimoGrupo && ultimoGrupo.clave === grupo && ahora - ultimoGrupo.t < 1200;
    set({
      diseno: nuevo,
      pasado: mismoGrupo ? pasado : [...pasado.slice(-59), diseno],
      futuro: [],
      ultimoGrupo: grupo ? { clave: grupo, t: ahora } : null,
      rechazo: null,
      // Si el cambio quita el tramo que se editaba (forma lineal, sin aéreos), se vuelve al principal.
      ...seleccionValida(nuevo, get().tramoActivo, get().moduloActivo),
    });
    escribirBorrador(producto?.id ?? null, nuevo, unidad, cotizacionActual);
  },

  operar(op, grupo) {
    const r = ejecutar(get().diseno, op);
    if (!r.ok) {
      set({ rechazo: { id: ++idRechazo, motivo: r.motivo ?? 'No se pudo hacer ese cambio.', alternativa: r.alternativa } });
      return r;
    }
    if (r.diseno !== get().diseno) get().cambiar(() => r.diseno, grupo);
    else if (get().rechazo) set({ rechazo: null });
    for (const a of r.avisos) get().avisar(a, 'info');
    return r;
  },

  deshacer() {
    const { pasado, diseno, futuro } = get();
    if (!pasado.length) return;
    const anterior = pasado[pasado.length - 1];
    set({ diseno: anterior, pasado: pasado.slice(0, -1), futuro: [diseno, ...futuro], ultimoGrupo: null, rechazo: null, ...seleccionValida(anterior, get().tramoActivo, get().moduloActivo) });
    guardarActual(get());
  },

  rehacer() {
    const { pasado, diseno, futuro } = get();
    if (!futuro.length) return;
    set({ diseno: futuro[0], futuro: futuro.slice(1), pasado: [...pasado, diseno], ultimoGrupo: null, rechazo: null, ...seleccionValida(futuro[0], get().tramoActivo, get().moduloActivo) });
    guardarActual(get());
  },

  restablecer() {
    const { disenoBase, diseno } = get();
    const base = disenoBase ?? disenoLibre(diseno.plantilla);
    get().cambiar(() => base);
    set({ encuadre: get().encuadre + 1, moduloActivo: 0, tramoActivo: 'base' });
  },

  cargarCotizacion(c) {
    const catalogo = get().catalogo;
    const producto = c.productoId != null ? (catalogo?.productos.find((p) => p.id === c.productoId) ?? null) : null;
    if (!c.config) return;
    const d = normalizar(c.config);
    const { config: _config, miniatura: _miniatura, ...resumen } = c;
    set({
      producto,
      disenoBase: producto ? disenoInicial(producto) : null,
      diseno: d,
      pasado: [],
      futuro: [],
      cotizacionActual: resumen,
      modal: null,
      abierto: false,
      moduloActivo: 0,
      tramoActivo: 'base',
      rechazo: null,
      encuadre: get().encuadre + 1,
    });
    escribirBorrador(c.productoId, d, get().unidad, resumen);
  },

  verCotizacion(c) {
    set({ cotizacionVista: c, modal: 'documento' });
  },

  set(parcial) {
    set(parcial);
    if ('unidad' in parcial || 'cotizacionActual' in parcial) {
      const { producto, diseno, unidad, cotizacionActual } = get();
      escribirBorrador(producto?.id ?? null, diseno, unidad, cotizacionActual);
    }
  },

  fijarVista(cambios) {
    set(cambios);
    const { panelPlegado, altoPestanas, coloresPlegados } = get();
    try {
      localStorage.setItem(CLAVE_VISTA, JSON.stringify({ panelPlegado, altoPestanas, coloresPlegados }));
    } catch {
      // sin almacenamiento local: la preferencia dura solo esta sesión
    }
  },

  avisar(texto, tipo = 'ok') {
    // El mismo aviso repetido (al arrastrar un deslizador, por ejemplo) no se apila.
    if (get().avisos.some((a) => a.texto === texto)) return;
    const id = ++idAviso;
    set({ avisos: [...get().avisos.slice(-3), { id, texto, tipo }] });
    // Los avisos largos del motor quedan a la vista el tiempo justo para leerlos.
    setTimeout(() => set({ avisos: get().avisos.filter((a) => a.id !== id) }), Math.min(9000, Math.max(3800, texto.length * 55)));
  },

  async revisarSesion() {
    try {
      const usuario = await backend.perfilActual();
      // Si entra otro vendedor, la cotización en edición no es suya.
      const ajena = usuario && get().cotizacionActual && get().cotizacionActual?.vendedor.id !== usuario.id;
      set({ usuario, sesion: usuario ? 'activa' : 'invitado', errorSesion: null, ...(ajena ? { cotizacionActual: null } : {}) });
    } catch (e) {
      set({ usuario: null, sesion: 'invitado', errorSesion: (e as Error).message });
    }
  },

  async cerrarSesion() {
    await backend.salir().catch(() => undefined);
    try {
      // En un equipo compartido el siguiente vendedor parte de cero.
      localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      // sin almacenamiento local
    }
    set({ usuario: null, sesion: 'invitado', errorSesion: null, cotizacionActual: null, cotizacionVista: null, modal: null });
  },
}));

export function escenarioActual(e: Escenario | 'auto', producto: ProductoCatalogo | null, d: Diseno): Escenario {
  if (e !== 'auto') return e;
  if (producto) return producto.escenario;
  if (d.plantilla === 'cocina' || d.plantilla === 'compacto') return 'cocina';
  if (d.plantilla === 'cocina-infantil' || d.plantilla === 'escritorio') return 'infantil';
  return 'dormitorio';
}
