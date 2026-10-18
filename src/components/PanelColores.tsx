import { useRef, useState } from 'react';
import { esCocina, esCocinaAdulta } from '../../shared/layout';
import type { Material, Materiales } from '../../shared/tipos';
import { muestraMaterial } from '../furniture/texturas';
import { useApp } from '../store/useApp';
import { Segmentado } from './Controles';
import { IcoBasura, IcoSubir } from './Iconos';

function Rejilla({ titulo, lista, valor, onElegir }: { titulo: string; lista: Material[]; valor: string; onElegir: (id: string) => void }) {
  return (
    <div className="muestras" role="radiogroup" aria-label={titulo}>
      {lista.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === valor}
          className={`muestra${m.id === valor ? ' elegida' : ''}`}
          title={m.nombre + (m.origen === 'catalogo-dto' ? ' · catálogo De Todito Outlet' : ' · genérico')}
          onClick={() => onElegir(m.id)}
        >
          <span className="muestra-img" style={{ backgroundImage: `url(${muestraMaterial(m)})` }} />
          <span className="muestra-nombre">{m.nombre}</span>
          {m.origen === 'catalogo-dto' && <span className="sello-dto">DTO</span>}
        </button>
      ))}
    </div>
  );
}

function Muestras({
  titulo,
  ayuda,
  lista,
  valor,
  onElegir,
  subtitulo,
  otros,
  todos,
}: {
  titulo: string;
  ayuda?: string;
  lista: Material[];
  valor: string;
  onElegir: (id: string) => void;
  /** Rótulo sobre la lista principal (p. ej. "Melaminas de cocina"). */
  subtitulo?: string;
  /** Colores secundarios, detrás de "Ver más colores". */
  otros?: Material[];
  /** Todos los materiales, para mostrar el nombre del elegido aunque no esté en la lista. */
  todos?: Material[];
}) {
  // Si el color elegido está entre los secundarios, se abren de entrada para que se vea marcado.
  const [verMas, setVerMas] = useState(() => !!otros?.some((m) => m.id === valor));
  const elegido = (todos ?? [...lista, ...(otros ?? [])]).find((m) => m.id === valor);
  return (
    <section className="grupo-colores">
      <div className="grupo-colores-cabeza">
        <h3>{titulo}</h3>
        <span className="nombre-elegido">{elegido?.nombre}</span>
      </div>
      {ayuda && <p className="tenue chico">{ayuda}</p>}
      {subtitulo && <p className="muestras-subtitulo">{subtitulo}</p>}
      <Rejilla titulo={subtitulo ?? titulo} lista={lista} valor={valor} onElegir={onElegir} />
      {otros && otros.length > 0 && (
        <>
          <button
            type="button"
            className="boton fantasma chico ver-mas-colores"
            aria-expanded={verMas}
            onClick={() => setVerMas((v) => !v)}
          >
            {verMas ? 'Ver menos colores' : `Ver más colores (${otros.length})`}
          </button>
          {verMas && <Rejilla titulo={`${titulo}: otros colores`} lista={otros} valor={valor} onElegir={onElegir} />}
        </>
      )}
    </section>
  );
}

const oficialesPrimero = (lista: Material[]) =>
  [...lista].sort((a, b) => Number(b.origen === 'catalogo-dto') - Number(a.origen === 'catalogo-dto'));

/** Reduce la imagen subida para que el diseño no pese demasiado. */
function reducirImagen(archivo: File, maximo = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maximo / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export function PanelColores() {
  const materiales = useApp((s) => s.materiales);
  const d = useApp((s) => s.diseno);
  const cambiar = useApp((s) => s.cambiar);
  const avisar = useApp((s) => s.avisar);
  const archivo = useRef<HTMLInputElement>(null);
  if (!materiales) return <aside className="panel-colores cargando">Cargando colores…</aside>;
  const set = (cambios: Partial<Materiales>) => cambiar((x) => ({ ...x, materiales: { ...x.materiales, ...cambios } }));
  // Cubierta postformada: cocina, cocina infantil y compacto (el compacto también lleva cubierta).
  const conCubierta = esCocina(d);
  // Las melaminas "cocina" son exclusivas de los muebles de cocina (cocina y compacto).
  const deCocina = esCocinaAdulta(d);
  const melaminasCocina = materiales.melaminas.filter((m) => m.cocina);
  const melaminasResto = oficialesPrimero(materiales.melaminas.filter((m) => !m.cocina));
  // Cuerpo (casco): todos los colores; Blanco primero porque es el habitual.
  const melaminasCasco = [
    ...materiales.melaminas.filter((m) => m.id === 'blanco'),
    ...oficialesPrimero(materiales.melaminas.filter((m) => m.id !== 'blanco')),
  ];
  const cubiertasOrdenadas = oficialesPrimero(materiales.cubiertas);

  return (
    <aside className="panel-colores" aria-label="Colores y terminaciones">
      <div className="panel-colores-cabeza">
        <h2>Colores</h2>
        <p className="nota-colores" title={materiales.nota}>
          Los marcados <span className="sello-dto inline">DTO</span> son colores oficiales de la tienda
        </p>
      </div>
      {deCocina && melaminasCocina.length > 0 ? (
        <Muestras
          key="frente-cocina"
          titulo="Melamina de frentes"
          ayuda="Puertas, cajones y fajas."
          subtitulo="Melaminas de cocina"
          lista={melaminasCocina}
          otros={melaminasResto}
          todos={materiales.melaminas}
          valor={d.materiales.frente}
          onElegir={(id) => set({ frente: id })}
        />
      ) : (
        <Muestras
          key="frente"
          titulo="Melamina de frentes"
          ayuda="Puertas, cajones y fajas."
          lista={melaminasResto}
          todos={materiales.melaminas}
          valor={d.materiales.frente}
          onElegir={(id) => set({ frente: id })}
        />
      )}
      {conCubierta && (
        <Muestras titulo="Cubierta postformada" lista={cubiertasOrdenadas} valor={d.materiales.cubierta} onElegir={(id) => set({ cubierta: id })} />
      )}
      <Muestras
        titulo="Melamina del cuerpo"
        ayuda="Costados, base y repisas (casco)."
        lista={melaminasCasco}
        valor={d.materiales.casco}
        onElegir={(id) => set({ casco: id })}
      />
      <section className="grupo-colores">
        <div className="grupo-colores-cabeza">
          <h3>Tiradores</h3>
        </div>
        <Segmentado
          valor={d.tirador}
          onCambio={(v) => cambiar((x) => ({ ...x, tirador: v }))}
          opciones={[
            { valor: 'barra', texto: 'Barra' },
            { valor: 'boton', texto: 'Botón' },
            { valor: 'unero', texto: 'Uñero' },
            { valor: 'sin', texto: 'Sin' },
          ]}
        />
        {d.tirador !== 'sin' && (
          <div className="muestras chicas" role="radiogroup" aria-label="Color de tirador">
            {materiales.tiradores.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === d.materiales.tirador}
                className={`muestra metal${m.id === d.materiales.tirador ? ' elegida' : ''}`}
                title={m.nombre}
                onClick={() => set({ tirador: m.id })}
              >
                <span
                  className="muestra-img"
                  style={{ background: `radial-gradient(circle at 35% 30%, #ffffff ${m.metal ? 0 : 100}%, ${m.color} 55%, #00000055 120%)`, backgroundColor: m.color }}
                />
                <span className="muestra-nombre">{m.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="grupo-colores">
        <div className="grupo-colores-cabeza">
          <h3>Imagen en los frentes</h3>
        </div>
        <p className="tenue chico">Sube una foto, dibujo o diseño y la imprimimos sobre puertas y cajones.</p>
        <input
          ref={archivo}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const url = await reducirImagen(f);
              cambiar((x) => ({ ...x, imagenFrontal: url }));
            } catch (err) {
              avisar((err as Error).message, 'error');
            }
          }}
        />
        <div className="fila-botones">
          <button type="button" className="boton secundario chico" onClick={() => archivo.current?.click()}>
            <IcoSubir width={15} height={15} /> {d.imagenFrontal ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {d.imagenFrontal && (
            <button type="button" className="boton-icono peligro" aria-label="Quitar imagen" onClick={() => cambiar((x) => ({ ...x, imagenFrontal: null }))}>
              <IcoBasura width={16} height={16} />
            </button>
          )}
        </div>
        {d.imagenFrontal && <img className="vista-imagen" src={d.imagenFrontal} alt="Imagen aplicada a los frentes" />}
      </section>
    </aside>
  );
}
