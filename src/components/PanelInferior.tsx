import { useState } from 'react';
import { LIMITES, advertencias, aUnidad, fijarAlto, fijarAncho, fijarProfundidad, formatear, formatoPrecio, precioReferencial } from '../../shared/reglas';
import type { Unidad } from '../../shared/tipos';
import { useApp } from '../store/useApp';
import { CampoMedida, Segmentado } from './Controles';
import { IcoAviso, IcoGuardar, IcoWsp } from './Iconos';
import { PestanaCajones, PestanaEquipamiento, PestanaModulos, PestanaPuertas, pestanasDe } from './Pestanas';

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
        max={limites[1]}
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
  const set = useApp((s) => s.set);
  const [verAvisos, setVerAvisos] = useState(false);
  const lim = LIMITES[d.plantilla];
  const pestanas = pestanasDe(d.plantilla);
  const actual = pestanas.find((p) => p.id === pestana)?.id ?? pestanas[0].id;
  const avisos = advertencias(d, unidad);
  const precio = precioReferencial(d, producto, disenoBase);
  const props = { d, unidad, cambiar };

  return (
    <section className="panel-inferior" aria-label="Medidas del mueble">
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
        <FilaMedida nombre="Alto" icono="↕" valor={d.alto} limites={lim.alto} unidad={unidad} onCambio={(mm) => cambiar((x) => fijarAlto(x, mm), 'alto')} />
        <FilaMedida nombre="Ancho" icono="↔" valor={d.ancho} limites={lim.ancho} unidad={unidad} onCambio={(mm) => cambiar((x) => fijarAncho(x, mm), 'ancho')} />
        <FilaMedida
          nombre="Fondo"
          icono="⤢"
          valor={d.profundidad}
          limites={lim.profundidad}
          unidad={unidad}
          onCambio={(mm) => cambiar((x) => fijarProfundidad(x, mm), 'profundidad')}
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
        <div role="tabpanel" className="pestana-panel">
          {actual === 'puertas' && <PestanaPuertas {...props} />}
          {actual === 'cajones' && <PestanaCajones {...props} />}
          {actual === 'modulos' && <PestanaModulos {...props} />}
          {actual === 'equipamiento' && <PestanaEquipamiento {...props} />}
        </div>
      </div>

      <div className="bloque-precio">
        <span className="campo-etiqueta">{precio ? 'Precio referencial' : 'Diseño a medida'}</span>
        <strong className="precio">{precio ? formatoPrecio(precio) : 'Cotízalo'}</strong>
        <span className="resumen-medidas">
          {formatear(d.ancho, unidad, false)} × {formatear(d.alto, unidad, false)} × {formatear(d.profundidad, unidad)}
        </span>
        <span className="tenue chico">{precio ? 'Estimado según medidas; la tienda confirma el valor.' : 'Rachel te envía el valor por WhatsApp.'}</span>
        <div className="acciones-precio">
          <button type="button" className="boton wsp" onClick={() => set({ modal: 'cotizar' })}>
            <IcoWsp /> Cotizar por WhatsApp
          </button>
          <button
            type="button"
            className="boton secundario"
            onClick={() =>
              useApp.getState().usuario ? set({ modal: 'guardar' }) : set({ modal: 'auth', modoAuth: 'login', trasAuth: 'guardar' })
            }
          >
            <IcoGuardar /> Guardar diseño
          </button>
        </div>
      </div>
    </section>
  );
}
