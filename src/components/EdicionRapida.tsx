import { useEffect, useState } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { mueblesProyecto, NOMBRE_CARA } from '../../shared/proyecto';
import { formatear, limitesModulo, nombreModulo } from '../../shared/reglas';
import type { Cuerpo } from '../../shared/tipos';
import { proyectoDe, useApp } from '../store/useApp';
import { CampoMedida } from './Controles';
import { etiquetaTramo, gruposDe } from './Pestanas';

const CLAVE = 'dto-edicion-rapida';
type Abiertas = { modulos: boolean; frentes: boolean };

function leer(): Abiertas {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Abiertas> | null;
    return { modulos: v?.modulos !== false, frentes: v?.frentes !== false };
  } catch {
    return { modulos: true, frentes: true };
  }
}

/** Contador chico con − y + para la edición rápida. */
function MasMenos({ valor, min, max, onCambio, etiqueta }: { valor: number; min: number; max: number; onCambio: (v: number) => void; etiqueta: string }) {
  return (
    <span className="mas-menos" role="group" aria-label={etiqueta}>
      <button type="button" aria-label={`Menos ${etiqueta}`} disabled={valor <= min} onClick={() => onCambio(valor - 1)}>
        −
      </button>
      <span>{valor}</span>
      <button type="button" aria-label={`Más ${etiqueta}`} disabled={valor >= max} onClick={() => onCambio(valor + 1)}>
        +
      </button>
    </span>
  );
}

/**
 * Edición rápida en dos barras laterales: a la izquierda el mueble que se edita (lista plegable del
 * proyecto) y el ancho de cada módulo; a la derecha la cantidad de puertas y cajones de cada módulo
 * con la medida de sus frentes. Cada barra se minimiza a un botón.
 */
export function EdicionRapida() {
  const s = useApp();
  const [abiertas, setAbiertas] = useState<Abiertas>(leer);
  const [lista, setLista] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(abiertas));
    } catch {
      /* sin almacenamiento: vuelven abiertas al recargar */
    }
  }, [abiertas]);

  const d = s.diseno;
  if (d.plantilla === 'tocador') return null;
  const proyecto = proyectoDe(s);
  const nombrePrincipal = s.producto?.modelo ?? (proyecto.nombreModelo || NOMBRE_PLANTILLA[proyecto.plantilla]);
  const muebles = mueblesProyecto(proyecto, nombrePrincipal);
  const actual = muebles.find((m) => m.id === s.muebleActivo) ?? muebles[0];
  const nombreMueble = (m: (typeof muebles)[number]) => (m.tipo === 'principal' ? m.nombre : m.cara ? `Isla · ${NOMBRE_CARA[m.cara]}` : m.nombre);
  const grupos = gruposDe(d, true);
  const operar = s.operar;
  const ir = (tramo: (typeof grupos)[number]['tramo'], i: number) => s.set({ tramoActivo: tramo, moduloActivo: i, pestana: 'modulos' });
  const marca = (tramo: string, i: number) => (s.pestana === 'modulos' && s.tramoActivo === tramo && s.moduloActivo === i ? ' activo' : '');
  const etiqueta = (tramo: (typeof grupos)[number]['tramo']) => `${etiquetaTramo(d, tramo).toUpperCase()} · ${formatear(grupos.find((g) => g.tramo === tramo)!.cuerpos.reduce((a, c) => a + c.ancho, 0), s.unidad)}`;
  const conFrentes = (c: Cuerpo) => c.tipo === 'frentes' || c.tipo === 'campana' || c.tipo === 'refrigerador';
  const medida = (g: (typeof grupos)[number], i: number, tipo: 'puerta' | 'cajon') => {
    const f = g.frentes.find((x) => x.cuerpo === i && x.tipo === tipo);
    return f ? `${formatear(f.rect.x1 - f.rect.x0, s.unidad, false)} × ${formatear(f.rect.y1 - f.rect.y0, s.unidad, false)}` : '';
  };

  return (
    <>
      {abiertas.modulos ? (
        <aside className="edicion-rapida izquierda" aria-label="Edición rápida de módulos">
          <div className="edicion-rapida-cabeza">
            <strong>Edición rápida · Módulos</strong>
            <button type="button" aria-label="Minimizar" title="Minimizar" onClick={() => setAbiertas((v) => ({ ...v, modulos: false }))}>
              –
            </button>
          </div>
          <div className="edicion-rapida-cuerpo">
            {muebles.length > 1 && (
              <div className="edicion-rapida-muebles">
                <span className="campo-etiqueta">Mueble que editas</span>
                <button type="button" className="edicion-rapida-elegido" aria-expanded={lista} onClick={() => setLista((v) => !v)}>
                  <span>{nombreMueble(actual)}</span>
                  <span aria-hidden="true">{lista ? '▴' : '▾'}</span>
                </button>
                {lista && (
                  <ul role="listbox" aria-label="Muebles del proyecto">
                    {muebles.map((m) => (
                      <li key={m.id ?? 'principal'}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={m.id === s.muebleActivo}
                          className={m.id === s.muebleActivo ? 'activo' : ''}
                          onClick={() => {
                            s.editarMueble(m.id);
                            setLista(false);
                          }}
                        >
                          <span>{nombreMueble(m)}</span>
                          <small>{formatear(m.diseno.ancho, s.unidad)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {grupos.map((g) => (
              <section key={g.tramo}>
                <h4>{etiqueta(g.tramo)}</h4>
                {g.cuerpos.map((c, i) => {
                  const lim = limitesModulo(d, g.tramo, c);
                  const fijo = lim.min === lim.max;
                  return (
                    <div key={c.id} className={`edicion-rapida-fila${marca(g.tramo, i)}`}>
                      <button type="button" className="numero-modulo" title="Ver este módulo" onClick={() => ir(g.tramo, i)}>
                        {i + 1}
                      </button>
                      <span className="edicion-rapida-nombre" title={nombreModulo(c)}>
                        {nombreModulo(c)}
                        {c.manual && <small> · fijado</small>}
                      </span>
                      {fijo ? (
                        <span className="edicion-rapida-fijo">{formatear(c.ancho, s.unidad)}</span>
                      ) : (
                        <CampoMedida
                          etiqueta={`Ancho del módulo ${i + 1}`}
                          ocultarEtiqueta
                          compacto
                          valor={c.ancho}
                          unidad={s.unidad}
                          min={lim.min}
                          onCambio={(mm) => operar({ op: 'fijarAnchoModulo', tramo: g.tramo, modulo: c.id, ancho: mm }, `ancho-cuerpo-${c.id}`)}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </aside>
      ) : (
        <button type="button" className="edicion-rapida-chip izquierda" onClick={() => setAbiertas((v) => ({ ...v, modulos: true }))}>
          ▸ Módulos
        </button>
      )}

      {abiertas.frentes ? (
        <aside className="edicion-rapida derecha" aria-label="Edición rápida de puertas y cajones">
          <div className="edicion-rapida-cabeza">
            <strong>Edición rápida · Puertas y cajones</strong>
            <button type="button" aria-label="Minimizar" title="Minimizar" onClick={() => setAbiertas((v) => ({ ...v, frentes: false }))}>
              –
            </button>
          </div>
          <div className="edicion-rapida-cuerpo">
            {grupos.map((g) => {
              const filas = g.cuerpos.map((c, i) => ({ c, i })).filter(({ c }) => conFrentes(c));
              if (!filas.length) return null;
              const aereo = g.tramo.startsWith('aereos');
              return (
                <section key={g.tramo}>
                  <h4>{etiqueta(g.tramo)}</h4>
                  {filas.map(({ c, i }) => {
                    const act = (cambios: Partial<Cuerpo>) => operar({ op: 'actualizarModulo', tramo: g.tramo, modulo: c.id, cambios });
                    const puertaFija = c.abatible || c.tipo === 'refrigerador';
                    return (
                      <div key={c.id} className={`edicion-rapida-fila frentes${marca(g.tramo, i)}`}>
                        <button type="button" className="numero-modulo" title="Ver este módulo" onClick={() => ir(g.tramo, i)}>
                          {i + 1}
                        </button>
                        <span className="edicion-rapida-frente">
                          <span className="campo-etiqueta">Puertas</span>
                          {puertaFija ? <span>{c.puertas}</span> : <MasMenos valor={c.puertas} min={c.tipo === 'campana' ? 1 : 0} max={4} etiqueta={`puertas del módulo ${i + 1}`} onCambio={(v) => act({ puertas: v })} />}
                          <small>{medida(g, i, 'puerta')}</small>
                        </span>
                        {!aereo && c.tipo === 'frentes' && (
                          <span className="edicion-rapida-frente">
                            <span className="campo-etiqueta">Cajones</span>
                            <MasMenos valor={c.cajones} min={0} max={8} etiqueta={`cajones del módulo ${i + 1}`} onCambio={(v) => act({ cajones: v })} />
                            <small>{medida(g, i, 'cajon')}</small>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
            <p className="tenue chico">Medidas de cada frente: ancho × alto. Toca el número para ver el módulo.</p>
          </div>
        </aside>
      ) : (
        <button type="button" className="edicion-rapida-chip derecha" onClick={() => setAbiertas((v) => ({ ...v, frentes: true }))}>
          Puertas y cajones ◂
        </button>
      )}
    </>
  );
}
