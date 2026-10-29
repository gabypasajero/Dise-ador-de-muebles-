import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { mueblesProyecto, NOMBRE_CARA } from '../../shared/proyecto';
import { proyectoDe, useApp } from '../store/useApp';
import { etiquetaTramo, tramosOrdenados } from './Pestanas';

/**
 * «Qué estás editando», arriba de Puertas, Cajones, Módulos y espacios y Equipos: el mueble del
 * proyecto (principal, islas y sus caras, muebles en línea) y la parte de ese mueble (principal,
 * lados de la L o la U, aéreo y sus lados). Cada pestaña muestra solo lo elegido.
 */
export function SelectorParte() {
  const s = useApp();
  const proyecto = proyectoDe(s);
  const nombrePrincipal = s.producto?.modelo ?? (proyecto.nombreModelo || NOMBRE_PLANTILLA[proyecto.plantilla]);
  const muebles = mueblesProyecto(proyecto, nombrePrincipal);
  const tramos = tramosOrdenados(s.diseno);
  if (muebles.length <= 1 && tramos.length <= 1) return null;
  const nombreCorto = (m: (typeof muebles)[number]) => (m.tipo === 'principal' ? 'Principal' : m.cara ? `Isla · ${NOMBRE_CARA[m.cara]}` : m.nombre);
  return (
    <div className="selector-parte">
      {muebles.length > 1 && (
        <div className="selector-parte-fila" role="tablist" aria-label="Mueble que editas">
          <span className="campo-etiqueta">Mueble</span>
          {muebles.map((m) => (
            <button
              key={m.id ?? 'principal'}
              type="button"
              role="tab"
              aria-selected={m.id === s.muebleActivo}
              className={m.id === s.muebleActivo ? 'activo' : ''}
              title={m.nombre}
              onClick={() => s.editarMueble(m.id)}
            >
              {nombreCorto(m)}
            </button>
          ))}
        </div>
      )}
      {tramos.length > 1 && (
        <div className="selector-parte-fila" role="tablist" aria-label="Parte que editas">
          <span className="campo-etiqueta">Parte</span>
          {tramos.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === s.tramoActivo} className={t === s.tramoActivo ? 'activo' : ''} onClick={() => s.set({ tramoActivo: t, moduloActivo: 0 })}>
              {etiquetaTramo(s.diseno, t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
