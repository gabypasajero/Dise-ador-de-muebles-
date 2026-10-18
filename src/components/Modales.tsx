import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { formatear, formatoPrecio } from '../../shared/reglas';
import type { Plantilla, ProductoCatalogo } from '../../shared/tipos';
import { useApp } from '../store/useApp';
import { IcoX } from './Iconos';

export function Modal({
  titulo,
  onCerrar,
  children,
  ancho,
  pie,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: 'grande' | 'medio';
  /** Botones fijos al pie del modal. */
  pie?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  // onCerrar suele ser una función nueva en cada render: se guarda en una ref para que el efecto
  // corra solo al abrir. Si dependiera de onCerrar, cada letra escrita movería el foco fuera del campo.
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero =
      caja.current?.querySelector<HTMLElement>('.modal-cuerpo input, .modal-cuerpo select, .modal-cuerpo textarea') ??
      caja.current?.querySelector<HTMLElement>('input, button, select, textarea');
    primero?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      previo?.focus?.();
    };
  }, []);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal-fondo" onClick={onCerrar} />
      <div ref={caja} className={`modal-caja${ancho ? ` ${ancho}` : ''}`}>
        <div className="modal-cabeza">
          <h2>{titulo}</h2>
          <button type="button" className="boton-icono" aria-label="Cerrar" onClick={onCerrar}>
            <IcoX />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
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

  const libres: Plantilla[] = ['cocina', 'compacto', 'closet', 'comoda', 'tocador', 'escritorio', 'cocina-infantil'];

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
