import { useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { largoPrincipalConEsquinas } from '../../shared/layout';
import { LIMITES, advertencias, aUnidad, aplicarAjustes, formatear, formatoPrecio, limpiarAjustes, precioDiseno, type PrecioAjustado } from '../../shared/reglas';
import { nuevoId } from '../../shared/catalogo';
import type { AjustesPrecio, Diseno, Unidad } from '../../shared/tipos';
import { useApp } from '../store/useApp';
import { CampoMedida, Interruptor, Segmentado } from './Controles';
import { backend } from '../datos';
import { IcoAviso, IcoGuardar } from './Iconos';
import { PanelColores } from './PanelColores';
import { AvisoRechazo, PestanaCajones, PestanaEquipamiento, PestanaModulos, PestanaPuertas, pestanasDe } from './Pestanas';

/** Una de las tres líneas de medida (alto, ancho, profundidad). */
function FilaMedida({
  nombre,
  icono,
  valor,
  limites,
  unidad,
  onCambio,
}: {
  nombre: string;
  icono: string;
  valor: number;
  limites: [number, number];
  unidad: Unidad;
  onCambio: (mm: number) => void;
}) {
  const rango = `${aUnidad(limites[0], unidad).toLocaleString('es-CL')} a ${aUnidad(limites[1], unidad).toLocaleString('es-CL')} ${unidad}`;
  return (
    <div className="fila-medida">
      <span className="fila-medida-nombre">
        <span className="icono-medida" aria-hidden="true">
          {icono}
        </span>
        {nombre}
      </span>
      <input
        type="range"
        className="deslizador"
        aria-label={`${nombre}, deslizador de ${rango}`}
        title={rango}
        min={limites[0]}
        max={Math.min(limites[1], Math.max(valor * 2, limites[0] * 2))}
        step={unidad === 'cm' ? 10 : 1}
        value={valor}
        onChange={(e) => onCambio(Number(e.target.value))}
      />
      <CampoMedida valor={valor} unidad={unidad} onCambio={onCambio} min={limites[0]} max={limites[1]} etiqueta={nombre} ocultarEtiqueta compacto />
    </div>
  );
}

/** Lee un monto en pesos escrito por el vendedor ("-20.000", "$15000"). */
function leerPesos(t: string): number | null {
  const limpio = t.replace(/[$\s.]/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Math.round(Number(limpio));
}

/** Monto editable: clic en el valor o el lápiz → campo; Enter o salir guarda, Esc cancela. */
function MontoEditable({ valor, etiqueta, onGuardar }: { valor: number; etiqueta: string; onGuardar: (v: number) => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const cancelado = useRef(false);
  if (texto === null)
    return (
      <button type="button" className="monto-editable" aria-label={`Editar valor de ${etiqueta}`} title="Editar valor" onClick={() => setTexto(String(valor))}>
        {formatoPrecio(valor)} <span aria-hidden="true">✎</span>
      </button>
    );
  const guardar = () => {
    if (cancelado.current) {
      cancelado.current = false;
      return;
    }
    const v = leerPesos(texto);
    if (v !== null && v !== valor) onGuardar(v);
    setTexto(null);
  };
  return (
    <input
      className="campo-monto"
      inputMode="numeric"
      autoFocus
      aria-label={`Valor de ${etiqueta} en pesos`}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelado.current = true;
          setTexto(null);
        }
      }}
    />
  );
}

function TablaDesglose({ precio, lineasBase, cambiar }: { precio: PrecioAjustado; lineasBase: Parameters<typeof limpiarAjustes>[1]; cambiar: (f: (d: Diseno) => Diseno, grupo?: string) => void }) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const fijar = (f: (a: AjustesPrecio) => AjustesPrecio) =>
    cambiar((d) => {
      const a = f(limpiarAjustes(d.ajustesPrecio, lineasBase) ?? { valores: {}, extras: [] });
      const limpio = limpiarAjustes(a, lineasBase);
      const { ajustesPrecio: _, ...resto } = d;
      return limpio ? { ...resto, ajustesPrecio: limpio } : (resto as Diseno);
    });
  const agregar = () => {
    const v = leerPesos(monto);
    if (v === null || v === 0) return;
    fijar((a) => ({ ...a, extras: [...a.extras, { id: nuevoId(), concepto: concepto.trim() || (v < 0 ? 'Descuento' : 'Ajuste'), valor: v }] }));
    setConcepto('');
    setMonto('');
  };
  return (
    <>
      <table>
        <tbody>
          {precio.lineas.map((l) => (
            <tr key={l.clave} className={l.editado ? 'editada' : undefined}>
              <th scope="row">
                {l.concepto}
                <span>{l.detalle}</span>
                {l.editado && (
                  <span className="marca-editado">
                    editado · calculado {formatoPrecio(l.calculado)}{' '}
                    <button
                      type="button"
                      className="enlace"
                      onClick={() =>
                        fijar((a) => {
                          const { [l.clave]: _, ...valores } = a.valores;
                          return { ...a, valores };
                        })
                      }
                    >
                      Restaurar
                    </button>
                  </span>
                )}
              </th>
              <td>
                <MontoEditable valor={l.valor} etiqueta={l.concepto} onGuardar={(v) => fijar((a) => ({ ...a, valores: { ...a.valores, [l.clave]: v } }))} />
              </td>
            </tr>
          ))}
          {precio.extras.map((e) => (
            <tr key={e.id} className="editada extra">
              <th scope="row">
                {e.concepto}
                <span className="marca-editado">
                  ajuste manual{' '}
                  <button type="button" className="enlace" aria-label={`Eliminar ajuste ${e.concepto}`} onClick={() => fijar((a) => ({ ...a, extras: a.extras.filter((x) => x.id !== e.id) }))}>
                    Eliminar
                  </button>
                </span>
              </th>
              <td>
                <MontoEditable
                  valor={e.valor}
                  etiqueta={e.concepto}
                  onGuardar={(v) => fijar((a) => ({ ...a, extras: a.extras.map((x) => (x.id === e.id ? { ...x, valor: v } : x)) }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total{precio.ajustado && <span>Calculado: {formatoPrecio(precio.totalCalculado)}</span>}</th>
            <td>{formatoPrecio(precio.total)}</td>
          </tr>
        </tfoot>
      </table>
      <form
        className="nuevo-ajuste"
        onSubmit={(e) => {
          e.preventDefault();
          agregar();
        }}
      >
        <input aria-label="Concepto del ajuste" placeholder="Ajuste (ej. Descuento cliente frecuente)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        <input aria-label="Monto del ajuste en pesos" placeholder="-20.000" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <button type="submit" className="boton secundario" disabled={leerPesos(monto) === null}>
          Agregar
        </button>
      </form>
      {precio.ajustado && (
        <button type="button" className="enlace restaurar-todo" onClick={() => fijar(() => ({ valores: {}, extras: [] }))}>
          Restaurar valores calculados
        </button>
      )}
    </>
  );
}

export function PanelInferior() {
  const d = useApp((s) => s.diseno);
  const unidad = useApp((s) => s.unidad);
  const pestana = useApp((s) => s.pestana);
  const producto = useApp((s) => s.producto);
  const disenoBase = useApp((s) => s.disenoBase);
  const cambiar = useApp((s) => s.cambiar);
  const operar = useApp((s) => s.operar);
  const set = useApp((s) => s.set);
  const [verAvisos, setVerAvisos] = useState(false);
  const [verDesglose, setVerDesglose] = useState(false);
  const altoPestanas = useApp((s) => s.altoPestanas);
  const fijarVista = useApp((s) => s.fijarVista);
  const panelPestanas = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ y: number; alto: number; max: number } | null>(null);
  // Arrastrar el borde superior agranda o achica el panel; doble clic vuelve al tamaño automático.
  const empezarArrastre = (e: EventoPuntero<HTMLDivElement>) => {
    if (!panelPestanas.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const alto = panelPestanas.current.getBoundingClientRect().height;
    // El visor conserva al menos 180 px (en ≤1100 px la fila de medidas y precio también va encima).
    const visor = document.querySelector('.visor')?.getBoundingClientRect().height ?? 0;
    arrastre.current = { y: e.clientY, alto, max: Math.max(110, Math.min(window.innerHeight * 0.6, alto + visor - 180)) };
  };
  const moverArrastre = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const alto = Math.round(Math.min(a.max, Math.max(110, a.alto + a.y - e.clientY)));
    useApp.getState().set({ altoPestanas: alto });
  };
  const terminarArrastre = () => {
    if (!arrastre.current) return;
    arrastre.current = null;
    fijarVista({ altoPestanas: useApp.getState().altoPestanas });
  };
  const lim = LIMITES[d.plantilla];
  const pestanas = pestanasDe(d.plantilla);
  const actual = pestana === 'colores' ? 'colores' : (pestanas.find((p) => p.id === pestana)?.id ?? null);
  const avisos = advertencias(d, unidad);
  const calculado = precioDiseno(d, producto, disenoBase);
  const precio = aplicarAjustes(calculado, d.ajustesPrecio);
  const oficial = precio?.metodo === 'oficial';
  const esCocinaConEquipos = d.plantilla === 'cocina' || d.plantilla === 'compacto' || d.plantilla === 'cocina-infantil';
  const props = { d, unidad, cambiar };
  // En la L y la U el ancho se mide completo, con las esquinas (como en la tienda y en el precio).
  const esquinas = d.plantilla === 'cocina' ? largoPrincipalConEsquinas(d) - d.ancho : 0;
  const lados = [d.lados.izq && `lado izquierdo ${formatear(d.lados.izq.largo, unidad)}`, d.lados.der && `lado derecho ${formatear(d.lados.der.largo, unidad)}`].filter(Boolean);
  const cotizacion = useApp((s) => s.cotizacionActual);
  const editable = cotizacion?.estado === 'cotizada';
  const verActual = async () => {
    const { avisar, verCotizacion } = useApp.getState();
    if (!cotizacion) return;
    try {
      verCotizacion(await backend.cotizacion(cotizacion.id));
    } catch (e) {
      avisar((e as Error).message, 'error');
    }
  };

  const titulo = actual === 'colores' ? 'Colores' : pestanas.find((p) => p.id === actual)?.texto;

  return (
    <section
      className={`panel-inferior${altoPestanas ? ' alto-fijo' : ''}`}
      aria-label="Medidas del mueble"
      style={altoPestanas ? ({ '--alto-pestanas': `${altoPestanas}px` } as React.CSSProperties) : undefined}
    >
      {actual && (
        <div className="seccion-abierta" role="region" aria-label={titulo}>
          <div
            className="agarre"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Arrastra para agrandar o achicar la sección"
            title="Arrastra para agrandar o achicar · doble clic: tamaño normal"
            onPointerDown={empezarArrastre}
            onPointerMove={moverArrastre}
            onPointerUp={terminarArrastre}
            onPointerCancel={terminarArrastre}
            onDoubleClick={() => fijarVista({ altoPestanas: null })}
          />
          <div className="seccion-cabeza">
            <h2>{titulo}</h2>
            {avisos.length > 0 && (
              <div className="avisos-fabricacion">
                <button
                  type="button"
                  className={`chip-aviso${avisos.some((a) => a.nivel === 'aviso') ? ' fuerte' : ''}`}
                  onClick={() => setVerAvisos((v) => !v)}
                  aria-expanded={verAvisos}
                >
                  <IcoAviso width={15} height={15} /> {avisos.length} {avisos.length === 1 ? 'recomendación' : 'recomendaciones'}
                </button>
                {verAvisos && (
                  <ul className="lista-avisos" role="list">
                    {avisos.map((a, i) => (
                      <li key={i} className={a.nivel}>
                        {a.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button type="button" className="cerrar-seccion" aria-label={`Cerrar ${titulo}`} title="Cerrar" onClick={() => set({ pestana: null })}>
              ✕
            </button>
          </div>
          {/* Módulos y el equipamiento de la cocina usan el panel alto (forma, tira, editor; tarjetas de equipos). */}
          <div
            ref={panelPestanas}
            className={`pestana-panel${(actual === 'modulos' && d.plantilla !== 'tocador') || (actual === 'equipamiento' && esCocinaConEquipos) ? ' modulos' : ''}`}
          >
            <AvisoRechazo />
            {actual === 'puertas' && <PestanaPuertas {...props} />}
            {actual === 'cajones' && <PestanaCajones {...props} />}
            {actual === 'modulos' && <PestanaModulos {...props} />}
            {actual === 'equipamiento' && <PestanaEquipamiento {...props} />}
            {actual === 'colores' && <PanelColores />}
          </div>
        </div>
      )}

      <div className="barra-simple">
        <div className="bloque-medidas">
          <FilaMedida nombre="Ancho" icono="↔" valor={d.ancho + esquinas} limites={[lim.ancho[0] + esquinas, lim.ancho[1] + esquinas]} unidad={unidad} onCambio={(mm) => operar({ op: 'fijarAncho', ancho: mm - esquinas }, 'ancho')} />
          <FilaMedida nombre="Alto" icono="↕" valor={d.alto} limites={lim.alto} unidad={unidad} onCambio={(mm) => operar({ op: 'fijarAlto', alto: mm }, 'alto')} />
          <FilaMedida nombre="Fondo" icono="⤢" valor={d.profundidad} limites={lim.profundidad} unidad={unidad} onCambio={(mm) => operar({ op: 'fijarProfundidad', profundidad: mm }, 'profundidad')} />
          <Segmentado
            valor={unidad}
            onCambio={(u) => set({ unidad: u })}
            opciones={[
              { valor: 'cm', texto: 'cm', titulo: 'Centímetros' },
              { valor: 'mm', texto: 'mm', titulo: 'Milímetros' },
            ]}
          />
          {d.plantilla === 'cocina' && (
            <Interruptor
              activo={d.aereos.activo}
              onCambio={(v) => {
                const r = operar({ op: 'activarAereos', activo: v });
                if (r.ok) set({ tramoActivo: v ? 'aereos' : 'base', moduloActivo: 0 });
              }}
              texto="Agregar aéreo"
            />
          )}
        </div>

        <div className="bloque-precio">
          <span className="campo-etiqueta">
            {cotizacion ? (
              <>
                {cotizacion.numero} · {cotizacion.cliente.nombre} · <span className={`estado-cotizacion ${cotizacion.estado}`}>{cotizacion.estado}</span>
              </>
            ) : oficial ? (
              'Precio oficial'
            ) : precio ? (
              'Valor referencial'
            ) : (
              'Diseño a medida'
            )}
          </span>
          <strong className="precio" title={lados.length > 0 ? `Con ${lados.join(' y ')}` : undefined}>
            {cotizacion ? formatoPrecio(cotizacion.venta?.valor ?? cotizacion.valor) : precio ? formatoPrecio(precio.total) : 'Sin referencia'}
          </strong>
          {precio && precio.lineas.length > 0 && (
            <div className="desglose-precio">
              <button type="button" className="boton-desglose" aria-expanded={verDesglose} onClick={() => setVerDesglose((v) => !v)}>
                {verDesglose ? '▾ Ocultar desglose' : '▸ Ver desglose'}
              </button>
              {verDesglose && (
                <div className="desglose-lista" role="region" aria-label="Desglose del precio">
                  <TablaDesglose precio={precio} lineasBase={calculado!.lineas} cambiar={cambiar} />
                </div>
              )}
            </div>
          )}
          <div className="acciones-precio">
            <button type="button" className="boton primario" onClick={() => set({ modal: 'registrarCotizacion' })}>
              <IcoGuardar /> {editable ? `Actualizar ${cotizacion!.numero}` : 'Registrar cotización'}
            </button>
            {cotizacion ? (
              <button type="button" className="boton secundario" onClick={() => verActual()}>
                Ver cotización
              </button>
            ) : (
              <button type="button" className="boton secundario" onClick={() => set({ modal: 'cotizaciones' })}>
                Mis cotizaciones
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
