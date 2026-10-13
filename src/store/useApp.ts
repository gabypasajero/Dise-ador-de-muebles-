import { create } from 'zustand';
import { clasificarProducto, disenoInicial, disenoLibre } from '../../shared/catalogo';
import { normalizar } from '../../shared/reglas';
import type { CatalogoMateriales, Cotizacion, Diseno, Escenario, Plantilla, ProductoCatalogo, Unidad, Usuario } from '../../shared/tipos';
import { api, guardarToken, tokenGuardado, type RespuestaCatalogo } from '../api/cliente';

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
  vista: Vista;
  encuadre: number;

  usuario: Usuario | null;
  token: string | null;
  sesion: 'verificando' | 'invitado' | 'activa';
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
  deshacer: () => void;
  rehacer: () => void;
  restablecer: () => void;
  cargarCotizacion: (c: Cotizacion) => void;
  verCotizacion: (c: Cotizacion) => void;
  set: (parcial: Partial<Estado>) => void;
  avisar: (texto: string, tipo?: Aviso['tipo']) => void;
  iniciarSesion: (token: string, usuario: Usuario) => void;
  cerrarSesion: () => void;
}

const CLAVE_BORRADOR = 'dto-borrador-v1';

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

let idAviso = 0;

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
  vista: 'perspectiva',
  encuadre: 0,

  usuario: null,
  token: tokenGuardado(),
  sesion: tokenGuardado() ? 'verificando' : 'invitado',
  cotizacionActual: null,
  cotizacionVista: null,
  modal: null,
  avisos: [],
  capturar: null,

  async cargarDatos() {
    const token = get().token;
    if (token) {
      api
        .yo(token)
        .then(({ usuario }) => set({ usuario, sesion: 'activa' }))
        .catch(() => {
          guardarToken(null);
          set({ token: null, usuario: null, sesion: 'invitado' });
        });
    }
    try {
      const [catalogo, materiales] = await Promise.all([api.productos(), api.materiales()]);
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
    });
    escribirBorrador(producto?.id ?? null, nuevo, unidad, cotizacionActual);
  },

  deshacer() {
    const { pasado, diseno, futuro } = get();
    if (!pasado.length) return;
    const anterior = pasado[pasado.length - 1];
    set({ diseno: anterior, pasado: pasado.slice(0, -1), futuro: [diseno, ...futuro], ultimoGrupo: null });
  },

  rehacer() {
    const { pasado, diseno, futuro } = get();
    if (!futuro.length) return;
    set({ diseno: futuro[0], futuro: futuro.slice(1), pasado: [...pasado, diseno], ultimoGrupo: null });
  },

  restablecer() {
    const { disenoBase, diseno } = get();
    const base = disenoBase ?? disenoLibre(diseno.plantilla);
    get().cambiar(() => base);
    set({ encuadre: get().encuadre + 1 });
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

  avisar(texto, tipo = 'ok') {
    const id = ++idAviso;
    set({ avisos: [...get().avisos, { id, texto, tipo }] });
    setTimeout(() => set({ avisos: get().avisos.filter((a) => a.id !== id) }), 3800);
  },

  iniciarSesion(token, usuario) {
    guardarToken(token);
    set({ token, usuario, sesion: 'activa' });
  },

  cerrarSesion() {
    guardarToken(null);
    try {
      // En un equipo compartido el siguiente vendedor parte de cero.
      localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      // sin almacenamiento local
    }
    set({ token: null, usuario: null, sesion: 'invitado', cotizacionActual: null, cotizacionVista: null, modal: null });
  },
}));

export function escenarioActual(e: Escenario | 'auto', producto: ProductoCatalogo | null, d: Diseno): Escenario {
  if (e !== 'auto') return e;
  if (producto) return producto.escenario;
  if (d.plantilla === 'cocina') return 'cocina';
  if (d.plantilla === 'cocina-infantil' || d.plantilla === 'escritorio') return 'infantil';
  return 'dormitorio';
}
