import { useState } from 'react';
import { NOMBRE_ESCENARIO } from '../../shared/catalogo';
import { formatear } from '../../shared/reglas';
import type { Escenario } from '../../shared/tipos';
import { escenarioActual, useApp, type Vista } from '../store/useApp';
import { BotonAsistente } from './Asistente';
import { IcoArriba, IcoCamara, IcoCentrar, IcoCubo, IcoFoto, IcoFrente, IcoPuerta, IcoRegla, IcoX } from './Iconos';

export function BarraVisor() {
  const s = useApp();
  const tipo = escenarioActual(s.escenario, s.producto, s.diseno);
  const vistas: { v: Vista; texto: string; icono: JSX.Element }[] = [
    { v: 'perspectiva', texto: '3D', icono: <IcoCubo width={16} height={16} /> },
    { v: 'frontal', texto: 'Frente', icono: <IcoFrente width={16} height={16} /> },
    { v: 'superior', texto: 'Arriba', icono: <IcoArriba width={16} height={16} /> },
  ];

  const capturar = () => {
    const url = s.capturar?.();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `diseno-${(s.producto?.modelo ?? s.diseno.plantilla).toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.jpg`;
    a.click();
  };

  return (
    <>
      <div className="barra-visor izquierda">
        <label className="selector-escenario">
          <span>Escenario</span>
          <select value={s.escenario} onChange={(e) => s.set({ escenario: e.target.value as Escenario | 'auto' })}>
            <option value="auto">Automático · {NOMBRE_ESCENARIO[tipo]}</option>
            {(Object.keys(NOMBRE_ESCENARIO) as Escenario[]).map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESCENARIO[e]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="barra-visor derecha" role="toolbar" aria-label="Herramientas del visor">
        <BotonAsistente />
        <div className="segmentado oscuro" role="radiogroup" aria-label="Vista">
          {vistas.map((x) => (
            <button
              key={x.v}
              type="button"
              role="radio"
              aria-checked={s.vista === x.v}
              className={s.vista === x.v ? 'activo' : ''}
              onClick={() => s.set({ vista: x.v, encuadre: s.encuadre + 1 })}
              title={`Vista ${x.texto}`}
            >
              {x.icono}
              <span>{x.texto}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`boton-visor${s.abierto ? ' activo' : ''}`} aria-pressed={s.abierto} onClick={() => s.set({ abierto: !s.abierto })}>
          <IcoPuerta /> <span>{s.abierto ? 'Cerrar' : 'Abrir'} puertas</span>
        </button>
        <button type="button" className={`boton-visor${s.cotas ? ' activo' : ''}`} aria-pressed={s.cotas} onClick={() => s.set({ cotas: !s.cotas })}>
          <IcoRegla /> <span>Cotas</span>
        </button>
        {s.producto?.imagen_url && (
          <button type="button" className={`boton-visor${s.fotoRef ? ' activo' : ''}`} aria-pressed={s.fotoRef} onClick={() => s.set({ fotoRef: !s.fotoRef })}>
            <IcoFoto /> <span>Foto</span>
          </button>
        )}
        <button type="button" className="boton-visor solo-icono" title="Centrar" aria-label="Centrar vista" onClick={() => s.set({ encuadre: s.encuadre + 1 })}>
          <IcoCentrar />
        </button>
        <button type="button" className="boton-visor solo-icono" title="Descargar imagen" aria-label="Descargar imagen del diseño" onClick={capturar}>
          <IcoCamara />
        </button>
      </div>

      {s.producto?.imagen_url && s.fotoRef && <FotoReferencia />}

      <p className="pista-visor">Arrastra para girar · rueda o pellizco para acercar · clic en una puerta o cajón para abrirlo</p>
    </>
  );
}

function FotoReferencia() {
  const producto = useApp((s) => s.producto)!;
  const unidad = useApp((s) => s.unidad);
  const set = useApp((s) => s.set);
  const [grande, setGrande] = useState(false);
  const [rota, setRota] = useState(false);
  const m = producto.medidasBase;
  if (rota) return null;
  return (
    <figure className={`foto-referencia${grande ? ' grande' : ''}`}>
      <button type="button" className="foto-boton" onClick={() => setGrande((v) => !v)} aria-label={grande ? 'Reducir foto' : 'Ampliar foto'}>
        <img src={producto.imagen_url!} alt={producto.nombre} referrerPolicy="no-referrer" onError={() => setRota(true)} />
      </button>
      <figcaption>
        <span className="tenue chico">Producto base · detoditooutlet.cl</span>
        <strong>{producto.modelo}</strong>
        <span className="chico">
          {formatear(m.ancho, unidad, false)} × {formatear(m.alto, unidad, false)} × {formatear(m.profundidad, unidad)}
          {m.estimadas ? ' (aprox.)' : ''}
        </span>
      </figcaption>
      <button type="button" className="boton-icono cerrar-foto" aria-label="Ocultar foto" onClick={() => set({ fotoRef: false })}>
        <IcoX width={14} height={14} />
      </button>
    </figure>
  );
}
