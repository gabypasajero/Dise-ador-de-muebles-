// Registro de cotizaciones y ventas del vendedor.
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { aplicarAjustes, formatoPrecio, precioDiseno } from '../../shared/reglas';
import { detalleCotizacion, formatoFecha, hoy } from '../../shared/resumen';
import type { SeccionFicha, TablaFicha } from '../../shared/resumen';
import type { Cliente, Cotizacion, DatosCotizacion, EstadoCotizacion } from '../../shared/tipos';
import { compartirPdf, enlaceCorreo, enlaceWhatsapp, puedeCompartirArchivos, type ServicioCorreo } from '../cotizacion/enviar';
import {
  contenidoHoja,
  descargarHojaMaestro,
  esquemaSvg,
  hojaMaestroComoArchivo,
  leyendaEsquema,
  renglonesCelda,
  tablaDeLineas,
  type DatosHojaMaestro,
} from '../cotizacion/hojaMaestro';
import { reducirImagen } from '../cotizacion/imagen';
import { LISTA_MARCAS, MARCAS, marcaDe, recordarMarca, textoCotizacionMarca, ultimaMarca, type Marca } from '../cotizacion/marcas';
import { datosCliente, descargarPdf, type DatosDocumento } from '../cotizacion/pdf';
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

/** La cotización sin la imagen grande (para guardarla como cotización en edición o borrador). */
function sinImagen<T extends { imagen?: string | null }>(c: T): Omit<T, 'imagen'> {
  const { imagen: _imagen, ...resto } = c;
  return resto;
}

/** Logo de la marca: el distintivo rosado DTO o la casa de colores de Molina. */
export function LogoMarca({ marca }: { marca: Marca }) {
  if (marca === 'molina') return <img className="logo logo-molina" src={MARCAS.molina.logo} alt="" width={40} height={40} />;
  return (
    <span className="logo" aria-hidden="true">
      DTO
    </span>
  );
}

/** Elección de la marca con la que se emite la cotización. */
function SelectorMarca({ marca, onCambio }: { marca: Marca; onCambio: (m: Marca) => void }) {
  return (
    <fieldset className="selector-marca">
      <legend className="campo-etiqueta">Marca de la cotización</legend>
      <div className="selector-marca-opciones" role="radiogroup" aria-label="Marca de la cotización">
        {LISTA_MARCAS.map((m) => (
          <label key={m.id} className={`opcion-marca${marca === m.id ? ' activa' : ''}`}>
            <input type="radio" name="marca-cotizacion" value={m.id} checked={marca === m.id} onChange={() => onCambio(m.id)} />
            <LogoMarca marca={m.id} />
            <span>{m.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Descarga la hoja para el maestro y avisa si algo falla. */
function hojaMaestro(datos: DatosHojaMaestro, avisar: (texto: string, tipo?: 'ok' | 'error' | 'info') => void) {
  try {
    descargarHojaMaestro(datos);
  } catch (e) {
    avisar(`No se pudo generar la hoja para el maestro: ${(e as Error).message}`, 'error');
  }
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
    imagen: c.imagen ?? null,
    marca: marcaDe(c),
  };
}

export function DocumentoCotizacion({ datos, acciones }: { datos: DatosDocumento; acciones?: ReactNode }) {
  const c = datos.cliente;
  const marca = datos.marca ?? 'dto';
  const m = MARCAS[marca];
  const imagen = datos.imagen || datos.miniatura;
  return (
    <article className="documento-cotizacion" data-marca={marca}>
      <header className="documento-cabeza">
        <div className="marca">
          <LogoMarca marca={marca} />
          <span className="marca-texto">
            <strong>{m.nombre}</strong>
            <small>{[m.lema, m.web].filter(Boolean).join(' · ')}</small>
          </span>
        </div>
        <div className="documento-numero">
          <span>{datos.numero ? `N° ${datos.numero}` : 'Vista previa'}</span>
          {datos.estado && <Estado estado={datos.estado} />}
        </div>
      </header>
      {imagen && <img className="documento-imagen" src={imagen} alt="Vista 3D del mueble cotizado" />}
      <h3 className="documento-titulo">Cotización {c.nombre || '…'}</h3>
      <dl className="documento-cliente">
        {datosCliente({ cliente: { ...c, nombre: c.nombre || '—' } }).map((l) => (
          <div key={l.etiqueta}>
            <dt>{l.etiqueta}:</dt>
            <dd>{l.valor}</dd>
          </div>
        ))}
      </dl>
      <ul className="documento-lista">
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

// ---------- Hoja del maestro dentro de la aplicación (mismo contenido que el PDF) ----------

function TablaHoja({ tabla }: { tabla: TablaFicha }) {
  const total = tabla.anchos.reduce((a, b) => a + b, 0);
  const conTitulos = tabla.columnas.length > 0;
  return (
    <div className="hoja-tabla-caja">
      <table className={`hoja-tabla${conTitulos ? '' : tabla.anchos[0] < 0.1 ? ' datos numerada' : ' datos'}`}>
        <colgroup>
          {tabla.anchos.map((a, i) => (
            <col key={i} style={{ width: `${(a / total) * 100}%` }} />
          ))}
        </colgroup>
        {conTitulos && (
          <thead>
            <tr>
              {tabla.columnas.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {tabla.filas.map((f, k) => (
            <tr key={k}>
              {f.celdas.map((celda, i) => {
                const renglones = renglonesCelda(tabla, i, celda).map((r, j) => (
                  <span key={j} className={`renglon${r.negrita ? ' negrita' : ''}${r.gris ? ' gris' : ''}`}>
                    {r.texto}
                  </span>
                ));
                return !conTitulos && i === 0 ? (
                  <th key={i} scope="row">
                    {renglones}
                  </th>
                ) : (
                  <td key={i} data-col={tabla.columnas[i]}>
                    {renglones}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeccionHoja({ s }: { s: SeccionFicha }) {
  return (
    <section className="hoja-seccion">
      <h4>{s.titulo}</h4>
      {s.lineas.length > 0 && <TablaHoja tabla={tablaDeLineas(s.lineas)} />}
      {s.tabla && <TablaHoja tabla={s.tabla} />}
    </section>
  );
}

/** La hoja para el maestro en HTML: lo mismo que el PDF (datos, imagen, ficha en tablas y esquemas). */
export function DocumentoHojaMaestro({ datos, antes }: { datos: DatosHojaMaestro; antes?: ReactNode }) {
  const { diseno, producto, unidad, materiales, marca } = datos;
  const contenido = useMemo(() => contenidoHoja(diseno, producto, unidad, materiales), [diseno, producto, unidad, materiales]);
  const esquemas = useMemo(
    () => contenido.muros.map((m) => ({ titulo: m.titulo, svg: esquemaSvg(m, contenido.escala, unidad, marca) })),
    [contenido, unidad, marca],
  );
  const m = MARCAS[marca];
  const numero = datos.numero ? `N° ${datos.numero}` : 'Borrador';
  const [generales, ...resto] = contenido.ficha.secciones;
  return (
    <article className="documento-cotizacion hoja-maestro" data-marca={marca} aria-label="Hoja para el maestro">
      {antes}
      <header className="documento-cabeza">
        <div className="marca">
          <LogoMarca marca={marca} />
          <span className="marca-texto">
            <strong>{m.nombre}</strong>
            <small>{[m.lema, m.web].filter(Boolean).join(' · ')}</small>
          </span>
        </div>
        <div className="documento-numero">
          <span className="hoja-tipo">Hoja para el maestro</span>
          <span>
            {numero} · {formatoFecha(datos.fecha)}
          </span>
        </div>
      </header>
      <dl className="hoja-orden">
        <div>
          <dt>Cliente</dt>
          <dd>{datos.cliente.nombre || '…'}</dd>
        </div>
        <div>
          <dt>Cotización</dt>
          <dd>{numero}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{formatoFecha(datos.fecha)}</dd>
        </div>
        <div>
          <dt>Vendedor</dt>
          <dd>
            {datos.vendedor}
            {datos.vendedorTelefono ? ` · ${datos.vendedorTelefono}` : ''}
          </dd>
        </div>
        {datos.cliente.direccion && (
          <div className="ancho">
            <dt>Despacho / instalación</dt>
            <dd>{datos.cliente.direccion}</dd>
          </div>
        )}
      </dl>
      <div>
        <h3 className="documento-titulo">{datos.modelo}</h3>
        <p className="hoja-leyenda">Documento interno para fabricar e instalar · sin precios · medidas en {unidad === 'cm' ? 'centímetros' : 'milímetros'}</p>
      </div>
      {datos.imagen && (
        <figure className="hoja-imagen">
          <img className="documento-imagen" src={datos.imagen} alt="Vista 3D del mueble" />
          <figcaption>Imagen referencial: las medidas y la distribución que valen son las de esta hoja.</figcaption>
        </figure>
      )}
      {generales && <SeccionHoja s={generales} />}
      {esquemas.length > 0 && (
        <section className="hoja-seccion">
          <h4>Esquema frontal</h4>
          <p className="hoja-leyenda">{leyendaEsquema(unidad)}</p>
          {esquemas.map((e) => (
            <figure key={e.titulo} className="hoja-esquema">
              <figcaption>{e.titulo}</figcaption>
              {/* SVG armado por esquemaSvg con números y textos fijos del motor (escapados). */}
              <div className="hoja-esquema-dibujo" dangerouslySetInnerHTML={{ __html: e.svg }} />
            </figure>
          ))}
        </section>
      )}
      {resto.map((s) => (
        <SeccionHoja key={s.titulo} s={s} />
      ))}
      {datos.observaciones && (
        <section className="hoja-seccion">
          <h4>Observaciones de la cotización</h4>
          <p className="hoja-observaciones">{datos.observaciones}</p>
        </section>
      )}
    </article>
  );
}

/** Descargar, imprimir o compartir la hoja del maestro. */
function AccionesHoja({ datos }: { datos: DatosHojaMaestro }) {
  const avisar = useApp((s) => s.avisar);
  const compartible = useMemo(() => puedeCompartirArchivos(), []);
  const imprimir = () => {
    document.body.classList.add('imprimiendo');
    window.print();
    document.body.classList.remove('imprimiendo');
  };
  const compartir = async () => {
    try {
      await navigator.share({ files: [hojaMaestroComoArchivo(datos)], title: `Hoja para el maestro ${datos.numero ?? ''}`.trim() });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') avisar('No se pudo compartir la hoja', 'error');
    }
  };
  return (
    <section className="documento-acciones hoja-acciones no-imprimir" aria-label="Descargar, imprimir o compartir la hoja del maestro">
      <span className="campo-etiqueta">Hoja del maestro · sin precios</span>
      <div className="fila-botones">
        <button type="button" className="boton primario" onClick={() => hojaMaestro(datos, avisar)}>
          Descargar PDF
        </button>
        <button type="button" className="boton secundario" onClick={imprimir}>
          Imprimir
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

/** Cotización y hoja del maestro en pestañas, para verlas sin salir de la aplicación. */
function VisorDocumentos({ cotizacion, maestro }: { cotizacion: ReactNode; maestro: ReactNode }) {
  const [pestana, setPestana] = useState<'cotizacion' | 'maestro'>('cotizacion');
  return (
    <div className="visor-documentos">
      <div className="pestanas-documento no-imprimir" role="tablist" aria-label="Documento">
        {(['cotizacion', 'maestro'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`pestana-doc-${p}`}
            aria-selected={pestana === p}
            aria-controls="panel-documento"
            className={pestana === p ? 'activa' : ''}
            onClick={() => setPestana(p)}
          >
            {p === 'cotizacion' ? 'Cotización' : 'Hoja del maestro'}
          </button>
        ))}
      </div>
      <div id="panel-documento" role="tabpanel" aria-labelledby={`pestana-doc-${pestana}`} className="panel-documento">
        {pestana === 'cotizacion' ? cotizacion : maestro}
      </div>
    </div>
  );
}

// ---------- Descargar, imprimir y enviar (al final de la cotización) ----------

function AccionesEnvio({ c, onHojaMaestro }: { c: Cotizacion; onHojaMaestro?: () => void }) {
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
        {onHojaMaestro && (
          <button type="button" className="boton secundario" onClick={onHojaMaestro}>
            Hoja para el maestro
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
  const precio = aplicarAjustes(precioDiseno(s.diseno, s.producto, s.disenoBase), s.diseno.ajustesPrecio);
  const referencial = precio?.total ?? null;
  const [cliente, setCliente] = useState<Cliente>(actual?.cliente ?? { nombre: '', telefono: '', email: '', direccion: '' });
  const [observaciones, setObservaciones] = useState(actual?.observaciones ?? '');
  const [valor, setValor] = useState<number>(actual?.valor ?? referencial ?? 0);
  const [fecha, setFecha] = useState(actual?.fecha ?? hoy());
  const [marca, setMarca] = useState<Marca>(() => (actual ? marcaDe(actual) : ultimaMarca(s.usuario?.id)));
  // La imagen del mueble se toma una vez al abrir (el diseño no cambia mientras se registra).
  const [imagen] = useState<string | null>(() => s.capturar?.() ?? null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detalle = useMemo(() => detalleCotizacion(s.diseno, s.producto, s.unidad, s.materiales), [s.diseno, s.producto, s.unidad, s.materiales]);
  const modelo = s.producto?.modelo ?? (s.diseno.nombreModelo || NOMBRE_PLANTILLA[s.diseno.plantilla]);
  const set = (k: keyof Cliente, v: string) => setCliente((c) => ({ ...c, [k]: v }));
  const elegirMarca = (m: Marca) => {
    setMarca(m);
    recordarMarca(s.usuario?.id, m);
  };
  const datosHoja: DatosHojaMaestro = {
    marca,
    numero: actual?.numero ?? null,
    cliente: { ...cliente, nombre: cliente.nombre.trim() || 'Cliente por definir' },
    fecha,
    vendedor: s.usuario?.nombre ?? '',
    vendedorTelefono: s.usuario?.telefono,
    modelo,
    imagen,
    diseno: s.diseno,
    producto: s.producto,
    materiales: s.materiales,
    unidad: s.unidad,
    observaciones: observaciones.trim() || null,
  };
  const hoja = () => hojaMaestro(datosHoja, s.avisar);

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
        miniatura: imagen ? await reducirImagen(imagen, 480) : null,
        imagen,
        marca,
        valor,
        fecha,
      };
      const r = actual && !comoNueva ? await backend.actualizarCotizacion(actual.id, datos) : await backend.crearCotizacion(datos);
      const { config: _c, miniatura: _m, imagen: _i, ...resumen } = r;
      recordarMarca(s.usuario?.id, marca);
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
          <SelectorMarca marca={marca} onCambio={elegirMarca} />
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
              ayuda={precio ? `${precio.metodo === 'oficial' ? 'Precio oficial' : 'Referencial'} del diseñador: ${formatoPrecio(precio.total)}` : undefined}
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
            <button type="button" className="boton fantasma" onClick={hoja} title="Ficha de fabricación sin precios, con el esquema acotado de cada tramo">
              Descargar hoja del maestro
            </button>
          </div>
        </form>
        <div className="registro-vista-previa">
          <span className="campo-etiqueta">Así quedan la cotización y la hoja del maestro</span>
          <VisorDocumentos
            cotizacion={
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
                  imagen,
                  marca,
                }}
              />
            }
            maestro={<DocumentoHojaMaestro datos={datosHoja} />}
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
  // La lista no trae el diseño ni la imagen grande: se piden al abrir la cotización.
  const incompleta = c && !c.config ? c.id : null;
  useEffect(() => {
    if (incompleta == null) return;
    let vigente = true;
    backend
      .cotizacion(incompleta)
      .then((completa) => {
        const vista = useApp.getState().cotizacionVista;
        if (vigente && vista?.id === completa.id) useApp.getState().set({ cotizacionVista: { ...completa, miniatura: vista.miniatura ?? completa.miniatura } });
      })
      .catch(() => {
        // Sin el diseño completo se muestra lo que trae la lista (la hoja para el maestro lo vuelve a pedir).
      });
    return () => {
      vigente = false;
    };
  }, [incompleta]);
  if (!c) return null;
  // La administración ve las cotizaciones de todos, pero solo el vendedor las gestiona.
  const propia = s.usuario?.esVendedor && c.vendedor.id === s.usuario.id;

  const abrir = async () => {
    setTrabajando(true);
    try {
      s.cargarCotizacion(sinImagen(c.config ? c : await backend.cotizacion(c.id)));
      s.avisar(`Diseño de ${c.numero} cargado`, 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    } finally {
      setTrabajando(false);
    }
  };
  // La hoja del maestro se arma con el diseño guardado (llega con la cotización completa).
  const producto = c.productoId != null ? (s.catalogo?.productos.find((p) => p.id === c.productoId) ?? null) : null;
  const datosHoja: DatosHojaMaestro | null = c.config
    ? {
        marca: marcaDe(c),
        numero: c.numero,
        cliente: c.cliente,
        fecha: c.fecha,
        vendedor: c.vendedor.nombre,
        vendedorTelefono: c.vendedor.telefono,
        modelo: c.modelo,
        imagen: c.imagen || c.miniatura,
        diseno: c.config,
        producto,
        materiales: s.materiales,
        unidad: s.unidad,
        observaciones: c.observaciones,
      }
    : null;
  const cambiarEstado = async (estado: 'cotizada' | 'anulada') => {
    if (estado === 'anulada' && !confirm(`¿Anular la cotización ${c.numero}?`)) return;
    setTrabajando(true);
    try {
      const r = await backend.cambiarEstado(c.id, estado);
      s.set({ cotizacionVista: { ...r, miniatura: c.miniatura, config: c.config, imagen: c.imagen } });
      if (s.cotizacionActual?.id === c.id) s.set({ cotizacionActual: { ...s.cotizacionActual, estado: r.estado, venta: null } });
      s.avisar(estado === 'anulada' ? 'Cotización anulada' : 'Cotización reactivada', 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    } finally {
      setTrabajando(false);
    }
  };
  const copiar = () =>
    navigator.clipboard?.writeText(textoCotizacionMarca(c)).then(
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
      <VisorDocumentos
        cotizacion={<DocumentoCotizacion datos={datosDocumento(c)} acciones={<AccionesEnvio c={c} />} />}
        maestro={
          datosHoja ? (
            <DocumentoHojaMaestro datos={datosHoja} antes={<AccionesHoja datos={datosHoja} />} />
          ) : (
            <p className="tenue">{incompleta != null ? 'Cargando el diseño de la cotización…' : 'Esta cotización no tiene el diseño guardado.'}</p>
          )
        }
      />
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
      s.set({ cotizacionVista: { ...r, miniatura: c.miniatura, config: c.config, imagen: c.imagen }, modal: 'documento' });
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
      s.cargarCotizacion(sinImagen(await backend.cotizacion(c.id)));
      s.avisar(`Diseño de ${c.numero} cargado`, 'info');
    } catch (e) {
      s.avisar((e as Error).message, 'error');
    }
  };

  const q = buscar.trim().toLowerCase();
  const visibles = (lista ?? []).filter(
    (c) =>
      (filtro === 'todas' || c.estado === filtro) &&
      (!q || `${c.numero} ${c.cliente.nombre} ${c.modelo} ${c.vendedor.nombre} ${MARCAS[marcaDe(c)].nombre}`.toLowerCase().includes(q)),
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
                <small className={`marca-fila ${marcaDe(c)}`}>{marcaDe(c) === 'molina' ? 'Molina' : 'DTO'}</small>
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

