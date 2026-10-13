import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { formatear, formatoPrecio, precioReferencial } from '../../shared/reglas';
import { resumenDiseno } from '../../shared/resumen';
import type { DisenoGuardado, Plantilla, ProductoCatalogo } from '../../shared/tipos';
import { api } from '../api/cliente';
import { useApp } from '../store/useApp';
import { IcoBasura, IcoWsp, IcoX } from './Iconos';

function Modal({ titulo, onCerrar, children, ancho }: { titulo: string; onCerrar: () => void; children: ReactNode; ancho?: 'grande' }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    caja.current?.querySelector<HTMLElement>('input, button, select, textarea')?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      previo?.focus?.();
    };
  }, [onCerrar]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal-fondo" onClick={onCerrar} />
      <div ref={caja} className={`modal-caja${ancho ? ' grande' : ''}`}>
        <div className="modal-cabeza">
          <h2>{titulo}</h2>
          <button type="button" className="boton-icono" aria-label="Cerrar" onClick={onCerrar}>
            <IcoX />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}

// ---------- Catálogo ----------

interface Grupo {
  clave: string;
  modelo: string;
  categoria: string;
  variantes: ProductoCatalogo[];
}

export function ModalCatalogo() {
  const catalogo = useApp((s) => s.catalogo);
  const errorCarga = useApp((s) => s.errorCarga);
  const { set, elegirProducto, empezarLibre } = useApp.getState();
  const unidad = useApp((s) => s.unidad);
  const [categoria, setCategoria] = useState<string>('todas');
  const [buscar, setBuscar] = useState('');
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const cerrar = () => set({ modal: null });

  const grupos = useMemo(() => {
    if (!catalogo) return [];
    const mapa = new Map<string, Grupo>();
    for (const p of catalogo.productos) {
      const clave = `${p.categoria}|${p.modelo}`;
      if (!mapa.has(clave)) mapa.set(clave, { clave, modelo: p.modelo, categoria: p.categoria, variantes: [] });
      mapa.get(clave)!.variantes.push(p);
    }
    return [...mapa.values()];
  }, [catalogo]);

  const filtrados = grupos.filter(
    (g) =>
      (categoria === 'todas' || g.categoria === categoria) &&
      (!buscar.trim() || `${g.modelo} ${g.variantes.map((v) => v.variante).join(' ')}`.toLowerCase().includes(buscar.trim().toLowerCase())),
  );
  const prioridad = ['cocina', 'closets', 'comodas', 'tocadores', 'escritorios', 'tocadores-infantiles', 'cocinas-infantiles'];
  const posicion = (id: string) => (prioridad.includes(id) ? prioridad.indexOf(id) : prioridad.length);
  const categorias = (catalogo?.categorias.filter((c) => grupos.some((g) => g.categoria === c.id)) ?? []).sort(
    (a, b) => posicion(a.id) - posicion(b.id),
  );

  const libres: Plantilla[] = ['cocina', 'closet', 'comoda', 'tocador', 'escritorio', 'cocina-infantil'];

  return (
    <Modal titulo="Elige el mueble a diseñar" onCerrar={cerrar} ancho="grande">
      {errorCarga && <p className="error">No se pudo cargar el catálogo: {errorCarga}</p>}
      {!catalogo && !errorCarga && <p className="tenue">Cargando productos de la tienda…</p>}
      {catalogo && (
        <>
          <div className="catalogo-barra">
            <input type="search" placeholder="Buscar mueble o color…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar en el catálogo" />
            <span className="fuente-catalogo">
              {catalogo.fuente === 'tienda' ? '● En vivo desde detoditooutlet.cl' : '● Copia local (la tienda no respondió)'} · {catalogo.productos.length} productos
            </span>
          </div>
          <div className="chips" role="tablist" aria-label="Categorías">
            <button type="button" role="tab" aria-selected={categoria === 'todas'} className={categoria === 'todas' ? 'activa' : ''} onClick={() => setCategoria('todas')}>
              Todas
            </button>
            {categorias.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={categoria === c.id} className={categoria === c.id ? 'activa' : ''} onClick={() => setCategoria(c.id)}>
                {c.nombre}
              </button>
            ))}
          </div>
          <div className="grilla-productos">
            {filtrados.map((g) => {
              const p = g.variantes.find((v) => v.id === elegidas[g.clave]) ?? g.variantes[0];
              const precio = p.precio_oferta ?? p.precio;
              const m = p.medidasBase;
              return (
                <article key={g.clave} className="tarjeta-producto">
                  <button type="button" className="tarjeta-producto-foto" onClick={() => elegirProducto(p)} aria-label={`Diseñar ${p.nombre}`}>
                    {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{NOMBRE_PLANTILLA[p.plantilla]}</span>}
                    {p.personalizable && <span className="etiqueta">Personalizable</span>}
                  </button>
                  <div className="tarjeta-producto-cuerpo">
                    <h3>{g.modelo}</h3>
                    <p className="tenue chico">
                      {formatear(m.ancho, unidad, false)} × {formatear(m.alto, unidad, false)} × {formatear(m.profundidad, unidad)}
                      {m.estimadas ? ' aprox.' : ''}
                    </p>
                    {g.variantes.length > 1 && (
                      <select
                        aria-label="Variante"
                        value={p.id}
                        onChange={(e) => setElegidas((x) => ({ ...x, [g.clave]: Number(e.target.value) }))}
                      >
                        {g.variantes.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variante ?? v.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="tarjeta-producto-pie">
                      <span className="precio-chico">
                        {formatoPrecio(precio)}
                        {p.precio_oferta && <s>{formatoPrecio(p.precio)}</s>}
                      </span>
                      <button type="button" className="boton primario chico" onClick={() => elegirProducto(p)}>
                        Diseñar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!filtrados.length && <p className="tenue">No hay productos que coincidan.</p>}
          </div>
          <div className="desde-cero">
            <h3>O empieza desde cero</h3>
            <div className="fila-botones">
              {libres.map((pl) => (
                <button key={pl} type="button" className="boton secundario chico" onClick={() => empezarLibre(pl)}>
                  {NOMBRE_PLANTILLA[pl]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------- Inicio de sesión ----------

export function ModalAuth() {
  const modo = useApp((s) => s.modoAuth);
  const { set, iniciarSesion, avisar } = useApp.getState();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = modo === 'login' ? await api.login(email, password) : await api.registro(nombre, email, password);
      iniciarSesion(r.token, r.usuario);
      avisar(modo === 'login' ? `¡Hola, ${r.usuario.nombre}!` : 'Cuenta creada. Ya puedes guardar tus diseños.');
      const tras = useApp.getState().trasAuth;
      if (tras) set({ modal: tras, trasAuth: null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} onCerrar={() => set({ modal: null, trasAuth: null })}>
      <div className="segmentado ancho" role="tablist">
        <button type="button" role="tab" aria-selected={modo === 'login'} className={modo === 'login' ? 'activo' : ''} onClick={() => set({ modoAuth: 'login' })}>
          Iniciar sesión
        </button>
        <button type="button" role="tab" aria-selected={modo === 'registro'} className={modo === 'registro' ? 'activo' : ''} onClick={() => set({ modoAuth: 'registro' })}>
          Crear cuenta
        </button>
      </div>
      <form className="formulario" onSubmit={enviar}>
        {modo === 'registro' && (
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required minLength={2} />
          </label>
        )}
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={modo === 'registro' ? 8 : 1}
          />
          {modo === 'registro' && <small className="tenue">Mínimo 8 caracteres.</small>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="boton primario ancho" disabled={enviando}>
          {enviando ? 'Enviando…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <p className="tenue chico centrado">Con tu cuenta guardas tus diseños y los retomas desde cualquier equipo.</p>
      </form>
    </Modal>
  );
}

// ---------- Guardar ----------

export function ModalGuardar() {
  const s = useApp();
  const [nombre, setNombre] = useState(
    s.nombreGuardado || `${s.producto?.modelo ?? NOMBRE_PLANTILLA[s.diseno.plantilla]} ${formatear(s.diseno.ancho, s.unidad)}`,
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async (comoNuevo: boolean) => {
    if (!s.token) return;
    setEnviando(true);
    setError(null);
    try {
      const datos = {
        nombre: nombre.trim() || 'Mi diseño',
        productoId: s.producto?.id ?? null,
        config: s.diseno,
        miniatura: s.capturar?.() ?? null,
      };
      const r =
        s.guardadoId && !comoNuevo ? await api.actualizarDiseno(s.token, s.guardadoId, datos) : await api.crearDiseno(s.token, datos);
      s.set({ guardadoId: r.diseno.id, nombreGuardado: r.diseno.nombre, modal: null });
      s.avisar('Diseño guardado en tu cuenta');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal titulo="Guardar diseño" onCerrar={() => s.set({ modal: null })}>
      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
      >
        <label>
          Nombre del diseño
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="fila-botones">
          <button type="submit" className="boton primario" disabled={enviando}>
            {s.guardadoId ? 'Actualizar' : 'Guardar'}
          </button>
          {s.guardadoId && (
            <button type="button" className="boton secundario" disabled={enviando} onClick={() => guardar(true)}>
              Guardar como copia
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---------- Mis diseños ----------

export function ModalMisDisenos() {
  const s = useApp();
  const [lista, setLista] = useState<DisenoGuardado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!s.token) return;
    api
      .disenos(s.token)
      .then((r) => setLista(r.disenos))
      .catch((e) => setError((e as Error).message));
  }, [s.token]);
  const borrar = async (id: number) => {
    if (!s.token || !confirm('¿Eliminar este diseño?')) return;
    try {
      await api.borrarDiseno(s.token, id);
      setLista((l) => l?.filter((d) => d.id !== id) ?? null);
      if (s.guardadoId === id) s.set({ guardadoId: null, nombreGuardado: '' });
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    }
  };
  return (
    <Modal titulo="Mis diseños" onCerrar={() => s.set({ modal: null })} ancho="grande">
      {error && <p className="error">{error}</p>}
      {!lista && !error && <p className="tenue">Cargando…</p>}
      {lista && lista.length === 0 && <p className="tenue">Aún no guardas diseños. Usa «Guardar» en el panel inferior.</p>}
      {lista && lista.length > 0 && (
        <div className="grilla-productos">
          {lista.map((d) => (
            <article key={d.id} className="tarjeta-producto">
              <button type="button" className="tarjeta-producto-foto" onClick={() => s.cargarGuardado(d.id, d.nombre, d.config, d.productoId)}>
                {d.miniatura ? <img src={d.miniatura} alt="" /> : <span>{NOMBRE_PLANTILLA[d.config.plantilla]}</span>}
              </button>
              <div className="tarjeta-producto-cuerpo">
                <h3>{d.nombre}</h3>
                <p className="tenue chico">
                  {formatear(d.config.ancho, s.unidad, false)} × {formatear(d.config.alto, s.unidad, false)} × {formatear(d.config.profundidad, s.unidad)}
                </p>
                <p className="tenue chico">Actualizado {new Date(d.actualizado.replace(' ', 'T') + 'Z').toLocaleString('es-CL')}</p>
                <div className="tarjeta-producto-pie">
                  <button type="button" className="boton-icono peligro" aria-label={`Eliminar ${d.nombre}`} onClick={() => borrar(d.id)}>
                    <IcoBasura width={16} height={16} />
                  </button>
                  <button type="button" className="boton primario chico" onClick={() => s.cargarGuardado(d.id, d.nombre, d.config, d.productoId)}>
                    Abrir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------- Cotizar ----------

export function ModalCotizar() {
  const s = useApp();
  const precio = precioReferencial(s.diseno, s.producto, s.disenoBase);
  const resumen = resumenDiseno(s.diseno, s.producto, s.unidad, s.materiales, precio);
  const [nombre, setNombre] = useState(s.usuario?.nombre ?? '');
  const [telefono, setTelefono] = useState('');
  const [comentario, setComentario] = useState('');
  const numero = s.catalogo?.whatsapp ?? '56931719740';

  const enviar = () => {
    let texto = resumen;
    if (comentario.trim()) texto += `\n• Comentario: ${comentario.trim()}`;
    if (nombre.trim()) texto += `\nMi nombre: ${nombre.trim()}`;
    if (telefono.trim()) texto += ` · Teléfono: ${telefono.trim()}`;
    // Se registra la cotización (no bloquea si falla).
    api
      .cotizar(s.token, {
        nombre: nombre.trim() || undefined,
        telefono: telefono.trim() || undefined,
        comentario: comentario.trim() || undefined,
        productoId: s.producto?.id ?? null,
        config: s.diseno,
        resumen: texto,
      })
      .catch(() => undefined);
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    s.set({ modal: null });
    s.avisar('Abrimos WhatsApp con el resumen de tu diseño');
  };

  return (
    <Modal titulo="Cotizar mi diseño" onCerrar={() => s.set({ modal: null })}>
      <div className="formulario">
        <pre className="resumen">{resumen}</pre>
        <div className="fila-campos">
          <label>
            Tu nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
          </label>
          <label>
            Teléfono
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" inputMode="tel" />
          </label>
        </div>
        <label>
          Comentario (opcional)
          <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comuna de despacho, plazos, dudas…" />
        </label>
        <div className="fila-botones">
          <button type="button" className="boton wsp" onClick={enviar}>
            <IcoWsp /> Enviar a Rachel por WhatsApp
          </button>
          <button
            type="button"
            className="boton secundario"
            onClick={() => navigator.clipboard?.writeText(resumen).then(() => s.avisar('Resumen copiado'), () => s.avisar('No se pudo copiar', 'error'))}
          >
            Copiar resumen
          </button>
        </div>
        {precio && <p className="tenue chico">Precio referencial {formatoPrecio(precio)}. El valor final lo confirma la tienda.</p>}
      </div>
    </Modal>
  );
}
