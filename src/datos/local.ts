// Modo de demostración: guarda vendedores y cotizaciones en este navegador.
// Sirve para probar la herramienta sin Supabase (npm run dev:local).
// Aplica las mismas reglas que la base de datos.
import type { Cotizacion, ProductoTienda, Usuario } from '../../shared/tipos';
import { aCotizacion, aFila, validarDatos, validarRegistro, type Backend, type FilaCotizacion } from './backend';

interface UsuarioLocal {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  hash: string;
}

const CLAVES = { usuarios: 'dto-local-usuarios', sesion: 'dto-local-sesion', cotizaciones: 'dto-local-cotizaciones' };
const oyentes = new Set<(hay: boolean) => void>();

function leer<T>(clave: string, defecto: T): T {
  try {
    const t = localStorage.getItem(clave);
    return t ? (JSON.parse(t) as T) : defecto;
  } catch {
    return defecto;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    throw new Error('No queda espacio en el navegador para guardar más cotizaciones de prueba.');
  }
}

async function hash(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(`dto-demo:${texto}`);
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sesion(): UsuarioLocal | null {
  const id = leer<string | null>(CLAVES.sesion, null);
  return leer<UsuarioLocal[]>(CLAVES.usuarios, []).find((u) => u.id === id) ?? null;
}

function exigirSesion(): UsuarioLocal {
  const u = sesion();
  if (!u) throw new Error('Inicia sesión como vendedor para continuar');
  return u;
}

function filas(): FilaCotizacion[] {
  return leer<FilaCotizacion[]>(CLAVES.cotizaciones, []);
}

/**
 * Guarda las cotizaciones. Si el navegador se queda sin espacio, quita la imagen grande de las
 * cotizaciones más antiguas (conservan su miniatura) hasta que quepa; la de `conservar` no se toca.
 */
function guardar(f: FilaCotizacion[], conservar?: number) {
  try {
    escribir(CLAVES.cotizaciones, f);
  } catch (e) {
    const conImagen = f.filter((x) => x.imagen && x.id !== conservar).sort((a, b) => a.id - b.id);
    for (const x of conImagen) {
      x.imagen = null;
      try {
        escribir(CLAVES.cotizaciones, f);
        return;
      } catch {
        // Sigue con la siguiente.
      }
    }
    throw e;
  }
}

/** Lo que devuelve la lista y los cambios de estado: sin el diseño ni la imagen grande. */
const resumida = (f: FilaCotizacion) => aCotizacion({ ...f, config: undefined, imagen: undefined });

function propia(id: number): { todas: FilaCotizacion[]; fila: FilaCotizacion } {
  const u = exigirSesion();
  const todas = filas();
  const fila = todas.find((f) => f.id === id && f.vendedor_id === u.id);
  if (!fila) throw new Error('Cotización no encontrada');
  return { todas, fila };
}

const ahora = () => new Date().toISOString();

export const backendLocal: Backend = {
  tipo: 'local',

  async perfilActual(): Promise<Usuario | null> {
    const u = sesion();
    return u ? { id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, esVendedor: true, esAdmin: false } : null;
  },

  alCambiarSesion(cb) {
    oyentes.add(cb);
    return () => oyentes.delete(cb);
  },

  async requiereCodigo() {
    return false;
  },

  async registrar({ nombre, email, telefono, password }) {
    const usuarios = leer<UsuarioLocal[]>(CLAVES.usuarios, []);
    const correo = email.trim().toLowerCase();
    const invalido = validarRegistro({ nombre, email, telefono, password });
    if (invalido) throw new Error(invalido);
    if (usuarios.some((u) => u.email === correo)) throw new Error('Ya existe una cuenta con ese correo');
    const u: UsuarioLocal = { id: crypto.randomUUID(), nombre: nombre.trim(), email: correo, telefono: telefono.trim() || null, hash: await hash(password) };
    escribir(CLAVES.usuarios, [...usuarios, u]);
    escribir(CLAVES.sesion, u.id);
    oyentes.forEach((cb) => cb(true));
    return { confirmarCorreo: false };
  },

  async ingresar(email, password) {
    const u = leer<UsuarioLocal[]>(CLAVES.usuarios, []).find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.hash !== (await hash(password))) throw new Error('Correo o contraseña incorrectos');
    escribir(CLAVES.sesion, u.id);
    oyentes.forEach((cb) => cb(true));
  },

  async salir() {
    escribir(CLAVES.sesion, null);
    oyentes.forEach((cb) => cb(false));
  },

  async productos(): Promise<ProductoTienda[]> {
    const r = await fetch('/datos/productos-respaldo.json');
    if (!r.ok) throw new Error('No se pudo cargar el catálogo');
    return r.json();
  },

  async cotizaciones(): Promise<Cotizacion[]> {
    const u = exigirSesion();
    return filas()
      .filter((f) => f.vendedor_id === u.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
      .map(resumida);
  },

  async cotizacion(id) {
    return aCotizacion(propia(id).fila);
  },

  async crearCotizacion(d) {
    const u = exigirSesion();
    const error = validarDatos(d);
    if (error) throw new Error(error);
    const todas = filas();
    const fila: FilaCotizacion = {
      ...aFila(d),
      id: todas.reduce((m, f) => Math.max(m, f.id), 0) + 1,
      vendedor_id: u.id,
      estado: 'cotizada',
      fecha_venta: null,
      valor_venta: null,
      medio_pago: null,
      nota_venta: null,
      creado_en: ahora(),
      actualizado_en: ahora(),
      vendedor: { id: u.id, nombre: u.nombre, telefono: u.telefono },
    };
    guardar([...todas, fila], fila.id);
    return aCotizacion(fila);
  },

  async actualizarCotizacion(id, d) {
    const { todas, fila } = propia(id);
    if (fila.estado === 'vendida') throw new Error('La cotización ya está vendida: registra una nueva para cambiarla');
    const error = validarDatos(d);
    if (error) throw new Error(error);
    Object.assign(fila, aFila(d), { actualizado_en: ahora() });
    guardar(todas, fila.id);
    return aCotizacion(fila);
  },

  async registrarVenta(id, v) {
    const { todas, fila } = propia(id);
    if (fila.estado === 'anulada') throw new Error('La cotización está anulada: reactívala antes de registrar la venta');
    if (!Number.isInteger(v.valor) || v.valor <= 0) throw new Error('Ingresa el valor de la venta');
    Object.assign(fila, {
      estado: 'vendida',
      fecha_venta: v.fecha,
      valor_venta: v.valor,
      medio_pago: v.medioPago,
      nota_venta: v.nota,
      actualizado_en: ahora(),
    });
    guardar(todas);
    return resumida(fila);
  },

  async cambiarEstado(id, estado) {
    const { todas, fila } = propia(id);
    Object.assign(fila, { estado, fecha_venta: null, valor_venta: null, medio_pago: null, nota_venta: null, actualizado_en: ahora() });
    guardar(todas);
    return resumida(fila);
  },
};
