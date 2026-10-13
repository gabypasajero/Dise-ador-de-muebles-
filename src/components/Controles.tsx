import { useEffect, useId, useState, type ReactNode } from 'react';
import { aUnidad, deUnidad } from '../../shared/reglas';
import type { Unidad } from '../../shared/tipos';
import { IcoMas, IcoMenos } from './Iconos';

/** Campo numérico que muestra mm convertidos a la unidad elegida. */
export function CampoMedida({
  valor,
  unidad,
  onCambio,
  min,
  max,
  paso,
  etiqueta,
  compacto,
  deshabilitado,
  ocultarEtiqueta,
}: {
  valor: number;
  unidad: Unidad;
  onCambio: (mm: number) => void;
  min?: number;
  max?: number;
  paso?: number;
  etiqueta?: string;
  compacto?: boolean;
  deshabilitado?: boolean;
  /** La etiqueta solo la leen los lectores de pantalla. */
  ocultarEtiqueta?: boolean;
}) {
  const id = useId();
  const mostrar = (mm: number) => String(aUnidad(mm, unidad)).replace('.', ',');
  const [texto, setTexto] = useState(mostrar(valor));
  const [editando, setEditando] = useState(false);
  useEffect(() => {
    if (!editando) setTexto(mostrar(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, unidad, editando]);
  const pasoMm = paso ?? (unidad === 'cm' ? 10 : 1);
  const aplicar = (t: string, final: boolean) => {
    const n = parseFloat(t.replace(',', '.'));
    if (!Number.isFinite(n)) {
      if (final) setTexto(mostrar(valor));
      return;
    }
    let mm = deUnidad(n, unidad);
    if (final) {
      if (min != null) mm = Math.max(min, mm);
      if (max != null) mm = Math.min(max, mm);
      onCambio(mm);
      setTexto(mostrar(mm));
    } else if ((min == null || mm >= min) && (max == null || mm <= max)) {
      onCambio(mm);
    }
  };
  return (
    <div className={`campo-medida${compacto ? ' compacto' : ''}`}>
      {etiqueta && (
        <label htmlFor={id} className={ocultarEtiqueta ? 'solo-lectores' : 'campo-etiqueta'}>
          {etiqueta}
        </label>
      )}
      <div className="campo-fila">
        <button
          type="button"
          className="boton-icono suave"
          aria-label={`Restar ${etiqueta ?? ''}`}
          disabled={deshabilitado || (min != null && valor <= min)}
          onClick={() => onCambio(Math.max(min ?? -Infinity, valor - pasoMm))}
        >
          <IcoMenos width={14} height={14} />
        </button>
        <div className="campo-caja">
          <input
            id={id}
            inputMode="decimal"
            value={texto}
            disabled={deshabilitado}
            onFocus={(e) => {
              setEditando(true);
              e.target.select();
            }}
            onChange={(e) => {
              setTexto(e.target.value);
              aplicar(e.target.value, false);
            }}
            onBlur={(e) => {
              setEditando(false);
              aplicar(e.target.value, true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                onCambio(Math.min(max ?? Infinity, valor + pasoMm));
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                onCambio(Math.max(min ?? -Infinity, valor - pasoMm));
              }
            }}
          />
          <span className="campo-unidad">{unidad}</span>
        </div>
        <button
          type="button"
          className="boton-icono suave"
          aria-label={`Sumar ${etiqueta ?? ''}`}
          disabled={deshabilitado || (max != null && valor >= max)}
          onClick={() => onCambio(Math.min(max ?? Infinity, valor + pasoMm))}
        >
          <IcoMas width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export function Contador({
  valor,
  min = 0,
  max = 10,
  onCambio,
  etiqueta,
}: {
  valor: number;
  min?: number;
  max?: number;
  onCambio: (v: number) => void;
  etiqueta: string;
}) {
  return (
    <div className="contador">
      <span className="campo-etiqueta">{etiqueta}</span>
      <div className="contador-fila">
        <button type="button" className="boton-icono suave" aria-label={`Menos ${etiqueta}`} disabled={valor <= min} onClick={() => onCambio(valor - 1)}>
          <IcoMenos width={14} height={14} />
        </button>
        <output aria-live="polite">{valor}</output>
        <button type="button" className="boton-icono suave" aria-label={`Más ${etiqueta}`} disabled={valor >= max} onClick={() => onCambio(valor + 1)}>
          <IcoMas width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: T; texto: ReactNode; titulo?: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta?: string;
}) {
  return (
    <div className="segmentado-grupo">
      {etiqueta && <span className="campo-etiqueta">{etiqueta}</span>}
      <div className="segmentado" role="radiogroup" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={o.valor === valor}
            title={o.titulo}
            className={o.valor === valor ? 'activo' : ''}
            onClick={() => onCambio(o.valor)}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Interruptor({ activo, onCambio, texto }: { activo: boolean; onCambio: (v: boolean) => void; texto: string }) {
  return (
    <label className="interruptor">
      <input type="checkbox" checked={activo} onChange={(e) => onCambio(e.target.checked)} />
      <span className="interruptor-pista" aria-hidden="true" />
      <span>{texto}</span>
    </label>
  );
}

export function Selector<T extends string | number>({
  valor,
  opciones,
  onCambio,
  etiqueta,
}: {
  valor: T;
  opciones: { valor: T; texto: string }[];
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  const id = useId();
  return (
    <div className="selector">
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <select
        id={id}
        value={String(valor)}
        onChange={(e) => {
          const o = opciones.find((x) => String(x.valor) === e.target.value);
          if (o) onCambio(o.valor);
        }}
      >
        {opciones.map((o) => (
          <option key={String(o.valor)} value={String(o.valor)}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
