import { useEffect, useMemo, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { recomendaciones } from '../../shared/recomendaciones';
import { useApp } from '../store/useApp';

const CLAVE = 'dto-recomendaciones';
type Estado = { x: number; y: number; abierto: boolean };

function leer(): Estado | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null;
  } catch {
    return null;
  }
}

/**
 * Cuadro flotante con las recomendaciones del mueble que se edita: lo que cabe idealmente en
 * cada tramo (puertas, cajones, módulos) según sus medidas y las de los equipos. Se mueve
 * arrastrando su cabecera y se cierra a un botón chico que muestra cuántos avisos hay.
 */
export function RecomendacionesFlotante() {
  const d = useApp((s) => s.diseno);
  const unidad = useApp((s) => s.unidad);
  const operar = useApp((s) => s.operar);
  const grupos = useMemo(() => recomendaciones(d, unidad), [d, unidad]);
  const avisos = grupos.reduce((n, g) => n + g.items.filter((i) => i.nivel === 'aviso').length, 0);
  const sugerencias = grupos.reduce((n, g) => n + g.items.filter((i) => i.nivel !== 'ok').length, 0);
  const [e, setE] = useState<Estado>(() => leer() ?? { x: 12, y: 132, abierto: false });
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(e));
    } catch {
      /* sin almacenamiento: vuelve a su lugar al recargar */
    }
  }, [e]);
  const acotar = (x: number, y: number) => {
    const r = caja.current?.getBoundingClientRect();
    return { x: Math.max(4, Math.min(window.innerWidth - (r?.width ?? 200) - 4, x)), y: Math.max(60, Math.min(window.innerHeight - 80, y)) };
  };
  useEffect(() => {
    const ubicar = () => setE((v) => ({ ...v, ...acotar(v.x, v.y) }));
    window.addEventListener('resize', ubicar);
    return () => window.removeEventListener('resize', ubicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bajar = (ev: EventoPuntero<HTMLDivElement>) => {
    if ((ev.target as HTMLElement).closest('button')) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    arrastre.current = { dx: ev.clientX - e.x, dy: ev.clientY - e.y };
  };
  const mover = (ev: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    if (a) setE((v) => ({ ...v, ...acotar(ev.clientX - a.dx, ev.clientY - a.dy) }));
  };
  const soltar = () => (arrastre.current = null);

  if (!e.abierto)
    return (
      <button
        type="button"
        className={`recomendaciones-chip${avisos ? ' con-avisos' : ''}`}
        style={{ left: e.x, top: e.y }}
        onClick={() => setE((v) => ({ ...v, abierto: true }))}
        title="Ver recomendaciones de puertas, cajones y módulos"
      >
        💡 Recomendaciones{sugerencias ? <span className="recomendaciones-cuenta">{sugerencias}</span> : null}
      </button>
    );

  return (
    <div ref={caja} className="recomendaciones-flotante" style={{ left: e.x, top: e.y }} role="dialog" aria-label="Recomendaciones">
      <div className="recomendaciones-cabeza" onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} title="Arrastra para mover">
        <strong>💡 Recomendaciones</strong>
        <button type="button" className="cerrar-seccion" aria-label="Cerrar recomendaciones" onClick={() => setE((v) => ({ ...v, abierto: false }))}>
          ✕
        </button>
      </div>
      <div className="recomendaciones-cuerpo">
        {grupos.length === 0 && <p className="tenue">Todo en orden: las medidas, puertas y cajones están dentro de lo recomendado.</p>}
        {grupos.map((g) => (
          <section key={g.titulo}>
            <h3>{g.titulo}</h3>
            <ul>
              {g.items.map((it, k) => (
                <li key={k} className={`nivel-${it.nivel}`}>
                  <span>{it.texto}</span>
                  {it.accion && (
                    <button type="button" className="boton secundario chico" onClick={() => operar(it.accion!.op)}>
                      {it.accion.texto}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="tenue chico">Son sugerencias según las medidas estándar: todas las medidas se pueden editar.</p>
      </div>
    </div>
  );
}
