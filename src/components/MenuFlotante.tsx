import { useEffect, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { useApp } from '../store/useApp';
import { pestanasDe } from './Pestanas';

const CLAVE = 'dto-menu-flotante';
type Estado = { x: number; y: number; vertical: boolean; achicado: boolean };

function leer(): Estado | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null;
  } catch {
    return null;
  }
}

function guardar(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* sin almacenamiento: el menú vuelve a su lugar al recargar */
  }
}

/**
 * Menú flotante con las ediciones (módulos, puertas, cajones, equipos y colores), como la barra
 * flotante del teclado de una tablet: se arrastra a cualquier lugar, se pone vertical u horizontal
 * y se achica pegado a un costado. Cada botón abre su sección en la franja inferior.
 */
export function MenuFlotante() {
  const plantilla = useApp((s) => s.diseno.plantilla);
  const pestana = useApp((s) => s.pestana);
  const set = useApp((s) => s.set);
  const caja = useRef<HTMLDivElement>(null);
  const [e, setE] = useState<Estado>(() => leer() ?? { x: -1, y: 150, vertical: true, achicado: false });
  const arrastre = useRef<{ dx: number; dy: number; movio: boolean } | null>(null);
  const opciones = [...pestanasDe(plantilla).map((p) => ({ id: p.id, texto: p.id === 'equipamiento' && p.texto === 'Equipamiento' ? 'Equipos' : p.texto })), { id: 'colores' as const, texto: 'Colores' }];

  // Mantiene el menú dentro de la pantalla (también al girar la tablet).
  const acotar = (x: number, y: number) => {
    const r = caja.current?.getBoundingClientRect();
    const w = r?.width ?? 60;
    const h = r?.height ?? 60;
    return { x: Math.max(4, Math.min(window.innerWidth - w - 4, x)), y: Math.max(60, Math.min(window.innerHeight - h - 4, y)) };
  };
  useEffect(() => {
    const ubicar = () => setE((v) => ({ ...v, ...acotar(v.x < 0 ? window.innerWidth : v.x, v.y) }));
    ubicar();
    window.addEventListener('resize', ubicar);
    return () => window.removeEventListener('resize', ubicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.vertical, e.achicado]);
  useEffect(() => guardar(e), [e]);

  const bajar = (ev: EventoPuntero<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    arrastre.current = { dx: ev.clientX - e.x, dy: ev.clientY - e.y, movio: false };
  };
  const mover = (ev: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    a.movio = true;
    setE((v) => ({ ...v, ...acotar(ev.clientX - a.dx, ev.clientY - a.dy) }));
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    // Achicado: un toque sin arrastrar lo vuelve a abrir.
    if (a && !a.movio && e.achicado) setE((v) => ({ ...v, achicado: false }));
  };

  const achicar = () => {
    // Se pega al costado más cercano.
    const r = caja.current?.getBoundingClientRect();
    const centro = (r?.left ?? 0) + (r?.width ?? 0) / 2;
    setE((v) => ({ ...v, achicado: true, x: centro < window.innerWidth / 2 ? 0 : window.innerWidth }));
  };

  return (
    <div
      ref={caja}
      className={`menu-flotante${e.vertical ? ' vertical' : ''}${e.achicado ? ' achicado' : ''}`}
      style={{ left: e.x, top: e.y }}
      role="toolbar"
      aria-label="Ediciones del mueble"
    >
      <div
        className="menu-flotante-asa"
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        title={e.achicado ? 'Toca para abrir el menú · arrastra para moverlo' : 'Arrastra para mover el menú'}
        aria-label={e.achicado ? 'Abrir el menú de ediciones' : 'Mover el menú'}
        role="button"
      >
        {e.achicado ? '☰' : '⠿'}
      </div>
      {!e.achicado && (
        <>
          {opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              className={pestana === o.id ? 'activa' : ''}
              aria-pressed={pestana === o.id}
              onClick={() => set({ pestana: pestana === o.id ? null : o.id })}
            >
              {o.texto}
            </button>
          ))}
          <div className="menu-flotante-ajustes">
            <button
              type="button"
              className="con-texto"
              title={e.vertical ? 'Poner horizontal' : 'Poner vertical'}
              aria-label={e.vertical ? 'Poner horizontal' : 'Poner vertical'}
              onClick={() => setE((v) => ({ ...v, vertical: !v.vertical }))}
            >
              {e.vertical ? '⇆ Horizontal' : '⇅'}
            </button>
            <button type="button" title="Achicar al costado" aria-label="Achicar el menú al costado" onClick={achicar}>
              ⇥
            </button>
          </div>
        </>
      )}
    </div>
  );
}
