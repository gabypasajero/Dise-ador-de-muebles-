// Modo sin conexión: la app sigue funcionando en la tablet sin internet.
// - El perfil del vendedor queda guardado: con la sesión abierta se entra sin conexión.
// - Las cotizaciones que se registran sin internet quedan en la tablet como pendientes
//   (número provisorio PEND-…) y se envían solas al volver la conexión.
// - La última lista de cotizaciones queda guardada para verla sin conexión.
import type { Cotizacion, DatosCotizacion, Usuario } from '../../shared/tipos';
import type { Backend } from './backend';

const CLAVE_PERFIL = 'dto-perfil-sin-conexion';
const CLAVE_LISTA = 'dto-lista-sin-conexion';

/** Error de red (sin internet o el servidor no responde), no un rechazo del servidor. */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|sin conexión|timeout|timed out/i.test(m);
}

// ---------- Cotizaciones pendientes (IndexedDB: caben las imágenes) ----------

interface Pendiente {
  id: number;
  datos: DatosCotizacion;
  vendedor: Cotizacion['vendedor'];
  creado: string;
}

let bd: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  if (!bd)
    bd = new Promise((ok, mal) => {
      const r = indexedDB.open('dto-sin-conexion', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pendientes', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  return bd;
}

async function tienda<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const req = f(db.transaction('pendientes', modo).objectStore('pendientes'));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

export async function listarPendientes(): Promise<Pendiente[]> {
  try {
    return (await tienda('readonly', (s) => s.getAll())) as Pendiente[];
  } catch {
    return [];
  }
}

const guardarPendiente = (p: Pendiente) => tienda('readwrite', (s) => s.put(p));
const borrarPendiente = (id: number) => tienda('readwrite', (s) => s.delete(id));

/** La cotización tal como se ve mientras espera: número provisorio PEND-… */
function comoCotizacion(p: Pendiente): Cotizacion {
  const d = p.datos;
  return {
    id: p.id,
    numero: `PEND-${-p.id}`,
    vendedor: p.vendedor,
    cliente: d.cliente,
    observaciones: d.observaciones,
    productoId: d.productoId,
    modelo: d.modelo,
    detalle: d.detalle,
    miniatura: d.miniatura,
    valor: d.valor,
    fecha: d.fecha,
    estado: 'cotizada',
    venta: null,
    creado: p.creado,
    actualizado: p.creado,
    config: d.config,
    ...(d.marca ? { marca: d.marca } : {}),
    ...(d.imagen ? { imagen: d.imagen } : {}),
  } as Cotizacion;
}

/** Avisa a la app cuando cambia la cantidad de pendientes (para el aviso de «sin conexión»). */
export function avisarPendientes() {
  window.dispatchEvent(new Event('dto-pendientes'));
}

let enviando: Promise<number> | null = null;

/** Envía las cotizaciones pendientes; devuelve cuántas se enviaron. */
export function enviarPendientes(base: Backend): Promise<number> {
  if (enviando) return enviando;
  enviando = (async () => {
    let n = 0;
    for (const p of (await listarPendientes()).sort((a, b) => b.id - a.id)) {
      try {
        await base.crearCotizacion(p.datos);
        await borrarPendiente(p.id);
        n++;
      } catch (e) {
        if (esErrorDeRed(e)) break;
        // El servidor la rechazó (datos inválidos): queda pendiente para revisarla.
      }
    }
    avisarPendientes();
    return n;
  })().finally(() => (enviando = null));
  return enviando;
}

/** El backend con el modo sin conexión encima. */
export function conModoSinConexion(base: Backend): Backend {
  const perfilGuardado = (): Usuario | null => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_PERFIL) ?? 'null');
    } catch {
      return null;
    }
  };
  const vendedor = (): Cotizacion['vendedor'] => {
    const u = perfilGuardado();
    return { id: u?.id ?? '', nombre: u?.nombre ?? 'Vendedor', telefono: u?.telefono ?? null };
  };
  const pendiente = async (id: number) => (await listarPendientes()).find((p) => p.id === id);

  return {
    ...base,
    async perfilActual() {
      try {
        const u = await base.perfilActual();
        // Sin internet la sesión vencida no se puede renovar: se sigue con el vendedor guardado.
        if (!u && typeof navigator !== 'undefined' && navigator.onLine === false && perfilGuardado()) return perfilGuardado();
        try {
          if (u) localStorage.setItem(CLAVE_PERFIL, JSON.stringify(u));
          else localStorage.removeItem(CLAVE_PERFIL);
        } catch {
          /* sin almacenamiento */
        }
        return u;
      } catch (e) {
        // Sin internet: el vendedor que dejó la sesión abierta sigue trabajando.
        const u = esErrorDeRed(e) ? perfilGuardado() : null;
        if (u) return u;
        throw e;
      }
    },
    async salir() {
      try {
        localStorage.removeItem(CLAVE_PERFIL);
        localStorage.removeItem(CLAVE_LISTA);
      } catch {
        /* sin almacenamiento */
      }
      await base.salir().catch(() => undefined);
    },
    async cotizaciones() {
      const pendientes = (await listarPendientes()).map(comoCotizacion);
      try {
        const lista = await base.cotizaciones();
        try {
          localStorage.setItem(CLAVE_LISTA, JSON.stringify(lista.map((c) => ({ ...c, miniatura: null }))));
        } catch {
          /* la lista no cabe: se omite la copia */
        }
        return [...pendientes, ...lista];
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        let guardada: Cotizacion[] = [];
        try {
          guardada = JSON.parse(localStorage.getItem(CLAVE_LISTA) ?? '[]');
        } catch {
          guardada = [];
        }
        return [...pendientes, ...guardada];
      }
    },
    async cotizacion(id) {
      if (id < 0) {
        const p = await pendiente(id);
        if (!p) throw new Error('Esa cotización pendiente ya se envió: búscala con su número nuevo.');
        return comoCotizacion(p);
      }
      return base.cotizacion(id);
    },
    async crearCotizacion(d) {
      try {
        return await base.crearCotizacion(d);
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        const ids = (await listarPendientes()).map((p) => p.id);
        const p: Pendiente = { id: Math.min(0, ...ids) - 1, datos: d, vendedor: vendedor(), creado: new Date().toISOString() };
        await guardarPendiente(p);
        avisarPendientes();
        return comoCotizacion(p);
      }
    },
    async actualizarCotizacion(id, d) {
      if (id < 0) {
        const p = await pendiente(id);
        if (!p) throw new Error('Esa cotización pendiente ya se envió: búscala con su número nuevo.');
        const nuevo = { ...p, datos: d };
        await guardarPendiente(nuevo);
        avisarPendientes();
        return comoCotizacion(nuevo);
      }
      return base.actualizarCotizacion(id, d);
    },
    async registrarVenta(id, v) {
      if (id < 0) throw new Error('Esta cotización todavía no se envía (no hay internet): la venta se registra cuando tenga su número COT-…');
      return base.registrarVenta(id, v);
    },
    async cambiarEstado(id, estado) {
      if (id < 0) throw new Error('Esta cotización todavía no se envía (no hay internet): podrás cambiar su estado cuando tenga su número COT-…');
      return base.cambiarEstado(id, estado);
    },
    async eliminarCotizacion(id) {
      if (id < 0) {
        await borrarPendiente(id);
        avisarPendientes();
        return;
      }
      return base.eliminarCotizacion(id);
    },
  };
}
