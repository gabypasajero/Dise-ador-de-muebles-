// Contrato común de la capa de datos. Hay dos implementaciones:
// Supabase (producción) y local (demostración en el navegador).
import { numeroCotizacion } from '../../shared/resumen';
import type {
  Cotizacion,
  DatosCotizacion,
  EstadoCotizacion,
  ProductoTienda,
  TotalesCotizaciones,
  Usuario,
  Venta,
} from '../../shared/tipos';

export interface DatosRegistro {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  codigo?: string;
}

export interface Backend {
  tipo: 'supabase' | 'local';
  /** Usuario con sesión, o null si no hay sesión. Lanza error si la cuenta no tiene acceso. */
  perfilActual(): Promise<Usuario | null>;
  /** Avisa cuando la sesión se cierra o se renueva (otra pestaña, token vencido…). */
  alCambiarSesion(cb: (haySesion: boolean) => void): () => void;
  requiereCodigo(): Promise<boolean>;
  /** Devuelve true si el vendedor debe confirmar su correo antes de ingresar. */
  registrar(d: DatosRegistro): Promise<{ confirmarCorreo: boolean }>;
  ingresar(email: string, password: string): Promise<void>;
  salir(): Promise<void>;
  productos(): Promise<ProductoTienda[]>;
  cotizaciones(): Promise<Cotizacion[]>;
  cotizacion(id: number): Promise<Cotizacion>;
  crearCotizacion(d: DatosCotizacion): Promise<Cotizacion>;
  actualizarCotizacion(id: number, d: DatosCotizacion): Promise<Cotizacion>;
  registrarVenta(id: number, v: Venta): Promise<Cotizacion>;
  cambiarEstado(id: number, estado: Exclude<EstadoCotizacion, 'vendida'>): Promise<Cotizacion>;
}

/** Fila de la tabla cotizaciones (Supabase) con el vendedor embebido. */
export interface FilaCotizacion {
  id: number;
  vendedor_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cliente_direccion: string | null;
  observaciones: string | null;
  producto_id: number | null;
  modelo: string;
  config?: unknown;
  detalle: unknown;
  miniatura: string | null;
  valor: number;
  fecha: string;
  estado: EstadoCotizacion;
  fecha_venta: string | null;
  valor_venta: number | null;
  medio_pago: string | null;
  nota_venta: string | null;
  creado_en: string;
  actualizado_en: string;
  vendedor: { id: string; nombre: string; telefono: string | null } | null;
}

export function aCotizacion(f: FilaCotizacion): Cotizacion {
  return {
    id: Number(f.id),
    numero: numeroCotizacion(Number(f.id)),
    vendedor: f.vendedor ?? { id: f.vendedor_id, nombre: 'Vendedor', telefono: null },
    cliente: { nombre: f.cliente_nombre, telefono: f.cliente_telefono, email: f.cliente_email, direccion: f.cliente_direccion },
    observaciones: f.observaciones,
    productoId: f.producto_id === null ? null : Number(f.producto_id),
    modelo: f.modelo,
    detalle: Array.isArray(f.detalle) ? (f.detalle as Cotizacion['detalle']) : [],
    miniatura: f.miniatura,
    valor: Number(f.valor),
    fecha: f.fecha,
    estado: f.estado,
    venta:
      f.estado === 'vendida' && f.fecha_venta && f.valor_venta !== null
        ? { fecha: f.fecha_venta, valor: Number(f.valor_venta), medioPago: f.medio_pago, nota: f.nota_venta }
        : null,
    creado: f.creado_en,
    actualizado: f.actualizado_en,
    ...(f.config !== undefined ? { config: f.config as Cotizacion['config'] } : {}),
  };
}

/** Convierte los datos del formulario en columnas de la tabla. */
export function aFila(d: DatosCotizacion) {
  return {
    cliente_nombre: d.cliente.nombre.trim(),
    cliente_telefono: d.cliente.telefono?.trim() || null,
    cliente_email: d.cliente.email?.trim().toLowerCase() || null,
    cliente_direccion: d.cliente.direccion?.trim() || null,
    observaciones: d.observaciones?.trim() || null,
    producto_id: d.productoId,
    modelo: d.modelo,
    config: d.config,
    detalle: d.detalle,
    miniatura: d.miniatura,
    valor: Math.round(d.valor),
    fecha: d.fecha,
  };
}

export function calcularTotales(lista: Cotizacion[]): TotalesCotizaciones {
  const vigentes = lista.filter((c) => c.estado !== 'anulada');
  const vendidas = lista.filter((c) => c.estado === 'vendida');
  return {
    cotizaciones: vigentes.length,
    montoCotizado: vigentes.reduce((s, c) => s + c.valor, 0),
    ventas: vendidas.length,
    montoVendido: vendidas.reduce((s, c) => s + (c.venta?.valor ?? c.valor), 0),
  };
}

/** Validaciones de la app (la base de datos vuelve a validarlas). */
/** Mismos límites que la tabla vendedores en Supabase. */
export function validarRegistro(d: DatosRegistro): string | null {
  const nombre = d.nombre.trim();
  if (nombre.length < 3) return 'Ingresa tu nombre y apellido';
  if (nombre.length > 80) return 'El nombre puede tener hasta 80 caracteres';
  if (d.telefono.trim().length > 30) return 'El teléfono puede tener hasta 30 caracteres';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Ingresa un correo válido';
  if (d.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return null;
}

export function validarDatos(d: DatosCotizacion): string | null {
  if (d.cliente.nombre.trim().length < 2) return 'Ingresa el nombre del cliente';
  if (d.cliente.email && d.cliente.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.cliente.email.trim())) return 'Correo del cliente no válido';
  if (!Number.isInteger(d.valor) || d.valor <= 0) return 'Ingresa el valor del mueble';
  if (d.valor > 100_000_000) return 'El valor es demasiado alto';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return 'Fecha no válida';
  return null;
}
