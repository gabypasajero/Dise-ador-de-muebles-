// Asistente de diseño con IA (Google Gemini, vía la función de Vercel /api/asistente).
// El vendedor escribe lo que necesita; la función devuelve un PLAN (mensaje, dudas y
// operaciones del motor) y aquí se revisa y se aplica con aplicarPlan() sobre el diseño
// actual. Todo lo aplicado entra como UN solo paso del historial (se deshace de una vez).
import { useEffect, useRef, useState, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import {
  LIMITE_INSTRUCCION,
  aplicarPlan,
  coloresAsistente,
  sanearPlan,
  type OperacionAplicada,
  type OperacionRechazada,
  type TurnoAsistente,
} from '../../shared/asistente';
import { tramosDe } from '../../shared/reglas';
import type { Diseno } from '../../shared/tipos';
import { backend } from '../datos';
import { supabase } from '../datos/supabase';
import { useApp } from '../store/useApp';
import { IcoX } from './Iconos';

const EJEMPLOS_COCINA = [
  'Hazla en L con el lado derecho de 1,6 m',
  'Agrega un especiero al lado del horno',
  'Lavaplatos doble pegado a la derecha, sin llave',
  'Agrega aéreos de 70 cm de alto con campana',
  'Frentes verde salvia y cubierta Calacatta',
];
const EJEMPLOS_MUEBLE = [
  'Hazlo de 2 m de ancho y 2,2 m de alto',
  'Agrega una cajonera de 4 cajones',
  'Que todas las puertas abran hacia la izquierda',
  'Frentes color nogal con tirador de botón',
];

const SIN_PUBLICAR = 'El asistente necesita la versión publicada del diseñador (en Vercel, con tu sesión de vendedor). En esta versión de prueba no está disponible.';

interface Respuesta {
  instruccion: string;
  mensaje: string;
  dudas: string[];
  aplicadas: OperacionAplicada[];
  rechazadas: OperacionRechazada[];
}

const IcoChispa = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M12 3.5 13.9 9a1.6 1.6 0 0 0 1.1 1.1L20.5 12l-5.5 1.9a1.6 1.6 0 0 0-1.1 1.1L12 20.5 10.1 15a1.6 1.6 0 0 0-1.1-1.1L3.5 12 9 10.1A1.6 1.6 0 0 0 10.1 9z" />
    <path d="M19 3v3M17.5 4.5h3" />
  </svg>
);

/** Botón «Asistente IA» de la barra del visor; abre y cierra el panel. */
export function BotonAsistente() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`boton-visor boton-asistente${abierto ? ' activo' : ''}`}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Diseñar con el asistente de IA"
        onClick={() => setAbierto((v) => !v)}
      >
        <IcoChispa width={16} height={16} /> <span>Asistente IA</span>
      </button>
      {abierto && createPortal(<PanelAsistente onCerrar={() => setAbierto(false)} />, document.body)}
    </>
  );
}

async function tokenSesion(): Promise<string | null> {
  if (backend.tipo !== 'supabase') return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Si el tramo o el módulo elegidos dejaron de existir, vuelve al tramo principal. */
function seleccion(d: Diseno, tramo: string, modulo: number) {
  return tramosDe(d).includes(tramo as never) ? { moduloActivo: modulo } : { tramoActivo: 'base' as const, moduloActivo: 0 };
}

export function PanelAsistente({ onCerrar }: { onCerrar: () => void }) {
  const plantilla = useApp((s) => s.diseno.plantilla);
  const sesion = useApp((s) => s.sesion);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const historial = useRef<TurnoAsistente[]>([]);
  const caja = useRef<HTMLTextAreaElement>(null);
  const pedido = useRef<AbortController | null>(null);
  const local = backend.tipo === 'local';
  const ejemplos = plantilla === 'cocina' || plantilla === 'compacto' ? EJEMPLOS_COCINA : EJEMPLOS_MUEBLE;

  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  // Solo al abrir y cerrar el panel (la barra se vuelve a dibujar con cada cambio del diseño).
  useEffect(() => {
    caja.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current();
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      pedido.current?.abort();
    };
  }, []);

  const disenar = async () => {
    const instruccion = texto.trim();
    if (!instruccion || pensando) return;
    const s = useApp.getState();
    setPensando(true);
    setError(null);
    setRespuesta(null);
    const control = new AbortController();
    pedido.current = control;
    try {
      const token = await tokenSesion().catch(() => null);
      if (!local && !token) throw new Error('Tu sesión venció: vuelve a ingresar para usar el asistente.');
      const r = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token ?? 'local'}` },
        body: JSON.stringify({
          instruccion,
          diseno: { ...s.diseno, imagenFrontal: null },
          contexto: {
            colores: s.materiales ? coloresAsistente(s.materiales) : null,
            historial: historial.current,
            producto: s.producto ? `${s.producto.nombre}${s.producto.variante ? ` (${s.producto.variante})` : ''}` : null,
          },
        }),
        signal: control.signal,
      });
      const datos = (await r.json().catch(() => null)) as { plan?: unknown; error?: string } | null;
      if (!datos) throw new Error(r.status === 404 || local ? SIN_PUBLICAR : 'El asistente no respondió bien. Intenta de nuevo en un momento.');
      if (!r.ok || datos.error) throw new Error(datos.error || 'No se pudo consultar al asistente.');
      const plan = sanearPlan(datos.plan);
      if (!plan) throw new Error('La IA respondió algo que no se pudo leer. Intenta de nuevo.');

      // Se aplica sobre el diseño de AHORA (el vendedor pudo seguir editando mientras esperaba).
      const ahora = useApp.getState();
      const res = aplicarPlan(ahora.diseno, plan, { materiales: ahora.materiales });
      if (res.diseno !== ahora.diseno) {
        ahora.cambiar(() => res.diseno);
        useApp.setState(seleccion(res.diseno, ahora.tramoActivo, ahora.moduloActivo));
      }
      const mensaje = res.mensaje || (res.aplicadas.length ? 'Listo.' : 'No hice cambios.');
      historial.current = [...historial.current, { instruccion, mensaje }].slice(-4);
      setRespuesta({ instruccion, mensaje, dudas: res.dudas, aplicadas: res.aplicadas, rechazadas: res.rechazadas });
      setTexto('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof TypeError ? 'No hay conexión con el asistente. Revisa internet e intenta de nuevo.' : (e as Error).message);
    } finally {
      if (pedido.current === control) pedido.current = null;
      setPensando(false);
    }
  };

  const alternativa = (x: OperacionRechazada) => {
    if (!x.alternativa) return;
    const r = useApp.getState().operar(x.alternativa);
    if (r.ok) setRespuesta((v) => v && { ...v, rechazadas: v.rechazadas.filter((y) => y !== x), aplicadas: [...v.aplicadas, { n: x.n, op: x.alternativa!, descripcion: `${x.descripcion} (ajustando el largo)`, avisos: r.avisos }] });
  };

  return (
    <section className="asistente" role="dialog" aria-label="Asistente de diseño con IA">
      <header className="asistente-cabecera">
        <span className="asistente-icono">
          <IcoChispa />
        </span>
        <div>
          <strong>Asistente de diseño</strong>
          <small>Dile qué necesita tu cliente y lo dibujo en el diseño.</small>
        </div>
        <button type="button" className="boton-icono" aria-label="Cerrar el asistente" onClick={onCerrar}>
          <IcoX width={16} height={16} />
        </button>
      </header>

      <div className="asistente-cuerpo" aria-live="polite">
        {(local || sesion !== 'activa') && <p className="asistente-nota">{local ? SIN_PUBLICAR : 'Ingresa con tu cuenta de vendedor para usar el asistente (funciona en la versión publicada).'}</p>}

        {!respuesta && !pensando && !error && (
          <div className="asistente-ejemplos">
            <span className="tenue chico">Prueba con:</span>
            {ejemplos.map((x) => (
              <button
                key={x}
                type="button"
                className="asistente-ejemplo"
                onClick={() => {
                  setTexto(x);
                  caja.current?.focus();
                }}
              >
                {x}
              </button>
            ))}
          </div>
        )}

        {pensando && (
          <p className="asistente-pensando">
            <span className="asistente-puntos" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Pensando…
          </p>
        )}

        {error && (
          <p className="asistente-error" role="alert">
            {error}
          </p>
        )}

        {respuesta && (
          <div className="asistente-respuesta">
            <p className="asistente-pedido">«{respuesta.instruccion}»</p>
            <p className="asistente-mensaje">{respuesta.mensaje}</p>
            {respuesta.dudas.length > 0 && (
              <ul className="asistente-dudas">
                {respuesta.dudas.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {respuesta.aplicadas.length > 0 && (
              <div className="asistente-lista">
                <h4>
                  Cambios aplicados ({respuesta.aplicadas.length}) <span className="tenue chico">· se deshacen de una vez</span>
                </h4>
                <ul>
                  {respuesta.aplicadas.map((a) => (
                    <li key={a.n} className="aplicada">
                      <span>{a.descripcion}</span>
                      {a.avisos.map((x) => (
                        <small key={x}>{x}</small>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {respuesta.rechazadas.length > 0 && (
              <div className="asistente-lista">
                <h4>No se pudo ({respuesta.rechazadas.length})</h4>
                <ul>
                  {respuesta.rechazadas.map((x) => (
                    <li key={x.n} className="rechazada">
                      <span>{x.descripcion}</span>
                      <small>{x.motivo}</small>
                      {x.alternativa && (
                        <button type="button" className="boton chico secundario" onClick={() => alternativa(x)}>
                          {x.alternativa.op === 'quitarModulo' ? 'Quitarlo achicando el mueble' : 'Hacerlo agrandando el mueble'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        className="asistente-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void disenar();
        }}
      >
        <textarea
          ref={caja}
          value={texto}
          maxLength={LIMITE_INSTRUCCION}
          rows={3}
          placeholder="Ej.: cocina en U de 2,4 m con lados de 1,2 y 2 m, horno y encimera de 4 platos"
          aria-label="Qué necesitas"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void disenar();
            }
          }}
        />
        <div className="asistente-acciones">
          <span className="tenue chico">La IA puede equivocarse: revisa el diseño antes de cotizar.</span>
          <button type="submit" className="boton primario" disabled={pensando || !texto.trim()}>
            <IcoChispa width={16} height={16} /> {pensando ? 'Pensando…' : 'Diseñar'}
          </button>
        </div>
      </form>
    </section>
  );
}
