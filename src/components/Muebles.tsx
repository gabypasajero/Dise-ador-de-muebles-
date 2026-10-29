import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { mueblesProyecto, NOMBRE_CARA, precioProyecto } from '../../shared/proyecto';
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
          <CampoMedida etiqueta="Centro: hacia el lado (desde el centro del principal)" compacto valor={activo.x} unidad={s.unidad} paso={paso} onCambio={(mm) => s.ubicarMueble(activo.id, { x: Math.round(mm) })} />
          <CampoMedida etiqueta="Centro: distancia desde el muro" compacto valor={activo.z} unidad={s.unidad} paso={paso} onCambio={(mm) => s.ubicarMueble(activo.id, { z: Math.round(mm) })} />
          <Segmentado
            etiqueta="Orientación"
            valor={String([0, 90, 180, 270].includes(activo.giro) ? activo.giro : 0) as '0' | '90' | '180' | '270'}
            onCambio={(v) => s.ubicarMueble(activo.id, { giro: Number(v) })}
            opciones={GIROS.map((g) => ({ ...g }))}
          />
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
