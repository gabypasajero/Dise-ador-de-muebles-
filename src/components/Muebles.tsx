import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { conVoladizo, ladoEnLinea, medidasIsla, mueblesProyecto, NOMBRE_CARA, posicionEnLinea, precioProyecto, voladizoParaCubierta } from '../../shared/proyecto';
import type { CaraIsla } from '../../shared/tipos';
import { formatear, formatoPrecio } from '../../shared/reglas';
import { adicionalActivo, proyectoDe, useApp } from '../store/useApp';
import { CampoMedida, Interruptor, Segmentado } from './Controles';
import { IcoBasura, IcoMas } from './Iconos';

const GIROS = [
  { valor: '0', texto: 'De frente', titulo: 'Mira hacia la sala, como el mueble principal' },
  { valor: '90', texto: 'Girada ↺', titulo: 'Girada un cuarto de vuelta' },
  { valor: '180', texto: 'Hacia el muro', titulo: 'Media vuelta: las puertas miran al mueble principal' },
  { valor: '270', texto: 'Girada ↻', titulo: 'Girada tres cuartos de vuelta' },
] as const;

/** Sección «Muebles»: los muebles del proyecto (principal, islas y en línea), cuál se edita y dónde va cada uno. */
export function PestanaMuebles() {
  const s = useApp();
  const proyecto = proyectoDe(s);
  const nombrePrincipal = s.producto?.modelo ?? (proyecto.nombreModelo || NOMBRE_PLANTILLA[proyecto.plantilla]);
  const muebles = mueblesProyecto(proyecto, nombrePrincipal);
  const precios = precioProyecto(proyecto, s.producto, s.disenoBase, nombrePrincipal);
  const activo = adicionalActivo(s);
  const enCocina = proyecto.plantilla === 'cocina';
  const paso = s.unidad === 'cm' ? 100 : 50;

  return (
    <div className="pestana-contenido muebles-proyecto">
      <div className="muebles-lista" role="list" aria-label="Muebles del proyecto">
        {muebles.map((m, i) => {
          const elegido = m.id === s.muebleActivo;
          const precio = precios.partes.find((x) => x.id === m.id)?.precio ?? (i === 0 ? precios.partes[0]?.precio : null);
          return (
            <button
              key={m.id ?? 'principal'}
              type="button"
              role="listitem"
              className={`tarjeta-mueble${elegido ? ' activa' : ''}`}
              aria-pressed={elegido}
              onClick={() => s.editarMueble(m.id)}
            >
              <span className="tarjeta-mueble-tipo">{m.tipo === 'principal' ? 'Principal' : m.cara ? `Isla · ${NOMBRE_CARA[m.cara]}` : m.tipo === 'isla' ? 'Isla' : 'En línea'}</span>
              <strong>{m.nombre}</strong>
              <span className="tenue chico">
                {formatear(m.diseno.ancho, s.unidad, false)} × {formatear(m.diseno.alto, s.unidad, false)} × {formatear(m.diseno.profundidad, s.unidad)}
              </span>
              {precio && <span className="tarjeta-mueble-precio">{formatoPrecio(precio.total)}</span>}
              {elegido && <span className="tarjeta-mueble-editando">Editando</span>}
            </button>
          );
        })}
        {enCocina && (
          <div className="muebles-agregar">
            <button type="button" className="boton secundario" onClick={() => s.agregarMueble('isla')}>
              <IcoMas width={15} height={15} /> Isla
            </button>
            <button type="button" className="boton secundario" onClick={() => s.agregarMueble('linea')}>
              <IcoMas width={15} height={15} /> Mueble en línea
            </button>
          </div>
        )}
      </div>

      {!enCocina && <p className="tenue">Las islas y los muebles en línea se agregan a las cocinas.</p>}
      {enCocina && !activo && (
        <p className="tenue">
          {muebles.length > 1
            ? 'Editas el mueble principal. Toca otro mueble (aquí o en el 3D) para editarlo: medidas, módulos, puertas, cajones, equipos y colores.'
            : 'Agrega una isla (150 × 90 × 90 cm) o un mueble en línea; todo queda en el mismo proyecto y en la misma cotización.'}
        </p>
      )}

      {muebles.length > 1 && (
        <button type="button" className="boton fantasma chico colores-todos" onClick={() => s.coloresATodos()}>
          Usar los colores de «{activo ? activo.nombre : nombrePrincipal}» en todos los muebles
        </button>
      )}

      {activo?.tipo === 'isla' && (
        <div className="caras-isla">
          <span className="campo-etiqueta">Puertas y cajones de la isla, a elección del cliente</span>
          <div className="caras-isla-botones">
            {(['trasera', 'izq', 'der'] as CaraIsla[]).map((cara) => {
              const islaId = activo.isla ?? activo.id;
              const tiene = proyecto.adicionales?.some((a) => a.isla === islaId && a.cara === cara);
              return (
                <button key={cara} type="button" className={`boton ${tiene ? 'primario' : 'secundario'} chico`} aria-pressed={!!tiene} onClick={() => s.alternarCara(cara)}>
                  {tiene ? '✓ ' : '＋ '}
                  {NOMBRE_CARA[cara].charAt(0).toUpperCase() + NOMBRE_CARA[cara].slice(1)}
                </button>
              );
            })}
          </div>
          <p className="tenue chico">
            El frente es la isla misma. El lado trasero parte el fondo en dos (cada lado con sus puertas y cajones); los costados van en las puntas. Toca cada cara para editar sus módulos.
          </p>
        </div>
      )}

      {activo?.tipo === 'isla' && !activo.cara && <IslaLisa />}

      {activo?.tipo === 'isla' && !activo.cara && <MedidasIsla />}

      {activo?.tipo === 'isla' && <VoladizoIsla islaId={activo.isla ?? activo.id} />}

      {activo?.cara && <p className="tenue">Esta cara se mueve y gira con su isla: para ubicarla, elige la isla.</p>}

      {activo && !activo.cara && (
        <div className="mueble-ubicacion">
          <label className="campo-texto">
            <span className="campo-etiqueta">Nombre</span>
            <input value={activo.nombre} maxLength={60} onChange={(e) => s.ubicarMueble(activo.id, { nombre: e.target.value })} onBlur={(e) => !e.target.value.trim() && s.ubicarMueble(activo.id, { nombre: activo.tipo === 'isla' ? 'Isla' : 'Mueble en línea' })} />
          </label>
          {activo.tipo === 'linea' && (
            <Interruptor
              activo={!!activo.pegado}
              onCambio={(v) => s.ubicarMueble(activo.id, { pegado: v })}
              texto="Pegado al mueble principal, después del espacio del refrigerador (se corre solo si el principal crece)"
            />
          )}
          {activo.tipo === 'linea' ? (
            <EnLinea />
          ) : (
            <>
              <CampoMedida etiqueta="Centro: hacia el lado (desde el centro del principal)" compacto valor={activo.x} unidad={s.unidad} paso={paso} onCambio={(mm) => s.ubicarMueble(activo.id, { x: Math.round(mm) })} />
              <CampoMedida etiqueta="Centro: distancia desde el muro" compacto valor={activo.z} unidad={s.unidad} paso={paso} onCambio={(mm) => s.ubicarMueble(activo.id, { z: Math.round(mm) })} />
              <Segmentado
                etiqueta="Orientación"
                valor={String([0, 90, 180, 270].includes(activo.giro) ? activo.giro : 0) as '0' | '90' | '180' | '270'}
                onCambio={(v) => s.ubicarMueble(activo.id, { giro: Number(v) })}
                opciones={GIROS.map((g) => ({ ...g }))}
              />
            </>
          )}
          <button
            type="button"
            className="boton fantasma peligro chico"
            onClick={() => {
              if (window.confirm(`¿Quitar «${activo.nombre}» del proyecto?`)) s.quitarMueble(activo.id);
            }}
          >
            <IcoBasura width={15} height={15} /> Quitar del proyecto
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Ubicación del mueble en línea: va siempre contra el muro del principal, alineado con él; solo se
 * elige a qué lado va y cuánto se separa (se desliza hacia los lados), como quedará en la cocina.
 */
function EnLinea() {
  const s = useApp();
  const proyecto = proyectoDe(s);
  const activo = adicionalActivo(s);
  if (!activo) return null;
  const { adicionales: _a, ...principal } = proyecto;
  const a = { ...activo, diseno: s.diseno };
  const { lado, separacion } = ladoEnLinea(principal, a);
  const mover = (l: 'izq' | 'der', sep: number) => s.ubicarMueble(activo.id, posicionEnLinea(principal, a, l, sep));
  return (
    <>
      <Segmentado
        etiqueta="Lado del mueble principal"
        valor={lado}
        onCambio={(v) => mover(v, separacion)}
        opciones={[
          { valor: 'izq', texto: '← Izquierda' },
          { valor: 'der', texto: 'Derecha →' },
        ]}
      />
      <CampoMedida etiqueta="Separación del mueble principal" compacto valor={separacion} unidad={s.unidad} min={0} paso={s.unidad === 'cm' ? 50 : 10} onCambio={(mm) => mover(lado, mm)} />
      <label className="deslizar-linea">
        <span className="campo-etiqueta">Deslizar a lo largo del muro</span>
        <input type="range" min={0} max={4000} step={10} value={Math.min(4000, separacion)} onChange={(e) => mover(lado, Number(e.target.value))} aria-label="Separación del mueble principal" />
      </label>
    </>
  );
}

const SIN_VOLADIZO = { frente: 0, trasero: 0, izq: 0, der: 0 };

/**
 * Isla lisa: sin puertas ni cajones, con el frente cerrado por un panel liso. Al volver a la isla
 * con puertas, cada módulo vacío recibe sus puertas (2 desde 55 cm, si no 1).
 */
function IslaLisa() {
  const s = useApp();
  const activo = adicionalActivo(s);
  if (!activo) return null;
  const alternar = (liso: boolean) => {
    s.cambiar(
      (d) => ({
        ...d,
        cuerpos: d.cuerpos.map((c) =>
          c.tipo !== 'frentes' ? c : liso ? { ...c, puertas: 0, cajones: 0 } : c.puertas || c.cajones ? c : { ...c, puertas: c.ancho >= 550 ? 2 : 1, repisas: Math.max(1, c.repisas) },
        ),
      }),
      'isla-lisa',
    );
    s.ubicarMueble(activo.id, { liso });
  };
  return (
    <div className="isla-lisa">
      <Interruptor activo={!!activo.liso} onCambio={alternar} texto="Isla lisa: sin puertas ni cajones (frente cerrado y liso)" />
      {activo.liso && <p className="tenue chico">El frente queda cerrado con un panel liso del color de los frentes. Para volver a ponerle puertas y cajones, apaga esta opción.</p>}
    </div>
  );
}

/**
 * Medidas de la isla por separado: la base (el mueble) y la cubierta. Al cambiar la base, la cubierta
 * conserva su medida (cambia lo que sobresale); al cambiar la cubierta, la base no se mueve.
 */
function MedidasIsla() {
  const s = useApp();
  const activo = adicionalActivo(s);
  const proyecto = proyectoDe(s);
  const isla = proyecto.adicionales?.find((a) => a.id === activo?.id);
  if (!activo || !isla) return null;
  const m = medidasIsla(proyecto, isla);
  const paso = s.unidad === 'cm' ? 10 : 5;
  const conservarCubierta = (pedido: { largo?: number; fondo?: number }) => {
    if (!conVoladizo(isla)) return;
    const p2 = proyectoDe(useApp.getState());
    const i2 = p2.adicionales?.find((a) => a.id === isla.id);
    if (i2) s.ubicarMueble(isla.id, { voladizo: voladizoParaCubierta(p2, i2, pedido) });
  };
  const cambiarBase = (que: 'largo' | 'fondo', mm: number) => {
    const extra = que === 'largo' ? m.base.largo - s.diseno.ancho : m.base.fondo - s.diseno.profundidad;
    const r =
      que === 'largo'
        ? s.operar({ op: 'fijarAncho', ancho: Math.round(mm - extra) }, 'isla-base-largo')
        : s.operar({ op: 'fijarProfundidad', profundidad: Math.round(mm - extra) }, 'isla-base-fondo');
    if (r.ok) conservarCubierta({ [que]: m.cubierta[que] });
  };
  const cambiarCubierta = (que: 'largo' | 'fondo', mm: number) => s.ubicarMueble(isla.id, { voladizo: voladizoParaCubierta(proyecto, isla, { [que]: Math.round(mm) }) });
  return (
    <div className="medidas-isla">
      <span className="campo-etiqueta">Medidas de la isla, por separado</span>
      <div className="medidas-isla-grupo">
        <strong>Base (mueble)</strong>
        <CampoMedida etiqueta="Largo" compacto valor={m.base.largo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarBase('largo', mm)} />
        <CampoMedida etiqueta="Fondo" compacto valor={m.base.fondo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarBase('fondo', mm)} />
        <CampoMedida etiqueta="Alto" compacto valor={s.diseno.alto} unidad={s.unidad} paso={paso} onCambio={(mm) => s.operar({ op: 'fijarAlto', alto: Math.round(mm) }, 'isla-base-alto')} />
      </div>
      <div className="medidas-isla-grupo">
        <strong>Cubierta</strong>
        <CampoMedida etiqueta="Largo" compacto valor={m.cubierta.largo} unidad={s.unidad} min={m.base.largo} paso={paso} onCambio={(mm) => cambiarCubierta('largo', mm)} />
        <CampoMedida etiqueta="Fondo" compacto valor={m.cubierta.fondo} unidad={s.unidad} min={m.base.fondo} paso={paso} onCambio={(mm) => cambiarCubierta('fondo', mm)} />
      </div>
      <p className="tenue chico">
        La cubierta más larga sobresale igual a cada costado; la más honda sobresale atrás, para sentarse. Al cambiar la base, la cubierta conserva su medida.
      </p>
    </div>
  );
}

/** Cubierta de la isla más grande que el mueble, para sentarse alrededor: cuánto sobresale por cada lado. */
function VoladizoIsla({ islaId }: { islaId: string }) {
  const s = useApp();
  const isla = proyectoDe(s).adicionales?.find((a) => a.id === islaId);
  if (!isla) return null;
  const v = isla.voladizo ?? SIN_VOLADIZO;
  const fijar = (cambios: Partial<typeof v>) => s.ubicarMueble(islaId, { voladizo: { ...v, ...cambios } });
  const lados = [
    { k: 'trasero', texto: 'Atrás' },
    { k: 'frente', texto: 'Adelante' },
    { k: 'izq', texto: 'Izquierda' },
    { k: 'der', texto: 'Derecha' },
  ] as const;
  return (
    <div className="voladizo-isla">
      <span className="campo-etiqueta">Cubierta más grande para sentarse (cuánto sobresale del mueble)</span>
      <div className="voladizo-isla-campos">
        {lados.map((l) => (
          <CampoMedida key={l.k} etiqueta={l.texto} compacto valor={v[l.k]} unidad={s.unidad} min={0} max={1500} paso={s.unidad === 'cm' ? 50 : 10} onCambio={(mm) => fijar({ [l.k]: Math.round(mm) })} />
        ))}
      </div>
      <div className="voladizo-isla-rapidos">
        <button type="button" className="boton secundario chico" onClick={() => fijar({ trasero: 300 })}>
          Barra atrás de 30 cm
        </button>
        <button type="button" className="boton secundario chico" onClick={() => fijar({ izq: 300, der: 300 })}>
          30 cm en los costados
        </button>
        <button type="button" className="boton fantasma chico" onClick={() => s.ubicarMueble(islaId, { voladizo: { ...SIN_VOLADIZO } })}>
          Sin voladizo
        </button>
      </div>
      <p className="tenue chico">Para sentarse cómodo se recomiendan 25 a 30 cm de voladizo (las piernas quedan bajo la cubierta).</p>
    </div>
  );
}
