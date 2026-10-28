// Datos en Supabase: registro e ingreso de vendedores con Supabase Auth,
// productos de la tienda y cotizaciones protegidas con RLS.
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Cotizacion, DatosCotizacion, ProductoTienda, Usuario } from '../../shared/tipos';
import { marcaDe } from '../cotizacion/marcas';
import { aCotizacion, aFila, validarDatos, validarRegistro, type Backend, type FilaCotizacion } from './backend';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL || 'https://bmxmqhbkgvgyqpwsuazm.supabase.co';
const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_C4bwkSAfBBHNg8z523_qpw_P-PDzciI';

export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const CAMPOS_PRODUCTO = 'id,nombre,categoria,descripcion,medidas,precio,precio_oferta,imagen_url,personalizable,destacado,orden';
const VENDEDOR = 'vendedor:vendedores(id,nombre,telefono)';
const CAMPOS_BASE = `id,vendedor_id,cliente_nombre,cliente_telefono,cliente_email,cliente_direccion,observaciones,producto_id,modelo,detalle,miniatura,valor,fecha,estado,fecha_venta,valor_venta,medio_pago,nota_venta,creado_en,actualizado_en,${VENDEDOR}`;

/**
 * La marca y la imagen grande vienen de supabase/migrations/20261019000000_marca_cotizaciones.sql.
 * Mientras ese SQL no se ejecute en el proyecto, la app sigue funcionando sin ellas (todo sale
 * como De Todito Outlet y el PDF usa la miniatura).
 */
let sinColumnasMarca = false;
const camposLista = () => (sinColumnasMarca ? CAMPOS_BASE : `${CAMPOS_BASE},marca`);
const camposCompletos = () => (sinColumnasMarca ? `${CAMPOS_BASE},config` : `${CAMPOS_BASE},marca,config,imagen`);

function faltanColumnasMarca(e: PostgrestError | null): boolean {
  return !!e && (e.code === '42703' || e.code === 'PGRST204') && /\b(marca|imagen)\b/.test(e.message);
}

type Respuesta = { data: unknown; error: PostgrestError | null };

/** Ejecuta la consulta y, si la base aún no tiene las columnas nuevas, la repite sin ellas. */
async function conRespaldo(q: () => PromiseLike<Respuesta>): Promise<Respuesta> {
  const r = await q();
  if (sinColumnasMarca || !faltanColumnasMarca(r.error)) return r;
  sinColumnasMarca = true;
  console.warn('Supabase aún no tiene la marca de las cotizaciones: ejecuta supabase/migrations/20261019000000_marca_cotizaciones.sql');
  return q();
}

/** Columnas a escribir (sin marca ni imagen si la base todavía no las tiene). */
function filaParaGuardar(d: DatosCotizacion) {
  const { marca, imagen, ...resto } = aFila(d);
  return sinColumnasMarca ? resto : { ...resto, marca, imagen };
}

export class ErrorConfiguracion extends Error {}

const SQL_PENDIENTE =
  'Faltan las tablas de vendedores y cotizaciones en Supabase. Ejecuta supabase/migrations/20261013120000_vendedores_cotizaciones.sql en el SQL Editor del proyecto.';

/** Traduce errores de PostgREST / Postgres a mensajes para el vendedor. */
function traducir(e: PostgrestError | null): Error {
  if (!e) return new Error('Error desconocido');
  if (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message)) return new ErrorConfiguracion(SQL_PENDIENTE);
  if (e.code === 'PGRST116') return new Error('Cotización no encontrada');
  if (e.code === '42501' || /row-level security/i.test(e.message)) return new Error('Tu cuenta no tiene permiso para esta acción');
  if (e.code === '23514') return new Error('Revisa los datos: hay un valor fuera de rango');
  return new Error(e.message);
}

async function una(q: () => PromiseLike<Respuesta>, marca?: DatosCotizacion['marca']): Promise<Cotizacion> {
  const { data, error } = await conRespaldo(q);
  if (error) throw traducir(error);
  const c = aCotizacion(data as FilaCotizacion);
  // Sin la columna en la base, la cotización recién guardada conserva en pantalla la marca elegida.
  return sinColumnasMarca && marca ? { ...c, marca: marcaDe({ marca }) } : c;
}

export const backendSupabase: Backend = {
  tipo: 'supabase',

  async perfilActual(): Promise<Usuario | null> {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const [vend, admin] = await Promise.all([
      supabase.from('vendedores').select('id,nombre,email,telefono,activo').eq('id', user.id).maybeSingle(),
      supabase.rpc('es_admin'),
    ]);
    if (vend.error) throw traducir(vend.error);
    const esAdmin = admin.data === true;
    const v = vend.data as { nombre: string; email: string; telefono: string | null; activo: boolean } | null;
    if (!v && !esAdmin) throw new Error('Esta cuenta no está registrada como vendedor.');
    if (v && !v.activo && !esAdmin) throw new Error('Tu cuenta de vendedor está desactivada. Habla con la administración de la tienda.');
    return {
      id: user.id,
      nombre: v?.nombre ?? (user.user_metadata?.nombre as string | undefined) ?? user.email ?? 'Administración',
      email: user.email ?? '',
      telefono: v?.telefono ?? null,
      esVendedor: Boolean(v?.activo),
      esAdmin,
    };
  },

  alCambiarSesion(cb) {
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'SIGNED_OUT' || evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED') cb(Boolean(sesion));
    });
    return () => data.subscription.unsubscribe();
  },

  async requiereCodigo() {
    const { data, error } = await supabase.rpc('registro_requiere_codigo');
    return !error && data === true;
  },

  async registrar({ nombre, email, telefono, password, codigo }) {
    const invalido = validarRegistro({ nombre, email, telefono, password });
    if (invalido) throw new Error(invalido);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { rol: 'vendedor', nombre: nombre.trim(), telefono: telefono.trim(), ...(codigo ? { codigo: codigo.trim() } : {}) },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) throw new Error('Ya existe una cuenta con ese correo');
      if (/database error/i.test(error.message)) {
        // Un trigger rechazó el registro: falta el SQL o el código no coincide.
        const r = await supabase.rpc('registro_requiere_codigo');
        if (r.error && (r.error.code === 'PGRST202' || r.error.code === '42883')) throw new ErrorConfiguracion(SQL_PENDIENTE);
        if (r.data === true) throw new Error('Código de vendedor incorrecto. Pídelo a la administración de la tienda.');
        throw new Error('No se pudo crear la cuenta. Revisa tus datos e inténtalo de nuevo.');
      }
      if (/password/i.test(error.message)) throw new Error('La contraseña es muy débil: usa al menos 8 caracteres');
      if (/rate limit|too many/i.test(error.message)) throw new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      throw new Error(error.message);
    }
    // Con confirmación de correo activa, Supabase no informa si el correo ya existía: devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) throw new Error('Ya existe una cuenta con ese correo');
    return { confirmarCorreo: !data.session };
  },

  async ingresar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      if (/invalid login/i.test(error.message)) throw new Error('Correo o contraseña incorrectos');
      if (/not confirmed/i.test(error.message)) throw new Error('Confirma tu correo: te enviamos un enlace al registrarte.');
      throw new Error(error.message);
    }
  },

  async salir() {
    await supabase.auth.signOut();
  },

  async recuperarClave(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/?nueva-clave=1`,
    });
    if (error) {
      if (/rate limit|too many|security purposes/i.test(error.message)) throw new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      throw new Error(error.message);
    }
  },

  async cambiarClave(password) {
    if (password.length < 8) throw new Error('La contraseña es muy débil: usa al menos 8 caracteres');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (/different from the old/i.test(error.message)) throw new Error('La contraseña nueva debe ser distinta de la anterior');
      if (/session/i.test(error.message)) throw new Error('El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».');
      throw new Error(error.message);
    }
  },

  async productos(): Promise<ProductoTienda[]> {
    const { data, error } = await supabase
      .from('productos')
      .select(CAMPOS_PRODUCTO)
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('orden')
      .order('nombre');
    if (error) throw traducir(error);
    if (!data?.length) throw new Error('La tienda no devolvió productos');
    return data as ProductoTienda[];
  },

  async cotizaciones() {
    const { data, error } = await conRespaldo(() =>
      supabase
        .from('cotizaciones')
        .select(camposLista())
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .limit(500),
    );
    if (error) throw traducir(error);
    return (data as unknown as FilaCotizacion[]).map(aCotizacion);
  },

  cotizacion(id) {
    return una(() => supabase.from('cotizaciones').select(camposCompletos()).eq('id', id).single());
  },

  crearCotizacion(d) {
    const error = validarDatos(d);
    if (error) return Promise.reject(new Error(error));
    return una(() => supabase.from('cotizaciones').insert(filaParaGuardar(d)).select(camposCompletos()).single(), d.marca);
  },

  actualizarCotizacion(id, d) {
    const error = validarDatos(d);
    if (error) return Promise.reject(new Error(error));
    return una(() => supabase.from('cotizaciones').update(filaParaGuardar(d)).eq('id', id).select(camposCompletos()).single(), d.marca);
  },

  registrarVenta(id, v) {
    if (!Number.isInteger(v.valor) || v.valor <= 0) return Promise.reject(new Error('Ingresa el valor de la venta'));
    return una(() =>
      supabase
        .from('cotizaciones')
        .update({ estado: 'vendida', fecha_venta: v.fecha, valor_venta: v.valor, medio_pago: v.medioPago, nota_venta: v.nota })
        .eq('id', id)
        .select(camposLista())
        .single(),
    );
  },

  cambiarEstado(id, estado) {
    return una(() => supabase.from('cotizaciones').update({ estado }).eq('id', id).select(camposLista()).single());
  },

  async eliminarCotizacion(id) {
    const { data, error } = await supabase.from('cotizaciones').delete().eq('id', id).select('id');
    if (error) throw traducir(error);
    // Sin permiso, Supabase no borra nada y tampoco avisa: no devuelve filas.
    if (!data || data.length === 0) throw new Error('No se pudo eliminar: las cotizaciones vendidas solo las elimina la administración.');
  },
};
