import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { baseParaCubierta, ladoEnLinea, medidasIsla, mueblesProyecto, NOMBRE_CARA, posicionEnLinea, precioProyecto, voladizoIsla, VUELO_ISLA, VUELO_SENTARSE } from '../../shared/proyecto';
import type { CaraIsla, Voladizo } from '../../shared/tipos';
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
 * Medidas de la isla: manda la cubierta. Se escribe su largo y su fondo, y el mueble base se ajusta
 * solo dejando lo que sobresale por cada lado (5 cm, o 30 cm donde se sientan). Lo que se escribe a
 * mano queda fijo: si cambia lo que sobresale, se ajusta el mueble base y la cubierta no se mueve.
 * Si se edita el mueble base, la cubierta lo sigue y conserva lo que sobresale.
 */
function MedidasIsla() {
  const s = useApp();
  const activo = adicionalActivo(s);
  const proyecto = proyectoDe(s);
  const isla = proyecto.adicionales?.find((a) => a.id === activo?.id);
  if (!activo || !isla) return null;
  const m = medidasIsla(proyecto, isla);
  const v = voladizoIsla(isla);
  const fija = isla.cubiertaFija ?? {};
  const paso = s.unidad === 'cm' ? 10 : 5;
  /** Lleva el frente de la isla (sin sus caras) a las medidas pedidas. */
  const ajustarBase = (b: { ancho?: number; profundidad?: number }) => {
    if (b.ancho != null && b.ancho !== s.diseno.ancho) s.operar({ op: 'fijarAncho', ancho: b.ancho }, 'isla-cubierta');
    if (b.profundidad != null && b.profundidad !== s.diseno.profundidad) s.operar({ op: 'fijarProfundidad', profundidad: b.profundidad }, 'isla-cubierta');
  };
  const cambiarCubierta = (que: 'largo' | 'fondo', mm: number) => {
    ajustarBase(baseParaCubierta(proyecto, isla, { [que]: Math.round(mm) }));
    s.ubicarMueble(isla.id, { cubiertaFija: { ...fija, [que]: true } });
  };
  const cambiarVoladizo = (cambios: Partial<Voladizo>) => {
    const nuevo = { ...v, ...cambios };
    // Con la cubierta fijada, lo que sobresale de más lo pierde el mueble base.
    ajustarBase(baseParaCubierta(proyecto, isla, { ...(fija.largo ? { largo: m.cubierta.largo } : {}), ...(fija.fondo ? { fondo: m.cubierta.fondo } : {}) }, nuevo));
    s.ubicarMueble(isla.id, { voladizo: nuevo });
  };
  const cambiarBase = (que: 'largo' | 'fondo', mm: number) => {
    const extra = que === 'largo' ? m.base.largo - s.diseno.ancho : m.base.fondo - s.diseno.profundidad;
    if (que === 'largo') s.operar({ op: 'fijarAncho', ancho: Math.round(mm - extra) }, 'isla-base-largo');
    else s.operar({ op: 'fijarProfundidad', profundidad: Math.round(mm - extra) }, 'isla-base-fondo');
  };
  const lados = [
    { k: 'trasero', texto: 'Atrás' },
    { k: 'frente', texto: 'Adelante' },
    { k: 'izq', texto: 'Izquierda' },
    { k: 'der', texto: 'Derecha' },
  ] as const;
  return (
    <div className="medidas-isla">
      <span className="campo-etiqueta">Medidas de la isla: manda la cubierta</span>
      <div className="medidas-isla-grupo">
        <strong>Cubierta</strong>
        <CampoMedida etiqueta={`Largo${fija.largo ? ' · fijado' : ''}`} compacto valor={m.cubierta.largo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarCubierta('largo', mm)} />
        <CampoMedida etiqueta={`Fondo${fija.fondo ? ' · fijado' : ''}`} compacto valor={m.cubierta.fondo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarCubierta('fondo', mm)} />
      </div>
      <div className="medidas-isla-grupo">
        <strong>Espacio para sentarse: la cubierta sobresale {VUELO_SENTARSE / 10} cm por ese lado</strong>
        <div className="caras-isla-botones">
          {lados.map((l) => {
            const on = v[l.k] >= 150;
            return (
              <button key={l.k} type="button" className={`boton ${on ? 'primario' : 'secundario'} chico`} aria-pressed={on} onClick={() => cambiarVoladizo({ [l.k]: on ? VUELO_ISLA : VUELO_SENTARSE })}>
                {on ? '✓ ' : '＋ '}
                {l.texto}
              </button>
            );
          })}
        </div>
      </div>
      <div className="medidas-isla-grupo">
        <strong>Cuánto sobresale la cubierta del mueble, por lado</strong>
        {lados.map((l) => (
          <CampoMedida key={l.k} etiqueta={l.texto} compacto valor={v[l.k]} unidad={s.unidad} min={0} paso={s.unidad === 'cm' ? 50 : 10} onCambio={(mm) => cambiarVoladizo({ [l.k]: Math.max(0, Math.round(mm)) })} />
        ))}
      </div>
      <div className="medidas-isla-grupo">
        <strong>Mueble base (se ajusta a la cubierta)</strong>
        <CampoMedida etiqueta="Largo" compacto valor={m.base.largo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarBase('largo', mm)} />
        <CampoMedida etiqueta="Fondo" compacto valor={m.base.fondo} unidad={s.unidad} paso={paso} onCambio={(mm) => cambiarBase('fondo', mm)} />
        <CampoMedida etiqueta="Alto" compacto valor={s.diseno.alto} unidad={s.unidad} paso={paso} onCambio={(mm) => s.operar({ op: 'fijarAlto', alto: Math.round(mm) }, 'isla-base-alto')} />
      </div>
      <p className="tenue chico">
        Isla de trabajo: la cubierta sobresale {VUELO_ISLA / 10} cm por los cuatro lados. Donde se sientan sobresale {VUELO_SENTARSE / 10} cm (se recomiendan 25 a 30 cm). La medida de
        cubierta que escribes queda fija y el mueble base se ajusta a ella; si cambias el mueble base, la cubierta lo sigue y conserva lo que sobresale. La isla se cobra por el largo de su
        cubierta.
      </p>
    </div>
  );
}
