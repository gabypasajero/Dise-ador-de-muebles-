import type { CatalogoMateriales, CategoriaTienda, Diseno, DisenoGuardado, ProductoCatalogo, Usuario } from '../../shared/tipos';

export interface RespuestaCatalogo {
  fuente: 'tienda' | 'respaldo';
  actualizado: string;
  tienda: string;
  whatsapp: string;
  categorias: CategoriaTienda[];
  productos: ProductoCatalogo[];
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

export const api = {
  productos: () => pedir<RespuestaCatalogo>('/api/productos'),
  materiales: () => pedir<CatalogoMateriales>('/api/materiales'),
  registro: (nombre: string, email: string, password: string) =>
    pedir<{ token: string; usuario: Usuario }>('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    }),
  login: (email: string, password: string) =>
    pedir<{ token: string; usuario: Usuario }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  yo: (token: string) => pedir<{ usuario: Usuario }>('/api/auth/yo', {}, token),
  disenos: (token: string) => pedir<{ disenos: DisenoGuardado[] }>('/api/disenos', {}, token),
  crearDiseno: (token: string, datos: { nombre: string; productoId: number | null; config: Diseno; miniatura: string | null }) =>
    pedir<{ diseno: DisenoGuardado }>('/api/disenos', { method: 'POST', body: JSON.stringify(datos) }, token),
  actualizarDiseno: (
    token: string,
    id: number,
    datos: { nombre: string; productoId: number | null; config: Diseno; miniatura: string | null },
  ) => pedir<{ diseno: DisenoGuardado }>(`/api/disenos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, token),
  borrarDiseno: (token: string, id: number) => pedir<void>(`/api/disenos/${id}`, { method: 'DELETE' }, token),
  cotizar: (
    token: string | null,
    datos: { nombre?: string; telefono?: string; comentario?: string; productoId: number | null; config: Diseno; resumen: string },
  ) => pedir<{ id: number }>('/api/cotizaciones', { method: 'POST', body: JSON.stringify(datos) }, token),
};
