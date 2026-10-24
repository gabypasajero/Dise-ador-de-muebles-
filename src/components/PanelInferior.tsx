import { useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { largoPrincipalConEsquinas } from '../../shared/layout';
import { LIMITES, advertencias, aUnidad, formatear, formatoPrecio, precioDiseno } from '../../shared/reglas';
import type { Unidad } from '../../shared/tipos';
import { useApp } from '../store/useApp';
import { CampoMedida, Segmentado } from './Controles';
import { backend } from '../datos';
import { IcoAviso, IcoGuardar } from './Iconos';
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
  const plegado = useApp((s) => s.panelPlegado);
  const altoPestanas = useApp((s) => s.altoPestanas);
  const fijarVista = useApp((s) => s.fijarVista);
  const panelPestanas = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ y: number; alto: number; max: number } | null>(null);
  // Arrastrar el borde superior agranda o achica el panel; doble clic vuelve al tamaño automático.
  const empezarArrastre = (e: EventoPuntero<HTMLDivElement>) => {
    if (plegado || !panelPestanas.current) return;
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
  const actual = pestanas.find((p) => p.id === pestana)?.id ?? pestanas[0].id;
  const avisos = advertencias(d, unidad);
  const precio = precioDiseno(d, producto, disenoBase);
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

  return (
    <section
      className={`panel-inferior${plegado ? ' plegado' : ''}${altoPestanas ? ' alto-fijo' : ''}`}
      aria-label="Medidas del mueble"
      style={altoPestanas ? ({ '--alto-pestanas': `${altoPestanas}px` } as React.CSSProperties) : undefined}
    >
      <div className="panel-asa">
        <div
          className="agarre"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Arrastra para agrandar o achicar el panel de medidas"
          title="Arrastra para agrandar o achicar · doble clic: tamaño normal"
          onPointerDown={empezarArrastre}
          onPointerMove={moverArrastre}
          onPointerUp={terminarArrastre}
          onPointerCancel={terminarArrastre}
          onDoubleClick={() => fijarVista({ altoPestanas: null })}
        />
        <button type="button" className="plegar-panel" aria-expanded={!plegado} onClick={() => fijarVista({ panelPlegado: !plegado })}>
          {plegado ? '▴ Mostrar medidas' : '▾ Ocultar medidas'}
        </button>
      </div>
      <div className="bloque-medidas">
        <div className="bloque-medidas-cabeza">
          <h2>Medidas</h2>
          <Segmentado
            valor={unidad}
            onCambio={(u) => set({ unidad: u })}
            opciones={[
              { valor: 'cm', texto: 'Centímetros', titulo: 'Centímetros (cm)' },
              { valor: 'mm', texto: 'Milímetros', titulo: 'Milímetros (mm)' },
            ]}
          />
        </div>
        <FilaMedida nombre="Alto" icono="↕" valor={d.alto} limites={lim.alto} unidad={unidad} onCambio={(mm) => operar({ op: 'fijarAlto', alto: mm }, 'alto')} />
        <FilaMedida
          nombre="Ancho"
          icono="↔"
          valor={d.ancho + esquinas}
          limites={[lim.ancho[0] + esquinas, lim.ancho[1] + esquinas]}
          unidad={unidad}
          onCambio={(mm) => operar({ op: 'fijarAncho', ancho: mm - esquinas }, 'ancho')}
        />
        <FilaMedida
          nombre="Fondo"
          icono="⤢"
          valor={d.profundidad}
          limites={lim.profundidad}
          unidad={unidad}
          onCambio={(mm) => operar({ op: 'fijarProfundidad', profundidad: mm }, 'profundidad')}
        />
      </div>

      <div className="categorias">
        <div className="pestanas-cabeza">
          <nav className="pestanas" role="tablist" aria-label="Categorías de medidas">
            {pestanas.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === actual}
                className={p.id === actual ? 'activa' : ''}
                onClick={() => set({ pestana: p.id })}
              >
                {p.texto}
              </button>
            ))}
          </nav>
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
        </div>
        {/* Módulos y el equipamiento de la cocina usan el panel alto (forma, tira, editor; tarjetas de equipos). */}
        <div
          role="tabpanel"
          ref={panelPestanas}
          className={`pestana-panel${(actual === 'modulos' && d.plantilla !== 'tocador') || (actual === 'equipamiento' && esCocinaConEquipos) ? ' modulos' : ''}`}
        >
          <AvisoRechazo />
          {actual === 'puertas' && <PestanaPuertas {...props} />}
          {actual === 'cajones' && <PestanaCajones {...props} />}
          {actual === 'modulos' && <PestanaModulos {...props} />}
          {actual === 'equipamiento' && <PestanaEquipamiento {...props} />}
        </div>
      </div>

      <div className="bloque-precio">
        {cotizacion ? (
          <span className="campo-etiqueta">
            {cotizacion.numero} · {cotizacion.cliente.nombre} · <span className={`estado-cotizacion ${cotizacion.estado}`}>{cotizacion.estado}</span>
          </span>
        ) : (
          <span className="campo-etiqueta">{oficial ? 'Precio oficial' : precio ? 'Valor referencial' : 'Diseño a medida'}</span>
        )}
        <strong className="precio">{cotizacion ? formatoPrecio(cotizacion.venta?.valor ?? cotizacion.valor) : precio ? formatoPrecio(precio.total) : 'Sin referencia'}</strong>
        <span className="resumen-medidas">
          {formatear(d.ancho + esquinas, unidad, false)} × {formatear(d.alto, unidad, false)} × {formatear(d.profundidad, unidad)}
        </span>
        {lados.length > 0 && <span className="tenue chico">Con {lados.join(' y ')}</span>}
        <span className="tenue chico">
          {cotizacion
            ? precio
              ? `${oficial ? 'Precio oficial' : 'Referencial'} con las medidas actuales: ${formatoPrecio(precio.total)}`
              : 'Valor registrado en la cotización.'
            : oficial
              ? precio?.lineas[0]?.concepto === 'Precio de la tienda'
                ? esCocinaConEquipos
                  ? 'Precio de la tienda del producto (mismas medidas del mueble base), menos los equipos que se quitan o van solo con el corte, más el aéreo y las campanas que se agregan.'
                  : 'Precio de la tienda del producto: se mantiene mientras no cambien sus medidas.'
                : 'Precio de la tienda: metro lineal según el fondo, equipamiento y aéreo por metro.'
              : precio
                ? 'Calculado desde el precio de la tienda; lo ajustas al cotizar.'
                : 'Ingresa el valor al registrar la cotización.'}
        </span>
        {precio && precio.lineas.length > 0 && (
          <div className="desglose-precio">
            <button type="button" className="boton-desglose" aria-expanded={verDesglose} onClick={() => setVerDesglose((v) => !v)}>
              {verDesglose ? '▾ Ocultar desglose' : '▸ Ver desglose'}
            </button>
            {verDesglose && (
              <div className="desglose-lista" role="region" aria-label="Desglose del precio oficial">
                <table>
                  <tbody>
                    {precio.lineas.map((l, i) => (
                      <tr key={i}>
                        <th scope="row">
                          {l.concepto}
                          <span>{l.detalle}</span>
                        </th>
                        <td>{formatoPrecio(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total</th>
                      <td>{formatoPrecio(precio.total)}</td>
                    </tr>
                  </tfoot>
                </table>
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
    </section>
  );
}
