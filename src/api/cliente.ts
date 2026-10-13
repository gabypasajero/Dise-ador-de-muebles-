import type {
  CatalogoMateriales,
  CategoriaTienda,
  Cliente,
  Cotizacion,
  Diseno,
  LineaDetalle,
  ProductoCatalogo,
  TotalesCotizaciones,
  Usuario,
} from '../../shared/tipos';

export interface RespuestaCatalogo {
  fuente: 'tienda' | 'respaldo';
  actualizado: string;
  tienda: string;
  whatsapp: string;
  categorias: CategoriaTienda[];
  productos: ProductoCatalogo[];
}

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

const CLAVE_TOKEN = 'dto-token';

export function tokenGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // almacenamiento no disponible: la sesión dura lo que la pestaña
  }
}

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    public estado: number,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}, token?: string | null): Promise<T> {
  const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const r = await fetch(ruta, { ...opciones, headers: { ...cabeceras, ...(opciones.headers as Record<string, string>) } });
  if (r.status === 204) return undefined as T;
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi((datos as { error?: string }).error ?? `Error ${r.status}`, r.status);
  return datos as T;
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  productos: () => pedir<RespuestaCatalogo>('/api/productos'),
  materiales: () => pedir<CatalogoMateriales>('/api/materiales'),

  opcionesRegistro: () => pedir<{ requiereCodigo: boolean }>('/api/auth/registro'),
  registro: (datos: { nombre: string; email: string; telefono: string; password: string; codigo?: string }) =>
    pedir<{ token: string; usuario: Usuario }>('/api/auth/registro', post(datos)),
  login: (email: string, password: string) => pedir<{ token: string; usuario: Usuario }>('/api/auth/login', post({ email, password })),
  yo: (token: string) => pedir<{ usuario: Usuario }>('/api/auth/yo', {}, token),

  cotizaciones: (token: string) => pedir<{ cotizaciones: Cotizacion[]; totales: TotalesCotizaciones }>('/api/cotizaciones', {}, token),
  cotizacion: (token: string, id: number) => pedir<{ cotizacion: Cotizacion }>(`/api/cotizaciones/${id}`, {}, token),
  crearCotizacion: (token: string, datos: DatosCotizacion) => pedir<{ cotizacion: Cotizacion }>('/api/cotizaciones', post(datos), token),
  actualizarCotizacion: (token: string, id: number, datos: DatosCotizacion) =>
    pedir<{ cotizacion: Cotizacion }>(`/api/cotizaciones/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, token),
  registrarVenta: (token: string, id: number, venta: { fecha: string; valor: number; medioPago: string | null; nota: string | null }) =>
    pedir<{ cotizacion: Cotizacion }>(`/api/cotizaciones/${id}/venta`, post(venta), token),
  cambiarEstado: (token: string, id: number, estado: 'cotizada' | 'anulada') =>
    pedir<{ cotizacion: Cotizacion }>(`/api/cotizaciones/${id}/estado`, post({ estado }), token),
};
