// Categorías de medidas del panel inferior: puertas, cajones, módulos y
// espacios, equipamiento/interior. Cambian según el tipo de mueble.
import { calcularLayout, calcularLayoutTocador, type Frente } from '../../shared/layout';
import {
  ANCHO_MIN_CUERPO,
  actualizarCuerpo,
  agregarCuerpo,
  fijarSeparacion,
  formatear,
  moverCuerpo,
  quitarCuerpo,
} from '../../shared/reglas';
import type { Cuerpo, Diseno, Plantilla, Unidad } from '../../shared/tipos';
import type { Pestana } from '../store/useApp';
import { CampoMedida, Contador, Interruptor, Segmentado, Selector } from './Controles';
import { IcoBasura, IcoDer, IcoIzq, IcoMas } from './Iconos';

type Cambiar = (f: (d: Diseno) => Diseno, grupo?: string) => void;

interface PropsPestana {
  d: Diseno;
  unidad: Unidad;
  cambiar: Cambiar;
}

export function pestanasDe(p: Plantilla): { id: Pestana; texto: string }[] {
  switch (p) {
    case 'cocina':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Equipamiento' },
      ];
    case 'cocina-infantil':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Equipamiento' },
      ];
    case 'closet':
    case 'escritorio':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Interior' },
      ];
    case 'comoda':
      return [
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Extras' },
      ];
    case 'tocador':
      return [
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Estructura' },
        { id: 'equipamiento', texto: 'Espejo y luz' },
      ];
  }
}

const NOMBRE_TIPO: Record<Cuerpo['tipo'], string> = {
  frentes: 'Puertas / cajones',
  horno: 'Horno empotrado',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
};

function tiposPermitidos(p: Plantilla): Cuerpo['tipo'][] {
  if (p === 'cocina') return ['frentes', 'horno', 'hueco'];
  if (p === 'cocina-infantil') return ['frentes', 'horno'];
  if (p === 'escritorio') return ['frentes', 'escritorio'];
  return ['frentes'];
}

function medida(f: Frente, unidad: Unidad) {
  return `${formatear(f.rect.x1 - f.rect.x0, unidad, false)} × ${formatear(f.rect.y1 - f.rect.y0, unidad)}`;
}

function CabeceraCuerpo({ d, i, unidad }: { d: Diseno; i: number; unidad: Unidad }) {
  const c = d.cuerpos[i];
  return (
    <header className="tarjeta-cuerpo-cabeza">
      <span className="numero-cuerpo">{i + 1}</span>
      <strong>Cuerpo {i + 1}</strong>
      <span className="tenue">{formatear(c.ancho, unidad)}</span>
    </header>
  );
}

// ---------- Puertas ----------

export function PestanaPuertas({ d, unidad, cambiar }: PropsPestana) {
  const l = calcularLayout(d);
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales">
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => cambiar((x) => ({ ...x, tirador: v }))}
          opciones={[
            { valor: 'barra', texto: 'Barra' },
            { valor: 'boton', texto: 'Botón' },
            { valor: 'unero', texto: 'Perfil uñero' },
            { valor: 'sin', texto: 'Sin tirador' },
          ]}
        />
        <p className="ayuda">Las medidas de cada puerta aparecen sobre el modelo 3D. Haz clic en una puerta para abrirla.</p>
      </div>
      <div className="lista-cuerpos">
        {d.cuerpos.map((c, i) => {
          if (c.tipo !== 'frentes')
            return (
              <article key={c.id} className="tarjeta-cuerpo apagada">
                <CabeceraCuerpo d={d} i={i} unidad={unidad} />
                <p className="tenue">{NOMBRE_TIPO[c.tipo]}: sin puertas.</p>
              </article>
            );
          const puertas = l.frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === i);
          return (
            <article key={c.id} className="tarjeta-cuerpo">
              <CabeceraCuerpo d={d} i={i} unidad={unidad} />
              <Contador etiqueta="Puertas" valor={c.puertas} max={4} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { puertas: v }))} />
              {c.puertas === 1 && (
                <Segmentado
                  etiqueta="Bisagra"
                  valor={c.bisagra}
                  onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { bisagra: v }))}
                  opciones={[
                    { valor: 'izq', texto: 'Izquierda' },
                    { valor: 'der', texto: 'Derecha' },
                  ]}
                />
              )}
              {puertas.length > 0 && (
                <ul className="medidas-frentes">
                  {puertas.map((f) => (
                    <li key={f.indice}>
                      <span>Puerta {f.indice + 1}</span>
                      <strong>{medida(f, unidad)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {c.puertas > 0 && puertas.length === 0 && <p className="tenue">No queda alto para puertas: reduce los cajones.</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Cajones ----------

export function PestanaCajones({ d, unidad, cambiar }: PropsPestana) {
  if (d.plantilla === 'tocador') return <CajonesTocador d={d} unidad={unidad} cambiar={cambiar} />;
  const l = calcularLayout(d);
  const fila = l.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === -1);
  return (
    <div className="pestana-contenido">
      {d.plantilla === 'comoda' && (
        <div className="opciones-globales">
          <Contador
            etiqueta="Cajones pequeños en fila superior"
            valor={d.filaSuperior}
            max={4}
            onCambio={(v) => cambiar((x) => ({ ...x, filaSuperior: v }))}
          />
          {fila.length > 0 && <p className="ayuda">Cada uno mide {medida(fila[0], unidad)}.</p>}
        </div>
      )}
      <div className="lista-cuerpos">
        {d.cuerpos.map((c, i) => {
          if (c.tipo !== 'frentes')
            return (
              <article key={c.id} className="tarjeta-cuerpo apagada">
                <CabeceraCuerpo d={d} i={i} unidad={unidad} />
                <p className="tenue">{NOMBRE_TIPO[c.tipo]}: sin cajones.</p>
              </article>
            );
          const cajones = l.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === i);
          return (
            <article key={c.id} className="tarjeta-cuerpo">
              <CabeceraCuerpo d={d} i={i} unidad={unidad} />
              <Contador etiqueta="Cajones" valor={c.cajones} max={12} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { cajones: v }))} />
              {c.cajones > 1 && (
                <Segmentado
                  etiqueta="Columnas"
                  valor={String(c.columnasCajones) as '1' | '2'}
                  onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { columnasCajones: v === '2' ? 2 : 1 }))}
                  opciones={[
                    { valor: '1', texto: '1 columna' },
                    { valor: '2', texto: '2 columnas' },
                  ]}
                />
              )}
              {c.cajones > 0 && (
                <>
                  <Segmentado
                    etiqueta="Alto de cada cajón"
                    valor={c.altoCajon > 0 ? 'fijo' : 'auto'}
                    onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { altoCajon: v === 'fijo' ? 180 : 0 }))}
                    opciones={[
                      { valor: 'auto', texto: 'Automático' },
                      { valor: 'fijo', texto: 'A medida' },
                    ]}
                  />
                  {c.altoCajon > 0 && (
                    <CampoMedida
                      etiqueta="Alto del frente"
                      compacto
                      valor={c.altoCajon}
                      unidad={unidad}
                      min={90}
                      max={600}
                      onCambio={(mm) => cambiar((x) => actualizarCuerpo(x, i, { altoCajon: mm }), `alto-cajon-${i}`)}
                    />
                  )}
                </>
              )}
              {cajones.length > 0 && (
                <ul className="medidas-frentes">
                  {cajones.map((f) => (
                    <li key={f.indice}>
                      <span>Cajón {f.indice + 1}</span>
                      <strong>{medida(f, unidad)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {cajones.length < c.cajones && <p className="aviso-texto">Solo caben {cajones.length} cajones con ese alto.</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CajonesTocador({ d, unidad, cambiar }: PropsPestana) {
  const l = calcularLayoutTocador(d);
  const grupos: { clave: 'cajonesIzq' | 'cajonesCentro' | 'cajonesDer'; nombre: string; cuerpo: number; max: number }[] = [
    { clave: 'cajonesIzq', nombre: 'Cajonera izquierda', cuerpo: 0, max: 6 },
    { clave: 'cajonesCentro', nombre: 'Cajones centrales', cuerpo: 1, max: 3 },
    { clave: 'cajonesDer', nombre: 'Cajonera derecha', cuerpo: 2, max: 6 },
  ];
  return (
    <div className="pestana-contenido">
      <div className="lista-cuerpos">
        {grupos.map((g) => {
          const cajones = l.frentes.filter((f) => f.cuerpo === g.cuerpo);
          return (
            <article key={g.clave} className="tarjeta-cuerpo">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>{g.nombre}</strong>
              </header>
              <Contador
                etiqueta="Cajones"
                valor={d.tocador[g.clave]}
                max={g.max}
                onCambio={(v) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, [g.clave]: v } }))}
              />
              {cajones.length > 0 && (
                <ul className="medidas-frentes">
                  {cajones.map((f, k) => (
                    <li key={f.indice}>
                      <span>Cajón {k + 1}</span>
                      <strong>{medida(f, unidad)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Módulos y espacios ----------

export function PestanaModulos({ d, unidad, cambiar }: PropsPestana) {
  if (d.plantilla === 'tocador') return <EstructuraTocador d={d} unidad={unidad} cambiar={cambiar} />;
  const tipos = tiposPermitidos(d.plantilla);
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales espacios">
        <CampoMedida
          etiqueta="Separación entre cuerpos"
          compacto
          valor={d.separacionCuerpos}
          unidad={unidad}
          paso={unidad === 'cm' ? 5 : 1}
          min={0}
          max={200}
          onCambio={(mm) => cambiar((x) => fijarSeparacion(x, mm), 'separacion')}
        />
        <CampoMedida
          etiqueta="Luz entre frentes"
          compacto
          valor={d.luzFrentes}
          unidad="mm"
          paso={1}
          min={1}
          max={10}
          onCambio={(mm) => cambiar((x) => ({ ...x, luzFrentes: mm }), 'luz')}
        />
        <CampoMedida
          etiqueta="Zócalo"
          compacto
          valor={d.zocalo}
          unidad={unidad}
          paso={unidad === 'cm' ? 5 : 1}
          min={0}
          max={200}
          onCambio={(mm) => cambiar((x) => ({ ...x, zocalo: mm }), 'zocalo')}
        />
        <Segmentado
          etiqueta="Espesor melamina"
          valor={String(d.espesor) as '15' | '18'}
          onCambio={(v) => cambiar((x) => ({ ...x, espesor: v === '18' ? 18 : 15 }))}
          opciones={[
            { valor: '15', texto: '15 mm' },
            { valor: '18', texto: '18 mm' },
          ]}
        />
      </div>
      <div className="lista-cuerpos">
        {d.cuerpos.map((c, i) => (
          <article key={c.id} className={`tarjeta-cuerpo${c.tipo === 'hueco' ? ' hueco' : ''}`}>
            <header className="tarjeta-cuerpo-cabeza">
              <span className="numero-cuerpo">{i + 1}</span>
              <strong>Cuerpo {i + 1}</strong>
              <span className="acciones-cuerpo">
                <button type="button" className="boton-icono" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => cambiar((x) => moverCuerpo(x, i, -1))}>
                  <IcoIzq width={15} height={15} />
                </button>
                <button
                  type="button"
                  className="boton-icono"
                  aria-label="Mover a la derecha"
                  disabled={i === d.cuerpos.length - 1}
                  onClick={() => cambiar((x) => moverCuerpo(x, i, 1))}
                >
                  <IcoDer width={15} height={15} />
                </button>
                <button
                  type="button"
                  className="boton-icono peligro"
                  aria-label={`Quitar cuerpo ${i + 1}`}
                  disabled={d.cuerpos.length <= 1}
                  onClick={() => cambiar((x) => quitarCuerpo(x, i))}
                >
                  <IcoBasura width={15} height={15} />
                </button>
              </span>
            </header>
            {tipos.length > 1 && (
              <Selector
                etiqueta="Tipo"
                valor={c.tipo}
                opciones={tipos.map((t) => ({ valor: t, texto: NOMBRE_TIPO[t] }))}
                onCambio={(v) =>
                  cambiar((x) =>
                    actualizarCuerpo(x, i, {
                      tipo: v,
                      ...(v === 'frentes' ? { puertas: 1 } : {}),
                      ...(v === 'escritorio' ? { alto: 750 } : { alto: 0 }),
                    }),
                  )
                }
              />
            )}
            <CampoMedida
              etiqueta="Ancho"
              compacto
              valor={c.ancho}
              unidad={unidad}
              min={c.tipo === 'hueco' ? 100 : ANCHO_MIN_CUERPO}
              max={1500}
              onCambio={(mm) => cambiar((x) => actualizarCuerpo(x, i, { ancho: mm }), `ancho-cuerpo-${c.id}`)}
            />
            {c.tipo === 'escritorio' && (
              <CampoMedida
                etiqueta="Alto del escritorio"
                compacto
                valor={c.alto || 750}
                unidad={unidad}
                min={450}
                max={Math.min(900, d.alto)}
                onCambio={(mm) => cambiar((x) => actualizarCuerpo(x, i, { alto: mm }), `alto-esc-${c.id}`)}
              />
            )}
            {c.tipo === 'hueco' && <p className="tenue">Hueco libre para lavadora, refrigerador u otro equipo. La cubierta pasa por encima.</p>}
            {c.tipo === 'horno' && d.plantilla === 'cocina' && <p className="tenue">Horno empotrado de 60 cm con faja de melamina superior.</p>}
          </article>
        ))}
        <article className="tarjeta-cuerpo agregar">
          <header className="tarjeta-cuerpo-cabeza">
            <strong>Agregar cuerpo</strong>
          </header>
          {tipos.map((t) => (
            <button key={t} type="button" className="boton secundario chico" onClick={() => cambiar((x) => agregarCuerpo(x, t))}>
              <IcoMas width={14} height={14} /> {NOMBRE_TIPO[t]}
            </button>
          ))}
        </article>
      </div>
    </div>
  );
}

function EstructuraTocador({ d, unidad, cambiar }: PropsPestana) {
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales espacios">
        <CampoMedida
          etiqueta="Alto de la cubierta"
          compacto
          valor={d.tocador.altoCubierta}
          unidad={unidad}
          min={450}
          max={Math.min(900, d.alto - 400)}
          onCambio={(mm) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, altoCubierta: mm } }), 'alto-cubierta')}
        />
        <CampoMedida
          etiqueta="Luz entre frentes"
          compacto
          valor={d.luzFrentes}
          unidad="mm"
          paso={1}
          min={1}
          max={10}
          onCambio={(mm) => cambiar((x) => ({ ...x, luzFrentes: mm }), 'luz')}
        />
        <Segmentado
          etiqueta="Espesor melamina"
          valor={String(d.espesor) as '15' | '18'}
          onCambio={(v) => cambiar((x) => ({ ...x, espesor: v === '18' ? 18 : 15 }))}
          opciones={[
            { valor: '15', texto: '15 mm' },
            { valor: '18', texto: '18 mm' },
          ]}
        />
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => cambiar((x) => ({ ...x, tirador: v }))}
          opciones={[
            { valor: 'boton', texto: 'Botón' },
            { valor: 'barra', texto: 'Barra' },
            { valor: 'unero', texto: 'Uñero' },
            { valor: 'sin', texto: 'Sin' },
          ]}
        />
      </div>
    </div>
  );
}

// ---------- Equipamiento / interior / extras ----------

export function PestanaEquipamiento({ d, unidad, cambiar }: PropsPestana) {
  const opcionesCuerpos = d.cuerpos.map((c, i) => ({ valor: i, texto: `Cuerpo ${i + 1} · ${formatear(c.ancho, unidad)}` }));
  if (d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil') {
    const k = d.cocina;
    const set = (cambios: Partial<Diseno['cocina']>) => cambiar((x) => ({ ...x, cocina: { ...x.cocina, ...cambios } }));
    const infantil = d.plantilla === 'cocina-infantil';
    return (
      <div className="pestana-contenido">
        <div className="lista-cuerpos">
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Encimera a gas</strong>
            </header>
            <Segmentado
              valor={k.encimera}
              onCambio={(v) => set({ encimera: v })}
              opciones={[
                { valor: 'ninguna', texto: 'Sin' },
                { valor: '2', texto: '2 platos' },
                { valor: '3', texto: '3 platos' },
                { valor: '4', texto: '4 platos' },
              ]}
            />
            {k.encimera !== 'ninguna' && <Selector etiqueta="Sobre el" valor={k.encimeraCuerpo} opciones={opcionesCuerpos} onCambio={(v) => set({ encimeraCuerpo: v })} />}
          </article>
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Lavaplatos</strong>
            </header>
            <Segmentado
              valor={k.lavaplatos}
              onCambio={(v) => set({ lavaplatos: v })}
              opciones={
                infantil
                  ? [
                      { valor: 'ninguno', texto: 'Sin' },
                      { valor: 'simple', texto: 'Con lavaplatos' },
                    ]
                  : [
                      { valor: 'ninguno', texto: 'Sin' },
                      { valor: 'simple', texto: '1 cubeta' },
                      { valor: 'doble', texto: '2 cubetas' },
                    ]
              }
            />
            {k.lavaplatos !== 'ninguno' && (
              <>
                <Selector etiqueta="Sobre el" valor={k.lavaplatosCuerpo} opciones={opcionesCuerpos} onCambio={(v) => set({ lavaplatosCuerpo: v })} />
                <Segmentado
                  etiqueta="Grifería"
                  valor={k.grifo}
                  onCambio={(v) => set({ grifo: v })}
                  opciones={[
                    { valor: 'negro', texto: 'Negro mate' },
                    { valor: 'cromado', texto: 'Cromado' },
                  ]}
                />
              </>
            )}
          </article>
          {!infantil && (
            <article className="tarjeta-cuerpo ancha">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>Cubierta postformada</strong>
              </header>
              <Segmentado
                etiqueta="Espesor"
                valor={String(k.espesorCubierta) as '28' | '30' | '38'}
                onCambio={(v) => set({ espesorCubierta: Number(v) })}
                opciones={[
                  { valor: '28', texto: '28 mm' },
                  { valor: '30', texto: '30 mm' },
                  { valor: '38', texto: '38 mm' },
                ]}
              />
              <CampoMedida
                etiqueta="Vuelo frontal"
                compacto
                valor={k.vueloCubierta}
                unidad="mm"
                paso={5}
                min={0}
                max={60}
                onCambio={(mm) => set({ vueloCubierta: mm })}
              />
              <Interruptor activo={k.copete} onCambio={(v) => set({ copete: v })} texto="Copete trasero" />
            </article>
          )}
          {!infantil && (
            <article className="tarjeta-cuerpo ancha">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>Horno empotrado</strong>
              </header>
              <p className="tenue">
                {d.cuerpos.some((c) => c.tipo === 'horno')
                  ? 'Tu mueble lleva horno. Puedes moverlo o quitarlo en Módulos y espacios.'
                  : 'Agrega un cuerpo de 60 cm preparado para horno empotrado.'}
              </p>
              {!d.cuerpos.some((c) => c.tipo === 'horno') && (
                <button type="button" className="boton secundario chico" onClick={() => cambiar((x) => agregarCuerpo(x, 'horno'))}>
                  <IcoMas width={14} height={14} /> Agregar horno
                </button>
              )}
            </article>
          )}
        </div>
      </div>
    );
  }

  if (d.plantilla === 'tocador') {
    const t = d.tocador;
    const set = (cambios: Partial<Diseno['tocador']>) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, ...cambios } }));
    return (
      <div className="pestana-contenido">
        <div className="opciones-globales espacios">
          <Segmentado
            etiqueta="Espejo"
            valor={t.espejo}
            onCambio={(v) => set({ espejo: v })}
            opciones={[
              { valor: 'ovalado', texto: 'Ovalado LED' },
              { valor: 'hollywood', texto: 'Hollywood' },
              { valor: 'rectangular', texto: 'Rectangular LED' },
            ]}
          />
          <Segmentado
            etiqueta="Tono de luz"
            valor={t.luz}
            onCambio={(v) => set({ luz: v })}
            opciones={[
              { valor: 'calida', texto: 'Cálida' },
              { valor: 'neutra', texto: 'Neutra' },
              { valor: 'fria', texto: 'Fría' },
            ]}
          />
          <Interruptor activo={t.repisasLaterales} onCambio={(v) => set({ repisasLaterales: v })} texto="Repisas laterales" />
        </div>
      </div>
    );
  }

  if (d.plantilla === 'comoda') {
    return (
      <div className="pestana-contenido">
        <div className="opciones-globales espacios">
          <Interruptor activo={d.mudador} onCambio={(v) => cambiar((x) => ({ ...x, mudador: v }))} texto="Mudador para bebé sobre la cubierta" />
        </div>
      </div>
    );
  }

  // Clóset y escritorio: interior de cada cuerpo.
  return (
    <div className="pestana-contenido">
      <div className="lista-cuerpos">
        {d.cuerpos.map((c, i) =>
          c.tipo === 'frentes' ? (
            <article key={c.id} className="tarjeta-cuerpo">
              <CabeceraCuerpo d={d} i={i} unidad={unidad} />
              <Contador etiqueta="Repisas" valor={c.repisas} max={8} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { repisas: v }))} />
              <Interruptor activo={c.colgador} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { colgador: v }))} texto="Barra para colgar" />
              {c.colgador && <p className="tenue">Con barra se usa una repisa superior y el resto queda para colgar.</p>}
            </article>
          ) : (
            <article key={c.id} className="tarjeta-cuerpo apagada">
              <CabeceraCuerpo d={d} i={i} unidad={unidad} />
              <p className="tenue">{NOMBRE_TIPO[c.tipo]}</p>
            </article>
          ),
        )}
      </div>
      <p className="ayuda">Usa «Abrir puertas» en el visor para ver el interior.</p>
    </div>
  );
}
