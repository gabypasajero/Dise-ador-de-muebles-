// Registro de cotizaciones y ventas del vendedor.
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { formatoPrecio, precioReferencial } from '../../shared/reglas';
import { detalleCotizacion, formatoFecha, hoy, textoCotizacion } from '../../shared/resumen';
import type { Cliente, Cotizacion, DatosCotizacion, EstadoCotizacion } from '../../shared/tipos';
import { compartirPdf, enlaceCorreo, enlaceWhatsapp, puedeCompartirArchivos, type ServicioCorreo } from '../cotizacion/enviar';
import { descargarPdf, type DatosDocumento } from '../cotizacion/pdf';
import { backend, calcularTotales } from '../datos';
import { useApp } from '../store/useApp';
import { IcoWsp } from './Iconos';
import { Modal } from './Modales';

const NOMBRE_ESTADO: Record<EstadoCotizacion, string> = {
  cotizada: 'Cotizada',
  vendida: 'Vendida',
  anulada: 'Anulada',
};

const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Otro'];

function Estado({ estado }: { estado: EstadoCotizacion }) {
  return <span className={`estado-cotizacion ${estado}`}>{NOMBRE_ESTADO[estado]}</span>;
}

/** Campo de dinero en pesos con separador de miles. */
function CampoPesos({ valor, onCambio, etiqueta, ayuda }: { valor: number; onCambio: (n: number) => void; etiqueta: string; ayuda?: string }) {
  return (
    <label>
      {etiqueta}
      <span className="campo-pesos">
        <span aria-hidden="true">$</span>
        <input
          inputMode="numeric"
          value={valor ? valor.toLocaleString('es-CL') : ''}
          onChange={(e) => onCambio(Number(e.target.value.replace(/\D/g, '')) || 0)}
          required
          placeholder="0"
        />
      </span>
      {ayuda && <small className="tenue">{ayuda}</small>}
    </label>
  );
}

// ---------- Documento (vista en lista) ----------

export function datosDocumento(c: Cotizacion): DatosDocumento {
  return {
    numero: c.numero,
    cliente: c.cliente,
    detalle: c.detalle,
    observaciones: c.observaciones,
    vendedor: c.vendedor.nombre,
    vendedorTelefono: c.vendedor.telefono,
    fecha: c.fecha,
    valor: c.valor,
    estado: c.estado,
    venta: c.venta,
    miniatura: c.miniatura,
  };
}

export function DocumentoCotizacion({ datos, acciones }: { datos: DatosDocumento; acciones?: ReactNode }) {
  const c = datos.cliente;
  return (
    <article className="documento-cotizacion">
      <header className="documento-cabeza">
        <div className="marca">
          <span className="logo">DTO</span>
          <span className="marca-texto">
            <strong>De Todito Outlet</strong>
            <small>Muebles a medida</small>
          </span>
        </div>
        <div className="documento-numero">
          <span>{datos.numero ? `N° ${datos.numero}` : 'Vista previa'}</span>
          {datos.estado && <Estado estado={datos.estado} />}
        </div>
      </header>
      <h3 className="documento-titulo">Cotización {c.nombre || '…'}</h3>
      {datos.miniatura && <img className="documento-imagen" src={datos.miniatura} alt="Vista 3D del mueble cotizado" />}
      <ul className="documento-lista">
        <li>
          <span>Cliente:</span> {c.nombre || '—'}
        </li>
        {c.telefono && (
          <li>
            <span>Teléfono:</span> {c.telefono}
          </li>
        )}
        {c.email && (
          <li>
            <span>Correo:</span> {c.email}
          </li>
        )}
        {c.direccion && (
          <li>
            <span>Dirección / comuna:</span> {c.direccion}
          </li>
        )}
        {datos.detalle.map((l) => (
          <li key={l.etiqueta}>
            <span>{l.etiqueta}:</span> {l.valor}
            {l.sub && l.sub.length > 0 && (
              <ul>
                {l.sub.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {datos.observaciones && (
          <li>
            <span>Observaciones:</span> {datos.observaciones}
          </li>
        )}
      </ul>
      <dl className="documento-cierre">
        <div>
          <dt>Vendedor</dt>
          <dd>
            {datos.vendedor}
            {datos.vendedorTelefono ? ` · ${datos.vendedorTelefono}` : ''}
          </dd>
        </div>
        <div>
          <dt>Fecha cotización</dt>
          <dd>{formatoFecha(datos.fecha)}</dd>
        </div>
        <div className="documento-valor">
          <dt>Valor mueble</dt>
          <dd>{formatoPrecio(datos.valor)}</dd>
        </div>
      </dl>
      {datos.venta && (
        <p className="documento-venta">
          Venta registrada el {formatoFecha(datos.venta.fecha)} por {formatoPrecio(datos.venta.valor)}
          {datos.venta.medioPago ? ` · ${datos.venta.medioPago}` : ''}
          {datos.venta.nota ? ` · ${datos.venta.nota}` : ''}
        </p>
      )}
      {acciones}
    </article>
  );
}

// ---------- Descargar, imprimir y enviar (al final de la cotización) ----------

function AccionesEnvio({ c }: { c: Cotizacion }) {
  const avisar = useApp((s) => s.avisar);
  const [menuCorreo, setMenuCorreo] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const compartible = useMemo(() => puedeCompartirArchivos(), []);
  const datos = datosDocumento(c);

  useEffect(() => {
    if (!menuCorreo) return;
    const fuera = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setMenuCorreo(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menuCorreo]);

  const descargar = () => {
    try {
      descargarPdf(datos);
    } catch (e) {
      avisar(`No se pudo generar el PDF: ${(e as Error).message}`, 'error');
    }
  };
  const imprimir = () => {
    document.body.classList.add('imprimiendo');
    window.print();
    document.body.classList.remove('imprimiendo');
  };
  const correo = (servicio: ServicioCorreo) => {
    setMenuCorreo(false);
    // Los enlaces de correo no pueden adjuntar archivos: se descarga el PDF para adjuntarlo.
    descargar();
    if (servicio === 'app') window.location.href = enlaceCorreo(c, servicio);
    else window.open(enlaceCorreo(c, servicio), '_blank', 'noopener');
    avisar('Se descargó el PDF: adjúntalo al correo antes de enviarlo', 'info');
  };
  const whatsapp = () => {
    window.open(enlaceWhatsapp(c), '_blank', 'noopener');
    if (!c.cliente.telefono) avisar('La cotización no tiene teléfono: elige el contacto en WhatsApp', 'info');
  };
  const compartir = async () => {
    try {
      await compartirPdf(c, datos);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') avisar('No se pudo compartir el PDF', 'error');
    }
  };

  return (
    <section className="documento-acciones no-imprimir" aria-label="Descargar, imprimir o enviar la cotización">
      <span className="campo-etiqueta">Descargar, imprimir o enviar</span>
      <div className="fila-botones">
        <button type="button" className="boton primario" onClick={descargar}>
          Descargar PDF
        </button>
        <button type="button" className="boton secundario" onClick={imprimir}>
          Imprimir
        </button>
        <div className="menu-correo" ref={menu}>
          <button type="button" className="boton secundario" aria-haspopup="menu" aria-expanded={menuCorreo} onClick={() => setMenuCorreo((v) => !v)}>
            Enviar por correo ▾
          </button>
          {menuCorreo && (
            <div className="menu-desplegable" role="menu">
              <div className="menu-cabeza">
                <strong>{c.cliente.email || 'Sin correo del cliente'}</strong>
                <small>Se descarga el PDF para adjuntarlo</small>
              </div>
              <button type="button" role="menuitem" onClick={() => correo('gmail')}>
                Gmail
              </button>
              <button type="button" role="menuitem" onClick={() => correo('outlook')}>
                Outlook
              </button>
              <button type="button" role="menuitem" onClick={() => correo('app')}>
                App de correo del equipo
              </button>
            </div>
          )}
        </div>
        <button type="button" className="boton wsp" onClick={whatsapp}>
          <IcoWsp /> WhatsApp
        </button>
        {compartible && (
          <button type="button" className="boton secundario" onClick={compartir}>
            Compartir PDF
          </button>
        )}
      </div>
    </section>
  );
}

// ---------- Registrar / actualizar cotización ----------

export function ModalRegistrarCotizacion() {
  const s = useApp();
  const actual =
    s.cotizacionActual && s.cotizacionActual.estado === 'cotizada' && s.cotizacionActual.vendedor.id === s.usuario?.id ? s.cotizacionActual : null;
  const referencial = precioReferencial(s.diseno, s.producto, s.disenoBase);
  const [cliente, setCliente] = useState<Cliente>(actual?.cliente ?? { nombre: '', telefono: '', email: '', direccion: '' });
  const [observaciones, setObservaciones] = useState(actual?.observaciones ?? '');
  const [valor, setValor] = useState<number>(actual?.valor ?? referencial ?? 0);
  const [fecha, setFecha] = useState(actual?.fecha ?? hoy());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detalle = useMemo(() => detalleCotizacion(s.diseno, s.producto, s.unidad, s.materiales), [s.diseno, s.producto, s.unidad, s.materiales]);
  const modelo = s.producto?.modelo ?? (s.diseno.nombreModelo || NOMBRE_PLANTILLA[s.diseno.plantilla]);
  const set = (k: keyof Cliente, v: string) => setCliente((c) => ({ ...c, [k]: v }));

  const registrar = async (comoNueva: boolean) => {
    if (!s.usuario?.esVendedor) {
      setError('Tu cuenta es de administración: para cotizar ingresa con una cuenta de vendedor.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const datos: DatosCotizacion = {
        cliente: { nombre: cliente.nombre.trim(), telefono: cliente.telefono?.trim() || null, email: cliente.email?.trim() || null, direccion: cliente.direccion?.trim() || null },
        observaciones: observaciones.trim() || null,
        productoId: s.producto?.id ?? null,
        modelo,
        config: s.diseno,
        detalle,
        miniatura: s.capturar?.() ?? null,
        valor,
        fecha,
      };
      const r = actual && !comoNueva ? await backend.actualizarCotizacion(actual.id, datos) : await backend.crearCotizacion(datos);
      const { config: _c, miniatura: _m, ...resumen } = r;
      s.set({ cotizacionActual: resumen, cotizacionVista: r, modal: 'documento' });
      s.avisar(actual && !comoNueva ? `Cotización ${r.numero} actualizada` : `Cotización ${r.numero} registrada`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={actual ? `Actualizar cotización ${actual.numero}` : 'Registrar cotización'} onCerrar={() => s.set({ modal: null })} ancho="grande">
      <div className="registro-cotizacion">
        <form
          className="formulario"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            registrar(false);
          }}
        >
          <h3 className="subtitulo">Datos del cliente</h3>
          <label>
            Nombre del cliente
            <input value={cliente.nombre} onChange={(e) => set('nombre', e.target.value)} required minLength={2} placeholder="Ej.: Fernando Pérez" />
          </label>
          <div className="fila-campos">
            <label>
              Teléfono
              <input value={cliente.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} inputMode="tel" placeholder="+56 9 …" />
            </label>
            <label>
              Correo
              <input type="email" value={cliente.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </label>
          </div>
          <label>
            Dirección / comuna de despacho
            <input value={cliente.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} />
          </label>
          <label>
            Observaciones
            <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Plazo de entrega, instalación, abono…" />
          </label>
          <h3 className="subtitulo">Cotización</h3>
          <div className="fila-campos">
            <CampoPesos
              etiqueta="Valor mueble"
              valor={valor}
              onCambio={setValor}
              ayuda={referencial ? `Referencial del diseñador: ${formatoPrecio(referencial)}` : undefined}
            />
            <label>
              Fecha cotización
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
          </div>
          <p className="tenue chico">Vendedor: {s.usuario?.nombre}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="fila-botones">
            <button type="submit" className="boton primario" disabled={enviando || valor <= 0}>
              {actual ? `Actualizar ${actual.numero}` : 'Registrar cotización'}
            </button>
            {actual && (
              <button type="button" className="boton secundario" disabled={enviando || valor <= 0} onClick={() => registrar(true)}>
                Registrar como nueva
              </button>
            )}
          </div>
        </form>
        <div className="registro-vista-previa">
          <span className="campo-etiqueta">Así queda la cotización</span>
          <DocumentoCotizacion
            datos={{
              numero: actual?.numero ?? null,
              cliente,
              detalle,
              observaciones: observaciones.trim() || null,
              vendedor: s.usuario?.nombre ?? '',
              vendedorTelefono: s.usuario?.telefono,
              fecha,
              valor,
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------- Documento de una cotización registrada ----------

export function ModalDocumento() {
  const s = useApp();
  const c = s.cotizacionVista;
  const [trabajando, setTrabajando] = useState(false);
  if (!c) return null;
  // La administración ve las cotizaciones de todos, pero solo el vendedor las gestiona.
  const propia = s.usuario?.esVendedor && c.vendedor.id === s.usuario.id;

  const abrir = async () => {
    setTrabajando(true);
    try {
      s.cargarCotizacion(await backend.cotizacion(c.id));
      s.avisar(`Diseño de ${c.numero} cargado`, 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    } finally {
      setTrabajando(false);
    }
  };
  const cambiarEstado = async (estado: 'cotizada' | 'anulada') => {
    if (estado === 'anulada' && !confirm(`¿Anular la cotización ${c.numero}?`)) return;
    setTrabajando(true);
    try {
      const r = await backend.cambiarEstado(c.id, estado);
      s.set({ cotizacionVista: { ...r, miniatura: c.miniatura } });
      if (s.cotizacionActual?.id === c.id) s.set({ cotizacionActual: { ...s.cotizacionActual, estado: r.estado, venta: null } });
      s.avisar(estado === 'anulada' ? 'Cotización anulada' : 'Cotización reactivada', 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    } finally {
      setTrabajando(false);
    }
  };
  const copiar = () =>
    navigator.clipboard?.writeText(textoCotizacion(c)).then(
      () => s.avisar('Cotización copiada'),
      () => s.avisar('No se pudo copiar', 'error'),
    );

  return (
    <Modal
      titulo={`Cotización ${c.numero}`}
      onCerrar={() => s.set({ modal: null })}
      ancho="medio"
      pie={
        <div className="acciones-documento">
          {propia && c.estado === 'cotizada' && (
            <button type="button" className="boton primario" disabled={trabajando} onClick={() => s.set({ modal: 'venta' })}>
              Registrar venta
            </button>
          )}
          <button type="button" className="boton secundario" disabled={trabajando} onClick={abrir}>
            Abrir en el diseñador
          </button>
          <button type="button" className="boton fantasma" onClick={copiar}>
            Copiar texto
          </button>
          {propia && c.estado === 'cotizada' && (
            <button type="button" className="boton fantasma peligro" disabled={trabajando} onClick={() => cambiarEstado('anulada')}>
              Anular
            </button>
          )}
          {propia && c.estado !== 'cotizada' && (
            <button type="button" className="boton fantasma" disabled={trabajando} onClick={() => cambiarEstado('cotizada')}>
              {c.estado === 'vendida' ? 'Deshacer venta' : 'Reactivar'}
            </button>
          )}
          <button type="button" className="boton fantasma" onClick={() => s.set({ modal: 'cotizaciones' })}>
            {s.usuario?.esAdmin && !s.usuario.esVendedor ? 'Ver registro' : 'Ver mis cotizaciones'}
          </button>
        </div>
      }
    >
      <DocumentoCotizacion datos={datosDocumento(c)} acciones={<AccionesEnvio c={c} />} />
    </Modal>
  );
}

// ---------- Registrar venta ----------

export function ModalVenta() {
  const s = useApp();
  const c = s.cotizacionVista;
  const [fecha, setFecha] = useState(hoy());
  const [valor, setValor] = useState(c?.valor ?? 0);
  const [medioPago, setMedioPago] = useState(MEDIOS_PAGO[0]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!c) return null;
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await backend.registrarVenta(c.id, { fecha, valor, medioPago, nota: nota.trim() || null });
      s.set({ cotizacionVista: { ...r, miniatura: c.miniatura }, modal: 'documento' });
      if (s.cotizacionActual?.id === c.id) s.set({ cotizacionActual: { ...s.cotizacionActual, estado: 'vendida', venta: r.venta } });
      s.avisar(`Venta de ${c.numero} registrada`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal titulo={`Registrar venta · ${c.numero}`} onCerrar={() => s.set({ modal: 'documento' })}>
      <form className="formulario" onSubmit={enviar}>
        <p className="tenue">
          Cotización {c.cliente.nombre} · {c.modelo} · {formatoPrecio(c.valor)}
        </p>
        <div className="fila-campos">
          <label>
            Fecha de venta
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <CampoPesos etiqueta="Valor de venta" valor={valor} onCambio={setValor} />
        </div>
        <label>
          Medio de pago
          <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
            {MEDIOS_PAGO.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Nota (opcional)
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Abono, fecha de despacho…" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="boton primario" disabled={enviando || valor <= 0}>
          Confirmar venta
        </button>
      </form>
    </Modal>
  );
}

// ---------- Registro de cotizaciones y ventas ----------

export function ModalCotizaciones() {
  const s = useApp();
  const [lista, setLista] = useState<Cotizacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoCotizacion | 'todas'>('todas');
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    backend
      .cotizaciones()
      .then(setLista)
      .catch((e) => setError((e as Error).message));
  }, []);
  const totales = lista ? calcularTotales(lista) : null;
  const esAdmin = Boolean(s.usuario?.esAdmin);

  const abrir = async (c: Cotizacion) => {
    try {
      s.cargarCotizacion(await backend.cotizacion(c.id));
      s.avisar(`Diseño de ${c.numero} cargado`, 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    }
  };

  const q = buscar.trim().toLowerCase();
  const visibles = (lista ?? []).filter(
    (c) =>
      (filtro === 'todas' || c.estado === filtro) &&
      (!q || `${c.numero} ${c.cliente.nombre} ${c.modelo} ${c.vendedor.nombre}`.toLowerCase().includes(q)),
  );
  const cierre = totales && totales.cotizaciones ? Math.round((totales.ventas / totales.cotizaciones) * 100) : 0;

  return (
    <Modal
      titulo={esAdmin ? 'Registro de todos los vendedores' : `Registro de ${s.usuario?.nombre ?? 'vendedor'}`}
      onCerrar={() => s.set({ modal: null })}
      ancho="grande"
    >
      {error && <p className="error">{error}</p>}
      {totales && (
        <div className="totales">
          <div>
            <span className="campo-etiqueta">Cotizaciones vigentes</span>
            <strong>{totales.cotizaciones}</strong>
            <span className="tenue chico">{formatoPrecio(totales.montoCotizado)} cotizado</span>
          </div>
          <div>
            <span className="campo-etiqueta">Ventas</span>
            <strong>{totales.ventas}</strong>
            <span className="tenue chico">{formatoPrecio(totales.montoVendido)} vendido</span>
          </div>
          <div>
            <span className="campo-etiqueta">Cierre</span>
            <strong>{cierre}%</strong>
            <span className="tenue chico">de las cotizaciones vigentes</span>
          </div>
        </div>
      )}
      <div className="catalogo-barra">
        <input type="search" placeholder={esAdmin ? 'Buscar por cliente, vendedor, N° o modelo…' : 'Buscar por cliente, N° o modelo…'} value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar cotización" />
        <div className="chips" role="tablist" aria-label="Estado">
          {(['todas', 'cotizada', 'vendida', 'anulada'] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filtro === f} className={filtro === f ? 'activa' : ''} onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : `${NOMBRE_ESTADO[f]}s`}
            </button>
          ))}
        </div>
      </div>
      {!lista && !error && <p className="tenue">Cargando…</p>}
      {lista && lista.length === 0 && (
        <p className="tenue">Aún no registras cotizaciones. Diseña el mueble con tu cliente y usa «Registrar cotización».</p>
      )}
      {lista && lista.length > 0 && (
        <div className={`tabla-cotizaciones${esAdmin ? ' con-vendedor' : ''}`} role="table" aria-label="Cotizaciones">
          <div className="fila cabeza" role="row">
            <span role="columnheader">N°</span>
            <span role="columnheader">Cliente</span>
            {esAdmin && <span role="columnheader">Vendedor</span>}
            <span role="columnheader">Mueble</span>
            <span role="columnheader">Fecha</span>
            <span role="columnheader">Valor</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" />
          </div>
          {visibles.map((c) => (
            <div key={c.id} className="fila" role="row">
              <span role="cell" className="numero">
                {c.numero}
              </span>
              <span role="cell">
                <strong>{c.cliente.nombre}</strong>
                {c.cliente.telefono && <small className="tenue">{c.cliente.telefono}</small>}
              </span>
              {esAdmin && <span role="cell">{c.vendedor.nombre}</span>}
              <span role="cell" className="modelo">
                {c.miniatura && <img src={c.miniatura} alt="" />}
                {c.modelo}
              </span>
              <span role="cell">{formatoFecha(c.fecha)}</span>
              <span role="cell" className="monto">
                {formatoPrecio(c.venta?.valor ?? c.valor)}
              </span>
              <span role="cell">
                <Estado estado={c.estado} />
              </span>
              <span role="cell" className="acciones-fila">
                <button type="button" className="boton secundario chico" onClick={() => s.verCotizacion(c)}>
                  Ver
                </button>
                <button type="button" className="boton fantasma chico" onClick={() => abrir(c)}>
                  Abrir diseño
                </button>
                {c.estado === 'cotizada' && c.vendedor.id === s.usuario?.id && (
                  <button type="button" className="boton primario chico" onClick={() => s.set({ cotizacionVista: c, modal: 'venta' })}>
                    Vender
                  </button>
                )}
              </span>
            </div>
          ))}
          {visibles.length === 0 && <p className="tenue">No hay cotizaciones con ese filtro.</p>}
        </div>
      )}
    </Modal>
  );
}

