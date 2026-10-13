import { create } from 'zustand';
import { clasificarProducto, disenoInicial, disenoLibre } from '../../shared/catalogo';
import { normalizar } from '../../shared/reglas';
import type { CatalogoMateriales, Diseno, Escenario, Plantilla, ProductoCatalogo, Unidad, Usuario } from '../../shared/tipos';
import { api, guardarToken, tokenGuardado, type RespuestaCatalogo } from '../api/cliente';

export type Pestana = 'puertas' | 'cajones' | 'modulos' | 'equipamiento';
export type Modal = null | 'catalogo' | 'auth' | 'misDisenos' | 'cotizar' | 'guardar';
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
  guardadoId: number | null;
  nombreGuardado: string;
  modal: Modal;
  /** Modal que se abre después de iniciar sesión (p. ej. guardar). */
  trasAuth: Modal;
  modoAuth: 'login' | 'registro';
  avisos: Aviso[];
  capturar: (() => string | null) | null;

  cargarDatos: () => Promise<void>;
  elegirProducto: (p: ProductoCatalogo) => void;
  empezarLibre: (plantilla: Plantilla) => void;
  cambiar: (f: (d: Diseno) => Diseno, grupo?: string) => void;
  deshacer: () => void;
  rehacer: () => void;
  restablecer: () => void;
  cargarGuardado: (id: number, nombre: string, config: Diseno, productoId: number | null) => void;
  set: (parcial: Partial<Estado>) => void;
  avisar: (texto: string, tipo?: Aviso['tipo']) => void;
  iniciarSesion: (token: string, usuario: Usuario) => void;
  cerrarSesion: () => void;
}

const CLAVE_BORRADOR = 'dto-borrador-v1';

function leerBorrador(): { productoId: number | null; diseno: Diseno; unidad?: Unidad } | null {
  try {
    const t = localStorage.getItem(CLAVE_BORRADOR);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}

function escribirBorrador(productoId: number | null, diseno: Diseno, unidad: Unidad) {
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ productoId, diseno, unidad }));
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
  guardadoId: null,
  nombreGuardado: '',
  modal: null,
  trasAuth: null,
  modoAuth: 'login',
  avisos: [],
  capturar: null,

  async cargarDatos() {
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
    const token = get().token;
    if (token) {
      api
        .yo(token)
        .then(({ usuario }) => set({ usuario }))
        .catch(() => {
          guardarToken(null);
          set({ token: null, usuario: null });
        });
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
      guardadoId: null,
      nombreGuardado: '',
      abierto: false,
      encuadre: get().encuadre + 1,
      vista: 'perspectiva',
      modal: null,
    });
    escribirBorrador(producto.id, d, get().unidad);
  },

  empezarLibre(plantilla) {
    const d = disenoLibre(plantilla);
    set({
      producto: null,
      disenoBase: null,
      diseno: d,
      pasado: [],
      futuro: [],
      guardadoId: null,
      nombreGuardado: '',
      abierto: false,
      encuadre: get().encuadre + 1,
      vista: 'perspectiva',
      modal: null,
    });
    escribirBorrador(null, d, get().unidad);
  },

  cambiar(f, grupo) {
    const { diseno, pasado, ultimoGrupo, producto, unidad } = get();
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
    escribirBorrador(producto?.id ?? null, nuevo, unidad);
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

  cargarGuardado(id, nombre, config, productoId) {
    const catalogo = get().catalogo;
    const producto = productoId != null ? (catalogo?.productos.find((p) => p.id === productoId) ?? null) : null;
    const d = normalizar(config);
    set({
      producto,
      disenoBase: producto ? disenoInicial(producto) : null,
      diseno: d,
      pasado: [],
      futuro: [],
      guardadoId: id,
      nombreGuardado: nombre,
      modal: null,
      encuadre: get().encuadre + 1,
    });
    escribirBorrador(productoId, d, get().unidad);
  },

  set(parcial) {
    set(parcial);
    if ('unidad' in parcial) {
      const { producto, diseno, unidad } = get();
      escribirBorrador(producto?.id ?? null, diseno, unidad);
    }
  },

  avisar(texto, tipo = 'ok') {
    const id = ++idAviso;
    set({ avisos: [...get().avisos, { id, texto, tipo }] });
    setTimeout(() => set({ avisos: get().avisos.filter((a) => a.id !== id) }), 3800);
  },

  iniciarSesion(token, usuario) {
    guardarToken(token);
    set({ token, usuario, modal: null });
  },

  cerrarSesion() {
    guardarToken(null);
    set({ token: null, usuario: null, guardadoId: null, nombreGuardado: '' });
  },
}));

export function escenarioActual(e: Escenario | 'auto', producto: ProductoCatalogo | null, d: Diseno): Escenario {
  if (e !== 'auto') return e;
  if (producto) return producto.escenario;
  if (d.plantilla === 'cocina') return 'cocina';
  if (d.plantilla === 'cocina-infantil' || d.plantilla === 'escritorio') return 'infantil';
  return 'dormitorio';
}
